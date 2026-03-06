// 云函数：提交练习题答案

        if (isAllCompleted && record.data.application_id) {
            await db.collection('applications').doc(record.data.application_id).update({
                data: {
                    status: 'training_completed', // Update status to training_completed
                    update_time: new Date()
                }
            });
        }

        return { success: true, isAllCompleted };
    } catch (error) {
        console.error('提交练习失败:', error);
        return { success: false, message: '提交失败' };
    }
};
