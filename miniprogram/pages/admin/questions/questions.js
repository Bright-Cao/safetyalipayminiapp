const { showLoading, hideLoading, showSuccess, showError, showConfirm } = require('../../../utils/util');

Page({
    data: {
        settings: {
            passing_score: 80,
            single: { count: 30, score: 2 },
            multiple: { count: 10, score: 4 },
            judge: { count: 10, score: 2 }
        },
        totalScore: 100,
        stats: {
            total: 0,
            single: 0,
            multiple: 0,
            judge: 0
        }
    },

    onLoad() {
        this.loadSettings();
        this.loadStats();
    },

    async loadSettings() {
        showLoading();
        try {
            const db = Cloud.database();
            const res = await db.collection('exam_settings').doc('global_config').get();
            if (res.data) {
                this.setData({ settings: res.data });
                this.calculateTotal();
            }
        } catch (error) {
            console.warn('Load settings failed, using defaults', error);
            // If doc not found, it's fine, will be created on save
        } finally {
            hideLoading();
        }
    },

    async loadStats() {
        try {
            const db = Cloud.database();
            const _ = db.command;
            const countRes = await Promise.all([
                db.collection('exam_questions').count(),
                db.collection('exam_questions').where({ type: 'single' }).count(),
                db.collection('exam_questions').where({ type: 'multiple' }).count(),
                db.collection('exam_questions').where({ type: 'judge' }).count()
            ]);

            this.setData({
                stats: {
                    total: countRes[0].total,
                    single: countRes[1].total,
                    multiple: countRes[2].total,
                    judge: countRes[3].total
                }
            });
        } catch (error) {
            console.error('Load stats failed', error);
        }
    },

    onSettingChange(e) {
        const field = e.currentTarget.dataset.field;
        const value = parseInt(e.detail.value) || 0;

        this.setData({
            [`settings.${field}`]: value
        });
    },

    onConfigChange(e) {
        const type = e.currentTarget.dataset.type;
        const field = e.currentTarget.dataset.field;
        const value = parseInt(e.detail.value) || 0;

        this.setData({
            [`settings.${type}.${field}`]: value
        });

        this.calculateTotal();
    },

    calculateTotal() {
        const { single, multiple, judge } = this.data.settings;
        const total = (single.count * single.score) + (multiple.count * multiple.score) + (judge.count * judge.score);
        this.setData({ totalScore: total });
    },

    async saveSettings() {
        showLoading('保存中...');
        try {
            const db = Cloud.database();
            const { passing_score, single, multiple, judge } = this.data.settings;

            const dbRes = await db.collection('exam_settings').doc('global_config').set({
                data: {
                    passing_score,
                    single,
                    multiple,
                    judge,
                    update_time: new Date()
                }
            });
            showSuccess('保存成功');
        } catch (error) {
            console.error('保存失败', error);
            showError('保存失败');
        } finally {
            hideLoading();
        }
    },

    importQuestions() {
        my.chooseFile({
            count: 1,
            success: async function (res) {
                const file = res.apFilePaths ? res.apFilePaths[0] : (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].path);
                if (file) {
                    this.uploadAndImport(file);
                } else {
                    showError('请选择 Excel 文件');
                }
            }.bind(this),
            fail: function () {
                showError('文件选择失败');
            }
        });
    },

    async uploadAndImport(filePath) {
        showLoading('正在上传...');
        try {
            const cloudPath = `exam_imports/${Date.now()}-${Math.random().toString(36).substr(2)}.xlsx`;
            const uploadRes = await Cloud.uploadFile({
                cloudPath,
                filePath
            });

            showLoading('正在导入...');
            const importRes = await Cloud.callFunction({
                name: 'importExamQuestions',
                data: {
                    fileID: uploadRes.fileID
                }
            });

            importRes.then(function (importRes) {
                if (importRes.result && importRes.result.success) {
                    showSuccess(importRes.result.message);
                    this.loadStats(); // Reload stats
                } else {
                    showError(importRes.result.message || '导入失败');
                }
            }.bind(this)).catch(function (error) {
                console.error('导入流程失败', error);
                showError('导入出错');
            });

        } catch (error) {
            console.error('导入流程失败', error);
            showError('导入出错');
        } finally {
            hideLoading();
        }
    },

    async clearQuestions() {
        try {
            const confirm = await showConfirm('确定要清空所有题目吗？此操作不可恢复。');
            if (confirm) {
                showLoading('正在清空...');
                const res = await Cloud.callFunction({
                    name: 'manageQuestions',
                    data: {
                        action: 'clearAll'
                    }
                });

                res.then(function (res) {
                    if (res.result && res.result.success) {
                        showSuccess(res.result.message);
                        this.loadStats(); // Reload stats
                    } else {
                        showError(res.result.message || '清空失败');
                    }
                }.bind(this)).catch(function (e) {
                    console.error('清空操作失败', e);
                });
            }
        } catch (e) {
            console.error('清空操作失败', e);
        } finally {
            hideLoading();
        }
    }
});
