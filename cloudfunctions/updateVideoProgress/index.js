// 云函数：更新视频学习进度（防作弊）（支付宝云函数）
exports.main = async (event, context) => {
  const { recordId, videoId, progress, watchTime, lastTime } = event;
  const db = cloud.database();

  try {
    // 获取当前记录
    const recordRes = await db.collection('training_records').doc(recordId).get();
    if (!recordRes.data) {
      return { success: false, message: '记录不存在' };
    }

    const videoProgress = recordRes.data.video_progress || {};
    const currentProgress = videoProgress[videoId] || { progress: 0, watch_time: 0, completed: false };

    // 防止观看时间异常增长（防作弊）
    const timeDiff = watchTime - currentProgress.watch_time;
    if (timeDiff > 15) {
      console.warn('检测到异常观看时间:', { diff: timeDiff });
      return { success: false, message: '检测到异常操作' };
    }

    // 更新进度
    const completed = progress >= 90;
    videoProgress[videoId] = {
      progress: Math.min(Math.max(progress, currentProgress.progress), 100),
      watch_time: watchTime,
      last_time: lastTime || currentProgress.last_time || 0,
      completed: completed,
      last_update: new Date()
    };

    if (completed && !currentProgress.completed) {
      videoProgress[videoId].completed_time = new Date();
    }

    await db.collection('training_records').doc(recordId).update({
      data: {
        video_progress: videoProgress,
        update_time: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    console.error('更新进度失败:', error);
    return { success: false, message: '更新失败: ' + error.message };
  }
};
