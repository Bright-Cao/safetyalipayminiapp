// 云函数：导入考试题目
const xlsx = require('node-xlsx');

        const buffer = res.fileContent;

        // 2. 解析 Excel
        const sheets = xlsx.parse(buffer);
        const sheet = sheets[0]; // 默认取第一个 sheet
        const data = sheet.data;

        // 3. 处理数据
        const questions = [];
        const headers = data[0]; // 第一行是表头

        // 简单映射表头索引
        const headerMap = {};
        headers.forEach((h, index) => {
            if (h) headerMap[h.trim()] = index; // trim 去除空格
        });

        // 从第二行开始遍历
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const typeRaw = row[headerMap['题型']];
            const question = row[headerMap['题目']];
            const optionsRaw = [
                row[headerMap['选项1']],
                row[headerMap['选项2']],
                row[headerMap['选项3']],
                row[headerMap['选项4']]
            ];
            const answerRaw = row[headerMap['正确答案']];
            // headerMap['解析'] will be accessed later

            if (!question || !typeRaw) continue;

            let type = 'single';
            if (typeRaw.includes('多选')) type = 'multiple';
            else if (typeRaw.includes('判断')) type = 'judge';

            // 过滤空选项
            const options = optionsRaw.filter(opt => opt !== undefined && opt !== null && (typeof opt === 'string' ? opt.trim() !== '' : true)).map(String);

            // 处理答案
            let correctAnswer = answerRaw;
            if (typeof correctAnswer === 'string') {
                correctAnswer = correctAnswer.toUpperCase().trim();
                // 如果是多选，且没用逗号分隔（例如 "ABC"），可以尝试拆分
                if (type === 'multiple' && !correctAnswer.includes(',')) {
                    correctAnswer = correctAnswer.split('').join(',');
                }
            }

            // 如果是判断题，转换 A/B 为 正确/错误 (根据Excel实际内容调整，这里假设 A=正确/1, B=错误/2 或 文本匹配)
            // 既然Excel里正确答案是 "正确" 或 "错误"，或者 "A" "B"，需要根据实际情况适配。
            // 用提供的截图来看，判断题的正确答案是 "正确" / "错误"。
            // 我们的系统里判断题可能是 options: ["正确", "错误"]， 答案 "A" 对应 "正确"？
            // 观察截图：
            // 题型：判断题，选项为空，正确答案 "正确" / "错误"
            // 我们的系统 getExamQuestions 需要 options 吗？
            // 如果是判断题，options 默认给 ["正确", "错误"]

            let finalOptions = options;
            if (type === 'judge') {
                finalOptions = ['正确', '错误'];
                // 如果 Excel 里答案写的是 "正确"，那么对应 A (索引0)？ 不是，通常 A=正确 B=错误
                // 我们的系统 submitExam 里怎么比对？通常比对文本或者索引。
                // 让我们统一存文本。
            }

            const explanation = row[headerMap['解析']] || '';

            questions.push({
                type,
                question,
                options: finalOptions,
                correct_answer: String(correctAnswer),
                explanation: String(explanation),
                create_time: new Date(),
                status: 'active'
            });
        }

        // 4. 批量入库
        // 每次限制 1000 条，但云函数 add 限制单次 100? 循环插入
        const BATCH_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < questions.length; i += BATCH_SIZE) {
            const batch = questions.slice(i, i + BATCH_SIZE);
            await db.collection('exam_questions').add({
                data: batch
            });
            successCount += batch.length;
        }

        return {
            success: true,
            count: successCount,
            message: `成功导入 ${successCount} 道题目`
        };

    } catch (error) {
        console.error('导入题目失败:', error);
        return {
            success: false,
            message: '导入失败: ' + error.message
        };
    }
};
