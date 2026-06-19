import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, Shuffle, List, RotateCcw, BookOpen } from 'lucide-react';

interface PracticeQuestion {
  _id: string;
  type: 'single' | 'multiple' | 'judge';
  question: string;
  options: string[];
  correct_answer: any;
  explanation: string;
}

const TYPE_LABEL: Record<string, string> = { single: '单选题', multiple: '多选题', judge: '判断题' };
const TYPE_COLOR: Record<string, string> = { single: '#3b82f6', multiple: '#8b5cf6', judge: '#f59e0b' };

/** 将数据库答案标准化为"实际文本"数组 */
function normalizeAnswer(raw: any, options: string[]): string[] {
  if (raw === null || raw === undefined) return [];
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw).split(',').map(s => s.trim()).filter(Boolean);

  return parts.map(p => {
    const t = p.trim();
    if (t.toLowerCase() === 'true')  return '正确';
    if (t.toLowerCase() === 'false') return '错误';
    if (/^[A-Z]$/.test(t)) {
      const idx = t.charCodeAt(0) - 65;
      return options[idx] !== undefined ? String(options[idx]).trim() : t;
    }
    return t;
  }).sort();
}

function isAnswerCorrect(userAns: any, question: PracticeQuestion): boolean {
  const correct = normalizeAnswer(question.correct_answer, question.options);
  let user: string[];
  if (Array.isArray(userAns)) {
    user = userAns.map(String).sort();
  } else {
    user = [String(userAns || '').trim()];
    if (user[0].toLowerCase() === 'true')  user = ['正确'];
    if (user[0].toLowerCase() === 'false') user = ['错误'];
  }
  return JSON.stringify(user.sort()) === JSON.stringify(correct.sort());
}

export default function Practice() {
  const [allQuestions, setAllQuestions] = useState<PracticeQuestion[]>([]);
  const [questions,    setQuestions]    = useState<PracticeQuestion[]>([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [answers,      setAnswers]      = useState<Record<string, any>>({});
  const [submitted,    setSubmitted]    = useState<Record<string, boolean>>({});  // 已提交过哪些题
  const [loading,      setLoading]      = useState(true);
  const [mode,         setMode]         = useState<'order' | 'random'>('order');
  const [filterType,   setFilterType]   = useState<'all' | 'single' | 'multiple' | 'judge'>('all');
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });
  const navigate = useNavigate();

  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/getPracticeQuestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ mode: 'all' }),
      });
      const data = await res.json();
      if (data.success) {
        setAllQuestions(data.data);
        applyFilter(data.data, 'all', 'order');
      } else {
        alert(data.message || '获取题目失败');
      }
    } catch { alert('网络错误，请刷新重试'); }
    finally { setLoading(false); }
  };

  const applyFilter = useCallback((src: PracticeQuestion[], type: string, m: 'order' | 'random') => {
    let qs = type === 'all' ? [...src] : src.filter(q => q.type === type);
    if (m === 'random') {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    setQuestions(qs);
    setCurrentIdx(0);
    setAnswers({});
    setSubmitted({});
    setSessionStats({ correct: 0, wrong: 0 });
  }, []);

  const handleFilterChange = (type: typeof filterType) => {
    setFilterType(type);
    applyFilter(allQuestions, type, mode);
  };

  const handleModeChange = (m: 'order' | 'random') => {
    setMode(m);
    applyFilter(allQuestions, filterType, m);
  };

  const currentQ = questions[currentIdx];
  const isSubmitted = currentQ ? !!submitted[currentQ._id] : false;
  const userAnswer  = currentQ ? answers[currentQ._id] : undefined;
  const correct     = currentQ ? normalizeAnswer(currentQ.correct_answer, currentQ.options) : [];

  const handleSelect = (opt: string) => {
    if (isSubmitted) return;
    if (currentQ.type === 'multiple') {
      const cur: string[] = answers[currentQ._id] || [];
      const next = cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt];
      setAnswers(p => ({ ...p, [currentQ._id]: next }));
    } else {
      setAnswers(p => ({ ...p, [currentQ._id]: opt }));
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQ) return;
    const ans = answers[currentQ._id];
    if (!ans || (Array.isArray(ans) && ans.length === 0)) return alert('请选择答案');
    const ok = isAnswerCorrect(ans, currentQ);
    setSubmitted(p => ({ ...p, [currentQ._id]: true }));
    setSessionStats(p => ok
      ? { ...p, correct: p.correct + 1 }
      : { ...p, wrong:   p.wrong   + 1 });
  };

  const isOptSelected  = (opt: string) => {
    const ans = answers[currentQ?._id];
    return Array.isArray(ans) ? ans.includes(opt) : ans === opt;
  };
  const isOptCorrect   = (opt: string) => isSubmitted && correct.includes(opt);
  const isOptWrong     = (opt: string) => {
    const ans = answers[currentQ?._id];
    const sel = Array.isArray(ans) ? ans.includes(opt) : ans === opt;
    return isSubmitted && sel && !correct.includes(opt);
  };

  const optBorderColor = (opt: string) => {
    if (!isSubmitted) return isOptSelected(opt) ? 'var(--primary-color)' : 'var(--border-color)';
    if (isOptCorrect(opt)) return 'var(--success-color)';
    if (isOptWrong(opt))   return 'var(--danger-color)';
    return 'var(--border-color)';
  };
  const optBg = (opt: string) => {
    if (!isSubmitted) return isOptSelected(opt) ? 'rgba(59,130,246,0.1)' : 'transparent';
    if (isOptCorrect(opt)) return 'rgba(16,185,129,0.12)';
    if (isOptWrong(opt))   return 'rgba(239,68,68,0.12)';
    return 'transparent';
  };

  const wasCorrect = isSubmitted && currentQ ? isAnswerCorrect(userAnswer, currentQ) : false;

  if (loading) return <div className="app-container">加载题库中...</div>;
  if (questions.length === 0) return (
    <div className="app-container" style={{ maxWidth: 800 }}>
      <h2 className="text-transparent-gradient">题库练习</h2>
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        题库暂无题目，请联系安全科管理员导入题目。
      </div>
    </div>
  );

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: 800 }}>

      {/* 顶部标题 + 统计 */}
      <header style={{ marginBottom: '1.5rem' }}>
        <h2 className="text-transparent-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={22} /> 题库练习
        </h2>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>题目 {currentIdx + 1} / {questions.length}</span>
          <span style={{ color: 'var(--success-color)' }}>✓ 正确 {sessionStats.correct}</span>
          <span style={{ color: 'var(--danger-color)' }}>✗ 错误 {sessionStats.wrong}</span>
        </div>
      </header>

      {/* 过滤栏 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        {(['all', 'single', 'multiple', 'judge'] as const).map(t => (
          <button key={t} onClick={() => handleFilterChange(t)} style={{
            padding: '0.3rem 0.75rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
            background: filterType === t ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: filterType === t ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s'
          }}>
            {{ all: '全部', single: '单选', multiple: '多选', judge: '判断' }[t]}
            {t !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>
              ({allQuestions.filter(q => q.type === t).length})
            </span>}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => handleModeChange('order')} title="顺序练习" style={{
            padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: mode === 'order' ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: mode === 'order' ? '#fff' : 'var(--text-muted)'
          }}><List size={15} /></button>
          <button onClick={() => handleModeChange('random')} title="随机练习" style={{
            padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: mode === 'random' ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: mode === 'random' ? '#fff' : 'var(--text-muted)'
          }}><Shuffle size={15} /></button>
          <button onClick={() => applyFilter(allQuestions, filterType, mode)} title="重新开始" style={{
            padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)'
          }}><RotateCcw size={15} /></button>
        </div>
      </div>

      {/* 题目卡片 */}
      <div className="glass-panel" style={{ minHeight: 400 }}>
        {/* 题型标签 + 题号 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'center' }}>
          <span style={{
            padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem',
            background: `${TYPE_COLOR[currentQ.type]}22`, color: TYPE_COLOR[currentQ.type]
          }}>
            {TYPE_LABEL[currentQ.type]}
          </span>
          {currentQ.type === 'multiple' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>多选题·可选多项</span>
          )}
        </div>

        {/* 题目正文 */}
        <p style={{ fontSize: '1.05rem', fontWeight: 500, lineHeight: 1.7, marginBottom: '1.5rem' }}>
          {currentIdx + 1}. {currentQ.question}
        </p>

        {/* 选项列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(currentQ.type === 'judge' ? ['正确', '错误'] : currentQ.options).map((opt, i) => {
            const letter = currentQ.type === 'judge' ? (opt === '正确' ? '○' : '×') : String.fromCharCode(65 + i);
            return (
              <div key={opt} onClick={() => handleSelect(opt)} style={{
                padding: '0.85rem 1rem',
                border: `1.5px solid ${optBorderColor(opt)}`,
                borderRadius: '8px',
                cursor: isSubmitted ? 'default' : 'pointer',
                background: optBg(opt),
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                transition: 'all 0.18s',
              }}>
                <span style={{
                  fontWeight: 700, minWidth: '1.5rem',
                  color: isOptCorrect(opt) ? 'var(--success-color)'
                       : isOptWrong(opt)   ? 'var(--danger-color)'
                       : isOptSelected(opt) ? 'var(--primary-color)'
                       : 'var(--text-muted)'
                }}>{letter}</span>
                <span style={{ flex: 1 }}>{opt}</span>
                {isOptCorrect(opt) && <CheckCircle2 size={16} color="var(--success-color)" style={{ flexShrink: 0, marginTop: 2 }} />}
                {isOptWrong(opt)   && <XCircle      size={16} color="var(--danger-color)"   style={{ flexShrink: 0, marginTop: 2 }} />}
              </div>
            );
          })}
        </div>

        {/* 提交按钮（未答题时显示） */}
        {!isSubmitted && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={handleSubmitAnswer} style={{ minWidth: '120px' }}>
              确认答案
            </button>
          </div>
        )}

        {/* 答题结果反馈（提交后显示） */}
        {isSubmitted && (
          <div style={{
            marginTop: '1.5rem', padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: wasCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${wasCorrect ? 'var(--success-color)' : 'var(--danger-color)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem',
                          color: wasCorrect ? 'var(--success-color)' : 'var(--danger-color)' }}>
              {wasCorrect
                ? <><CheckCircle2 size={18} /> 回答正确！</>
                : <><XCircle size={18} /> 回答错误</>
              }
            </div>

            {!wasCorrect && (
              <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>正确答案：</span>
                <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                  {correct.join(' / ')}
                </span>
              </div>
            )}

            {currentQ.explanation && (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '0.5rem',
                            borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>解析：</span>
                {currentQ.explanation}
              </div>
            )}
          </div>
        )}

        {/* 导航按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.75rem',
                      paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary" disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(p => p - 1)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ChevronLeft size={16} /> 上一题
          </button>

          {currentIdx < questions.length - 1 ? (
            <button className="btn btn-primary"
              onClick={() => setCurrentIdx(p => p + 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {isSubmitted ? '下一题' : '跳过'} <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              完成练习
            </button>
          )}
        </div>
      </div>

      {/* 小型题号导航（按题型分组显示） */}
      <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>答题进度</div>
        {(['single', 'multiple', 'judge'] as const).map(type => {
          const typeQs = questions.map((q, i) => ({ q, i })).filter(({ q }) => q.type === type);
          if (typeQs.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', color: TYPE_COLOR[type], marginBottom: '0.4rem' }}>
                {TYPE_LABEL[type]} ({typeQs.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {typeQs.map(({ q, i }) => {
                  const isAnswered = !!submitted[q._id];
                  const wasOk = isAnswered && isAnswerCorrect(answers[q._id], q);
                  return (
                    <div key={q._id} onClick={() => setCurrentIdx(i)} style={{
                      width: 28, height: 28, borderRadius: '4px', cursor: 'pointer',
                      fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: i === currentIdx ? 700 : 400,
                      background: i === currentIdx ? 'var(--primary-color)'
                                : isAnswered ? (wasOk ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)')
                                : 'rgba(255,255,255,0.06)',
                      color: i === currentIdx ? '#fff'
                           : isAnswered ? (wasOk ? 'var(--success-color)' : 'var(--danger-color)')
                           : 'var(--text-muted)',
                      border: `1px solid ${i === currentIdx ? 'var(--primary-color)'
                             : isAnswered ? (wasOk ? 'var(--success-color)' : 'var(--danger-color)')
                             : 'transparent'}`,
                      transition: 'all 0.15s'
                    }}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>返回工作台</button>
      </div>
    </div>
  );
}
