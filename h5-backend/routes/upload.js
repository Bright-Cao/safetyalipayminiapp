const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { PptTask, Video } = require('../models');

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

// POST /api/upload/video (常规视频上传)
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

// POST /api/upload/ppt (提交异步 PPT 转视频任务)
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

  const title = (req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "")).trim();
  const voice = req.body.voice || 'zh-CN-XiaoxiaoNeural';
  const rate = req.body.rate || '+0%';

  const pptxPath = req.file.path;
  const taskId = `ppt_${Date.now()}`;
  const outFileName = `${Date.now()}_ppt_converted.mp4`;
  const outputVideoPath = path.join(LOCAL_UPLOAD_DIR, outFileName);
  const fileId = `videos/${outFileName}`;
  const videoUrl = `/uploads/videos/${outFileName}`;

  try {
    // 写入 DB 任务记录
    const taskDoc = await PptTask.create({
      title,
      original_filename: req.file.originalname,
      task_id: taskId,
      voice,
      rate,
      status: '排队启动转换中...',
      progress: 5,
      completed: false
    });

    // 启动 Python 转换后台子进程
    const venvPython = path.join(__dirname, '..', 'ppt2video_env', 'bin', 'python3');
    const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
    const scriptPath = path.join(__dirname, '..', 'services', 'ppt2video', 'converter.py');

    const pyProcess = spawn(pythonBin, [
      scriptPath, pptxPath,
      '--output', outputVideoPath,
      '--voice', voice,
      '--rate', rate
    ]);

    pyProcess.stdout.on('data', async (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.progress !== undefined) {
            await PptTask.updateOne({ task_id: taskId }, {
              progress: parsed.progress,
              status: parsed.status || '转换中...'
            });
          }
          if (parsed.error) {
            await PptTask.updateOne({ task_id: taskId }, {
              completed: true,
              error: parsed.error,
              status: '转换失败'
            });
          }
        } catch (e) {
          console.log('[PPT2Video Output]', line.trim());
        }
      }
    });

    pyProcess.stderr.on('data', (data) => {
      console.error('[PPT2Video STDERR]', data.toString());
    });

    pyProcess.on('close', async (code) => {
      // 删除临时 PPTX
      fs.unlink(pptxPath, () => {});

      if (code === 0 && fs.existsSync(outputVideoPath)) {
        await PptTask.updateOne({ task_id: taskId }, {
          progress: 100,
          status: '转换完成！',
          completed: true,
          error: null,
          url: videoUrl,
          file_id: fileId
        });
      } else {
        const task = await PptTask.findOne({ task_id: taskId });
        if (task && !task.error) {
          await PptTask.updateOne({ task_id: taskId }, {
            completed: true,
            error: `转换异常中止 (Exit Code: ${code})`,
            status: '转换失败'
          });
        }
      }
    });

    return res.json({
      success: true,
      taskId,
      message: 'PPT 转换任务已提交后台处理，无需保留在页面等待！'
    });

  } catch (err) {
    fs.unlink(pptxPath, () => {});
    return res.json({ success: false, message: '提交失败: ' + err.message });
  }
});

// GET /api/upload/ppt-tasks (获取所有转换任务列表)
router.get('/ppt-tasks', authMiddleware, async (req, res) => {
  if (!req.user || !['safety_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  try {
    const tasks = await PptTask.find().sort({ create_time: -1 });
    return res.json({ success: true, data: tasks });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/upload/publish-ppt (一键发布转换好的视频到课程库)
router.post('/publish-ppt', authMiddleware, async (req, res) => {
  if (!req.user || !['safety_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  const { taskId } = req.body;
  try {
    const task = await PptTask.findOne({ task_id: taskId });
    if (!task || !task.completed || !task.file_id) {
      return res.json({ success: false, message: '任务尚未转换完成或无效' });
    }
    // 添加到 Video 视频库
    await Video.create({
      title: task.title,
      file_id: task.file_id,
      description: `由 PPT 《${task.original_filename || task.title}》 自动转换合成`,
      status: 'active'
    });
    // 标记该任务为已发布
    task.published = true;
    await task.save();

    return res.json({ success: true, message: '已成功发布到教学视频库！' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// POST /api/upload/delete-ppt-task (删除任务记录及生成文件)
router.post('/delete-ppt-task', authMiddleware, async (req, res) => {
  if (!req.user || !['safety_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  const { taskId } = req.body;
  try {
    const task = await PptTask.findOne({ task_id: taskId });
    if (task) {
      if (task.file_id) {
        const filePath = path.join(LOCAL_UPLOAD_DIR, path.basename(task.file_id));
        fs.unlink(filePath, () => {});
      }
      await PptTask.deleteOne({ task_id: taskId });
    }
    return res.json({ success: true, message: '任务已删除' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

module.exports = router;
