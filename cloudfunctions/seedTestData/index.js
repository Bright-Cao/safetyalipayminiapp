// 云函数：添加测试数据

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const results = {};

    // 1. 添加通知公告示例
    try {
      await db.collection('notices').add({
        data: {
          title: '欢迎使用监护人培训与考核平台',
          content: '本平台致力于提升监护人员的专业能力和安全意识。',
          type: 'info',
          status: 'active',
          createTime: new Date(),
          updateTime: new Date()
        }
      });
      results.notices = '通知公告添加成功';
    } catch (err) {
      results.notices = `通知公告添加失败: ${err.message}`;
    }

    // 2. 添加培训视频示例
    try {
      await db.collection('training_videos').add({
        data: {
          title: '监护人基础知识培训',
          description: '介绍监护人的基本职责、安全要求和操作规范',
          cover: 'cloud://placeholder.png', // 需要替换为真实的封面图
          url: 'cloud://placeholder.mp4',   // 需要替换为真实的视频文件
          duration: 600, // 10分钟
          min_watch_time: 540, // 至少观看9分钟
          sequence: 1,
          status: 'active',
          createTime: new Date(),
          updateTime: new Date()
        }
      });
      results.training_videos = '培训视频添加成功';
    } catch (err) {
      results.training_videos = `培训视频添加失败: ${err.message}`;
    }

    // 3. 添加练习题示例
    try {
      const practiceQuestions = [
        {
          video_id: 'video_001', // 关联视频ID
          question: '监护人的主要职责是什么？',
          options: ['A. 现场监督', 'B. 技术指导', 'C. 安全监护', 'D. 质量检查'],
          correct_answer: 'C',
          explanation: '监护人的主要职责是进行安全监护，确保作业人员的安全。',
          sequence: 1,
          status: 'active',
          createTime: new Date()
        },
        {
          video_id: 'video_001',
          question: '发现安全隐患时，监护人应该如何处理？',
          options: ['A. 立即制止作业', 'B. 继续观察', 'C. 事后报告', 'D. 不予理会'],
          correct_answer: 'A',
          explanation: '发现安全隐患时，监护人应立即制止作业，确保人员安全。',
          sequence: 2,
          status: 'active',
          createTime: new Date()
        }
      ];

      for (const question of practiceQuestions) {
        await db.collection('practice_questions').add({ data: question });
      }
      results.practice_questions = '练习题添加成功';
    } catch (err) {
      results.practice_questions = `练习题添加失败: ${err.message}`;
    }

    // 4. 添加考试题库示例
    try {
      const examQuestions = [
        // 单选题
        {
          type: 'single',
          question: '监护人在作业现场的首要任务是？',
          options: ['A. 技术指导', 'B. 安全监护', 'C. 质量检查', 'D. 进度管理'],
          correct_answer: 'B',
          score: 2,
          difficulty: 'easy',
          category: '基础知识',
          status: 'active',
          createTime: new Date()
        },
        {
          type: 'single',
          question: '作业人员未佩戴安全帽，监护人应该？',
          options: ['A. 提醒后继续', 'B. 立即制止', 'C. 不予理会', 'D. 事后报告'],
          correct_answer: 'B',
          score: 2,
          difficulty: 'easy',
          category: '安全规范',
          status: 'active',
          createTime: new Date()
        },
        // 多选题
        {
          type: 'multiple',
          question: '监护人应具备的基本素质包括（多选）',
          options: ['A. 责任心强', 'B. 熟悉安全规程', 'C. 善于沟通', 'D. 技术精湛'],
          correct_answer: 'ABC',
          score: 3,
          difficulty: 'medium',
          category: '基础知识',
          status: 'active',
          createTime: new Date()
        },
        // 判断题
        {
          type: 'judge',
          question: '监护人可以在监护过程中临时离开现场处理其他事务。',
          correct_answer: false,
          score: 1,
          difficulty: 'easy',
          category: '安全规范',
          status: 'active',
          createTime: new Date()
        }
      ];

      for (const question of examQuestions) {
        await db.collection('exam_questions').add({ data: question });
      }
      results.exam_questions = '考试题库添加成功';
    } catch (err) {
      results.exam_questions = `考试题库添加失败: ${err.message}`;
    }

    // 5. 添加初始管理员（重要：用于首次登录）
    try {
      const adminPhone = '18796245711'; // 建议修改为你自己的真实手机号
      const checkAdmin = await db.collection('users').where({ phone: adminPhone }).get();
      if (checkAdmin.data.length === 0) {
        await db.collection('users').add({
          data: {
            name: '系统管理员',
            phone: adminPhone,
            role: 'safety_admin',
            status: 'active',
            createTime: new Date(),
            lastLoginTime: new Date()
          }
        });
        results.admin = '初始管理员（13800000000）添加成功';
      } else {
        results.admin = '管理员已存在，无需添加';
      }
    } catch (err) {
      results.admin = `管理员添加失败: ${err.message}`;
    }

    return {
      success: true,
      message: '测试数据添加完成',
      results: results
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
