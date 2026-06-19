import React, { useEffect, useState } from 'react';
import {
  BookOpen, Award, CheckCircle, LogOut, Shield, Settings,
  ClipboardList, Dumbbell, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ROLE_SUBTITLE: Record<string, string> = {
  user:             '安全管理人员认证系统',
  applicant:        '安全管理人员认证系统',
  workshop_leader:  '车间审批工作台',
  safety_admin:     '安全科管理工作台',
  super_admin:      '系统超级管理员',
};

// ── 申请状态配置（与 Certificate.tsx 保持一致） ─────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number; totalSteps: number; hint: string }> = {
  pending_workshop_interview: { label: '待车间面试',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  step: 1, totalSteps: 4, hint: '📋 请等待车间领导进行面试审批，面试通过后可开始培训学习。' },
  pending_admin_interview:    { label: '待安全科审批',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  step: 1, totalSteps: 2, hint: '📋 请等待安全科审批，通过后将发证。' },
  pending_training:           { label: '待培训',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', step: 2, totalSteps: 4, hint: '🎬 面试已通过！请前往「在线视频学习」完成培训（进度≥90%）后参加考试。' },
  training_completed:         { label: '培训完成，待考试', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', step: 3, totalSteps: 4, hint: '✏️ 培训已完成！请前往「理论考试」，成绩≥80分后自动发证。' },
  qualified:                  { label: '合格 / 已发证',   color: '#10b981', bg: 'rgba(16,185,129,0.1)', step: 4, totalSteps: 4, hint: '✅ 资质认定通过' },
  rejected:                   { label: '已驳回',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  step: 0, totalSteps: 0, hint: '❌ 申请被驳回，请联系安全科了解原因后重新申请。' },
  closed:                     { label: '已关闭',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)', step: 0, totalSteps: 0, hint: '⚪ 该流程已被安全科关闭，如需重新认证请重新提交申请。' },
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

function StepBar({ status, fastTrack }: { status: string; fastTrack?: boolean }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg || cfg.totalSteps === 0) return null;
  // 快速通道（已持证换发）显示 3 步
  const steps = fastTrack && status === 'qualified'
    ? STEPS_3
    : cfg.totalSteps === 2 ? STEPS_2 : STEPS_4;
  // 快速通道时所有步骤都完成
  const effectiveStep = fastTrack && status === 'qualified' ? steps.length + 1 : cfg.step;
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '0.6rem 0 0.25rem', overflowX: 'auto' as const }}>
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done    = stepNum < effectiveStep;
        const active  = stepNum === effectiveStep;
        const dotColor  = done ? '#10b981' : active ? cfg.color : 'rgba(255,255,255,0.12)';
        const textColor = done ? '#10b981' : active ? cfg.color : 'var(--text-muted)';
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '52px' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: dotColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: active ? `2px solid ${cfg.color}` : 'none',
                boxShadow: active ? `0 0 8px ${cfg.color}66` : 'none',
              }}>
                {done
                  ? <CheckCircle2 size={13} color="#fff" />
                  : <span style={{ fontSize: '10px', color: active ? '#fff' : 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{stepNum}</span>
                }
              </div>
              <span style={{ fontSize: '0.6rem', color: textColor, marginTop: '3px', textAlign: 'center' as const, lineHeight: 1.2 }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#10b981' : 'rgba(255,255,255,0.07)', minWidth: 8, marginBottom: 13 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [user,         setUser]         = useState<any>(null);
  const [allApps,      setAllApps]      = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);   // 车间领导：待处理数
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));

    const token = localStorage.getItem('token');
    const AH = { Authorization: `Bearer ${token}` };

    // 申请人：拉取全部申请
    fetch('/api/getMyApplications', { method: 'POST', headers: AH })
      .then(r => r.json())
      .then(res => { if (res.success && res.data) setAllApps(res.data); })
      .catch(() => {});

    // 车间领导：拉取待处理数量
    const stored = JSON.parse(userData || '{}');
    if (stored.role === 'workshop_leader') {
      fetch('/api/workshop/getApplications', { method: 'POST', headers: AH })
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            const cnt = res.data.filter((a: any) => a.status === 'pending_workshop_interview').length;
            setPendingCount(cnt);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  };

  if (!user) return <div className="app-container">加载中...</div>;

  const role             = user.role || 'user';
  const isAdmin          = ['safety_admin', 'super_admin'].includes(role);
  const isWorkshopLeader = role === 'workshop_leader';
  const isApplicant      = !isAdmin && !isWorkshopLeader;

  // 是否有监护人类别申请（控制是否显示培训/考试菜单）
  const hasGuardianApp = allApps.some(a => a.category === 'guardian');

  // ── 菜单 ──────────────────────────────────────────────────────────────
  type MenuItem = { title: string; subtitle: string; icon: React.ReactNode; path: string; color: string; badge?: number };
  const menuItems: MenuItem[] = [];

  if (isApplicant) {
    menuItems.push({ title: '填写/更新申请表', subtitle: '提交资质认定申请',        icon: <ClipboardList size={28} />, path: '/apply',       color: '#ec4899' });
    if (hasGuardianApp) {
      menuItems.push({ title: '在线视频学习',    subtitle: '监护人必修培训课程',     icon: <BookOpen size={28} />,      path: '/training',    color: '#3b82f6' });
      menuItems.push({ title: '题库练习',        subtitle: '顺序或随机练习，立即查看解析', icon: <Dumbbell size={28} />, path: '/practice',    color: '#a855f7' });
      menuItems.push({ title: '理论考试',        subtitle: '完成考试方可发证',       icon: <CheckCircle size={28} />,   path: '/exam',        color: '#10b981' });
    }
    menuItems.push({ title: '我的电子资质',      subtitle: '查看资质证书和进度',     icon: <Award size={28} />,         path: '/certificate', color: '#f59e0b' });
  }

  if (isWorkshopLeader) {
    menuItems.push({ title: '车间面试审批', subtitle: `${user.workshop_name || '本车间'} 待审申请`, icon: <Shield size={28} />, path: '/workshop-admin', color: '#ef4444', badge: pendingCount });
    menuItems.push({ title: '我的电子资质', subtitle: '查看我的个人资质', icon: <Award size={28} />, path: '/certificate', color: '#f59e0b' });
  }

  if (isAdmin) {
    menuItems.push({ title: '安全科特批审批', subtitle: '审核班组长等特批申请',   icon: <Shield size={28} />,      path: '/workshop-admin', color: '#8b5cf6' });
    menuItems.push({ title: '教学内容管理',   subtitle: '管理培训视频 · 题库导入', icon: <BookOpen size={28} />,    path: '/safety-admin',   color: '#10b981' });
    menuItems.push({ title: '数据后台管理',   subtitle: '人员权限 · 导出报表',     icon: <Settings size={28} />,    path: '/admin',          color: '#3b82f6' });
    menuItems.push({ title: '填写/更新申请表',subtitle: '以工人身份提交申请',      icon: <ClipboardList size={28} />, path: '/apply',          color: '#ec4899' });
  }

  return (
    <div className="app-container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="text-transparent-gradient">欢迎，{user.name}</h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            {ROLE_SUBTITLE[role] || '工作台'}
            {isWorkshopLeader && user.workshop_name && (
              <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontSize: '0.85rem' }}>
                · {user.workshop_name}
              </span>
            )}
          </p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <LogOut size={18} /> 退出
        </button>
      </header>

      {/* ── 菜单卡片 ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {menuItems.map((item, idx) => (
          <div
            key={idx}
            onClick={() => navigate(item.path)}
            className="glass-panel"
            style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', position: 'relative' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {/* 消息气泡 */}
            {item.badge != null && item.badge > 0 && (
              <div style={{
                position: 'absolute', top: '0.6rem', right: '0.6rem',
                background: '#ef4444', color: '#fff',
                borderRadius: '999px', minWidth: '22px', height: '22px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700, padding: '0 5px',
                boxShadow: '0 0 8px #ef444488',
              }}>
                {item.badge}
              </div>
            )}
            <div style={{ display: 'inline-flex', padding: '0.85rem', background: `${item.color}22`, borderRadius: '12px', color: item.color, flexShrink: 0 }}>
              {item.icon}
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>{item.title}</h2>
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 申请人：进度卡（在菜单下方展示） ────────────────────────────── */}
      {isApplicant && allApps.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.03em' }}>
            📑 我的申请进度
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {allApps.map((app, idx) => {
              const cfg = STATUS_CONFIG[app.status] || { label: app.status, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', hint: '', step: 0, totalSteps: 0 };
              return (
                <div key={app._id || idx} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{app.name}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: 'var(--primary-color)' }}>
                        [{app.workshop_name || app.workshop}]
                      </span>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {CATEGORY_LABEL[app.category] || app.category}
                      </div>
                    </div>
                    <span style={{ color: cfg.color, background: cfg.bg, padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', whiteSpace: 'nowrap' as const }}>
                      {cfg.label}
                    </span>
                  </div>

                  <StepBar status={app.status} fastTrack={!!app.fast_track} />

                  {cfg.hint && (
                    <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: cfg.color, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                      {cfg.hint}
                    </div>
                  )}
                  {app.status === 'qualified' && app.valid_until && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      证书有效期至: {new Date(app.valid_until).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
