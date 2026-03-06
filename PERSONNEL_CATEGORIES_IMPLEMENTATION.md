# 人员类别扩展实施文档

> 创建时间：2026-01-26
> 目的：新增安全负责人、专职安全员、班组长三类人员的申请和面试流程

---

## 📋 人员类别对比表

| 字段 | 监护人 (guardian) | 安全负责人 (safety_manager) | 专职安全员 (safety_officer) | 班组长 (team_leader) |
|------|------------------|---------------------------|---------------------------|---------------------|
| **年龄要求** | ≥20岁 | ≥25岁 | ≥20岁 | ≥20岁 |
| **学历要求** | 本厂≥高中，协作≥初中 | ≥高中 | ≥高中 | ≥初中 |
| **工作年限** | 厂龄/工作≥2年 | 安全管理≥2年 | 安全管理≥2年 | 现场管理≥1年 |
| **社保要求** | 无 | 有，合同与社保单位一致 | 有，合同与社保单位一致 | 有，合同与社保单位一致 |
| **证书要求** | 无 | 安全员证(应急/住建B/C) | 安全员证(应急) | 安全员证(应急) |
| **面试流程** | 车间→安全科 | 仅安全科 | 仅安全科 | 车间→安全科 |
| **培训** | ✅ 需要 | ❌ 不需要 | ❌ 不需要 | ❌ 不需要 |
| **考试** | ✅ 需要 | ❌ 不需要 | ❌ 不需要 | ❌ 不需要 |
| **及格线** | 考试80分 | 面试80分 | 面试80分 | 面试80分 |

---

## 📊 面试评分标准

### 1. 安全负责人面试评分项
| 序号 | 评分项 | 分值 |
|------|--------|------|
| 1 | 安全生产、职业卫生、消防等法律法规知识储备 | 25分 |
| 2 | 对沙钢相关安全制度的了解 | 25分 |
| 3 | 人员培训组织能力 | 25分 |
| 4 | 应急处理和事故调查能力 | 25分 |
| **合计** | | **100分** |

### 2. 专职安全员面试评分项
| 序号 | 评分项 | 分值 |
|------|--------|------|
| 1 | 沙钢各项安全制度的了解 | 25分 |
| 2 | 现场作业方案及处置方案的制定能力 | 25分 |
| 3 | 各类检修维修和危险作业的安全措施了解程度 | 25分 |
| 4 | 现场事故/事件处理能力 | 25分 |
| **合计** | | **100分** |

### 3. 班组长面试评分项
| 序号 | 评分项 | 分值 |
|------|--------|------|
| 1 | 安全生产方针和法律法规的了解 | 25分 |
| 2 | 沙钢危险作业安全管理制度的了解 | 25分 |
| 3 | KYT的开展的具体流程 | 25分 |
| 4 | 日常工作职责、安全检查等工作要点 | 25分 |
| **合计** | | **100分** |

---

## 🔧 实施步骤

### 步骤1：更新数据结构 (apply.js)

在 `apply.js` 的 `data` 对象中添加以下字段：

```javascript
// 在 data 对象中添加
data: {
  // ... 现有字段保持不变
  
  // 新增：人员类别列表
  categoryList: [
    { id: 'guardian', name: '监护人', desc: '需培训+考试' },
    { id: 'safety_manager', name: '安全负责人', desc: '仅面试' },
    { id: 'safety_officer', name: '专职安全员', desc: '仅面试' },
    { id: 'team_leader', name: '班组长', desc: '仅面试' }
  ],
  categoryIndex: 0,
  
  // 新增：表单扩展字段
  formData: {
    // ... 现有字段保持不变
    
    category: 'guardian',           // 人员类别
    safetyManagementYears: '',      // 安全管理工作年限
    siteManagementYears: '',        // 现场管理工作年限
    hasSocialSecurity: 'yes',       // 是否有社保
    contractMatchSocialSecurity: 'yes', // 合同单位与社保单位是否一致
    safetyCertType: '',             // 安全员证类型
    safetyCertNumber: '',           // 安全员证编号
  },
  
  // 新增：安全员证类型选项
  safetyCertTypes: [
    { id: 'emergency', name: '应急管理部门颁发' },
    { id: 'construction_b', name: '住建部安全B证' },
    { id: 'construction_c', name: '住建部安全C证' }
  ],
  safetyCertTypeIndex: -1,
  
  // 新增：安全员证照片
  safetyCertImages: []
}
```

---

### 步骤2：更新申请表单UI (apply.wxml)

在 `<form>` 标签内的最开头，添加人员类别选择器：

```xml
<!-- 在 "基本信息" section 之前添加 -->
<view class="card">
  <view class="section-title">申请类别</view>
  
  <view class="category-selector">
    <view 
      class="category-item {{formData.category === item.id ? 'active' : ''}}" 
      wx:for="{{categoryList}}" 
      wx:key="id"
      bindtap="onCategoryChange"
      data-category="{{item.id}}"
    >
      <text class="category-name">{{item.name}}</text>
      <text class="category-desc">{{item.desc}}</text>
    </view>
  </view>
</view>
```

在"基本信息"卡片的合适位置，根据类别条件显示不同字段：

```xml
<!-- 社保相关（安全负责人/专职安全员/班组长需要） -->
<block wx:if="{{formData.category !== 'guardian'}}">
  <view class="form-item">
    <text class="form-label">是否有社保 <text class="required">*</text></text>
    <radio-group name="hasSocialSecurity" bindchange="onRadioChange" data-field="hasSocialSecurity">
      <label class="radio-item">
        <radio value="yes" checked="{{formData.hasSocialSecurity === 'yes'}}" />是
      </label>
      <label class="radio-item">
        <radio value="no" checked="{{formData.hasSocialSecurity === 'no'}}" />否
      </label>
    </radio-group>
  </view>

  <view class="form-item">
    <text class="form-label">合同单位与社保单位是否一致 <text class="required">*</text></text>
    <radio-group name="contractMatchSocialSecurity" bindchange="onRadioChange" data-field="contractMatchSocialSecurity">
      <label class="radio-item">
        <radio value="yes" checked="{{formData.contractMatchSocialSecurity === 'yes'}}" />是
      </label>
      <label class="radio-item">
        <radio value="no" checked="{{formData.contractMatchSocialSecurity === 'no'}}" />否
      </label>
    </radio-group>
  </view>
</block>

<!-- 安全管理工作年限（安全负责人/专职安全员需要） -->
<view class="form-item" wx:if="{{formData.category === 'safety_manager' || formData.category === 'safety_officer'}}">
  <text class="form-label">安全管理工作年限 <text class="required">*</text></text>
  <input class="form-input" name="safetyManagementYears" type="digit" placeholder="请输入年限（≥2年）" value="{{formData.safetyManagementYears}}" bindinput="onInput" data-field="safetyManagementYears" />
</view>

<!-- 现场管理工作年限（班组长需要） -->
<view class="form-item" wx:if="{{formData.category === 'team_leader'}}">
  <text class="form-label">现场管理工作年限 <text class="required">*</text></text>
  <input class="form-input" name="siteManagementYears" type="digit" placeholder="请输入年限（≥1年）" value="{{formData.siteManagementYears}}" bindinput="onInput" data-field="siteManagementYears" />
</view>

<!-- 安全员证类型（安全负责人/专职安全员/班组长需要） -->
<block wx:if="{{formData.category !== 'guardian'}}">
  <view class="form-item">
    <text class="form-label">安全员证类型 <text class="required">*</text></text>
    <picker 
      mode="selector" 
      range="{{safetyCertTypes}}" 
      range-key="name" 
      bindchange="onSafetyCertTypeChange" 
      value="{{safetyCertTypeIndex}}"
    >
      <view class="picker-input">
        {{safetyCertTypeIndex >= 0 ? safetyCertTypes[safetyCertTypeIndex].name : '请选择证书类型'}}
      </view>
    </picker>
    <text class="form-hint" wx:if="{{formData.category === 'safety_manager'}}">
      支持：应急管理部门颁发 / 住建部安全B证或C证
    </text>
    <text class="form-hint" wx:else>
      仅支持：应急管理部门颁发
    </text>
  </view>

  <view class="form-item">
    <text class="form-label">安全员证编号</text>
    <input class="form-input" name="safetyCertNumber" placeholder="请输入证书编号" value="{{formData.safetyCertNumber}}" bindinput="onInput" data-field="safetyCertNumber" />
  </view>

  <!-- 安全员证照片上传 -->
  <view class="form-item">
    <text class="form-label">安全员证照片 <text class="required">*</text></text>
    <view class="image-upload">
      <view class="image-list">
        <view class="image-item" wx:for="{{safetyCertImages}}" wx:key="*this">
          <image src="{{item}}" mode="aspectFill" bindtap="previewImage" data-url="{{item}}" data-type="safetyCert" />
          <view class="delete-btn" bindtap="deleteImage" data-type="safetyCert" data-index="{{index}}">×</view>
        </view>
        <view class="upload-btn" bindtap="chooseImage" data-type="safetyCert" wx:if="{{safetyCertImages.length < 2}}">
          <text class="upload-icon">+</text>
          <text class="upload-text">上传证书</text>
        </view>
      </view>
      <text class="form-hint">请上传安全员证正反面照片</text>
    </view>
  </view>
</block>
```

---

### 步骤3：更新申请表单逻辑 (apply.js)

添加以下方法：

```javascript
// 人员类别切换
onCategoryChange(e) {
  const category = e.currentTarget.dataset.category;
  const categoryIndex = this.data.categoryList.findIndex(c => c.id === category);
  this.setData({
    'formData.category': category,
    categoryIndex
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
```

更新 `validateForm` 方法，根据类别进行不同的验证：

```javascript
validateForm() {
  const { formData, idCardImages, safetyCertImages } = this.data;
  const category = formData.category;

  // 通用验证
  if (!formData.name) {
    showError('请输入姓名');
    return false;
  }

  // ... 其他通用验证保持不变 ...

  // 年龄验证（根据类别不同）
  const age = parseInt(formData.age);
  if (category === 'safety_manager' && age < 25) {
    showError('安全负责人年龄须满25周岁');
    return false;
  } else if (age < 20) {
    showError('年龄须满20周岁');
    return false;
  }

  // 学历验证
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

  // 非监护人类别的额外验证
  if (category !== 'guardian') {
    // 社保验证
    if (formData.hasSocialSecurity !== 'yes') {
      showError('该类别须有社保');
      return false;
    }
    if (formData.contractMatchSocialSecurity !== 'yes') {
      showError('合同单位与社保单位须一致');
      return false;
    }

    // 工作年限验证
    if (category === 'safety_manager' || category === 'safety_officer') {
      const years = parseFloat(formData.safetyManagementYears);
      if (isNaN(years) || years < 2) {
        showError('安全管理工作年限须满2年');
        return false;
      }
    } else if (category === 'team_leader') {
      const years = parseFloat(formData.siteManagementYears);
      if (isNaN(years) || years < 1) {
        showError('现场管理工作年限须满1年');
        return false;
      }
    }

    // 安全员证验证
    if (!formData.safetyCertType) {
      showError('请选择安全员证类型');
      return false;
    }
    
    // 安全负责人可以选应急/住建，其他只能选应急
    if (category !== 'safety_manager' && formData.safetyCertType !== 'emergency') {
      showError('该类别仅支持应急管理部门颁发的安全员证');
      return false;
    }

    if (safetyCertImages.length === 0) {
      showError('请上传安全员证照片');
      return false;
    }
  }

  return true;
}
```

更新 `handleSubmit` 方法，包含新字段：

```javascript
const applicationData = {
  ...this.data.formData,
  category: this.data.formData.category, // 人员类别
  workshop_id: selectedWorkshop ? selectedWorkshop.id : '',
  workshop_name: this.data.formData.workshop,
  id_card_images: this.data.idCardImages,
  profile_photo: this.data.profilePhoto,
  safety_cert_images: this.data.safetyCertImages, // 安全员证照片
  other_images: this.data.otherImages,
  applicant_openid: app.globalData.openid || wx.getStorageSync('openid'),
  status: 'pending',
  create_time: new Date(),
  update_time: new Date()
};
```

---

### 步骤4：更新首页流程展示 (index.wxml / index.js)

在 `index.js` 中添加流程步骤数据：

```javascript
data: {
  // ... 现有字段

  // 不同类别的流程步骤
  flowSteps: {
    guardian: [
      { name: '提交申请', icon: '📝' },
      { name: '车间面试', icon: '💬' },
      { name: '安全科面试', icon: '🏢' },
      { name: '培训学习', icon: '📚' },
      { name: '考试认证', icon: '✅' }
    ],
    safety_manager: [
      { name: '提交申请', icon: '📝' },
      { name: '安全科面试', icon: '🏢' },
      { name: '认证通过', icon: '✅' }
    ],
    safety_officer: [
      { name: '提交申请', icon: '📝' },
      { name: '安全科面试', icon: '🏢' },
      { name: '认证通过', icon: '✅' }
    ],
    team_leader: [
      { name: '提交申请', icon: '📝' },
      { name: '车间面试', icon: '💬' },
      { name: '安全科面试', icon: '🏢' },
      { name: '认证通过', icon: '✅' }
    ]
  },
  currentFlowSteps: [], // 当前用户的流程步骤
  currentCategory: 'guardian'
}
```

在 `loadApplicationStatus` 方法中读取类别并设置流程：

```javascript
// 在获取到 application 后
const category = application.category || 'guardian';
this.setData({
  currentCategory: category,
  currentFlowSteps: this.data.flowSteps[category] || this.data.flowSteps.guardian
});
```

---

### 步骤5：更新面试页面 (interview.js / interview.wxml)

添加不同类别的评分标准：

```javascript
// 在 data 中添加
interviewCriteria: {
  guardian: [
    { name: '安全知识掌握程度', maxScore: 25 },
    { name: '应急处理能力', maxScore: 25 },
    { name: '责任心与工作态度', maxScore: 25 },
    { name: '沟通表达能力', maxScore: 25 }
  ],
  safety_manager: [
    { name: '安全生产、职业卫生、消防等法律法规知识储备', maxScore: 25 },
    { name: '对沙钢相关安全制度的了解', maxScore: 25 },
    { name: '人员培训组织能力', maxScore: 25 },
    { name: '应急处理和事故调查能力', maxScore: 25 }
  ],
  safety_officer: [
    { name: '沙钢各项安全制度的了解', maxScore: 25 },
    { name: '现场作业方案及处置方案的制定能力', maxScore: 25 },
    { name: '各类检修维修和危险作业安全措施了解程度', maxScore: 25 },
    { name: '现场事故/事件处理能力', maxScore: 25 }
  ],
  team_leader: [
    { name: '安全生产方针和法律法规的了解', maxScore: 25 },
    { name: '沙钢危险作业安全管理制度的了解', maxScore: 25 },
    { name: 'KYT开展的具体流程', maxScore: 25 },
    { name: '日常工作职责、安全检查等工作要点', maxScore: 25 }
  ]
},
currentCriteria: [], // 当前申请人的评分项
passingScore: 80     // 及格线改为80分
```

根据申请人类别加载对应的评分标准：

```javascript
// 在 loadApplicationDetail 中
const category = application.category || 'guardian';
this.setData({
  currentCriteria: this.data.interviewCriteria[category] || this.data.interviewCriteria.guardian
});
```

面试通过后的状态更新逻辑：

```javascript
// 面试通过后
async handleInterviewPass() {
  const { application, userRole } = this.data;
  const category = application.category || 'guardian';
  
  let newStatus = '';
  
  if (category === 'guardian') {
    // 监护人：根据当前角色决定下一个状态
    if (userRole === 'workshop_leader') {
      newStatus = 'workshop_interview_passed';
    } else {
      newStatus = 'interview_passed'; // 进入培训阶段
    }
  } else if (category === 'safety_manager' || category === 'safety_officer') {
    // 安全负责人/专职安全员：安全科面试通过直接认证
    newStatus = 'qualified';
  } else if (category === 'team_leader') {
    // 班组长：和监护人相同的两级面试流程
    if (userRole === 'workshop_leader') {
      newStatus = 'workshop_interview_passed';
    } else {
      newStatus = 'qualified'; // 安全科面试通过直接认证
    }
  }
  
  // 更新状态...
}
```

---

### 步骤6：更新证书页面 (result.wxml)

在证书上显示人员类别：

```xml
<view class="certificate-category">
  <text>{{categoryName}}</text>
</view>
```

在 `result.js` 中添加类别名称映射：

```javascript
const categoryNames = {
  guardian: '监护人',
  safety_manager: '安全负责人',
  safety_officer: '专职安全员',
  team_leader: '班组长'
};

// 在加载数据后设置
this.setData({
  categoryName: categoryNames[application.category] || '监护人'
});
```

---

## 🧪 测试清单

### 1. 申请流程测试
- [ ] 选择"监护人"类别，验证表单字段正确显示
- [ ] 选择"安全负责人"，验证年龄须≥25岁
- [ ] 选择"专职安全员"，验证只能选择"应急管理部门"证书
- [ ] 选择"班组长"，验证工作年限≥1年
- [ ] 验证安全员证照片上传功能

### 2. 面试流程测试
- [ ] 安全负责人申请：车间领导看不到，安全科可面试
- [ ] 专职安全员申请：车间领导看不到，安全科可面试
- [ ] 班组长申请：车间领导和安全科均可面试
- [ ] 监护人申请：车间领导和安全科均可面试

### 3. 评分测试
- [ ] 验证各类别评分项正确显示
- [ ] 验证80分及格线
- [ ] 验证评分结果正确保存

### 4. 认证测试
- [ ] 安全负责人面试通过后直接显示"已认证"
- [ ] 专职安全员面试通过后直接显示"已认证"
- [ ] 班组长两级面试通过后显示"已认证"
- [ ] 监护人完整流程（面试→培训→考试）后显示"已认证"

### 5. 证书测试
- [ ] 验证证书上显示正确的人员类别名称

---

## ⚠️ 注意事项

1. **向后兼容**：现有的监护人申请记录会自动识别为 `guardian` 类别
2. **权限控制**：安全负责人/专职安全员的待面试列表，车间领导应该看不到
3. **数据迁移**：无需迁移，新字段对老数据无影响

---

## 📅 执行顺序建议

1. **先备份**：在云开发控制台导出 `applications` 集合数据
2. **步骤1-3**：先完成申请表单改造，测试提交功能
3. **步骤4**：更新首页流程展示
4. **步骤5**：更新面试页面
5. **步骤6**：更新证书页面
6. **全流程测试**：创建4种类别的测试申请，验证完整流程

---

如需实施帮助，请告诉我要从哪一步开始，我会提供完整的代码。
