const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs');
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

// 本地存储目录（OSS 未配置时的回退方案）
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');
if (!ossClient) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

// 支持的视频格式
const ALLOWED_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm', '.flv', '.wmv'];
const ALLOWED_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'video/m4v', 'video/webm', 'video/x-flv', 'video/x-ms-wmv', 'application/octet-stream'];

// multer 磁盘存储（避免大文件撑爆内存）
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

// POST /api/upload/video
router.post('/video', authMiddleware, (req, res, next) => {
  // 权限校验
  if (!req.user || !['safety_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  // 用回调方式调用 multer，捕获文件类型/大小错误并返回 JSON
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
      // ── 上传到阿里云 OSS ──────────────────────────────────
      await ossClient.put(fileId, tmpPath, { mime: 'video/mp4' });
      fs.unlink(tmpPath, () => {}); // 上传完删除临时文件

      const url = ossClient.signatureUrl(fileId, { expires: 7200 });
      return res.json({ success: true, file_id: fileId, url, storage: 'oss' });

    } else {
      // ── 本地存储（OSS 未配置时的回退）────────────────────
      const destPath = path.join(LOCAL_UPLOAD_DIR, req.file.filename);
      fs.renameSync(tmpPath, destPath); // 从 tmp 移到正式目录

      // 通过 /uploads/videos/xxx.mp4 访问
      const url = `/uploads/videos/${req.file.filename}`;
      return res.json({
        success: true,
        file_id: fileId,          // 保存到 DB 的标识
        url,                       // 可直接访问的 URL
        storage: 'local',
        message: '视频已保存到服务器本地（OSS 未配置）'
      });
    }
  } catch (e) {
    // 清理临时文件
    fs.unlink(tmpPath, () => {});
    console.error('[Upload] 上传失败:', e);
    return res.json({ success: false, message: '上传失败: ' + e.message });
  }
});

module.exports = router;
