// pages/check/check.js
const { checkAPI } = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError } = require('../../utils/util');

Page({
  data: {
    keyword: '',
    searched: false,
    searchResult: null,
    searchHistory: []
  },

  onLoad() {
    this.loadSearchHistory();
  },

  onShow() {
    // 每次显示时刷新
    if (this.data.searched && this.data.keyword) {
      this.handleSearch();
    }
  },


  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  async handleSearch() {
    const { keyword } = this.data;

    if (!keyword || keyword.trim() === '') {
      showError('请输入查询关键词');
      return;
    }

    showLoading('查询中...');

    try {
      const res = await checkAPI.checkGuardianQualification(keyword.trim());

      if (res.result.success && res.result.data) {
        const guardian = res.result.data;

        this.setData({
          searched: true,
          searchResult: guardian
        });

        // 保存查询历史
        this.saveSearchHistory(keyword.trim());
      } else {
        this.setData({
          searched: true,
          searchResult: null
        });
      }

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('查询失败:', error);
      this.setData({
        searched: true,
        searchResult: null
      });
      showError('查询失败');
    }
  },


  loadSearchHistory() {
    const history = my.getStorageSync({ key: 'searchHistory' }).data || [];
    this.setData({ searchHistory: history });
  },

  saveSearchHistory(keyword) {
    let history = my.getStorageSync({ key: 'searchHistory' }).data || [];

    // 移除重复项
    history = history.filter(item => item.keyword !== keyword);

    // 添加到开头
    history.unshift({
      keyword,
      time: new Date().toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    });

    // 最多保存10条
    if (history.length > 10) {
      history = history.slice(0, 10);
    }

    my.setStorageSync({ key: 'searchHistory', data: history });
    this.setData({ searchHistory: history });
  },

  quickSearch(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword }, () => {
      this.handleSearch();
    });
  },

  clearHistory() {
    my.showModal({
      title: '确认清空',
      content: '确定要清空查询历史吗？',
      success: function(res) {
        if (res.confirm) {
          my.removeStorageSync({ key: 'searchHistory' });
          this.setData({ searchHistory: [] });
          showSuccess('已清空');
        }
      }
    });
  }
});
