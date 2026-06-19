import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LayoutGrid, X } from 'lucide-react';

interface Question {
  _id: string;
  type: 'single' | 'multiple' | 'judge';
  question: string;
  options: string[];
}

const TYPE_LABEL: Record<string, string> = { single: '单选题', multiple: '多选题', judge: '判断题' };
const TYPE_COLOR: Record<string, string> = { single: '#3b82f6', multiple: '#8b5cf6', judge: '#f59e0b' };
const TYPE_ORDER = ['single', 'multiple', 'judge'];

export default function Exam() {
  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers,    setAnswers]    = useState<Record<string, any>>({});
  const [timeLeft,   setTimeLeft]   = useState(60 * 60);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCard,   setShowCard]   = useState(false);
  const navigate = useNavigate();
  const submitRef = useRef<((forced?: boolean) => void) | undefined>(undefined);

  useEffect(() => { fetchQuestions(); }, []);

  useEffect(() => {
    if (loading || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); submitRef.current?.(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/getExamQuestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success) setQuestions(data.data);
      else alert(data.message);
    } catch { alert('获取题目失败'); }
    finally { setLoading(false); }
  };

  const handleSelect = (questionId: string, opt: string, isMultiple: boolean) => {
    setAnswers(prev => {
      if (isMultiple) {
        const cur: string[] = prev[questionId] || [];
        return { ...prev, [questionId]: cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt] };
      }
      return { ...prev, [questionId]: opt };
    });
  };

  const handleSubmit = async (forced = false) => {
    if (!forced && Object.keys(answers).length < questions.length) {
      const unanswered = questions.length - Object.keys(answers).length;
      if (!window.confirm(`还有 ${unanswered} 题未作答，确定交卷？`)) return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/submitExam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          answers: Object.keys(answers).map(qId => ({ question_id: qId, answer: answers[qId] })),
          time_used: 3600 - timeLeft,
        }),
      });
      const data = await res.json();
      if (data.success) navigate('/exam-result', { state: { result: data.data } });
      else alert(data.message);
    } catch { alert('交卷失败，请重试'); }
    finally { setSubmitting(false); }
  };

  // Keep a stable ref so the timer closure can call it
  submitRef.current = handleSubmit;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const isAnswered = (q: Question) => {
    const a = answers[q._id];
    return a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0);
  };

  const answeredCount = questions.filter(isAnswered).length;

  if (loading) return <div className="app-container">加载试卷中...</div>;
  if (!questions.length) return <div className="app-container">未获取到题目</div>;

  const currentQ = questions[currentIdx];

  // 按题型分组（保持题序）
  const groupedByType: Record<string, { q: Question; idx: number }[]> = {};
  questions.forEach((q, idx) => {
    if (!groupedByType[q.type]) groupedByType[q.type] = [];
    groupedByType[q.type].push({ q, idx });
  });

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: 800 }}>

      {/* 顶栏 */}
      <header className="glass-panel" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.85rem 1.5rem', marginBottom: '1.5rem', position: 'sticky', top: '0.5rem', zIndex: 20
      }}>
        <div>
          <span style={{ fontWeight: 700 }}>铁前监护人资格考试</span>
          <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            已答 {answeredCount} / {questions.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* 答题卡按钮 */}
          <button onClick={() => setShowCard(true)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', color: 'var(--text-color)', fontSize: '0.85rem'
          }}>
            <LayoutGrid size={15} /> 答题卡
          </button>
          {/* 计时器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
                        color: timeLeft < 300 ? 'var(--danger-color)' : 'var(--text-color)',
                        fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
            <Clock size={16} />{formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* 题目卡 */}
      <div className="glass-panel" style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
        {/* 题型 + 题号 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <span style={{
            padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.8rem',
            background: `${TYPE_COLOR[currentQ.type]}22`, color: TYPE_COLOR[currentQ.type]
          }}>
            {TYPE_LABEL[currentQ.type]}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            第 {currentIdx + 1} 题
          </span>
          {currentQ.type === 'multiple' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              多选·可选多项
            </span>
          )}
        </div>

        {/* 题干 */}
        <p style={{ fontSize: '1.05rem', fontWeight: 500, lineHeight: 1.7, marginBottom: '1.5rem' }}>
          {currentQ.question}
        </p>

        {/* 选项 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          {(currentQ.type === 'judge' ? ['正确', '错误'] : currentQ.options).map((opt, i) => {
            const isMultiple = currentQ.type === 'multiple';
            const cur = answers[currentQ._id];
            const selected = isMultiple ? (cur || []).includes(opt) : cur === opt;
            const letter = currentQ.type === 'judge'
              ? (opt === '正确' ? '○' : '×')
              : String.fromCharCode(65 + i);
            return (
              <div key={opt} onClick={() => handleSelect(currentQ._id, opt, isMultiple)} style={{
                padding: '0.9rem 1rem',
                border: `1.5px solid ${selected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                borderRadius: '8px', cursor: 'pointer',
                background: selected ? 'rgba(59,130,246,0.1)' : 'transparent',
                display: 'flex', gap: '0.75rem', transition: 'all 0.18s', alignItems: 'flex-start'
              }}>
                <span style={{ fontWeight: 700, minWidth: '1.4rem',
                               color: selected ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                  {letter}
                </span>
                <span>{opt}</span>
              </div>
            );
          })}
        </div>

        {/* 上一题 / 下一题 / 交卷 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem',
                      paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary" disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(p => p - 1)}>上一题</button>

          {currentIdx < questions.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setCurrentIdx(p => p + 1)}>下一题</button>
          ) : (
            <button className="btn btn-primary" disabled={submitting}
              onClick={() => handleSubmit(false)}>
              {submitting ? '交卷中...' : '确认交卷'}
            </button>
          )}
        </div>
      </div>

      {/* ── 答题卡浮层 ── */}
      {showCard && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }} onClick={() => setShowCard(false)}>
          <div className="glass-panel animate-slide-up" onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 640, maxHeight: '75vh', overflowY: 'auto',
                     borderRadius: '16px 16px 0 0', padding: '1.5rem' }}>

            {/* 答题卡标题 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>答题卡</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  已答 {answeredCount} / {questions.length}
                </span>
              </div>
              <button onClick={() => setShowCard(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
              }}><X size={20} /></button>
            </div>

            {/* 图例 */}
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 14, height: 14, background: 'var(--primary-color)', borderRadius: 3, display: 'inline-block' }} />当前题
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 14, height: 14, background: 'rgba(16,185,129,0.3)', border: '1px solid var(--success-color)', borderRadius: 3, display: 'inline-block' }} />已答
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 14, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 3, display: 'inline-block' }} />未答
              </span>
            </div>

            {/* 按题型分组 */}
            {TYPE_ORDER.filter(t => groupedByType[t]?.length).map(type => (
              <div key={type} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem',
                    background: `${TYPE_COLOR[type]}22`, color: TYPE_COLOR[type]
                  }}>
                    {TYPE_LABEL[type]}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    共 {groupedByType[type].length} 题
                    ·已答 {groupedByType[type].filter(({ q }) => isAnswered(q)).length} 题
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {groupedByType[type].map(({ q, idx }) => {
                    const answered = isAnswered(q);
                    const isCurrent = idx === currentIdx;
                    return (
                      <div key={q._id} onClick={() => { setCurrentIdx(idx); setShowCard(false); }}
                        style={{
                          width: 34, height: 34,
                          borderRadius: '6px', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: isCurrent ? 700 : 400,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isCurrent ? 'var(--primary-color)'
                                    : answered  ? 'rgba(16,185,129,0.2)'
                                    : 'rgba(255,255,255,0.06)',
                          color: isCurrent ? '#fff'
                               : answered  ? 'var(--success-color)'
                               : 'var(--text-muted)',
                          border: `1.5px solid ${isCurrent ? 'var(--primary-color)'
                                 : answered  ? 'var(--success-color)'
                                 : 'rgba(255,255,255,0.1)'}`,
                          transition: 'all 0.15s',
                          transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                        }}>
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 答题卡底部：交卷按钮 */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-primary" style={{ width: '100%' }}
                disabled={submitting} onClick={() => { setShowCard(false); handleSubmit(false); }}>
                {submitting ? '交卷中...' : `确认交卷（已答 ${answeredCount}/${questions.length}）`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
