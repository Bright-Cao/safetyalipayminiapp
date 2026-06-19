const { Application } = require('../models');

exports.checkGuardian = async (req, res) => {
  const keyword = req.body.keyword || req.body.idCard;
  if (!keyword) {
    return res.json({ success: false, message: '请输入查询关键字' });
  }

  try {
    const kw = keyword.trim();
    const records = await Application.find({
      $or: [
        { name: new RegExp(kw, 'i') },
        { phone: new RegExp(kw, 'i') }
      ],
      status: { $in: ['qualified', 'training_completed', 'pending', 'exam_passed'] }
    }).select('name workshop status phone update_time').limit(20).lean();

    return res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Check Guardian Error:', error);
    return res.json({ success: false, message: '查询失败' });
  }
};
