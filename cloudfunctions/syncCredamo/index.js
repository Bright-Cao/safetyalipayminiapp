// 云函数：同步 Credamo 学习完成状态
// 接口：POST https://www.credamo.com/v1/cleanVar/dataOverview
// 双写机制：1) credamo_completions (按手机号永久存储) 2) training_records (可选，需有 application 匹配)
const https = require('https');

            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ success: false, message: data }); }
            });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

async function getCredamoCookie() {
    const res = await db.collection(COLL_CONFIG).where({ key: 'credamo_cookie' }).limit(1).get();
    if (!res.data.length || !res.data[0].session) {
        throw new Error('未配置 Credamo Cookie，请先调用 action=saveCookie 保存');
    }
    const cfg = res.data[0];
    try {
        // 检查 expiry_time（10小时内有效）
        if (cfg.expiry_time) {
            const hoursLeft = (new Date(cfg.expiry_time) - Date.now()) / 3600000;
            if (hoursLeft <= 0) console.warn('Cookie 已过期（存储时间: ' + cfg.expiry_time + '）');
            else if (hoursLeft < 2) console.warn('Cookie 即将过期，还剩 ' + hoursLeft.toFixed(1) + ' 小时');
        }
    } catch (e) { }
    return [
        'credamo-dms-session=' + cfg.session,
        'credamo-dms-auth=' + cfg.session,
        'dm_dfh=' + cfg.dm_dfh,
        'predamo-dms-user-info=' + cfg.user_info,
        'credamo-unique-cookie=' + (cfg.unique_cookie || ''),
    ].join('; ');
}

async function syncPageRecords(records) {
    let saved = 0, matched = 0, updated = 0, skipped = 0;

    // status=3 且有手机号
    const validRecords = records.filter(r =>
        (r.status === 3 || r.status === '3') && String(r[FIELD.PHONE] || '').trim()
    );
    skipped += records.length - validRecords.length;
    if (validRecords.length === 0) return { saved, matched, updated, skipped };

    const now = new Date().toISOString();
    const phones = [...new Set(validRecords.map(r => String(r[FIELD.PHONE]).trim()))];

    // ── A. 查已有 credamo_completions ─────────────────────────────
    const existingCompMap = {};
    for (let i = 0; i < phones.length; i += 50) {
        const res = await db.collection(COLL_COMPLETION)
            .where({ phone: _.in(phones.slice(i, i + 50)) }).limit(50)
            .field({ _id: true, phone: true }).get();
        for (const r of res.data) existingCompMap[r.phone] = r._id;
    }

    // ── B. 并行写入 credamo_completions ───────────────────────────
    const saveResults = await Promise.all(validRecords.map(async row => {
        const phone = String(row[FIELD.PHONE]).trim();
        const data = {
            phone,
            name: String(row[FIELD.NAME] || '').trim(),
            company: String(row[FIELD.COMPANY] || '').trim(),
            workshop: String(row[FIELD.WORKSHOP] || '').trim(),
            score: parseFloat(row[FIELD.TOTAL_SCORE]) || 0,
            watch_video: row[FIELD.WATCH_VIDEO] === '1' || row[FIELD.WATCH_VIDEO] === 1,
            answer_id: row.answerId || '',
            finish_time: row.answerEndTime || '',
            survey_id: SURVEY_ID,
            sync_time: now,
            update_time: db.serverDate(),
        };
        try {
            if (existingCompMap[phone]) {
                await db.collection(COLL_COMPLETION).doc(existingCompMap[phone]).update({ data });
            } else {
                await db.collection(COLL_COMPLETION).add({ data: { ...data, create_time: db.serverDate() } });
            }
            return 1;
        } catch (e) {
            console.error('写completions失败 ' + phone + ': ' + e.message);
            return 0;
        }
    }));
    saved = saveResults.reduce((a, b) => a + b, 0);
    console.log('completions写入: ' + saved + '/' + validRecords.length);

    // ── C. 批量查 applications（可选匹配）────────────────────────
    const phoneMap = {};
    for (let i = 0; i < phones.length; i += 50) {
        const res = await db.collection(COLL_APP)
            .where({ phone: _.in(phones.slice(i, i + 50)) }).limit(50)
            .field({ _id: true, phone: true }).get();
        for (const a of res.data) phoneMap[a.phone] = a._id;
    }
    matched = Object.keys(phoneMap).length;

    // ── D. 更新 training_records ──────────────────────────────────
    if (matched > 0) {
        const appIds = Object.values(phoneMap);
        const existingTrMap = {};
        for (let i = 0; i < appIds.length; i += 50) {
            const res = await db.collection(COLL_TRAINING)
                .where({ application_id: _.in(appIds.slice(i, i + 50)) }).limit(50)
                .field({ _id: true, application_id: true }).get();
            for (const t of res.data) existingTrMap[t.application_id] = t._id;
        }
        const trResults = await Promise.all(validRecords.map(async row => {
            const phone = String(row[FIELD.PHONE]).trim();
            const appId = phoneMap[phone];
            if (!appId) return 0;
            const upd = {
                credamo_completed: true,
                credamo_score: parseFloat(row[FIELD.TOTAL_SCORE]) || 0,
                credamo_watch_video: row[FIELD.WATCH_VIDEO] === '1' || row[FIELD.WATCH_VIDEO] === 1,
                credamo_answer_id: row.answerId || '',
                credamo_finish_time: row.answerEndTime || '',
                credamo_sync_time: now,
                update_time: db.serverDate(),
            };
            try {
                const rid = existingTrMap[appId];
                if (rid) {
                    await db.collection(COLL_TRAINING).doc(rid).update({ data: upd });
                } else {
                    await db.collection(COLL_TRAINING).add({ data: { application_id: appId, create_time: db.serverDate(), ...upd } });
                }
                return 1;
            } catch (e) { return 0; }
        }));
        updated = trResults.reduce((a, b) => a + b, 0);
    }

    return { saved, matched, updated, skipped };
}

exports.main = async (event, context) => {
    const { action } = event;

    if (action === 'saveCookie') {
        try {
            const { session, dm_dfh, user_info, unique_cookie } = event;
            if (!session || !dm_dfh || !user_info) return { success: false, message: '请传入 session、dm_dfh、user_info 字段' };
            let existing = { data: [] };
            try { existing = await db.collection(COLL_CONFIG).where({ key: 'credamo_cookie' }).limit(1).get(); } catch (e) { }
            // 固定 10 小时过期
            const expiryTime = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
            const data = { session, dm_dfh, user_info, unique_cookie: unique_cookie || '', update_time: new Date().toISOString(), expiry_time: expiryTime };
            if (existing.data && existing.data.length) {
                await db.collection(COLL_CONFIG).doc(existing.data[0]._id).update({ data });
            } else {
                await db.collection(COLL_CONFIG).add({ data: { key: 'credamo_cookie', ...data } });
            }
            return { success: true, message: 'Cookie 已保存，于 ' + expiryTime.replace('T', ' ').substring(0, 16) + ' UTC 过期' };
        } catch (e) { return { success: false, message: 'saveCookie 失败: ' + e.message }; }
    }

    // 按手机号查询完成状态（供其他云函数调用）
    if (action === 'checkPhone') {
        const { phone } = event;
        if (!phone) return { success: false, message: '请传入 phone' };
        const res = await db.collection(COLL_COMPLETION).where({ phone }).limit(1).get();
        return { success: true, completed: res.data.length > 0, data: res.data[0] || null };
    }

    let cookie;
    try { cookie = await getCredamoCookie(); }
    catch (e) { return { success: false, message: e.message }; }

    if (action === 'test') {
        try {
            // 读取过期时间
            let expiryInfo = {};
            try {
                const cfg = await db.collection(COLL_CONFIG).where({ key: 'credamo_cookie' }).limit(1).get();
                if (cfg.data.length && cfg.data[0].expiry_time) {
                    const expiry = new Date(cfg.data[0].expiry_time);
                    const rawHours = Math.round((expiry - Date.now()) / 3600000 * 10) / 10;
                    const hoursLeft = rawHours < 0 ? 0 : rawHours;
                    // 转换为北京时间
                    const localExpiry = new Date(expiry.getTime() + 8 * 3600 * 1000)
                        .toISOString().replace('T', ' ').substring(0, 16);
                    expiryInfo = { expiry_time: localExpiry + ' (CST)', hours_left: hoursLeft, expired: rawHours <= 0 };
                }
            } catch (e) { }
            const res = await httpPost(
                'https://www.credamo.com/v1/cleanVar/dataOverview?currPageSize=5&currPageIndex=1',
                { surveyId: SURVEY_ID },
                { Cookie: cookie, Referer: 'https://www.credamo.com/survey.html?surveyId=' + SURVEY_ID }
            );
            return { success: res.success, total: res.total, message: res.message || '', ...expiryInfo };
        } catch (e) { return { success: false, message: e.message }; }
    }

    // 用户自助查询：先查本地，没有则向 Credamo 拉最新一页再查
    if (action === 'selfCheck') {
        const { phone } = event;
        if (!phone) return { success: false, message: '请传入 phone' };

        // 1. 先查本地
        const localRes = await db.collection(COLL_COMPLETION).where({ phone }).limit(1).get();
        if (localRes.data.length > 0) {
            return { success: true, completed: true, source: 'local', data: localRes.data[0] };
        }

        // 2. 本地没有，从 Credamo 拉最新1页（100条）快速查找
        try {
            const referer = 'https://www.credamo.com/survey.html?surveyId=' + SURVEY_ID;
            const apiRes = await httpPost(
                'https://www.credamo.com/v1/cleanVar/dataOverview?currPageSize=100&currPageIndex=1',
                { surveyId: SURVEY_ID },
                { Cookie: cookie, Referer: referer }
            );
            if (apiRes.success) {
                // 把这一页全部存入 completions（并行）
                await syncPageRecords(apiRes.data.rowList || []);
                // 再查一次
                const checkRes = await db.collection(COLL_COMPLETION).where({ phone }).limit(1).get();
                if (checkRes.data.length > 0) {
                    return { success: true, completed: true, source: 'credamo', data: checkRes.data[0] };
                }
            }
        } catch (e) {
            console.error('selfCheck Credamo 请求失败:', e.message);
        }

        // 3. 还是没有
        return { success: true, completed: false, message: '暂未查询到您的完成记录。如已完成学习，请等待5分钟后再次刷新，或联系管理员同步数据。' };
    }

    // 分页同步（默认每页30条保证不超时）
    try {
        const page = event.page || 1;
        const pageSize = event.pageSize || 30;
        const url = 'https://www.credamo.com/v1/cleanVar/dataOverview?currPageSize=' + pageSize + '&currPageIndex=' + page;
        const res = await httpPost(url, { surveyId: SURVEY_ID }, {
            Cookie: cookie,
            Referer: 'https://www.credamo.com/survey.html?surveyId=' + SURVEY_ID
        });
        if (!res.success) {
            if (res.code === '99') throw new Error('Cookie 已过期，请重新登录');
            throw new Error('获取失败: ' + res.message);
        }
        const total = res.total || 0;
        const records = res.data.rowList || [];
        const totalPages = Math.ceil(total / pageSize);
        console.log('获取 ' + records.length + ' 条，共 ' + total + '/' + totalPages + ' 页');

        const result = await syncPageRecords(records);
        return {
            success: true,
            page, totalPages,
            hasMore: page < totalPages,
            message: '第' + page + '/' + totalPages + '页：存' + result.saved + '条，匹配' + result.matched + '个申请，更新' + result.updated + '条，跳过' + result.skipped,
            ...result, total,
        };
    } catch (e) {
        return { success: false, message: e.message };
    }
};
