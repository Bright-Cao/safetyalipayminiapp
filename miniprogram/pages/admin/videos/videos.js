// pages/admin/videos/videos.js
const { showLoading, hideLoading, showError, showSuccess, showConfirm, compressImage } = require('../../../utils/util');

Page({
  data: {
    videos: [],
    showModal: false,
    isEdit: false,
    editId: '',
    categories: ['基础知识', '操作规范', '案例分析', '应急管理', '法律法规'],
    categoryIndex: 0,
    formData: {
      title: '',
      description: '',
      category: '基础知识',
      order: 1,
      duration: 0,
      video_url: '',
      thumbnail: '',
      practice_questions: [],
      status: 'active'
    }
  },

  onLoad() {
    this.loadVideos();
  },

  onShow() {
    this.loadVideos();
  },

  async loadVideos() {
    showLoading();

    try {
      const db = Cloud.database();
      const res = await db.collection('training_videos')
        .orderBy('order', 'asc')
        .get();

      const videos = res.data.map(item => ({
        ...item,
        duration_str: this.formatDuration(item.duration)
      }));

      this.setData({ videos });
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载视频列表失败:', error);
      showError('加载失败');
    }
  },

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  },

  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editId: '',
      categoryIndex: 0,
      formData: {
        title: '',
        description: '',
        category: '基础知识',
        order: this.data.videos.length + 1,
        duration: 0,
        video_url: '',
        thumbnail: '',
        practice_questions: [],
        status: 'active'
      }
    });
  },

  async editVideo(e) {
    const id = e.currentTarget.dataset.id;
    const video = this.data.videos.find(v => v._id === id);

    if (!video) return;

    const categoryIndex = this.data.categories.indexOf(video.category);

    this.setData({
      showModal: true,
      isEdit: true,
      editId: id,
      categoryIndex: categoryIndex !== -1 ? categoryIndex : 0,
      formData: {
        title: video.title,
        description: video.description || '',
        category: video.category,
        order: video.order,
        duration: video.duration,
        video_url: video.video_url,
        thumbnail: video.thumbnail || '',
        practice_questions: video.practice_questions || [],
        status: video.status
      }
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({
      categoryIndex: index,
      'formData.category': this.data.categories[index]
    });
  },

  async chooseVideo() {
    try {
      const res = await my.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 1800, // 最长30分钟
        camera: 'back'
      });

      const tempFilePath = res.tempFilePath || res.apFilePath;
      if (!tempFilePath) {
        showError('选择视频失败，未获取到文件路径');
        return;
      }

      showLoading('上传中，请稍候...');

      // 上传到云存储（fileID 格式，播放时由云函数转临时链接）
      const cloudPath = `training-videos/${Date.now()}-${Math.random().toString(36).substr(2)}.mp4`;

      const uploadRes = await Cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      });

      this.setData({
        'formData.video_url': uploadRes.fileID,
        'formData.duration': Math.floor(res.duration || 0)
      });

      hideLoading();
      showSuccess('视频上传成功');
    } catch (error) {
      hideLoading();
      if (error && (error.errMsg || '').includes('cancel')) return;
      console.error('上传视频失败:', error);
      showError('上传失败：' + (error.errMsg || error.message || '未知错误'));
    }
  },

  async chooseThumbnail() {
    try {
      const res = await my.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      showLoading('上传中...');

      const compressedPath = await compressImage(res.tempFilePaths[0]);
      const cloudPath = `thumbnails/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
      const uploadRes = await Cloud.uploadFile({
        cloudPath,
        filePath: compressedPath
      });

      this.setData({
        'formData.thumbnail': uploadRes.fileID
      });

      hideLoading();
      showSuccess('上传成功');
    } catch (error) {
      hideLoading();
      if (error.errMsg && error.errMsg.includes('cancel')) {
        console.log('用户取消选择');
        return;
      }
      console.error('上传封面失败:', error);
      showError('上传失败');
    }
  },

  addQuestion() {
    const questions = this.data.formData.practice_questions;
    questions.push({
      question: '',
      options: ['', '', '', ''],
      answer: 0
    });
    this.setData({
      'formData.practice_questions': questions
    });
  },

  removeQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const questions = this.data.formData.practice_questions;
    questions.splice(index, 1);
    this.setData({
      'formData.practice_questions': questions
    });
  },

  onQuestionChange(e) {
    const index = e.currentTarget.dataset.index;
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.practice_questions[${index}].${field}`]: e.detail.value
    });
  },

  onOptionChange(e) {
    const qIndex = e.currentTarget.dataset.qindex;
    const optIndex = e.currentTarget.dataset.optindex;
    this.setData({
      [`formData.practice_questions[${qIndex}].options[${optIndex}]`]: e.detail.value
    });
  },

  onAnswerChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      [`formData.practice_questions[${index}].answer`]: Number(e.detail.value)
    });
  },

  async saveVideo() {
    const { formData, isEdit, editId } = this.data;

    // 验证
    if (!formData.title.trim()) {
      showError('请输入资料标题');
      return;
    }

    if (!formData.video_url) {
      showError('请输入学习链接');
      return;
    }

    showLoading('保存中...');

    try {
      const db = Cloud.database();
      const data = {
        ...formData,
        order: Number(formData.order),
        duration: Number(formData.duration),
        update_time: new Date()
      };

      if (isEdit) {
        // 更新
        await db.collection('training_videos')
          .doc(editId)
          .update({ data });
        showSuccess('更新成功');
      } else {
        // 新增
        data.create_time = new Date();
        await db.collection('training_videos')
          .add({ data });
        showSuccess('添加成功');
      }

      hideLoading();
      this.hideModal();
      this.loadVideos();
    } catch (error) {
      hideLoading();
      console.error('保存失败:', error);
      showError('保存失败');
    }
  },

  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const newStatus = status === 'active' ? 'inactive' : 'active';

    try {
      await showConfirm(`确认${newStatus === 'active' ? '启用' : '禁用'}此视频吗？`, '确认操作');

      showLoading();

      const db = Cloud.database();
      await db.collection('training_videos')
        .doc(id)
        .update({
          data: {
            status: newStatus,
            update_time: new Date()
          }
        });

      hideLoading();
      showSuccess('操作成功');
      this.loadVideos();
    } catch (error) {
      hideLoading();
      if (error !== false) {
        console.error('操作失败:', error);
        showError('操作失败');
      }
    }
  },

  async deleteVideo(e) {
    const id = e.currentTarget.dataset.id;

    try {
      await showConfirm('确认删除此视频吗？删除后无法恢复', '确认删除');

      showLoading();

      const db = Cloud.database();
      await db.collection('training_videos')
        .doc(id)
        .remove();

      hideLoading();
      showSuccess('删除成功');
      this.loadVideos();
    } catch (error) {
      hideLoading();
      if (error !== false) {
        console.error('删除失败:', error);
        showError('删除失败');
      }
    }
  }
});
