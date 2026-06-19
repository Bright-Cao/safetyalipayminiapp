import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, HardHat, Users, ArrowLeft, Building2, ShieldCheck } from 'lucide-react';

type Step = 'home' | 'admin_type' | 'phone';
type EntryMode = 'applicant' | 'workshop_leader' | 'safety_admin';

const ENTRY_CONFIG: Record<EntryMode, { title: string; subtitle: string; color: string; icon: React.ReactNode }> = {
  applicant: {
    title: '申请人入口',
    subtitle: '外委施工人员 · 资质认定申请',
    color: '#ec4899',
    icon: <HardHat size={34} />,
  },
  workshop_leader: {
    title: '车间领导入口',
    subtitle: '车间面试审批 · 资质认定管理',
    color: '#f59e0b',
    icon: <Building2 size={34} />,
  },
  safety_admin: {
    title: '安全科入口',
    subtitle: '安全科 · 超管 · 数据后台管理',
    color: '#3b82f6',
    icon: <ShieldCheck size={34} />,
  },
};

export default function Login({ setAuth }: { setAuth: (val: boolean) => void }) {
  const [step, setStep] = useState<Step>('home');
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 11) {
      alert('请输入正确的11位手机号');
      return;
    }

    // applicant = 申请人，其他两种都属于 admin 模式走后端权限校验
    const loginMode = entryMode === 'applicant' ? 'applicant' : 'admin';

    setLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, loginMode }),
      });

      const res = await response.json();
      if (res.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.userInfo));
        setAuth(true);
        navigate('/dashboard');
      } else {
        alert(res.message);
      }
    } catch {
      alert('登录失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'phone') {
      setStep(entryMode === 'applicant' ? 'home' : 'admin_type');
    } else {
      setStep('home');
    }
    setPhone('');
  };

  // ── 第一步：主入口选择 ─────────────────────────────
  if (step === 'home') {
    return (
      <div className="auth-container" style={{ flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <Shield size={52} color="var(--primary-color)" />
          <h2 style={{ marginTop: '1rem', fontSize: '1.35rem' }}>铁前总厂安全管理人员认证系统</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>内部专用，请选择您的身份入口</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '360px' }}>
          <EntryCard
            icon={<HardHat size={30} />}
            color="#ec4899"
            title="申请人入口"
            subtitle="外委施工人员 · 提交资质认定申请"
            onClick={() => { setEntryMode('applicant'); setStep('phone'); }}
          />
          <EntryCard
            icon={<Users size={30} />}
            color="#3b82f6"
            title="管理人员入口"
            subtitle="安全科 · 车间领导 · 审批与管理"
            onClick={() => setStep('admin_type')}
            showArrow
          />
        </div>
      </div>
    );
  }

  // ── 第二步：管理人员细分 ───────────────────────────
  if (step === 'admin_type') {
    return (
      <div className="auth-container" style={{ flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
          <Users size={48} color="#3b82f6" />
          <h2 style={{ marginTop: '0.75rem', fontSize: '1.2rem' }}>管理人员入口</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>请选择您的管理角色</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '360px' }}>
          <EntryCard
            icon={<Building2 size={28} />}
            color="#f59e0b"
            title="车间领导"
            subtitle="车间级审批 · 面试打分 · 认定管理"
            onClick={() => { setEntryMode('workshop_leader'); setStep('phone'); }}
          />
          <EntryCard
            icon={<ShieldCheck size={28} />}
            color="#3b82f6"
            title="安全科 / 系统管理"
            subtitle="安全科特批 · 人员权限 · 数据后台"
            onClick={() => { setEntryMode('safety_admin'); setStep('phone'); }}
          />
        </div>

        <button
          onClick={goBack}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem' }}
        >
          <ArrowLeft size={16} /> 返回
        </button>
      </div>
    );
  }

  // ── 第三步：手机号登录 ─────────────────────────────
  const config = ENTRY_CONFIG[entryMode!];
  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '1rem',
            background: `${config.color}18`,
            borderRadius: '50%',
            color: config.color,
            marginBottom: '1rem'
          }}>
            {config.icon}
          </div>
          <h2 style={{ fontSize: '1.2rem' }}>{config.title}</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>{config.subtitle}</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">手机号码</label>
            <input
              type="tel"
              className="input-field"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="请输入手机号"
              maxLength={11}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            disabled={loading}
          >
            {loading ? '正在验证...' : '安全登录'}
          </button>

          <button
            type="button"
            onClick={goBack}
            className="btn btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={16} /> 返回上一步
          </button>
        </form>
      </div>
    </div>
  );
}

// ── 通用入口卡片组件 ───────────────────────────────
function EntryCard({ icon, color, title, subtitle, onClick, showArrow }: {
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  showArrow?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="glass-panel"
      style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '1.4rem',
        transition: 'transform 0.18s',
        border: `1px solid ${color}33`,
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{
        padding: '0.85rem',
        background: `${color}18`,
        borderRadius: '12px',
        color,
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '1.02rem', marginBottom: '0.2rem' }}>{title}</div>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>{subtitle}</div>
      </div>
      {showArrow && <div style={{ color, fontSize: '1.2rem' }}>›</div>}
    </div>
  );
}
