// 云函数：发送短信验证码

    return {
      success: true,
      message: '验证码已发送',
      // 为了测试方便，非生产环境可以在日志查看，或者在这里返回（生产环境务必移除）
      // debugCode: code 
    };
  } catch (error) {
    console.error('发送验证码失败:', error);
    return {
      success: false,
      message: '服务繁忙，请稍后重试'
    };
  }
};
