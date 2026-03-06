// pages/video/video.js
const { trainingAPI } = require('../../utils/api');
const { showError, showSuccess } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    trainingRecordId: '',
    videoId: '',
    videoSrc: '',
    videoTitle: '',
    videoDescription: '',
    isCompleted: false,
    // 播放控制
    resumeTime: 0,       // 断点续播起始时间
    currentTime: 0,      // 当前播放时间（秒）
    duration: 0,         // 视频总时长
    progressPct: 0,      // 进度百分比（0-100）
    watchedPct: 0,       // 已看到的最大进度%（展示用）
    currentTimeText: '0:00',
    durationText: '0:00',
    showSeekTip: false,  // 显示"不能拖拽"提示
  },

  // 内部状态（不放 data 里避免频繁 setData）
  _maxWatchedTime: 0,   // 用户实际看到的最远时间（秒），用于防拖拽判断
  _saveTimer: null,     // 定时保存进度的 timer
  _videoContext: null,  // video context

  onLoad(options) {
    this.setData({
      trainingRecordId: options.trainingRecordId || '',
      videoId: options.videoId || ''
    });
    this.loadVideoData();
  },

  onUnload() {
    // 离开页面时保存一次进度
    this._saveProgress();
    if (this._saveTimer) clearInterval(this._saveTimer);
  },

  async loadVideoData() {
    try {
      const db = Cloud.database();
      const { videoId, trainingRecordId } = this.data;

      // 1. 获取视频信息
      const videoRes = await db.collection('training_videos').doc(videoId).get();
      const video = videoRes.data;

      // 2. 获取云存储临时访问链接
      let videoSrc = '';
      if (video.video_url) {
        if (video.video_url.startsWith('cloud://')) {
          // 云存储 fileID → 临时链接
          const urlRes = await Cloud.callFunction({
            name: 'getVideoUrl',
            data: { fileID: video.video_url }
          });
          videoSrc = (urlRes.result && urlRes.result.url) || video.video_url;
        } else {
          videoSrc = video.video_url;
        }
      }

      // 3. 获取学习记录（断点续播）
      let resumeTime = 0;
      let isCompleted = false;
      let watchedPct = 0;

      if (trainingRecordId) {
        const recordRes = await db.collection('training_records').doc(trainingRecordId).get();
        const record = recordRes.data;
        if (record && record.video_progress && record.video_progress[videoId]) {
          const vp = record.video_progress[videoId];
          isCompleted = !!vp.completed;
          watchedPct = Math.floor(vp.progress || 0);
          // 断点续播：从上次看到的位置恢复（不超过总时长-5秒）
          if (vp.last_time && vp.last_time > 5) {
            resumeTime = vp.last_time - 3; // 稍微退回3秒，更自然
          }
          this._maxWatchedTime = vp.watch_time || 0;
        }
      }

      this.setData({
        videoSrc,
        videoTitle: video.title || '',
        videoDescription: video.description || '',
        isCompleted,
        resumeTime,
        watchedPct
      });

      // 4. 初始化 video context
      this._videoContext = my.createVideoContext('myVideo');

      // 5. 每30秒自动保存一次进度
      this._saveTimer = setInterval(() => this._saveProgress(), 30000);

    } catch (error) {
      console.error('加载视频失败:', error);
      showError('视频加载失败，请返回重试');
    }
  },

  // ====== 播放事件 ======

  onPlay() {
    console.log('视频开始播放');
  },

  onPause() {
    this._saveProgress();
  },

  onTimeUpdate(e) {
    const currentTime = e.detail.currentTime;
    const duration = e.detail.duration;

    // ===== 核心防拖拽逻辑 =====
    // 如果当前时间比已看到的最大时间超前超过3秒，强制跳回
    if (currentTime > this._maxWatchedTime + 3 && this._maxWatchedTime > 0) {
      console.warn('检测到跳进度，强制回跳至', this._maxWatchedTime);
      this._videoContext && this._videoContext.seek(this._maxWatchedTime);
      // 显示提示
      this.setData({ showSeekTip: true });
      setTimeout(() => this.setData({ showSeekTip: false }), 2000);
      return;
    }

    // 更新最远观看时间
    if (currentTime > this._maxWatchedTime) {
      this._maxWatchedTime = currentTime;
    }

    if (!duration || duration <= 0) return;

    const progressPct = Math.min(Math.floor((currentTime / duration) * 100), 100);
    const watchedPct = Math.min(Math.floor((this._maxWatchedTime / duration) * 100), 100);

    this.setData({
      currentTime,
      duration,
      progressPct,
      watchedPct,
      currentTimeText: this._formatTime(currentTime),
      durationText: this._formatTime(duration)
    });
  },

  onEnded() {
    console.log('视频播放完毕');
    this._saveProgress(true); // 强制标记完成
  },

  onVideoError(e) {
    console.error('视频播放错误:', e);
    showError('视频播放出错，请检查网络后重试');
  },

  // ====== 进度保存 ======

  async _saveProgress(forceComplete = false) {
    const { trainingRecordId, videoId, currentTime, duration } = this.data;
    if (!trainingRecordId || !videoId) return;

    const progress = duration > 0
      ? Math.min(Math.floor((this._maxWatchedTime / duration) * 100), 100)
      : 0;

    // 看满90%自动完成，或视频结束时强制完成
    const shouldComplete = forceComplete || progress >= 90;

    try {
      await trainingAPI.updateVideoProgress(
        trainingRecordId,
        videoId,
        progress,
        Math.floor(this._maxWatchedTime),     // 最远观看时间（秒）
        Math.floor(currentTime)               // 当前播放位置（用于下次续播）
      );

      if (shouldComplete && !this.data.isCompleted) {
        this.setData({ isCompleted: true, watchedPct: 100 });
        showSuccess('🎉 视频学习完成！');
      }
    } catch (e) {
      console.error('保存进度失败:', e);
    }
  },

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
});