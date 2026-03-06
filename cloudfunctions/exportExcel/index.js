// 云函数：导出数据为 Excel（支付宝云函数）
const xlsx = require('node-xlsx');

exports.main = async (event, context) => {
    const { type, filters = {} } = event;
    const db = cloud.database();

    try {
        let data = [];
        let headers = [];
        let fields = [];
        let title = '';

        const formatDate = (date, includeTime = false) => {
            if (!date) return '';
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            if (!includeTime) return `${year}-${month}-${day}`;
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            return `${year}${month}${day}_${hour}${minute}`;
        };

        if (type === 'applications') {
            title = '申请记录';
            headers = ['姓名', '性别', '身份证号', '联系电话', '申请类型', '车间', '学历', '状态', '申请时间', '更新时间'];
            fields = ['name', 'gender', 'idCard', 'phone', 'applicantType', 'workshop', 'education', 'status', 'create_time', 'update_time'];
            let query = db.collection('applications');
            if (filters.workshop) query = query.where({ workshop: filters.workshop });
            const res = await query.orderBy('create_time', 'desc').limit(1000).get();
            data = res.data;

        } else if (type === 'trainings') {
            title = '培训记录';
            headers = ['申请ID', '视频进度', '更新时间'];
            fields = ['application_id', 'video_progress', 'update_time'];
            const res = await db.collection('training_records').limit(1000).get();
            data = res.data;

        } else if (type === 'exams') {
            title = '考试记录';
            headers = ['申请ID', '分数', '是否通过', '用时(秒)', '考试时间'];
            fields = ['application_id', 'total_score', 'passed', 'time_used', 'exam_time'];
            const res = await db.collection('exam_records').orderBy('exam_time', 'desc').limit(1000).get();
            data = res.data;

        } else if (type === 'qualified') {
            title = '达标人员';
            headers = ['姓名', '性别', '身份证号', '联系电话', '车间', '达标时间'];
            fields = ['name', 'gender', 'idCard', 'phone', 'workshop', 'exam_time'];
            let query = db.collection('applications').where({ status: 'qualified' });
            if (filters.workshop) query = query.where({ workshop: filters.workshop });
            const res = await query.limit(1000).get();
            data = res.data;
        }

        if (data.length === 0) {
            return { success: false, message: '没有可导出的数据' };
        }

        // 格式化数据行
        const rows = [headers];
        data.forEach(item => {
            const row = fields.map(field => {
                let val = item[field];
                if (field === 'applicantType') val = val === 'internal' ? '本厂' : '协作';
                else if (field === 'gender') val = val === 'male' ? '男' : '女';
                else if (field === 'passed') val = val ? '是' : '否';
                else if (field === 'status') {
                    const statusMap = {
                        'pending': '审查中', 'interview_passed': '评估达标',
                        'training': '自学中', 'training_completed': '自学完成',
                        'exam_pending': '待测评', 'exam_passed': '测评达标',
                        'qualified': '已达标', 'rejected': '已拒绝'
                    };
                    val = statusMap[val] || val;
                } else if (['create_time', 'update_time', 'exam_time'].includes(field)) {
                    val = val ? formatDate(val) : '';
                } else if (field === 'video_progress' && val && typeof val === 'object') {
                    const keys = Object.keys(val);
                    const completed = keys.filter(k => val[k].completed).length;
                    val = `已完成${completed}/${keys.length}`;
                }
                return val || '';
            });
            rows.push(row);
        });

        // 生成 Excel Buffer
        const buffer = xlsx.build([{ name: 'Sheet1', data: rows }]);

        // 上传到云存储
        const cloudPath = `exports/${type}_${Date.now()}.xlsx`;
        const uploadRes = await cloud.uploadFile({ cloudPath, fileContent: buffer });

        // 获取临时链接
        const linkRes = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] });

        return {
            success: true,
            fileID: uploadRes.fileID,
            url: linkRes.fileList[0].tempFileURL,
            filename: `${title}_${formatDate(new Date(), true)}.xlsx`
        };

    } catch (error) {
        console.error('导出失败:', error);
        return { success: false, message: error.message };
    }
};
