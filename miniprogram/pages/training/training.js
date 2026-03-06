// pages/training/training.js
const app = getApp();
const { showLoading, hideLoading, showError } = require('../../utils/util');

Page({
  data: {
    applicationId: '',
    trainingRecordId: '',
    videos: [],
    totalCount: 0,
    completedCount: 0,
    overallPct: 0,
    allCompleted: false,
    loading: true
  },

  onLoad(options) {
    if (options.applicationId) {
      this.setData({ applicationId: options.applicationId });
    }
    if (options.trainingRecordId) {
      this.setData({ trainingRecordId: options.trainingRecordId });
    }
    this.loadTrainingData();
  },

  onShow() {
    // 每次返回此页面时刷新（用户看完视频后）
    if (this.data.trainingRecordId) {
      this.loadTrainingData();
    }
  },

  async loadTrainingData() {
    this.setData({ loading: true });
    showLoading('加载中...');

    try {
      if (typeof Cloud === 'undefined') {
        hideLoading();
        this.setData({ loading: false });
        showError('云服务未初始化');
        return;
      }

      const db = Cloud.database();
      const { applicationId } = this.data;
      let trainingRecordId = this.data.trainingRecordId;

      // 1. 获取所有激活的培训视频（按排序）
      const videosRes = await db.collection('training_videos')
        .where({ status: 'active' })
        .orderBy('order', 'asc')
        .get();

      const videoList = videosRes.data;

      // 2. 查找或创建学习记录
      let videoProgress = {};
      if (applicationId && !trainingRecordId) {
        // 通过 applicationId 查找记录
        const recordRes = await db.collection('training_records')
          .where({ application_id: applicationId })
          .get();

        if (recordRes.data.length > 0) {
          trainingRecordId = recordRes.data[0]._id;
          videoProgress = recordRes.data[0].video_progress || {};
          this.setData({ trainingRecordId });
        } else if (applicationId) {
          // 创建新学习记录
          const newRecord = await db.collection('training_records').add({
            data: {
              application_id: applicationId,
              video_progress: {},
              create_time: new Date(),
              update_time: new Date()
            }
          });
          trainingRecordId = newRecord._id;
          this.setData({ trainingRecordId });
        }
      } else if (trainingRecordId) {
        const recordRes = await db.collection('training_records').doc(trainingRecordId).get();
        videoProgress = (recordRes.data && recordRes.data.video_progress) || {};
      }

      // 3. 合并视频信息与学习进度
      let completedCount = 0;
      const videos = videoList.map((v, idx) => {
        const vp = videoProgress[v._id] || {};
        const progress = Math.floor(vp.progress || 0);
        const isCompleted = !!vp.completed;
        if (isCompleted) completedCount++;

        return {
          ...v,
          orderNum: idx + 1,
          progress,
          isCompleted,
          duration_str: v.duration ? this._formatDuration(v.duration) : ''
        };
      });

      const totalCount = videos.length;
      const overallPct = totalCount > 0
        ? Math.floor((completedCount / totalCount) * 100)
        : 0;
      const allCompleted = totalCount > 0 && completedCount === totalCount;

      this.setData({
        videos,
        totalCount,
        completedCount,
        overallPct,
        allCompleted,
        loading: false
      });

      // 4. 如果全部完成，自动更新申请状态
      if (allCompleted && applicationId) {
        this._updateApplicationStatus(applicationId);
      }

      hideLoading();
    } catch (error) {
      hideLoading();
      this.setData({ loading: false });
      console.error('加载培训数据失败:', error);
      showError('加载失败，请重试');
    }
  },

  // 跳转到视频播放页
  goToVideo(e) {
    const videoId = e.currentTarget.dataset.id;
    const { trainingRecordId } = this.data;

    if (!trainingRecordId) {
      showError('学习记录未初始化，请退出后重试');
      return;
    }

    my.navigateTo({
      url: `/pages/video/video?videoId=${videoId}&trainingRecordId=${trainingRecordId}`
    });
  },

  // 前往考试
  goToExam() {
    my.navigateTo({
      url: `/pages/exam/exam?applicationId=${this.data.applicationId}`
    });
  },

  // 全部完成后更新申请状态为 training_completed
  async _updateApplicationStatus(applicationId) {
    try {
      const db = Cloud.database();
      const appRes = await db.collection('applications').doc(applicationId).get();
      const currentStatus = appRes.data && appRes.data.status;
      const updatable = ['training', 'interview_passed'];
      if (!updatable.includes(currentStatus)) return;

      await db.collection('applications').doc(applicationId).update({
        data: {
          status: 'training_completed',
          training_complete_time: db.serverDate(),
          update_time: db.serverDate()
        }
      });
      console.log('申请状态已更新为 training_completed');
    } catch (e) {
      console.error('更新状态失败:', e);
    }
  },

  _formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
});
