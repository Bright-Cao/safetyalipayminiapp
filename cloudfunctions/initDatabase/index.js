// 云函数：初始化数据库

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const collections = [
      'applications',
      'users', 
      'interviews',
      'training_videos',
      'training_records',
      'practice_questions',
      'exam_questions',
      'exam_records',
      'notices',
      'sms_codes',
      'activities'
    ];

    const results = [];
    
    for (const collectionName of collections) {
      try {
        // 尝试创建集合（实际上通过控制台创建更方便）
        results.push({
          collection: collectionName,
          message: '请通过云开发控制台手动创建此集合'
        });
      } catch (err) {
        results.push({
          collection: collectionName,
          error: err.message
        });
      }
    }

    return {
      success: true,
      message: '请在云开发控制台手动创建以下数据库集合',
      collections: collections,
      results: results
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
