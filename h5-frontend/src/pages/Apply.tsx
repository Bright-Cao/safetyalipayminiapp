import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Pencil } from 'lucide-react';

const WORKSHOPS = [
  '炼铁一车间', '炼铁二车间', '炼铁三车间', '炼铁四车间', '炼铁辅助车间',
  '原料一车间', '原料二车间', '原料三车间',
  '烧结一车间', '烧结二车间', '烧结三车间', '烧结四车间',
  '球团车间', '铁前设备科',
];

export default function Apply() {
  const [formData, setFormData] = useState({
    name:           '',
    gender:         'male',
    phone:          '',
    applicantType:  'internal',
    company:        '',
    workshop:       '',
    contractSigned: 'yes',
    age:            '',
    workYears:      '',
    education:      '',
    isTeamLeader:   'no',
    category:       'guardian',
  });

  const [loading,       setLoading]       = useState(false);
  const [nameIsFixed,   setNameIsFixed]   = useState(false);
  const [isNewUser,     setIsNewUser]     = useState(true);
  const [infoMsg,       setInfoMsg]       = useState('');
  // workshop -> '已持证' | '申请中' | '审核中' | '培训中'
  const [blockedWS,     setBlockedWS]     = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    // ── Step 1: 从 localStorage 读取基础信息 ──
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    const basePhone = stored.phone || '';

    // 判断是否是真实姓名（非"用户xxxx"的自动生成名）
    const storedName = stored.name || '';
    const isRealName = storedName && !/^用户\d{4}$/.test(storedName);

    let prefill: Record<string, any> = { phone: basePhone };
    if (isRealName) prefill.name = storedName;

    // ── Step 2: 拉取历史申请，取最近一条 ──
    try {
      const res = await fetch('/api/getMyApplications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();

      if (data.success && data.data?.length > 0) {
        setIsNewUser(false);

        // ── 计算被锁定的车间 ──
        const STATUS_LABEL: Record<string, string> = {
          qualified:                  '已持证',
          pending_workshop_interview: '审核中',
          pending_admin_interview:    '审核中',
          pending_training:           '培训中',
          training_completed:         '待考试',
        };
        const blocked: Record<string, string> = {};
        for (const app of data.data) {
          const label = STATUS_LABEL[app.status];
          if (label && app.workshop) {
            // 若该车间已持证，且未过期，则锁定
            if (app.status === 'qualified') {
              const validUntil = app.valid_until ? new Date(app.valid_until) : null;
              if (!validUntil || validUntil > new Date()) {
                blocked[app.workshop] = label; // 有效证书
              }
              // 过期证书：不锁定，允许重新申请
            } else {
              // 进行中的申请：锁定
              blocked[app.workshop] = label;
            }
          }
        }
        setBlockedWS(blocked);

        const prev = data.data[0];

        // 姓名强绑定：历史申请里的姓名优先（肯定是真实录入过的）
        const historicalName = prev.name || '';
        if (historicalName) {
          prefill.name = historicalName;
          setNameIsFixed(true);
          setInfoMsg(`您的姓名"${historicalName}"已与手机号 ${basePhone} 绑定，再次申请只需更新车间即可。`);
        }

        // 预填其他可变字段（方便复用，workshop 清空让用户重新选）
        prefill = {
          ...prefill,
          gender:        prev.gender        || 'male',
          applicantType: prev.applicantType || 'internal',
          company:       prev.company       || '',
          age:           prev.age           || '',
          workYears:     prev.workYears     || '',
          education:     prev.education     || '',
          isTeamLeader:  prev.isTeamLeader  || 'no',
          category:      prev.category      || 'guardian',
          workshop:      '',  // 必须重新选择
        };
      }
    } catch {
      // 网络失败不影响表单使用
    }

    setFormData(prev => ({ ...prev, ...prefill }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUnlockName = () => {
    if (window.confirm('修改姓名后将重新绑定到您的手机号，确认修改？')) {
      setNameIsFixed(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.workshop) {
      alert('必填项不完整');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/submitApplication', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ ...formData }),
      });

      const res = await response.json();
      if (res.success) {
        // 同步更新本地缓存中的姓名
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        stored.name = formData.name;
        localStorage.setItem('user', JSON.stringify(stored));

        alert('申请提交成功！');
        navigate('/dashboard');
      } else {
        alert(res.message);
      }
    } catch {
      alert('提交失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  // ── 锁定字段样式 ──
  const lockedStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '600px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="text-transparent-gradient">在线申请表</h2>
        <p className="text-muted">
          {isNewUser ? '首次申请，请如实填写资质审核信息' : '再次申请，更新车间或申请类别即可'}
        </p>
      </header>

      {/* 绑定提示横幅 */}
      {infoMsg && (
        <div style={{
          marginBottom: '1.25rem', padding: '0.85rem 1rem',
          background: 'rgba(59,130,246,0.1)', borderRadius: '8px',
          border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.85rem',
          color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <Lock size={14} style={{ flexShrink: 0 }} />
          {infoMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* 人员类别 */}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">人员类别</label>
          <select name="category" value={formData.category} onChange={handleChange}
            className="input-field" style={{ backgroundColor: 'rgba(15,23,42,0.9)' }}>
            <option value="guardian">监护人 (必考与车间面试)</option>
            <option value="team_leader">班组长 (免考与车间面试)</option>
            <option value="safety_principal">协作单位安全科长 (免考与安全科特派)</option>
            <option value="safety_officer">协作专职安全员 (免考与安全科特派)</option>
          </select>
        </div>

        {/* 姓名（绑定后只读，带解锁入口） */}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label className="input-label" style={{ margin: 0 }}>
              姓名 *
            </label>
            {nameIsFixed && (
              <button type="button" onClick={handleUnlockName} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px'
              }}>
                <Pencil size={11} /> 修改
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text" name="name" value={formData.name}
              onChange={handleChange} className="input-field"
              placeholder="法定真实姓名" required
              readOnly={nameIsFixed}
              style={nameIsFixed ? { ...lockedStyle, marginBottom: 0 } : { marginBottom: 0 }}
            />
            {nameIsFixed && (
              <Lock size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            )}
          </div>
          {nameIsFixed && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              姓名已与您的手机号绑定，如需修改请点击"修改"
            </p>
          )}
        </div>

        {/* 手机号（始终只读） */}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">联系电话 *</label>
          <div style={{ position: 'relative' }}>
            <input
              type="tel" name="phone" value={formData.phone}
              className="input-field" readOnly required
              style={{ ...lockedStyle, marginBottom: 0 }}
            />
            <Lock size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            手机号为登录凭证，如需变更请联系安全科管理员
          </p>
        </div>

        {/* 年龄 + 工龄 */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">年龄 (岁)</label>
            <input type="number" name="age" value={formData.age} onChange={handleChange}
              className="input-field" placeholder="法定年龄" min="16" max="70" style={{ marginBottom: 0 }} />
          </div>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">服务时间 (年)</label>
            <input type="number" name="workYears" value={formData.workYears} onChange={handleChange}
              className="input-field" placeholder="工龄/厂龄" min="0" max="60" style={{ marginBottom: 0 }} />
          </div>
        </div>

        {/* 单位 */}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">所在单位</label>
          <input type="text" name="company" value={formData.company} onChange={handleChange}
            className="input-field" placeholder="所属公司或单位名称" style={{ marginBottom: 0 }} />
        </div>

        {/* 学历 + 是否班组长 */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">学历</label>
            <select name="education" value={formData.education} onChange={handleChange}
              className="input-field" style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: 0 }}>
              <option value="">请选择学历</option>
              <option value="初中">初中</option>
              <option value="高中">高中</option>
              <option value="中专">中专</option>
              <option value="中技">中技</option>
              <option value="大专">大专</option>
              <option value="本科">本科</option>
              <option value="硕士研究生">硕士研究生</option>
              <option value="博士研究生">博士研究生</option>
            </select>
          </div>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">是否班组长</label>
            <select name="isTeamLeader" value={formData.isTeamLeader} onChange={handleChange}
              className="input-field" style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: 0 }}>
              <option value="no">否</option>
              <option value="yes">是</option>
            </select>
          </div>
        </div>

        {/* 所属车间（每次必须重新选） */}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">
            所属车间 (或外委区域) *
            {!isNewUser && (
              <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#f59e0b' }}>
                · 请重新选择本次申请车间
              </span>
            )}
          </label>
          <select name="workshop" value={formData.workshop} onChange={handleChange}
            className="input-field" style={{ backgroundColor: 'rgba(15,23,42,0.9)' }} required>
            <option value="">请选择车间</option>
            {WORKSHOPS.map(w => {
              const blockLabel = blockedWS[w];
              return (
                <option key={w} value={w} disabled={!!blockLabel}
                  style={blockLabel ? { color: '#6b7280' } : undefined}>
                  {blockLabel ? `${w}（${blockLabel}）` : w}
                </option>
              );
            })}
          </select>
          {Object.keys(blockedWS).length > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              标注「已持证」的车间证书有效，不可重复申请；标注「审核中/培训中」的车间申请进行中，请等待审批完成。
            </p>
          )}
        </div>

        {/* 隐私同意 */}
        <div style={{ padding: '0.5rem 0', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" id="privacyConsent" name="privacyConsent" required style={{ marginTop: '0.25rem' }} />
          <label htmlFor="privacyConsent" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            本人知晓并同意，填写的信息（包含手机号、真实姓名及车间）仅用于本次资质认定与考核建档，平台将严格履行内部保密义务。
          </label>
        </div>

        {/* 提交按钮 */}
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ flex: 1 }}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? '提交中...' : '提交审批'}
          </button>
        </div>
      </form>
    </div>
  );
}
