const xlsx = require('node-xlsx');
const { Application, TrainingRecord, ExamRecord } = require('../models');

exports.exportData = async (req, res) => {
  const { type, workshop } = req.body;
  // Make sure only admins can call this in a real scenario
  const userRole = req.user && req.user.role;
  if (userRole !== 'safety_admin') {
    return res.status(403).json({ success: false, message: '权限不足' });
  }

  try {
    let data = [];
    let headers = [];
    let fields = [];
    let title = '';

    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };

    if (type === 'applications') {
        title = '申请记录';
        headers = ['姓名', '性别', '联系电话', '申请类型', '车间', '学历', '状态', '申请时间'];
        fields = ['name', 'gender', 'phone', 'applicantType', 'workshop', 'education', 'status', 'create_time'];
        const query = workshop ? { workshop } : {};
        data = await Application.find(query).sort({ create_time: -1 }).limit(1000).lean();

    } else if (type === 'exams') {
        title = '考试记录';
        headers = ['得分', '是否通过', '答对题数', '考试时间'];
        fields = ['total_score', 'passed', 'correct_count', 'exam_time'];
        data = await ExamRecord.find().sort({ exam_time: -1 }).limit(1000).lean();

    } else if (type === 'qualified') {
        title = '达标人员';
        headers = ['姓名', '性别', '联系电话', '车间', '达标时间'];
        fields = ['name', 'gender', 'phone', 'workshop', 'update_time'];
        const query = { status: 'qualified' };
        if (workshop) query.workshop = workshop;
        data = await Application.find(query).limit(1000).lean();
    }

    if (data.length === 0) {
        return res.status(404).json({ success: false, message: '没有可导出的数据' });
    }

    const rows = [headers];
    data.forEach(item => {
        const row = fields.map(field => {
            let val = item[field];
            if (field === 'applicantType') val = val === 'internal' ? '本厂' : '外协';
            else if (field === 'gender') val = val === 'male' ? '男' : '女';
            else if (field === 'passed') val = val ? '是' : '否';
            else if (field === 'status') {
                const statusMap = {
                    'pending': '审查中', 'training_completed': '待考试',
                    'exam_passed': '测评达标', 'qualified': '已发证'
                };
                val = statusMap[val] || val;
            } else if (['create_time', 'update_time', 'exam_time'].includes(field)) {
                val = val ? formatDate(val) : '';
            }
            return String(val || '');
        });
        rows.push(row);
    });

    const buffer = xlsx.build([{ name: title, data: rows }]);

    // Express file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(title)}.xlsx`);
    return res.send(buffer);

  } catch (error) {
    console.error('导出失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
