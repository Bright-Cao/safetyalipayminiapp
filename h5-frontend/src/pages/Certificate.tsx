import React, { useState, useEffect } from 'react';
import { Search, ShieldCheck, Clock, XCircle, BookOpen, PenLine, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string;
  step: number; totalSteps: number; hint: string;
}> = {
  pending_workshop_interview: {
    label: '待车间面试', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',
    step: 1, totalSteps: 4,
    hint: '📋 请等待所属车间领导进行面试审批，面试通过后方可开始培训学习。',
  },
  pending_admin_interview: {
    label: '待安全科审批', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',
    step: 1, totalSteps: 2,
    hint: '📋 请等待安全科进行审批，审批通过后将完成资质认定并发证。',
  },
  pending_training: {
    label: '待培训', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',
    step: 2, totalSteps: 4,
    hint: '🎬 面试已通过！请进入「在线视频学习」观看培训视频（进度≥90%），完成后方可参加理论考试。',
  },
  training_completed: {
    label: '培训完成，待考试', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',
    step: 3, totalSteps: 4,
    hint: '✏️ 培训视频已看完！请前往「理论考试」参加考试，成绩≥80分后自动发证。',
  },
  qualified: {
    label: '合格 / 已发证', color: '#10b981', bg: 'rgba(16,185,129,0.1)',
    step: 4, totalSteps: 4,
    hint: '✅ 资质认定通过',
  },
  rejected: {
    label: '已驳回', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',
    step: 0, totalSteps: 0,
    hint: '❌ 申请已被驳回，请联系安全科了解原因，或重新提交申请。',
  },
  closed: {
    label: '已关闭', color: '#6b7280', bg: 'rgba(107,114,128,0.1)',
    step: 0, totalSteps: 0,
    hint: '⚪ 该流程已被安全科关闭，如需重新认证请重新提交申请。',
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  guardian:         '安全监护人',
  team_leader:      '班组长',
  safety_principal: '协作单位安全科长',
  safety_officer:   '协作专职安全员',
};

const STEPS_4 = ['提交申请', '车间面试', '视频培训', '考试发证'];
const STEPS_3 = ['提交申请', '车间面试', '快速发证'];
const STEPS_2 = ['提交申请', '审批发证'];

export default function Certificate() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [myApps, setMyApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchMyApp(); }, []);

  const fetchMyApp = async () => {
    try {
      const res = await fetch('/api/getMyApplications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success && data.data) setMyApps(data.data);
    } catch (err) { console.error(err); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.length < 2) { alert('请输入至少两位姓名或手机号'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/checkGuardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (data.success) { setResults(data.data); setSearched(true); }
      else alert(data.message);
    } catch { alert('查询失败'); }
    finally { setLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    return (
      <span style={{ color: cfg.color, background: cfg.bg, padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'nowrap' as const }}>
        {cfg.label}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    if (status === 'qualified') return <ShieldCheck size={28} color="#10b981" />;
    if (status === 'rejected') return <XCircle size={28} color="#ef4444" />;
    if (status === 'training_completed') return <PenLine size={28} color="#f59e0b" />;
    if (status === 'pending_training') return <BookOpen size={28} color="#8b5cf6" />;
    return <Clock size={28} color="#3b82f6" />;
  };

  const StepBar = ({ status, fastTrack }: { status: string; fastTrack?: boolean }) => {
    const cfg = STATUS_CONFIG[status];
    if (!cfg || cfg.totalSteps === 0) return null;
    // 快速通道（已持证换发）显示 3 步，且全部完成
    const steps = fastTrack && status === 'qualified'
      ? STEPS_3
      : cfg.totalSteps === 2 ? STEPS_2 : STEPS_4;
    const effectiveStep = fastTrack && status === 'qualified' ? steps.length + 1 : cfg.step;
    return (
      <div style={{ display: 'flex', alignItems: 'center', margin: '0.75rem 0 0.25rem', overflowX: 'auto' as const }}>
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const done   = stepNum < effectiveStep;
          const active = stepNum === effectiveStep;
          const dotColor  = done ? '#10b981' : active ? cfg.color : 'rgba(255,255,255,0.12)';
          const textColor = done ? '#10b981' : active ? cfg.color : 'var(--text-muted)';
          return (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '54px' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: dotColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: active ? `2px solid ${cfg.color}` : 'none',
                  boxShadow: active ? `0 0 8px ${cfg.color}66` : 'none',
                }}>
                  {done
                    ? <CheckCircle2 size={14} color="#fff" />
                    : <span style={{ fontSize: '11px', color: active ? '#fff' : 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{stepNum}</span>
                  }
                </div>
                <span style={{ fontSize: '0.62rem', color: textColor, marginTop: '3px', textAlign: 'center' as const, lineHeight: 1.2 }}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? '#10b981' : 'rgba(255,255,255,0.07)', minWidth: 10, marginBottom: 14 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '600px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 className="text-transparent-gradient">动态资质核验</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1rem' }}>返回</button>
      </header>

      {/* 搜索框 */}
      <form onSubmit={handleSearch} className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', padding: '1.25rem' }}>
        <input
          type="text" placeholder="请输入姓名或手机号搜索"
          value={keyword} onChange={e => setKeyword(e.target.value)}
          className="input-field" style={{ marginBottom: 0, flex: 1, padding: '0.75rem' }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} disabled={loading}>
          <Search size={18} />
        </button>
      </form>

      {/* 查询结果 */}
      {searched && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>人员核验结果 ({results.length})</h3>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => { setSearched(false); setKeyword(''); }}>清除查询</button>
          </div>
          {results.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>未找到相关的达标记录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {results.map((r, i) => (
                <div key={i} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{r.name}</div>
                    {getStatusBadge(r.status)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <div>车间归属: {r.workshop || '无记录'}</div>
                    <div>联系电话: {r.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '无记录'}</div>
                    <div>资质时标: {new Date(r.update_time).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 个人申请进度 */}
      {!searched && (
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>我本人的申请进度与电子凭证</h3>
          {myApps.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              您目前没有任何资质申请记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myApps.map((app, idx) => {
                const cfg = STATUS_CONFIG[app.status] || { hint: '', color: '#6b7280', bg: '' };
                return (
                  <div key={app._id || idx} className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getStatusIcon(app.status)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{app.name}</h3>
                            <div style={{ fontSize: '0.82rem', color: 'var(--primary-color)', marginTop: '0.1rem' }}>
                              [{app.workshop_name || app.workshop}]
                            </div>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>

                        {/* 步骤进度条 */}
                        <StepBar status={app.status} fastTrack={!!app.fast_track} />

                        {/* 详情 + 当前步骤提示 */}
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.83rem', marginTop: '0.5rem' }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <strong>申请类别:</strong> {CATEGORY_LABEL[app.category] || app.category}
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: cfg.hint ? '8px' : 0 }}>
                            <strong>更新时间:</strong> {new Date(app.update_time || app.create_time).toLocaleString()}
                          </div>
                          {cfg.hint && (
                            <div style={{ color: cfg.color, fontSize: '0.82rem', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                              {cfg.hint}
                            </div>
                          )}
                          {app.status === 'qualified' && app.valid_until && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
                              证书有效期至: {new Date(app.valid_until).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
