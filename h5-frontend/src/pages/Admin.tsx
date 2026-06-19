import { useState, useEffect } from 'react';
import { Download, Users, Shield, Video, BookOpen, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WORKSHOPS = [
  '炼铁一车间','炼铁二车间','炼铁三车间','炼铁四车间','炼铁辅助车间',
  '原料一车间','原料二车间','原料三车间',
  '烧结一车间','烧结二车间','烧结三车间','烧结四车间',
  '球团车间','铁前设备科'
];

const ROLE_LABELS: Record<string, string> = {
  user: '普通工人',
  workshop_leader: '车间领导',
  safety_admin: '安全科管理员',
  super_admin: '超级管理员',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'var(--text-muted)',
  workshop_leader: '#f59e0b',
  safety_admin: '#3b82f6',
  super_admin: '#ef4444',
};

interface UserItem {
  _id: string;
  phone: string;
  name?: string;
  role?: string;
  workshop_name?: string;
  createTime?: string;
}

const emptyNew = { phone: '', name: '', role: 'workshop_leader', workshop_name: '' };

export default function Admin() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newWorkshop, setNewWorkshop] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 新增人员弹窗
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyNew);
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();
  const myRole = JSON.parse(localStorage.getItem('user') || '{}').role;

  const postAPI = (path: string, body: object) =>
    fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(body),
    }).then(r => r.json());

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await postAPI('admin/getAllUsers', {});
      if (data.success) setUsers(data.data);
      else alert(data.message);
    } catch { alert('加载用户列表失败'); }
    finally { setUsersLoading(false); }
  };

  useEffect(() => {
    if (['super_admin', 'safety_admin'].includes(myRole)) fetchUsers();
  }, []);

  const handleUpdateRole = async () => {
    if (!editingUser || !newRole) return;
    const data = await postAPI('admin/updateUserRole', {
      userId: editingUser._id, role: newRole, workshop_name: newWorkshop
    });
    if (data.success) { alert('✅ 角色更新成功！'); setEditingUser(null); fetchUsers(); }
    else alert(data.message);
  };

  const handleCreateUser = async () => {
    if (!createForm.phone || !createForm.name || !createForm.role) {
      return alert('请填写手机号、姓名和角色');
    }
    setCreating(true);
    const data = await postAPI('admin/createUser', createForm);
    setCreating(false);
    if (data.success) {
      alert('✅ ' + data.message);
      setShowCreate(false);
      setCreateForm(emptyNew);
      fetchUsers();
    } else {
      alert('❌ ' + data.message);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (!confirm(`确认删除账号「${u.name || u.phone}」？此操作不可恢复。`)) return;
    const data = await postAPI('admin/deleteUser', { userId: u._id });
    if (data.success) { alert('✅ ' + data.message); fetchUsers(); }
    else alert('❌ ' + data.message);
  };

  const handleExport = async (type: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/exportData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ type })
      });
      if (!response.ok) {
        if (response.status === 403) alert('权限不足：仅管理员可用');
        else if (response.status === 404) alert('没有可导出的数据');
        else alert('导出失败');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_data.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch { alert('导出发生网络错误'); }
    finally { setLoading(false); }
  };

  const filteredUsers = users.filter(u =>
    (u.phone || '').includes(searchKeyword) ||
    (u.name || '').includes(searchKeyword) ||
    (u.workshop_name || '').includes(searchKeyword)
  );

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '900px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="text-transparent-gradient">安全科管理后台</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1rem' }}>返回工作台</button>
      </header>

      {/* 人员权限管理 */}
      {['super_admin', 'safety_admin'].includes(myRole) && (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={20} color="#3b82f6" />
              人员权限管理
            </h3>
            {myRole === 'super_admin' && (
              <button className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.88rem' }}
                onClick={() => { setCreateForm(emptyNew); setShowCreate(true); }}>
                <Plus size={15} />新增人员
              </button>
            )}
          </div>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            为车间领导、安全科人员分配系统角色；也可预先录入账号，对方直接用手机号登录即生效。
          </p>

          <input
            type="text" className="input-field"
            placeholder="🔍 搜索姓名/手机号/车间..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            style={{ marginBottom: '1rem' }}
          />

          {usersLoading ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载中...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
              {filteredUsers.map(u => (
                <div key={u._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'rgba(15,23,42,0.5)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px', gap: '0.5rem', flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <div style={{ fontWeight: 500 }}>
                      {u.name || '未填写'}&nbsp;
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.phone}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {u.workshop_name || '未指定车间'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.78rem', padding: '2px 8px', borderRadius: '20px',
                      border: `1px solid ${ROLE_COLORS[u.role || 'user']}`,
                      color: ROLE_COLORS[u.role || 'user'],
                    }}>
                      {ROLE_LABELS[u.role || 'user'] || u.role}
                    </span>
                    {myRole === 'super_admin' && (<>
                      <button className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => { setEditingUser(u); setNewRole(u.role || 'user'); setNewWorkshop(u.workshop_name || ''); }}>
                        修改角色
                      </button>
                      <button
                        style={{ padding: '0.28rem 0.6rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => handleDeleteUser(u)}>
                        <Trash2 size={14} />
                      </button>
                    </>)}
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>没有找到相关用户</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 内容管理（视频 + 题库） */}
      {['super_admin', 'safety_admin'].includes(myRole) && (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} color="#8b5cf6" />
            教学内容管理
          </h3>
          <p className="text-muted" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            管理系统内的教学视频和考试题库，支持批量导入题目。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/safety-admin')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.5rem' }}>
              <Video size={26} color="#3b82f6" />
              <span style={{ fontWeight: 500 }}>教学视频管理</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>新增 / 编辑 / 停用视频</span>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/safety-admin')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.5rem' }}>
              <BookOpen size={26} color="#8b5cf6" />
              <span style={{ fontWeight: 500 }}>题库管理</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>编辑 / 批量Excel导入题目</span>
            </button>
          </div>
        </div>
      )}

      {/* 数据导出 */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} />
          数据报表导出
        </h3>
        <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          支持将系统数据直接汇算为 Excel 表格并下载。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => handleExport('applications')} disabled={loading}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem' }}>
            <Download size={24} color="var(--primary-color)" />
            <span>导出 [申请流水]</span>
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('qualified')} disabled={loading}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem' }}>
            <Download size={24} color="var(--success-color)" />
            <span>导出 [已发证名册]</span>
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('exams')} disabled={loading}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem' }}>
            <Download size={24} color="#f59e0b" />
            <span>导出 [历史考卷成绩]</span>
          </button>
        </div>
      </div>

      {/* ── 修改角色弹窗 ── */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>修改人员角色</h3>
            <p className="text-muted" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              {editingUser.name || editingUser.phone}
            </p>

            <label className="input-label">新角色</label>
            <select className="input-field" value={newRole} onChange={e => setNewRole(e.target.value)}
              style={{ marginBottom: '1rem', backgroundColor: 'rgba(15,23,42,0.9)' }}>
              <option value="user">普通工人</option>
              <option value="workshop_leader">车间领导</option>
              <option value="safety_admin">安全科管理员</option>
              <option value="super_admin">超级管理员</option>
            </select>

            {(newRole === 'workshop_leader') && (
              <>
                <label className="input-label">所属车间</label>
                <select className="input-field" value={newWorkshop} onChange={e => setNewWorkshop(e.target.value)}
                  style={{ marginBottom: '1rem', backgroundColor: 'rgba(15,23,42,0.9)' }}>
                  <option value="">请选择车间</option>
                  {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingUser(null)}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdateRole}>确认修改</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 新增人员弹窗 ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '0.3rem' }}>新增人员账号</h3>
            <p className="text-muted" style={{ marginBottom: '1.25rem', fontSize: '0.83rem' }}>
              预先录入后，对方直接用手机号登录即可，无需自行注册。
            </p>

            <label className="input-label">手机号 *</label>
            <input className="input-field" style={{ marginBottom: '0.85rem' }} placeholder="11位手机号"
              value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />

            <label className="input-label">姓名 *</label>
            <input className="input-field" style={{ marginBottom: '0.85rem' }} placeholder="真实姓名"
              value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />

            <label className="input-label">角色 *</label>
            <select className="input-field" value={createForm.role}
              onChange={e => setCreateForm(f => ({ ...f, role: e.target.value, workshop_name: '' }))}
              style={{ marginBottom: '0.85rem', backgroundColor: 'rgba(15,23,42,0.9)' }}>
              <option value="user">普通工人</option>
              <option value="workshop_leader">车间领导</option>
              <option value="safety_admin">安全科管理员</option>
              <option value="super_admin">超级管理员</option>
            </select>

            {createForm.role === 'workshop_leader' && (
              <>
                <label className="input-label">所属车间 *</label>
                <select className="input-field" value={createForm.workshop_name}
                  onChange={e => setCreateForm(f => ({ ...f, workshop_name: e.target.value }))}
                  style={{ marginBottom: '0.85rem', backgroundColor: 'rgba(15,23,42,0.9)' }}>
                  <option value="">请选择车间</option>
                  {WORKSHOPS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </>
            )}

            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              💡 创建后对方用该手机号登录，系统会自动识别其角色和权限，无需密码。
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateUser} disabled={creating}>
                {creating ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
