require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const port = process.env.PORT || 3000;

// 开启跨域和 JSON 解析
app.use(cors());
app.use(express.json());

// 本地上传视频静态访问（OSS 未配置时的回退）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 挂载路由 (API接口)
app.use('/api', apiRoutes);

// 连接 MongoDB 数据库
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/training_db';
mongoose.connect(mongoUri)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// 健康检查接口
app.get('/', (req, res) => {
  res.json({ status: 'H5 Backend is running under Express!' });
});

app.listen(port, () => {
  console.log(`Backend Server listening at http://localhost:${port}`);
});
