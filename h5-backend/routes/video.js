const express = require('express');
const OSS = require('ali-oss');
const router = express.Router();

let client = null;

// 初始化阿里云 OSS 客户端
if (process.env.ALIYUN_OSS_AK) {
  try {
    client = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_AK,
      accessKeySecret: process.env.ALIYUN_OSS_SK,
      bucket: process.env.ALIYUN_OSS_BUCKET
    });
    console.log('OSS Client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize OSS Client:', err);
  }
}

// 模拟原版小程序的 getVideoUrl 云函数
router.post('/getVideoUrl', async (req, res) => {
  const { fileID } = req.body;

  if (!fileID) {
    return res.json({ success: false, message: 'fileID(文件名)不能为空' });
  }

  // 临时模拟或报错，防止报错卡死
  if (!client) {
    return res.json({ 
      success: false, 
      message: '阿里云 OSS 尚未在 .env 中配置，暂时无法生成签名防盗链',
      // 这里我们在本地开发期间，如果没配账号，就假装返回一个地址用来测试前端能否连通
      url: `https://mock-domain.com/videos/${fileID}`
    });
  }

  try {
    // 生成一个有效期为 2小时(7200秒) 的临时可播放链接
    const url = client.signatureUrl(fileID, { expires: 7200 });
    
    return res.json({
      success: true,
      url: url,
      fileID: fileID
    });
  } catch (error) {
    console.error('获取视频链接失败:', error);
    return res.json({ success: false, message: error.message });
  }
});

module.exports = router;
