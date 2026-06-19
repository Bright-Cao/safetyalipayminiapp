const { TrainingRecord, Video } = require('../models');

/** 对 file_id 做键名消毒：Mongoose Map 不允许键名含 '.' 或 '$' */
function sanitizeKey(key) {
  return key.replace(/\./g, '_').replace(/\$/g, '_').replace(/\//g, '_');
}

/** 获取培训视频列表（所有已登录用户均可访问） */
exports.getTrainingVideos = async (req, res) => {
  try {
    const videos = await Video.find({ status: 'active' })
      .sort({ sort_order: 1, create_time: -1 })
      .lean();
    return res.json({ success: true, data: videos });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 获取当前用户所有视频的观看进度（用于断点续看） */
exports.getVideoProgress = async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) return res.json({ success: false, message: '未授权访问' });

  try {
    const record = await TrainingRecord.findOne({ _openid: userId })
      .sort({ update_time: -1 })
      .lean();

    if (!record || !record.video_progress) {
      return res.json({ success: true, data: {} });
    }

    // Mongoose lean() 可能返回 Map 或普通对象，统一转成普通对象
    let progressData = {};
    if (record.video_progress instanceof Map) {
      record.video_progress.forEach((v, k) => { progressData[k] = v; });
    } else {
      progressData = record.video_progress;
    }

    return res.json({ success: true, data: progressData });
  } catch (e) {
    console.error('获取进度失败:', e);
    return res.json({ success: false, message: e.message });
  }
};

/** 更新视频观看进度 */
exports.updateVideoProgress = async (req, res) => {
  const { videoId, progress, currentTime, maxWatched } = req.body;
  const userId = req.user && req.user.userId;

  if (!userId) return res.json({ success: false, message: '未授权访问' });
  if (!videoId) return res.json({ success: false, message: '缺少 videoId' });

  const safeKey = sanitizeKey(videoId);

  try {
    let trainingRecord = await TrainingRecord.findOne({ _openid: userId })
      .sort({ update_time: -1 });

    if (!trainingRecord) {
      trainingRecord = new TrainingRecord({
        _openid: userId,
        video_progress: new Map(),
        update_time: new Date()
      });
    }

    const prev = trainingRecord.video_progress.get(safeKey) || {
      progress: 0, max_watched: 0, current_time: 0, completed: false
    };

    const newProgress  = Math.max(progress   || 0, prev.progress   || 0);
    const newMaxWatched = Math.max(maxWatched || 0, prev.max_watched || 0);
    const completed    = newProgress >= 90 || prev.completed;

    const newData = {
      progress:     newProgress,
      max_watched:  newMaxWatched,
      current_time: currentTime || 0,
      completed,
      last_update:  new Date(),
    };
    if (completed && !prev.completed) newData.completed_time = new Date();

    trainingRecord.video_progress.set(safeKey, newData);
    trainingRecord.update_time = new Date();
    await trainingRecord.save();

    // ── 首次完成当前视频时，检查是否所有视频都看完 ──────────────────
    if (completed && !prev.completed) {
      const allVideos = await Video.find({ status: 'active' }).lean();
      const allDone = allVideos.every(v => {
        const k = sanitizeKey(v.file_id);
        const p = trainingRecord.video_progress.get(k);
        return p && p.completed;
      });

      if (allDone) {
        const { Application } = require('../models');
        // 把最近的 pending_training 申请推进到 training_completed
        await Application.findOneAndUpdate(
          { _openid: userId, status: 'pending_training' },
          { $set: { status: 'training_completed', update_time: new Date() } },
          { sort: { update_time: -1 } }
        );
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('更新进度失败:', error);
    return res.json({ success: false, message: '更新失败: ' + error.message });
  }
};
