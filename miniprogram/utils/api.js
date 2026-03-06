// 云开发数据库API封装
// 注意：Cloud 是运行时延迟注入的全局变量，不能在顶层调用，必须懒加载
function getDb() { return Cloud.database(); }
function getCommand() { return Cloud.database().command; }

// 用户相关
const userAPI = {
  // 登录/注册
  login(phoneNumber, code) {
    return Cloud.callFunction({
      name: 'login',
      data: { phoneNumber, code }
    });
  },

  // 获取用户信息
  getUserInfo(openid) {
    return getDb().collection('users').where({ _openid: openid }).get();
  },

  // 更新用户信息
  updateUserInfo(data) {
    return getDb().collection('users').doc(data._id).update({ data });
  }
};

// 申请相关
const applicationAPI = {
  // 提交申请
  submitApplication(data) {
    return getDb().collection('applications').add({ data });
  },

  // 获取我的申请
  getMyApplications(openid) {
    return getDb().collection('applications').where({ applicant_openid: openid }).orderBy('create_time', 'desc').get();
  },

  // 获取待审核申请（车间领导）
  getPendingApplications(workshop) {
    return getDb().collection('applications').where({
      workshop: workshop,
      status: 'pending'
    }).orderBy('create_time', 'desc').get();
  },

  // 更新申请状态
  updateApplicationStatus(id, status, data) {
    return getDb().collection('applications').doc(id).update({
      data: {
        status,
        ...data
      }
    });
  }
};

// 面试相关
const interviewAPI = {
  // 创建面试记录
  createInterview(data) {
    return getDb().collection('interviews').add({ data });
  },

  // 提交面试评分
  submitInterviewScore(id, scores, totalScore, passed, comments) {
    return getDb().collection('interviews').doc(id).update({
      data: {
        scores,
        total_score: totalScore,
        passed,
        comments,
        interview_time: new Date(),
        status: 'completed'
      }
    });
  },

  // 获取面试记录
  getInterviewByApplicationId(applicationId) {
    return getDb().collection('interviews').where({ application_id: applicationId }).get();
  }
};

// 培训相关
const trainingAPI = {
  // 获取培训视频列表
  getTrainingVideos() {
    return getDb().collection('training_videos').where({ status: 'active' }).get();
  },

  // 创建培训记录
  createTrainingRecord(data) {
    return getDb().collection('training_records').add({ data });
  },

  // 更新视频学习进度（防作弊）
  updateVideoProgress(recordId, videoId, progress, watchTime, lastTime) {
    return Cloud.callFunction({
      name: 'updateVideoProgress',
      data: { recordId, videoId, progress, watchTime, lastTime }
    });
  },

  // 提交练习题答案
  submitPracticeAnswers(recordId, videoId, answers) {
    return Cloud.callFunction({
      name: 'submitPracticeAnswers',
      data: { recordId, videoId, answers }
    });
  },

  // 获取培训记录
  getTrainingRecord(applicationId) {
    return getDb().collection('training_records').where({ application_id: applicationId }).get();
  }
};

// 考试相关
const examAPI = {
  // 获取考试题目
  getExamQuestions() {
    return Cloud.callFunction({
      name: 'getExamQuestions'
    });
  },

  // 提交考试答案
  submitExam(data) {
    return Cloud.callFunction({
      name: 'submitExam',
      data
    });
  },

  // 获取考试记录
  getExamRecords(applicationId) {
    return getDb().collection('exam_records').where({ application_id: applicationId }).orderBy('exam_time', 'desc').get();
  }
};

// 练习相关
const practiceAPI = {
  // 获取练习题目
  getQuestions(mode) {
    return Cloud.callFunction({
      name: 'getPracticeQuestions',
      data: { mode }
    });
  }
};

// 查询相关
const checkAPI = {
  // 通过姓名或身份证查询监护人资质
  checkGuardianQualification(keyword) {
    return Cloud.callFunction({
      name: 'checkGuardian',
      data: { keyword }
    });
  },

  // 扫码查询
  scanQRCode(qrData) {
    return Cloud.callFunction({
      name: 'checkGuardianByQR',
      data: { qrData }
    });
  }
};

// 管理员相关
const adminAPI = {
  // 获取所有申请
  getAllApplications(filters) {
    let query = getDb().collection('applications');
    if (filters.workshop) {
      query = query.where({ workshop: filters.workshop });
    }
    if (filters.status) {
      query = query.where({ status: filters.status });
    }
    return query.orderBy('create_time', 'desc').limit(100).get();
  },

  // 获取统计数据（测试模式：直接查询数据库）
  async getStatistics(workshop) {
    try {
      const db = Cloud.database();
      const _ = db.command;

      let baseFilter = {};
      if (workshop) {
        baseFilter = { workshop: workshop };
      }

      // 并行查询各种状态的数据
      const [total, pending, training, qualified] = await Promise.all([
        db.collection('applications').where(baseFilter).count(),
        db.collection('applications').where({ ...baseFilter, status: 'pending' }).count(),
        db.collection('applications').where({ ...baseFilter, status: _.in(['training', 'training_completed']) }).count(),
        db.collection('applications').where({ ...baseFilter, status: 'qualified' }).count()
      ]);

      return {
        result: {
          success: true,
          data: {
            totalApplications: total.total,
            pendingReview: pending.total,
            inTraining: training.total,
            qualified: qualified.total
          }
        }
      };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      return {
        result: {
          success: false,
          error: error.message
        }
      };
    }
  },

  // 获取培训完成情况
  getTrainingProgress() {
    return getDb().collection('training_records')
      .aggregate()
      .lookup({
        from: 'applications',
        localField: 'application_id',
        foreignField: '_id',
        as: 'application'
      })
      .end();
  },

  // 导出数据（调用云函数生成Excel）
  async exportData(type, filters) {
    try {
      const res = await Cloud.callFunction({
        name: 'exportExcel',
        data: {
          type,
          filters
        }
      });

      return res;
    } catch (error) {
      console.error('导出数据失败:', error);
      return {
        result: {
          success: false,
          error: error.message
        }
      };
    }
  }
};

module.exports = {
  userAPI,
  applicationAPI,
  interviewAPI,
  trainingAPI,
  examAPI,
  practiceAPI,
  checkAPI,
  adminAPI
};
