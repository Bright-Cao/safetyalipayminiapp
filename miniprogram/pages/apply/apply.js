// pages/apply/apply.js
const { applicationAPI } = require('../../utils/api');
const { validateIdCard, validatePhone, showLoading, hideLoading, showSuccess, showError, showConfirm, compressImage } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    // 人员类别列表
    categoryList: [
      { id: 'guardian', name: '监护员', desc: '理论+测评' },
      { id: 'safety_manager', name: '管理员', desc: '水平测评' },
      { id: 'safety_officer', name: '安全员', desc: '水平测评' },
      { id: 'team_leader', name: '领班', desc: '综合测评' }
    ],
    categoryIndex: 0,

    formData: {
      name: '',
      gender: 'male',
      idCard: '',
      phone: '',
      applicantType: 'internal', // 'internal' | 'contractor'
      company: '',
      workshop: '',
      contractSigned: 'yes',
      age: '',
      workYears: '',
      education: '',
      isTeamLeader: 'no',
      major: '',
      specialCert: '',
      safetyCert: '',
      // 新增字段
      category: 'guardian',              // 人员类别
      safetyManagementYears: '',         // 安全管理工作年限
      siteManagementYears: '',           // 现场管理工作年限
      hasSocialSecurity: 'yes',          // 是否有社保
      contractMatchSocialSecurity: 'yes', // 合同单位与社保单位是否一致
      safetyCertType: '',                // 安全员证类型
      safetyCertNumber: ''               // 安全员证编号
    },
    workshops: [
      { id: 'ws001', name: '炼铁一车间' },
      { id: 'ws002', name: '炼铁二车间' },
      { id: 'ws003', name: '炼铁三车间' },
      { id: 'ws004', name: '炼铁四车间' },
      { id: 'ws005', name: '炼铁辅助车间' },
      { id: 'ws006', name: '原料一车间' },
      { id: 'ws007', name: '原料二车间' },
      { id: 'ws008', name: '原料三车间' },
      { id: 'ws009', name: '烧结一车间' },
      { id: 'ws010', name: '烧结二车间' },
      { id: 'ws011', name: '烧结三车间' },
      { id: 'ws012', name: '烧结四车间' },
      { id: 'ws013', name: '球团车间' },
      { id: 'ws014', name: '铁前设备科' }
    ],
    workshopIndex: -1,
    educations: ['初中', '高中/中专', '大专', '本科', '硕士及以上'],
    educationIndex: -1,

    // 安全员证类型选项
    safetyCertTypes: [
      { id: 'emergency', name: '应急管理部门颁发' },
      { id: 'construction_b', name: '住建部安全B证' },
      { id: 'construction_c', name: '住建部安全C证' }
    ],
    safetyCertTypeIndex: -1,

    // 图片上传
    idCardImages: [],
    profilePhoto: '',
    otherImages: [],
    safetyCertImages: []  // 安全员证照片
  },

  async onLoad() {
    const userInfo = app.globalData.userInfo;
    const openid = app.globalData.openid || my.getStorageSync({key: 'openid'}).data;

    showLoading('加载中...');
    try {
      // 1. 基础手机号填充
      if (userInfo) {
        this.setData({
          'formData.phone': userInfo.phone || ''
        });
      }

      // 2. 尝试获取之前的申请记录以自动填充
      const res = await applicationAPI.getMyApplications(openid);
      if (res.data && res.data.length > 0) {
        // 优先寻找“已认证”或“考试通过”的记录
        const prevApp = res.data.find(a => ['qualified', 'exam_passed', 'training_completed'].includes(a.status)) || res.data[0];

        console.log('自动填充参考记录:', prevApp);

        const updateData = {
          'formData.name': prevApp.name || '',
          'formData.gender': prevApp.gender || 'male',
          'formData.idCard': prevApp.idCard || '',
          'formData.applicantType': prevApp.applicantType || 'internal',
          'formData.company': prevApp.company || '',
          'formData.contractSigned': prevApp.contractSigned || 'yes',
          'formData.age': prevApp.age || '',
          'formData.workYears': prevApp.workYears || '',
          'formData.education': prevApp.education || '',
          'formData.isTeamLeader': prevApp.isTeamLeader || 'no',
          'formData.major': prevApp.major || '',
          'formData.specialCert': prevApp.specialCert || '',
          'formData.safetyCert': prevApp.safetyCert || '',
          idCardImages: prevApp.id_card_images || [],
          profilePhoto: prevApp.profile_photo || '',
          otherImages: prevApp.other_images || []
        };

        // 处理学历选择
        if (prevApp.education) {
          const eduIndex = this.data.educations.indexOf(prevApp.education);
          if (eduIndex !== -1) {
            updateData.educationIndex = eduIndex;
          }
        }

        // 处理车间逻辑：保持当前选择的车间，不覆盖为旧车间
        if (userInfo && userInfo.workshop_name) {
          updateData['formData.workshop'] = userInfo.workshop_name;
          const wsIndex = this.data.workshops.findIndex(w => w.name === userInfo.workshop_name);
          if (wsIndex !== -1) {
            updateData.workshopIndex = wsIndex;
          }
        }

        this.setData(updateData);
      } else if (userInfo && userInfo.workshop_name) {
        // 如果没有历史记录，仅填充车间
        this.setData({
          'formData.workshop': userInfo.workshop_name,
          workshopIndex: this.data.workshops.findIndex(w => w.name === userInfo.workshop_name)
        });
      }
    } catch (error) {
      console.error('加载历史申请失败:', error);
    } finally {
      hideLoading();
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  onRadioChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  // 人员类别切换
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category;
    const categoryIndex = this.data.categoryList.findIndex(c => c.id === category);
    this.setData({
      'formData.category': category,
      categoryIndex,
      // 切换类别时重置相关字段
      safetyCertTypeIndex: -1,
      'formData.safetyCertType': '',
      'formData.safetyCertNumber': '',
      'formData.safetyManagementYears': '',
      'formData.siteManagementYears': '',
      safetyCertImages: []
    });
  },

  // 安全员证类型切换
  onSafetyCertTypeChange(e) {
    const index = e.detail.value;
    this.setData({
      safetyCertTypeIndex: index,
      'formData.safetyCertType': this.data.safetyCertTypes[index].id
    });
  },

  onWorkshopChange(e) {
    const index = e.detail.value;
    this.setData({
      workshopIndex: index,
      'formData.workshop': this.data.workshops[index].name
    });
  },

  onEducationChange(e) {
    const index = e.detail.value;
    this.setData({
      educationIndex: index,
      'formData.education': this.data.educations[index]
    });
  },

  // 选择图片
  async chooseImage(e) {
    const type = e.currentTarget.dataset.type;
    let maxCount = 4;
    let currentImages = [];

    if (type === 'idCard') {
      maxCount = 2;
      currentImages = this.data.idCardImages;
    } else if (type === 'profile') {
      maxCount = 1;
      currentImages = this.data.profilePhoto ? [this.data.profilePhoto] : [];
    } else if (type === 'safetyCert') {
      maxCount = 2;
      currentImages = this.data.safetyCertImages;
    } else {
      currentImages = this.data.otherImages;
    }

    try {
      const res = await my.chooseImage({
        count: maxCount - currentImages.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      showLoading('上传中...');

      // 上传到云存储
      const uploadPromises = res.tempFilePaths.map(async filePath => {
        const compressedPath = await compressImage(filePath);
        const cloudPath = `applications/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
        return Cloud.uploadFile({
          cloudPath,
          filePath: compressedPath
        });
      });

      const uploadResults = await Promise.all(uploadPromises);
      const fileIds = uploadResults.map(result => result.fileID);

      hideLoading();

      if (type === 'idCard') {
        this.setData({
          idCardImages: [...currentImages, ...fileIds]
        });
      } else if (type === 'profile') {
        this.setData({
          profilePhoto: fileIds[0]
        });
      } else if (type === 'safetyCert') {
        this.setData({
          safetyCertImages: [...currentImages, ...fileIds]
        });
      } else {
        this.setData({
          otherImages: [...currentImages, ...fileIds]
        });
      }

      showSuccess('上传成功');
    } catch (error) {
      hideLoading();
      console.error('上传失败:', error);
      showError('上传失败');
    }
  },

  // 删除图片
  deleteImage(e) {
    const type = e.currentTarget.dataset.type;
    const index = e.currentTarget.dataset.index;

    if (type === 'idCard') {
      const images = this.data.idCardImages;
      images.splice(index, 1);
      this.setData({ idCardImages: images });
    } else if (type === 'profile') {
      this.setData({ profilePhoto: '' });
    } else if (type === 'safetyCert') {
      const images = this.data.safetyCertImages;
      images.splice(index, 1);
      this.setData({ safetyCertImages: images });
    } else {
      const images = this.data.otherImages;
      images.splice(index, 1);
      this.setData({ otherImages: images });
    }
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const type = e.currentTarget.dataset.type;
    let images = [];
    if (type === 'idCard') {
      images = this.data.idCardImages;
    } else if (type === 'profile') {
      images = [this.data.profilePhoto];
    } else if (type === 'safetyCert') {
      images = this.data.safetyCertImages;
    } else {
      images = this.data.otherImages;
    }

    my.previewImage({
      current: url,
      urls: images
    });
  },

  // 表单验证
  validateForm() {
    const { formData, idCardImages, safetyCertImages } = this.data;
    const category = formData.category;

    // === 通用验证 ===
    if (!formData.name) {
      showError('请输入姓名');
      return false;
    }

    if (!validateIdCard(formData.idCard)) {
      showError('请输入正确的身份证号');
      return false;
    }

    if (!validatePhone(formData.phone)) {
      showError('请输入正确的联系电话');
      return false;
    }

    if (!formData.age) {
      showError('请输入年龄');
      return false;
    }

    // === 年龄验证（根据类别不同） ===
    const age = parseInt(formData.age);
    if (category === 'safety_manager') {
      if (isNaN(age) || age < 25 || age > 65) {
        showError('该级别建议年龄满25周岁');
        return false;
      }
    } else {
      if (isNaN(age) || age < 20 || age > 65) {
        showError('该级别建议年龄满20周岁');
        return false;
      }
    }

    if (!formData.company) {
      showError('请输入所属单位');
      return false;
    }

    if (!formData.workshop) {
      showError('请选择申请车间');
      return false;
    }

    // === 学历验证（根据类别不同） ===
    if (!formData.education) {
      showError('请选择学历');
      return false;
    }

    const eduIndex = this.data.educations.indexOf(formData.education);
    if (category === 'guardian') {
      // 监护人：本厂≥高中，协作≥初中
      if (formData.applicantType === 'internal' && eduIndex < 1) {
        showError('本厂人员学历须高中及以上');
        return false;
      }
    } else if (category === 'team_leader') {
      // 班组长：≥初中
      if (eduIndex < 0) {
        showError('班组长学历须初中及以上');
        return false;
      }
    } else {
      // 安全负责人/专职安全员：≥高中
      if (eduIndex < 1) {
        showError('该类别学历须高中及以上');
        return false;
      }
    }

    // === 工作年限验证 ===
    if (category === 'guardian') {
      // 监护人：厂龄/工作年限≥2年
      if (!formData.workYears) {
        showError('请输入厂龄/工作年限');
        return false;
      }
      const workYears = parseFloat(formData.workYears);
      if (isNaN(workYears) || workYears < 2) {
        showError('厂龄/工作年限须满2年');
        return false;
      }
    } else if (category === 'safety_manager' || category === 'safety_officer') {
      // 安全负责人/专职安全员：安全管理≥2年
      if (!formData.safetyManagementYears) {
        showError('请输入安全管理工作年限');
        return false;
      }
      const years = parseFloat(formData.safetyManagementYears);
      if (isNaN(years) || years < 2) {
        showError('安全管理工作年限须满2年');
        return false;
      }
    } else if (category === 'team_leader') {
      // 班组长：现场管理≥1年
      if (!formData.siteManagementYears) {
        showError('请输入现场管理工作年限');
        return false;
      }
      const years = parseFloat(formData.siteManagementYears);
      if (isNaN(years) || years < 1) {
        showError('现场管理工作年限须满1年');
        return false;
      }
    }

    // === 非监护人类别的额外验证 ===
    if (category !== 'guardian') {
      // 社保验证
      if (formData.hasSocialSecurity !== 'yes') {
        showError('请确认具备相关保障');
        return false;
      }
      if (formData.contractMatchSocialSecurity !== 'yes') {
        showError('请确认身份信息一致性');
        return false;
      }

      // 安全员证类型验证
      if (!formData.safetyCertType) {
        showError('请选择安全员证类型');
        return false;
      }

      // 安全负责人可以选应急/住建，其他只能选应急
      if (category !== 'safety_manager' && formData.safetyCertType !== 'emergency') {
        showError('该类别仅支持应急管理部门颁发的安全员证');
        return false;
      }

      // 安全员证照片
      if (safetyCertImages.length === 0) {
        showError('请上传安全员证照片');
        return false;
      }
    }

    // === 通用图片验证 ===
    if (idCardImages.length < 2) {
      showError('请上传身份证正反面照片');
      return false;
    }

    if (!this.data.profilePhoto) {
      showError('请上传个人证件照');
      return false;
    }

    return true;
  },

  // 提交申请
  async handleSubmit() {
    if (!this.validateForm()) {
      return;
    }

    try {
      const confirmed = await showConfirm('确认发起计划吗？提交后将进入测评流程', '确认发起');

      showLoading('提交中...');

      // 获取选中的车间ID
      const selectedWorkshop = this.data.workshops[this.data.workshopIndex];

      const applicationData = {
        ...this.data.formData,
        workshop_id: selectedWorkshop ? selectedWorkshop.id : '',  // 添加车间ID
        workshop_name: this.data.formData.workshop,  // 车间名称
        id_card_images: this.data.idCardImages,
        profile_photo: this.data.profilePhoto, // 个人证件照
        safety_cert_images: this.data.safetyCertImages, // 安全员证照片
        other_images: this.data.otherImages,
        applicant_openid: app.globalData.openid || my.getStorageSync({key: 'openid'}).data,
        status: 'pending',
        create_time: new Date(),
        update_time: new Date()
      };

      const res = await applicationAPI.submitApplication(applicationData);

      hideLoading();

      if (res._id) {
        showSuccess('提交成功');
        setTimeout(() => {
          my.navigateBack();
        }, 1500);
      } else {
        showError('提交失败');
      }
    } catch (error) {
      hideLoading();
      console.error('提交失败:', error);
      if (error !== false) { // 用户取消不显示错误
        showError('提交失败，请稍后重试');
      }
    }
  }
});
