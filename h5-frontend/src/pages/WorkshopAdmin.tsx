import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const SCORING_ITEMS = [
  { id: 'q1', title: '对监护工作职责的理解',  maxScore: 10, section: '安全意识' },
  { id: 'q2', title: '对作业风险的识别能力',  maxScore: 10, section: '安全意识' },
  { id: 'q3', title: '应急处理能力',           maxScore: 10, section: '安全意识' },
  { id: 'q4', title: '安全操作规程掌握程度',  maxScore: 15, section: '专业知识' },
  { id: 'q5', title: '危险源辨识能力',         maxScore: 15, section: '专业知识' },
  { id: 'q6', title: '防护用品使用知识',       maxScore: 10, section: '专业知识' },
  { id: 'q7', title: '语言表达能力',           maxScore: 10, section: '沟通协调能力' },
  { id: 'q8', title: '团队协作意识',           maxScore: 10, section: '沟通协调能力' },
  { id: 'q9', title: '责任心与敬业精神',       maxScore: 10, section: '工作态度' },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending_workshop_interview: { label: '待车间面试',    color: '#3b82f6' },
  pending_admin_interview:    { label: '待安全科审批',  color: '#3b82f6' },
  pending_training:           { label: '待培训',        color: '#8b5cf6' },
  training_completed:         { label: '培训完成待考试', color: '#f59e0b' },
};

const AH = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function WorkshopAdmin() {
  const [applications,    setApplications]    = useState<any[]>([]);
  const [inProgressApps,  setInProgressApps]  = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [selectedApp,     setSelectedApp]     = useState<any>(null);
  const [activeTab,       setActiveTab]       = useState<'interview' | 'inprogress'>('interview');
  const [closeTarget,     setCloseTarget]     = useState<any>(null);  // 待关闭的申请
  const [closeReason,     setCloseReason]     = useState('');

  const [scores, setScores] = useState<Record<string, number>>({
    q1: 10, q2: 10, q3: 10, q4: 15, q5: 15, q6: 10, q7: 10, q8: 10, q9: 10,
  });
  const [notes, setNotes] = useState('');
  const navigate = useNavigate();

  // 判断当前用户是否安全科/超管
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : {};
  const isSafetyAdmin = ['safety_admin', 'super_admin'].includes(currentUser.role);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const r1 = await fetch('/api/workshop/getApplications', { method: 'POST', headers: AH() });
      const j1 = await r1.json();
      if (j1.success) setApplications(j1.data);

      if (isSafetyAdmin) {
        const r2 = await fetch('/api/workshop/getAllInProgress', { method: 'POST', headers: AH() });
        const j2 = await r2.json();
        if (j2.success) setInProgressApps(j2.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleScoreChange = (id: string, value: number, max: number) => {
    let n = Number(value);
    if (isNaN(n)) n = 0;
    n = Math.min(Math.max(n, 0), max);
    setScores(prev => ({ ...prev, [id]: n }));
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  const handleApprove = async (passed: boolean) => {
    if (!selectedApp) return;
    if (passed && totalScore < 80) return alert('总分未达到80分，不能通过发证');
    try {
      const res = await fetch('/api/workshop/approveInterview', {
        method: 'POST', headers: AH(),
        body: JSON.stringify({ applicationId: selectedApp._id, interviewScore: passed ? totalScore : 0, interviewNotes: notes, passed }),
      });
      const json = await res.json();
      if (json.success) {
        const msg = json.fast_track
          ? '✅ 面试通过！该申请人已持有历史证书，已直接发证（快速通道）。'
          : passed ? '✅ 面试通过！申请人已进入待培训阶段。' : '✅ 已驳回该申请。';
        alert(msg);
        setSelectedApp(null); setNotes('');
        setScores({ q1: 10, q2: 10, q3: 10, q4: 15, q5: 15, q6: 10, q7: 10, q8: 10, q9: 10 });
        fetchAll();
      } else { alert('❌ ' + (json.message || '操作失败')); }
    } catch (e: any) { alert('请求出错: ' + (e?.message || String(e))); }
  };

  const handleClose = async () => {
    if (!closeTarget) return;
    if (!closeReason.trim()) return alert('请填写关闭原因');
    try {
      const res = await fetch('/api/workshop/closeApplication', {
        method: 'POST', headers: AH(),
        body: JSON.stringify({ applicationId: closeTarget._id, reason: closeReason }),
      });
      const json = await res.json();
      if (json.success) {
        alert('✅ 流程已关闭');
        setCloseTarget(null); setCloseReason('');
        fetchAll();
      } else { alert('❌ ' + json.message); }
    } catch (e: any) { alert('请求出错: ' + e?.message); }
  };

  const tabStyle = (active: boolean) => ({
    padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem',
    background: active ? 'var(--primary-color)' : 'rgba(255,255,255,0.07)',
    color: active ? '#fff' : 'var(--text-muted)',
    transition: 'all 0.2s',
  });

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="text-transparent-gradient">车间面试及审批</h2>
        <p className="text-muted">待审批的申请名单</p>
      </header>

      {/* 安全科 Tab */}
      {isSafetyAdmin && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button style={tabStyle(activeTab === 'interview')}   onClick={() => setActiveTab('interview')}>
            待面试审批 {applications.length > 0 && <span style={{ marginLeft: 4, background: '#ef4444', borderRadius: '999px', padding: '0 6px', fontSize: '0.75rem' }}>{applications.length}</span>}
          </button>
          <button style={tabStyle(activeTab === 'inprogress')} onClick={() => setActiveTab('inprogress')}>
            进行中的流程 {inProgressApps.length > 0 && <span style={{ marginLeft: 4, background: '#f59e0b', borderRadius: '999px', padding: '0 6px', fontSize: '0.75rem' }}>{inProgressApps.length}</span>}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted">加载中...</p>
      ) : (
        <>
          {/* Tab: 待面试 */}
          {(!isSafetyAdmin || activeTab === 'interview') && (
            applications.length === 0
              ? <p className="text-muted">当前没有待处理的面试申请。</p>
              : <div style={{ display: 'grid', gap: '1rem' }}>
                  {applications.map(app => (
                    <div key={app._id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>{app.name} - <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{app.phone}</span></h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b5cf6' }}>申请类别: {app.category}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>车间: {app.workshop}</p>
                      </div>
                      <button className="btn btn-primary" onClick={() => setSelectedApp(app)}>面试/审批</button>
                    </div>
                  ))}
                </div>
          )}

          {/* Tab: 进行中流程（仅安全科） */}
          {isSafetyAdmin && activeTab === 'inprogress' && (
            inProgressApps.length === 0
              ? <p className="text-muted">当前没有进行中的申请流程。</p>
              : <div style={{ display: 'grid', gap: '1rem' }}>
                  {inProgressApps.map(app => {
                    const sl = STATUS_LABEL[app.status] || { label: app.status, color: '#6b7280' };
                    return (
                      <div key={app._id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                            <h3 style={{ margin: 0 }}>{app.name}</h3>
                            <span style={{ fontSize: '0.75rem', color: sl.color, background: `${sl.color}22`, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{sl.label}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {app.workshop} · {app.category} · {app.phone}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            更新: {new Date(app.update_time).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => { setCloseTarget(app); setCloseReason(''); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}
                        >
                          <XCircle size={16} /> 关闭流程
                        </button>
                      </div>
                    );
                  })}
                </div>
          )}
        </>
      )}

      {/* 面试评分弹窗 */}
      {selectedApp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1rem', flexShrink: 0 }}>审批: {selectedApp.name}</h3>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>面试评分表（总分100分，80分合格）</div>
              {SCORING_ITEMS.map((item, idx) => {
                const showSection = idx === 0 || SCORING_ITEMS[idx - 1].section !== item.section;
                return (
                  <div key={item.id}>
                    {showSection && <div style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600, color: '#f59e0b' }}>{item.section}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <div style={{ flex: 1, fontSize: '0.9rem' }}>{idx + 1}. {item.title} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({item.maxScore}分)</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="range" min="0" max={item.maxScore} step="1" value={scores[item.id]} onChange={e => handleScoreChange(item.id, Number(e.target.value), item.maxScore)} style={{ width: '100px' }} />
                        <input type="number" className="input-field" value={scores[item.id]} onChange={e => handleScoreChange(item.id, Number(e.target.value), item.maxScore)} style={{ width: '50px', marginBottom: 0, padding: '0.2rem', textAlign: 'center' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>总分</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: totalScore >= 80 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {totalScore} <span style={{ fontSize: '1rem' }}>分 {totalScore >= 80 ? '(合格)' : '(不合格)'}</span>
                </span>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <label className="input-label">面试评语/备注</label>
                <textarea className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="请输入面试评语和建议（选填）" style={{ height: '80px', resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedApp(null)}>取消</button>
              <button className="btn btn-secondary" style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }} onClick={() => handleApprove(false)}>驳回/不通过</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleApprove(true)} disabled={totalScore < 80}>面试通过</button>
            </div>
          </div>
        </div>
      )}

      {/* 关闭流程确认弹窗 */}
      {closeTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={20} /> 关闭申请流程
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              即将关闭 <strong>{closeTarget.name}</strong>（{closeTarget.workshop}）的申请，关闭后用户可重新提交申请。
            </p>
            <label className="input-label">关闭原因（必填）</label>
            <textarea
              className="input-field"
              value={closeReason}
              onChange={e => setCloseReason(e.target.value)}
              placeholder="请说明关闭原因，例如：人员已离职、信息有误、重新申请等"
              style={{ height: '80px', resize: 'none', marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setCloseTarget(null); setCloseReason(''); }}>取消</button>
              <button
                style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', fontWeight: 700 }}
                onClick={handleClose}
              >
                确认关闭
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>返回工作台</button>
      </div>
    </div>
  );
}
