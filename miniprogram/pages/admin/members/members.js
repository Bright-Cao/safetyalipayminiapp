// pages/admin/members/members.js
const { showLoading, hideLoading, showError, showSuccess, showConfirm, validatePhone } = require('../../../utils/util');

Page({
    data: {
        users: [],
        filteredUsers: [],
        searchQuery: '',
        showModal: false,
        isEdit: false,
        formData: {
            name: '',
            phone: '',
            role: 'applicant',
            workshop_id: '',
            workshop_name: ''
        },
        roleOptions: [
            { value: 'applicant', label: '申请人' },
            { value: 'workshop_leader', label: '车间领导' },
            { value: 'safety_admin', label: '安全科' },
            { value: 'checker', label: '检查人员' }
        ],
        roleIndex: 0,
        workshopOptions: [
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
        roleTextMap: {
            'applicant': '申请人',
            'workshop_leader': '车间领导',
            'safety_admin': '安全科',
            'checker': '检查人员'
        }
    },

    onLoad() {
        this.loadUsers();
    },

    async loadUsers() {
        showLoading();
        try {
            const db = Cloud.database();
            const res = await db.collection('users').limit(100).get();
            this.setData({
                users: res.data,
                filteredUsers: res.data
            });
            hideLoading();
        } catch (error) {
            hideLoading();
            showError('加载失败');
        }
    },

    onSearchInput(e) {
        const query = e.detail.value.toLowerCase();
        const filtered = this.data.users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.phone.includes(query)
        );
        this.setData({
            searchQuery: query,
            filteredUsers: filtered
        });
    },

    showAddModal() {
        this.setData({
            showModal: true,
            isEdit: false,
            roleIndex: 0,
            workshopIndex: -1,
            formData: {
                name: '',
                phone: '',
                role: 'applicant',
                workshop_id: '',
                workshop_name: ''
            }
        });
    },

    showEditModal(e) {
        const user = e.currentTarget.dataset.user;
        const roleIndex = this.data.roleOptions.findIndex(r => r.value === user.role);
        const workshopIndex = this.data.workshopOptions.findIndex(w => w.id === user.workshop_id);

        this.setData({
            showModal: true,
            isEdit: true,
            roleIndex: roleIndex >= 0 ? roleIndex : 0,
            workshopIndex: workshopIndex,
            formData: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                workshop_id: user.workshop_id || '',
                workshop_name: user.workshop_name || ''
            }
        });
    },

    hideModal() {
        this.setData({ showModal: false });
    },

    onModalInput(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({
            [`formData.${field}`]: e.detail.value
        });
    },

    onRoleChange(e) {
        const index = e.detail.value;
        const role = this.data.roleOptions[index].value;
        this.setData({
            roleIndex: index,
            'formData.role': role
        });
    },

    onWorkshopChange(e) {
        const index = e.detail.value;
        const workshop = this.data.workshopOptions[index];
        this.setData({
            workshopIndex: index,
            'formData.workshop_id': workshop.id,
            'formData.workshop_name': workshop.name
        });
    },

    async handleSubmit() {
        const { formData, isEdit } = this.data;

        if (!formData.name) return showError('请填写姓名');
        if (!validatePhone(formData.phone)) return showError('手机号不正确');

        if ((formData.role === 'workshop_leader' || formData.role === 'applicant') && !formData.workshop_id) {
            return showError('请选择所属车间');
        }

        showLoading('提交中...');
        const db = Cloud.database();

        try {
            if (isEdit) {
                await db.collection('users').doc(formData._id).update({
                    data: {
                        name: formData.name,
                        role: formData.role,
                        workshop_id: formData.workshop_id,
                        workshop_name: formData.workshop_name,
                        updateTime: new Date()
                    }
                });
            } else {
                // 先检查是否已存在
                const check = await db.collection('users').where({ phone: formData.phone }).get();
                if (check.data.length > 0) {
                    hideLoading();
                    return showError('该手机号已存在');
                }

                await db.collection('users').add({
                    data: {
                        ...formData,
                        status: 'active',
                        createTime: new Date(),
                        lastLoginTime: new Date()
                    }
                });
            }

            hideLoading();
            showSuccess(isEdit ? '更新成功' : '添加成功');
            this.hideModal();
            this.loadUsers();
        } catch (error) {
            hideLoading();
            showError('提交失败');
        }
    },

    async handleDelete(e) {
        const { id, name } = e.currentTarget.dataset;
        try {
            const confirmed = await showConfirm(`确定要移除成员 ${name} 吗？`);
            if (confirmed) {
                showLoading('删除中...');
                const db = Cloud.database();
                await db.collection('users').doc(id).remove();
                hideLoading();
                showSuccess('已移除');
                this.loadUsers();
            }
        } catch (error) {
            hideLoading();
        }
    }
});
