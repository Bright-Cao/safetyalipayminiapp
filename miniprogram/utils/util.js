// 工具函数
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('-')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatDate = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${[year, month, day].map(formatNumber).join('-')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 验证身份证号
const validateIdCard = (idCard) => {
  const reg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
  return reg.test(idCard);
}

// 验证手机号
const validatePhone = (phone) => {
  const reg = /^1[3-9]\d{9}$/;
  return reg.test(phone);
}

// 显示加载提示
const showLoading = (title = '加载中...') => {
  my.showLoading({
    content: title,
    mask: true
  });
}

// 隐藏加载提示
const hideLoading = () => {
  my.hideLoading();
}

// 显示成功提示
const showSuccess = (title = '操作成功') => {
  my.showToast({
    content: title,
    type: 'success',
    duration: 2000
  });
}

// 显示错误提示
const showError = (title = '操作失败') => {
  my.showToast({
    content: title,
    type: 'fail',
    duration: 2000
  });
}

// 确认对话框
const showConfirm = (content, title = '提示') => {
  return new Promise((resolve, reject) => {
    my.showModal({
      title: title,
      content: content,
      success: function(res) {
        if (res.confirm) {
          resolve(true);
        } else {
          reject(false);
        }
      }
    });
  });
}

// 格式化时长（秒转为分:秒）
const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${formatNumber(minutes)}:${formatNumber(secs)}`;
}

// 计算视频观看完成度
const calculateCompletionRate = (watchTime, totalDuration) => {
  if (!totalDuration) return 0;
  return Math.min((watchTime / totalDuration) * 100, 100).toFixed(2);
}

// 防抖函数
const debounce = (fn, delay = 500) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 节流函数
const throttle = (fn, interval = 1000) => {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// 检查权限
const checkPermission = (userRole, requiredRoles) => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return requiredRoles.includes(userRole);
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'pending': '审查中',
    'workshop_interview_passed': '初审通过',
    'interview_scheduled': '评估中',
    'interview_passed': '评估达标',
    'interview_failed': '评估未达标',
    'training': '资料自学中',
    'training_completed': '自学完成',
    'exam_pending': '待测评',
    'exam_passed': '测评达标',
    'exam_failed': '测评未达标',
    'qualified': '学习已达标',
    'expired': '已失效'
  };
  return statusMap[status] || status;
}

// 获取状态样式类
const getStatusClass = (status) => {
  if (['pending', 'interview_scheduled', 'exam_pending'].includes(status)) {
    return 'status-pending';
  } else if (['interview_passed', 'training_completed', 'exam_passed', 'qualified'].includes(status)) {
    return 'status-approved';
  } else if (['interview_failed', 'exam_failed', 'expired'].includes(status)) {
    return 'status-rejected';
  } else if (['training'].includes(status)) {
    return 'status-training';
  }
  return '';
}

// 压缩图片
const compressImage = (filePath, quality = 80) => {
  return new Promise((resolve) => {
    my.compressImage({
      apFilePaths: [filePath],
      compressLevel: quality,
      success: function(res) {
        resolve(res.apFilePaths && res.apFilePaths[0] ? res.apFilePaths[0] : filePath);
      },
      fail: function(err) {
        console.warn('图片压缩失败，使用原图:', err);
        resolve(filePath); // 失败时返回原图，不中断流程
      }
    });
  });
}

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  validateIdCard,
  validatePhone,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm,
  formatDuration,
  calculateCompletionRate,
  debounce,
  throttle,
  checkPermission,
  getStatusText,
  getStatusClass,
  compressImage
};
