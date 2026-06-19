import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORTAL_ORIGIN = "http://qypt.shasteel.cn";
const PORTAL_API = `${PORTAL_ORIGIN}/mobilePortal`;
const PORTAL_HOME = `${PORTAL_ORIGIN}/mobile-apps/`;
const PORTAL_SIGNIN = `${PORTAL_ORIGIN}/mobile-apps/signin`;
const ANSWER_CACHE = path.join(__dirname, "answer-cache.json");
const STORAGE_STATE = path.join(__dirname, "storage-state.json");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const config = {
  username: process.env.SHASTEEL_USERNAME,
  password: process.env.SHASTEEL_PASSWORD,
  headless: process.env.HEADLESS !== "false",
  slowMo: Number(process.env.SLOW_MO_MS || 0),
  appName: process.env.PRACTICE_APP_NAME || "每日一练",
  maxQuestions: Number(process.env.MAX_QUESTIONS || 10),
  timeoutMs: Number(process.env.TIMEOUT_MS || 30000),
};

function requireConfig() {
  const missing = [];
  if (!config.username) missing.push("SHASTEEL_USERNAME");
  if (!config.password) missing.push("SHASTEEL_PASSWORD");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function portalPassword(password) {
  return crypto.createHash("md5").update(password).digest("base64");
}

function userToken(token) {
  return crypto.createHash("sha256").update(`${token}shasteel`).digest("hex");
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 500)}`);
  }
  return body;
}

async function portalLogin() {
  const body = await jsonFetch(`${PORTAL_API}/login`, {
    method: "POST",
    body: JSON.stringify({
      userName: config.username,
      password: portalPassword(config.password),
    }),
  });
  if (!body?.data?.userUniqueToken) {
    throw new Error(`Login did not return a token: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return {
    userName: body.data.userName || config.username,
    token: body.data.userUniqueToken,
  };
}

async function portalRequest(user, url, options = {}) {
  return jsonFetch(`${PORTAL_API}${url}`, {
    ...options,
    headers: {
      userName: user.userName,
      userToken: userToken(user.token),
      ...(options.headers || {}),
    },
  });
}

async function findPracticeUrl(user) {
  const apps = await portalRequest(user, "/app/my", { method: "GET" });
  const list = Array.isArray(apps?.data) ? apps.data : [];
  const app = list.find((item) => item.appName?.includes(config.appName));
  if (!app) {
    const names = list.map((item) => item.appName).filter(Boolean).join(", ");
    throw new Error(`Could not find app "${config.appName}". Available apps: ${names}`);
  }

  const redirect = await portalRequest(user, `/third/redirect?appId=${encodeURIComponent(app.id)}`, {
    method: "POST",
    headers: { appId: app.appId },
  });
  const accessToken = redirect?.data?.appAccessToken;
  if (!accessToken) {
    throw new Error(`Could not get appAccessToken: ${JSON.stringify(redirect).slice(0, 500)}`);
  }

  const separator = app.appLaunchSchema.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    userNumber: user.userName,
    token: accessToken,
    appId: app.appId || "null",
  });
  return `${app.appLaunchSchema}${separator}${params.toString()}`;
}

async function getStoredUser(page) {
  await page.goto(PORTAL_HOME, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
  const user = await page
    .evaluate(() => {
      const raw = localStorage.getItem("UserData");
      return raw ? JSON.parse(raw) : null;
    })
    .catch(() => null);

  if (user?.userName && user?.token) {
    return user;
  }
  return null;
}

async function loginWithSigninPage(page) {
  await page.goto(PORTAL_SIGNIN, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => {});

  const inputs = page.locator("input");
  const inputCount = await inputs.count();
  if (inputCount < 2) {
    throw new Error(`Signin page did not expose username/password inputs. Found ${inputCount} inputs.`);
  }

  await inputs.nth(0).fill(config.username);
  await inputs.nth(1).fill(config.password);

  const remember = page.getByText("记住我", { exact: false }).first();
  if (await remember.isVisible({ timeout: 1000 }).catch(() => false)) {
    await remember.click().catch(() => {});
  }

  const loginButton = page.getByRole("button", { name: /登录/ }).first();
  if (await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginButton.click();
  } else if (!(await clickByText(page, ["登录"], { timeout: 3000 }))) {
    throw new Error("Could not find the signin submit button.");
  }

  await page.waitForURL((url) => !url.pathname.endsWith("/signin"), {
    timeout: config.timeoutMs,
  }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => {});

  const user = await getStoredUser(page);
  if (!user) {
    const body = normalizeText(await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""));
    throw new Error(`Signin page login did not produce UserData. Current page text: ${body.slice(0, 300)}`);
  }
  return user;
}

async function resolveUser(page) {
  const stored = await getStoredUser(page);
  if (stored) {
    console.log("Using existing portal login state.");
    return stored;
  }

  try {
    const user = await portalLogin();
    await page.goto(PORTAL_HOME, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
    await page.evaluate((userData) => localStorage.setItem("UserData", JSON.stringify(userData)), user);
    console.log("Logged in through portal API.");
    return user;
  } catch (error) {
    console.warn(`Portal API login failed, falling back to signin page: ${error.message}`);
  }

  const user = await loginWithSigninPage(page);
  console.log("Logged in through signin page.");
  return user;
}

async function readAnswerCache() {
  try {
    return JSON.parse(await fs.readFile(ANSWER_CACHE, "utf8"));
  } catch {
    return {};
  }
}

async function writeAnswerCache(cache) {
  await fs.writeFile(ANSWER_CACHE, `${JSON.stringify(cache, null, 2)}\n`);
}

async function clickByText(page, patterns, options = {}) {
  for (const pattern of patterns) {
    const locator = page.getByText(pattern, { exact: false }).first();
    if (await locator.isVisible({ timeout: 1200 }).catch(() => false)) {
      await locator.click(options);
      return true;
    }
  }
  return false;
}

async function openPracticePage(page, practiceUrl) {
  await page.goto(practiceUrl, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => {});
  await clickByText(page, ["开始答题", "继续答题", "重新答题", "去答题"], { timeout: 5000 });
  await waitForQuestionOptions(page);
}

async function waitForQuestionOptions(page) {
  await page
    .waitForFunction(
      () => [...document.querySelectorAll("*")].some((el) => /^\s*A\s*[:：.、]/.test(el.textContent || "")),
      null,
      { timeout: config.timeoutMs },
    )
    .catch(async () => {
      const body = normalizeText(await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""));
      throw new Error(`Question options did not appear. Current page text: ${body.slice(0, 300)}`);
    });
}

async function visibleOptionLocators(page) {
  const selectors = [
    "[role='radio']",
    "[role='checkbox']",
    ".adm-radio",
    ".adm-checkbox",
    ".van-radio",
    ".van-checkbox",
    ".nut-radio",
    ".nut-checkbox",
    "label",
    "li",
    ".option",
    ".answer",
  ];
  const locators = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await item.isVisible().catch(() => false)) {
        const text = normalizeText(await item.innerText().catch(() => ""));
        if (/^[A-D][.、\s]|选项|正确|错误|是|否|同意|不同意|可以|不可以/.test(text) || text.length > 0) {
          locators.push({ item, text });
        }
      }
    }
  }
  return dedupeLocators(locators);
}

function dedupeLocators(items) {
  const seen = new Set();
  const result = [];
  for (const entry of items) {
    const key = entry.text;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function optionLetter(text) {
  return normalizeText(text).match(/^([A-D])(?:[.、:：\s]|$)/)?.[1];
}

function questionKey(text, index) {
  const normalized = normalizeText(text)
    .replace(/第\s*\d+\s*题/g, "")
    .replace(/^\d+[.、\s]*/, "")
    .slice(0, 80);
  return normalized || `question-${index + 1}`;
}

async function visibleQuestionTexts(page) {
  const text = await page.locator("body").innerText({ timeout: 5000 });
  const lines = text.split(/\n+/).map(normalizeText).filter(Boolean);
  const questions = [];
  for (const line of lines) {
    if (/^(第\s*)?\d+\s*[.、题]/.test(line) || /[？?]$/.test(line)) {
      questions.push(line);
    }
  }
  return questions.slice(0, config.maxQuestions);
}

async function currentOptionChoices(page) {
  const choices = [];
  for (const letter of ["A", "B", "C", "D"]) {
    const locator = page.getByText(new RegExp(`^\\s*${letter}\\s*[:：.、]`)).first();
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      choices.push({
        letter,
        text: normalizeText(await locator.innerText().catch(() => "")),
        item: locator,
      });
    }
  }
  return choices;
}

async function chooseCurrentAnswer(page, index, answerBook = {}) {
  const questions = await visibleQuestionTexts(page);
  const options = await currentOptionChoices(page);
  if (!options.length) {
    throw new Error("Could not find visible A/B/C/D options on the current question.");
  }

  const key = questionKey(questions[0] || "", index);
  const knownAnswer = answerBook[key];
  let choice = null;

  if (knownAnswer) {
    choice = options.find(({ text, letter }) => text.includes(knownAnswer) || letter === knownAnswer);
  }
  choice ||= options[Math.floor(Math.random() * options.length)];

  await choice.item.click({ timeout: 5000 }).catch(async () => {
    await choice.item.locator("xpath=ancestor-or-self::*[self::label or self::li or self::div][1]").click();
  });
  await page.waitForTimeout(200);
}

async function chooseAnswers(page, answerBook = {}) {
  for (let i = 0; i < config.maxQuestions; i += 1) {
    await chooseCurrentAnswer(page, i, answerBook);
    if (i < config.maxQuestions - 1) {
      const moved = await clickByText(page, ["下一题"], { timeout: 5000 });
      if (!moved) throw new Error(`Could not move to question ${i + 2}.`);
      await page.waitForTimeout(500);
    }
  }
}

async function submit(page) {
  const clicked = await clickByText(page, ["提交", "交卷", "完成", "确认提交", "提交答案"], { timeout: 5000 });
  if (!clicked) throw new Error("Could not find a submit button");
  await clickByText(page, ["确定", "确认", "是"], { timeout: 3000 });
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function isCompleted(page) {
  const body = normalizeText(await page.locator("body").innerText({ timeout: 5000 }));
  return /已完成|全对|满分|100\s*分|完成练习/.test(body) && !/未完成|待完成|错题/.test(body);
}

async function extractCorrectAnswers(page) {
  const body = await page.locator("body").innerText({ timeout: 5000 });
  const lines = body.split(/\n+/).map(normalizeText).filter(Boolean);
  const answers = {};
  let currentQuestion = null;
  let questionIndex = -1;

  for (const line of lines) {
    if (/^(第\s*)?\d+\s*[.、题]/.test(line) || /[？?]$/.test(line)) {
      questionIndex += 1;
      currentQuestion = questionKey(line, questionIndex);
      continue;
    }

    const answerMatch = line.match(/(?:正确答案|答案)[:：\s]*([A-D]|[^，。；;]+)/);
    if (currentQuestion && answerMatch) {
      answers[currentQuestion] = normalizeText(answerMatch[1]);
    }
  }

  return answers;
}

async function saveFailureArtifact(page, label) {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshot = path.join(SCREENSHOT_DIR, `${stamp}-${label}.png`);
  const textFile = path.join(SCREENSHOT_DIR, `${stamp}-${label}.txt`);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch((error) => String(error));
  await fs.writeFile(textFile, text);
  console.error(`Saved failure artifacts:\n- ${screenshot}\n- ${textFile}`);
}

async function main() {
  requireConfig();
  const cache = await readAnswerCache();
  const today = new Date().toISOString().slice(0, 10);
  const answerBook = cache[today] || {};

  const browser = await chromium.launch({ headless: config.headless, slowMo: config.slowMo });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await fs.access(STORAGE_STATE).then(() => STORAGE_STATE).catch(() => undefined),
  });
  const page = await context.newPage();

  try {
    const user = await resolveUser(page);
    const practiceUrl = await findPracticeUrl(user);
    console.log(`Resolved practice URL for ${config.appName}.`);

    await openPracticePage(page, practiceUrl);
    await chooseAnswers(page, answerBook);
    await submit(page);

    if (!(await isCompleted(page))) {
      const discovered = await extractCorrectAnswers(page);
      cache[today] = { ...answerBook, ...discovered };
      await writeAnswerCache(cache);

      console.log(`First attempt not complete. Learned ${Object.keys(discovered).length} answers; retrying.`);
      await openPracticePage(page, practiceUrl);
      await chooseAnswers(page, cache[today]);
      await submit(page);
    }

    if (!(await isCompleted(page))) {
      await saveFailureArtifact(page, "not-completed");
      throw new Error("Practice was submitted but did not reach completed/full-score state.");
    }

    await context.storageState({ path: STORAGE_STATE });
    console.log("Daily practice completed.");
  } catch (error) {
    await saveFailureArtifact(page, "error");
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
