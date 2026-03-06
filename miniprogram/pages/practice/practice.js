Page({
    data: {
        hasHistory: false,
        lastMode: '',
        lastTime: '',
        lastScore: null
    },

    onShow() {
        this.loadHistory();
    },

    loadHistory() {
        const history = my.getStorageSync({key: 'practice_history'}).data;
        if (history) {
            this.setData({
                hasHistory: true,
                lastMode: history.mode,
                lastTime: history.time,
                lastScore: history.score
            });
        }
    },

    startPractice(e) {
        const mode = e.currentTarget.dataset.mode;
        my.navigateTo({
            url: `/pages/practice-detail/practice-detail?mode=${mode}`
        });
    }
});
