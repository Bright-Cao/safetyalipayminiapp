const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

// OSS 客户端
let ossClient = null;
if (process.env.ALIYUN_OSS_AK) {
  try {
    ossClient = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_AK,
      accessKeySecret: process.env.ALIYUN_OSS_SK,
      bucket: process.env.ALIYUN_OSS_BUCKET
    });
    console.log('[Upload] OSS client ready.');
  } catch (e) {
    console.error('[Upload] OSS init failed:', e.message);
  }
}

// 本地存储目录
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');
if (!ossClient) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

// 内存中记录 PPT 转换任务状态
const pptTasks = new Map();

// 支持的视频格式
const ALLOWED_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm', '.flv', '.wmv'];
const ALLOWED_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'video/m4v', 'video/webm', 'video/x-flv', 'video/x-ms-wmv', 'application/octet-stream'];

// multer 磁盘存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmpDir = path.join(LOCAL_UPLOAD_DIR, 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error(`不支持的格式 "${ext || file.mimetype}"，支持：${ALLOWED_EXTS.join(' / ')}`));
    }
    cb(null, true);
  }
});

// PPT 文件 Multer 配置
const pptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmpDir = path.join(LOCAL_UPLOAD_DIR, 'tmp_ppt');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const uploadPpt = multer({
  storage: pptStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.pptx', '.ppt'].includes(ext)) {
      return cb(new Error(`仅支持 .pptx 或 .ppt 格式`));
    }
    cb(null, true);
  }
});

// POST /api/upload/video (已有常规视频上传)
router.post('/video', authMiddleware, (req, res, next) => {
  if (!req.user || !['safety_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.json({ success: false, message: '文件过大，最大支持 500MB' });
      }
      return res.json({ success: false, message: err.message || '文件上传处理失败' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '未收到文件，请选择 MP4 视频' });
  }

  const tmpPath = req.file.path;
  const fileId = `videos/${req.file.filename}`;

  try {
    if (ossClient) {
      await ossClient.put(fileId, tmpPath, { mime: 'video/mp4' });
      fs.unlink(tmpPath, () => {});
      const url = ossClient.signatureUrl(fileId, { expires: 7200 });
      return res.json({ success: true, file_id: fileId, url, storage: 'oss' });
    } else {
      const destPath = path.join(LOCAL_UPLOAD_DIR, req.file.filename);
      fs.renameSync(tmpPath, destPath);
      const url = `/uploads/videos/${req.file.filename}`;
      return res.json({
        success: true,
        file_id: fileId,
        url,
        storage: 'local',
        message: '视频已保存到服务器本地'
      });
    }
  } catch (e) {
    fs.unlink(tmpPath, () => {});
    console.error('[Upload] 上传失败:', e);
    return res.json({ success: false, message: '上传失败: ' + e.message });
  }
});

// POST /api/upload/ppt (PPT 转视频处理接口)
router.post('/ppt', authMiddleware, (req, res, next) => {
  if (!req.user || !['safety_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  uploadPpt.single('file')(req, res, (err) => {
    if (err) {
      return res.json({ success: false, message: err.message || 'PPT 上传失败' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '未收到文件，请选择 PPTX 演示文稿' });
  }

  const pptxPath = req.file.path;
  const taskId = `ppt_task_${Date.now()}`;
  const outFileName = `${Date.now()}_ppt_converted.mp4`;
  const outputVideoPath = path.join(LOCAL_UPLOAD_DIR, outFileName);
  const fileId = `videos/${outFileName}`;
  const videoUrl = `/uploads/videos/${outFileName}`;

  // 初始化任务状态
  pptTasks.set(taskId, {
    progress: 5,
    status: '已接收 PPT，准备启动转换...',
    completed: false,
    error: null,
    url: null,
    file_id: null
  });

  // 异步启动 Python 转换进程
  const venvPython = path.join(__dirname, '..', 'ppt2video_env', 'bin', 'python3');
  const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
  const scriptPath = path.join(__dirname, '..', 'services', 'ppt2video', 'converter.py');

  const pyProcess = spawn(pythonBin, [scriptPath, pptxPath, '--output', outputVideoPath]);

  pyProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.progress !== undefined) {
          pptTasks.set(taskId, {
            ...pptTasks.get(taskId),
            progress: parsed.progress,
            status: parsed.status || '转换中...'
          });
        }
        if (parsed.error) {
          pptTasks.set(taskId, {
            ...pptTasks.get(taskId),
            completed: true,
            error: parsed.error,
            status: '转换失败'
          });
        }
      } catch (e) {
        console.log('[PPT2Video Python STDOUT]', line.trim());
      }
    }
  });

  pyProcess.stderr.on('data', (data) => {
    console.error('[PPT2Video Python STDERR]', data.toString());
  });

  pyProcess.on('close', (code) => {
    // 删除临时上传的 PPTX
    fs.unlink(pptxPath, () => {});

    if (code === 0 && fs.existsSync(outputVideoPath)) {
      pptTasks.set(taskId, {
        progress: 100,
        status: '转换完成！',
        completed: true,
        error: null,
        url: videoUrl,
        file_id: fileId
      });
    } else {
      const current = pptTasks.get(taskId);
      if (!current.error) {
        pptTasks.set(taskId, {
          ...current,
          completed: true,
          error: `转换异常终止 (退出码: ${code})`,
          status: '转换失败'
        });
      }
    }
  });

  return res.json({ success: true, taskId, message: 'PPT 转换任务已启动' });
});

// GET /api/upload/ppt-status/:taskId (轮询 PPT 转换进度)
router.get('/ppt-status/:taskId', authMiddleware, (req, res) => {
  const { taskId } = req.params;
  const task = pptTasks.get(taskId);
  if (!task) {
    return res.json({ success: false, message: '未找到对应任务' });
  }
  return res.json({ success: true, task });
});

module.exports = router;
