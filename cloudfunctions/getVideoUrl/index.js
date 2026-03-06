// 云函数：获取云存储文件的临时访问链接（支付宝云函数）
// 用于将 cloud:// 格式的 fileID 转换为可播放的 HTTPS 临时链接
exports.main = async (event, context) => {
    const { fileID } = event;

    if (!fileID) {
        return { success: false, message: 'fileID 不能为空' };
    }

    try {
        // 获取临时链接（有效期2小时）
        const result = await cloud.getTempFileURL({
            fileList: [fileID]
        });

        if (result.fileList && result.fileList.length > 0) {
            const file = result.fileList[0];
            if (file.status === 0 || file.tempFileURL) {
                return {
                    success: true,
                    url: file.tempFileURL,
                    fileID
                };
            }
        }

        return { success: false, message: '获取临时链接失败' };
    } catch (error) {
        console.error('getVideoUrl 失败:', error);
        return { success: false, message: error.message };
    }
};
