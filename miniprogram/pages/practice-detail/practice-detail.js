const { practiceAPI } = require('../../utils/api');
const { showLoading, hideLoading, showError, showConfirm, showSuccess } = require('../../utils/util');

Page({
    data: {
        mode: 'recitation', // recitation | mock
        questions: [],
        currentIndex: 0,
        showSheet: false,
        showResult: false,
        mockScore: 0,
        correctCount: 0,
        wrongCount: 0,
        mockFinished: false,
        reviewMode: false,
        remainingTime: 3600,
        remainingTimeText: '60:00',
        timer: null
    },

    onLoad(options) {
        const mode = options.mode || 'recitation';
        this.setData({ mode });
        this.loadQuestions();

        if (mode === 'mock') {
            this.startTimer();
        }

        my.setNavigationBarTitle({
            title: mode === 'recitation' ? '背题模式' : '模拟考试'
        });
    },

    onUnload() {
        this.stopTimer();
    },

    async loadQuestions() {
        showLoading('加载题库...');
        try {
            const res = await practiceAPI.getQuestions(this.data.mode);
            if (res.result && res.result.success) {
                const questions = res.result.data.map((q, index) => ({
                    ...q,
                    typeText: this.getQuestionTypeText(q.type),
                    userAnswer: q.type === 'multiple' ? [] : '',
                    answered: false,
                    correctAnswerArray: q.type === 'multiple' ? q.correct_answer.split(',') : [],
                    originalIndex: index
                }));

                // 分组处理
                const groupedQuestions = [
                    { type: 'single', title: '单选题', list: questions.filter(q => q.type === 'single') },
                    { type: 'multiple', title: '多选题', list: questions.filter(q => q.type === 'multiple') },
                    { type: 'judge', title: '判断题', list: questions.filter(q => q.type === 'judge') }
                ].filter(g => g.list.length > 0);

                this.setData({ questions, groupedQuestions });
            } else {
                showError('加载题库失败');
            }
        } catch (error) {
            console.error('加载题库失败:', error);
            showError('网络错误');
        } finally {
            hideLoading();
        }
    },

    getQuestionTypeText(type) {
        const map = { single: '单选题', multiple: '多选题', judge: '判断题' };
        return map[type] || '题目';
    },

    startTimer() {
        this.setData({ remainingTime: 3600 });
        this.data.timer = setInterval(() => {
            let time = this.data.remainingTime - 1;
            if (time <= 0) {
                this.stopTimer();
                this.submitMock();
            }
            this.setData({
                remainingTime: time,
                remainingTimeText: this.formatTime(time)
            });
        }, 1000);
    },

    stopTimer() {
        if (this.data.timer) {
            clearInterval(this.data.timer);
            this.data.timer = null;
        }
    },

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    onOptionTap(e) {
        if (this.data.mockFinished && this.data.reviewMode) return;

        const { questions, currentIndex, mode } = this.data;
        const currentQ = questions[currentIndex];
        const selectedOption = e.currentTarget.dataset.option;

        if (mode === 'recitation' && currentQ.answered) return;

        if (currentQ.type === 'multiple') {
            let userAnswer = currentQ.userAnswer || [];
            const index = userAnswer.indexOf(selectedOption);
            if (index > -1) {
                userAnswer.splice(index, 1);
            } else {
                userAnswer.push(selectedOption);
            }
            this.setData({
                [`questions[${currentIndex}].userAnswer`]: userAnswer
            });
        } else {
            // 单选或判断
            this.setData({
                [`questions[${currentIndex}].userAnswer`]: selectedOption
            }, () => {
                if (mode === 'recitation') {
                    this.setData({
                        [`questions[${currentIndex}].answered`]: true
                    });
                }
            });
        }
    },

    submitMultiAnswer() {
        const { currentIndex, questions } = this.data;
        if (questions[currentIndex].userAnswer.length === 0) {
            showError('请选择答案');
            return;
        }
        this.setData({
            [`questions[${currentIndex}].answered`]: true
        });
    },

    prevQuestion() {
        if (this.data.currentIndex > 0) {
            this.setData({ currentIndex: this.data.currentIndex - 1 });
        }
    },

    nextQuestion() {
        if (this.data.currentIndex < this.data.questions.length - 1) {
            this.setData({ currentIndex: this.data.currentIndex + 1 });
        }
    },

    toggleSheet() {
        this.setData({ showSheet: !this.data.showSheet });
    },

    goToQuestion(e) {
        this.setData({
            currentIndex: e.currentTarget.dataset.index,
            showSheet: false
        });
    },

    async submitMock() {
        const unansweredCount = this.data.questions.filter(q => !q.userAnswer || q.userAnswer.length === 0).length;
        if (unansweredCount > 0 && this.data.remainingTime > 0) {
            try {
                await showConfirm(`还有 ${unansweredCount} 道题未做，确定提交吗？`);
            } catch (e) {
                return;
            }
        }

        this.stopTimer();
        this.calculateScore();
    },

    calculateScore() {
        let score = 0;
        let correct = 0;
        let wrong = 0;
        const { questions } = this.data;

        questions.forEach(q => {
            let isCorrect = false;
            if (q.type === 'multiple') {
                const userSet = new Set(q.userAnswer);
                const correctSet = new Set(q.correctAnswerArray);
                isCorrect = userSet.size === correctSet.size && [...userSet].every(item => correctSet.has(item));
            } else {
                isCorrect = q.userAnswer === q.correct_answer;
            }

            if (isCorrect) {
                correct++;
                score += 2; // 假设每题2分，实际应根据配置
            } else {
                wrong++;
            }
        });

        this.setData({
            mockScore: score,
            correctCount: correct,
            wrongCount: wrong,
            showResult: true,
            mockFinished: true
        });

        // 保存练习历史
        my.setStorageSync('practice_history', {
            mode: this.data.mode,
            time: new Date().toLocaleDateString(),
            score: score
        });
    },

    startReview() {
        this.setData({
            showResult: false,
            reviewMode: true,
            currentIndex: 0
        });
    },

    backToMode() {
        my.navigateBack();
    },

    backHome() {
        my.reLaunch({ url: '/pages/index/index' });
    }
});
