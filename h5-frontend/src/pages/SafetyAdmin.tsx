import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, BookOpen, Plus, Trash2, Edit2, Upload, X, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';

const API = (path: string, body: object) =>
  fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(body),
  }).then(r => r.json());

type Tab = 'videos' | 'questions' | 'settings';

interface VideoItem { _id: string; title: string; file_id: string; description: string; sort_order: number; status: string; }
interface Question { _id: string; type: string; question: string; options: string[]; correct_answer: any; explanation: string; status: string; }

const TYPE_LABEL: Record<string, string> = { single: '单选题', multiple: '多选题', judge: '判断题' };
const TYPE_COLOR: Record<string, string> = { single: '#3b82f6', multiple: '#8b5cf6', judge: '#10b981' };

export default function SafetyAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('videos');

  // ── Video state ──
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [vModal, setVModal] = useState<Partial<VideoItem> | null>(null);
  const [vSaving, setVSaving] = useState(false);
  const [vUploading, setVUploading] = useState(false);
  const [vUploadProgress, setVUploadProgress] = useState(0);
  const [vUploadName, setVUploadName] = useState('');
  const [vStatusText, setVStatusText] = useState('');
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollTimerRef = useRef<any>(null);

  // ── Question state ──
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qTotal, setQTotal] = useState(0);
  const [qPage, setQPage] = useState(1);
  const [qType, setQType] = useState('');
  const [qKeyword, setQKeyword] = useState('');
  const [qLoading, setQLoading] = useState(false);
  const [qModal, setQModal] = useState<Partial<Question> | null>(null);
  const [qSaving, setQSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Exam Settings state ──
  const [examSettings, setExamSettings] = useState({
    single:   { count: 20, score: 2 },
    multiple: { count: 10, score: 2 },
    judge:    { count: 20, score: 2 },
    pass_score: 80
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => { fetchVideos(); }, []);
  useEffect(() => { fetchQuestions(); }, [qPage, qType]);
  useEffect(() => { if (tab === 'settings') fetchExamSettings(); }, [tab]);

  const fetchVideos = async () => {
    setVLoading(true);
    const d = await API('safety/getVideos', {});
    if (d.success) setVideos(d.data);
    setVLoading(false);
  };

  const fetchQuestions = async () => {
    setQLoading(true);
    const d = await API('safety/getQuestions', { page: qPage, pageSize: 15, type: qType, keyword: qKeyword });
    if (d.success) { setQuestions(d.data); setQTotal(d.total); }
    setQLoading(false);
  };

  const resetUploadState = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setVUploading(false);
    setVUploadProgress(0);
    setVUploadName('');
    setVStatusText('');
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetUploadState();

    setVUploading(true);
    setVUploadProgress(0);
    setVUploadName(file.name);
    setVStatusText('文件上传中...');
    e.target.value = '';

    const isPpt = /\.pptx?$/i.test(file.name);
    const uploadUrl = isPpt ? '/api/upload/ppt' : '/api/upload/video';

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const percent = Math.round((ev.loaded / ev.total) * (isPpt ? 20 : 100));
        setVUploadProgress(percent);
        if (isPpt) setVStatusText(`PPT 上传中... ${Math.round((ev.loaded / ev.total) * 100)}%`);
      }
    };

    xhr.onload = () => {
      xhrRef.current = null;
      try {
        const res = JSON.parse(xhr.responseText);
        if (res.success) {
          if (isPpt && res.taskId) {
            // PPT 上传成功，开始轮询后台转换状态
            startPptStatusPolling(res.taskId);
          } else {
            setVModal(prev => ({ ...prev, file_id: res.file_id }));
            setVUploading(false);
            setVStatusText('');
          }
        } else {
          alert('上传失败：' + (res.message || '服务器错误'));
          setVUploading(false);
        }
      } catch (_) {
        alert(`上传失败（服务器返回异常，状态码: ${xhr.status}）`);
        setVUploading(false);
      }
    };

    xhr.onerror = () => { xhrRef.current = null; alert('网络错误，上传失败'); setVUploading(false); };
    xhr.onabort = () => { xhrRef.current = null; setVUploading(false); setVUploadProgress(0); };
    xhr.send(formData);
  };

  const startPptStatusPolling = (taskId: string) => {
    setVStatusText('已开始转换 PPT，准备生成语音和视频...');
    pollTimerRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const r = await fetch(`/api/upload/ppt-status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success && d.task) {
          const task = d.task;
          setVUploadProgress(task.progress || 0);
          setVStatusText(task.status || '转换处理中...');

          if (task.completed) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setVUploading(false);
            if (task.error) {
              alert('PPT 转换视频失败: ' + task.error);
            } else if (task.file_id) {
              setVModal(prev => ({ ...prev, file_id: task.file_id }));
              alert('🎉 PPT 已成功转换为课程视频！');
            }
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2000);
  };

  const saveVideo = async () => {
    if (!vModal?.title) return alert('标题不能为空');
    if (!vModal?.file_id) return alert('请先上传视频文件');
    setVSaving(true);
    const isEdit = !!vModal._id;
    const d = await API(isEdit ? 'safety/updateVideo' : 'safety/addVideo',
      isEdit ? { videoId: vModal._id, ...vModal } : vModal);
    if (d.success) { setVModal(null); fetchVideos(); setVUploadName(''); }
    else alert(d.message);
    setVSaving(false);
  };

  const deleteVideo = async (id: string) => {
    if (!confirm('确认删除该视频？')) return;
    const d = await API('safety/deleteVideo', { videoId: id });
    if (d.success) fetchVideos(); else alert(d.message);
  };

  const fetchExamSettings = async () => {
    setSettingsLoading(true);
    try {
      const d = await API('safety/getExamSettings', {});
      if (d.success) setExamSettings(d.data);
      else console.error('getExamSettings failed:', d.message);
    } catch (e) {
      console.error('getExamSettings error:', e);
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveExamSettings = async () => {
    setSettingsSaving(true);
    setSettingsSaved(false);
    const d = await API('safety/updateExamSettings', examSettings);
    if (d.success) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); }
    else alert('保存失败：' + d.message);
    setSettingsSaving(false);
  };

  // 计算总分预览
  const totalMax = examSettings.single.count * examSettings.single.score
    + examSettings.multiple.count * examSettings.multiple.score
    + examSettings.judge.count * examSettings.judge.score;


  const saveQuestion = async () => {
    if (!qModal?.question || !qModal?.type) return alert('请填写题型和题目');
    if (qModal.type !== 'judge' && (!qModal.options || qModal.options.filter(Boolean).length < 2))
      return alert('请至少填写2个选项');
    if (!qModal.correct_answer) return alert('请填写正确答案');
    setQSaving(true);
    const isEdit = !!qModal._id;
    const d = await API(isEdit ? 'safety/updateQuestion' : 'safety/addQuestion',
      isEdit ? { questionId: qModal._id, ...qModal } : qModal);
    if (d.success) { setQModal(null); fetchQuestions(); }
    else alert(d.message);
    setQSaving(false);
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(`确认删除选中的 ${selected.length} 道题？`)) return;
    const d = await API('safety/deleteQuestions', { questionIds: selected });
    if (d.success) { setSelected([]); fetchQuestions(); alert(d.message); }
    else alert(d.message);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = (ev.target?.result as string).split(',')[1];
      const d = await API('safety/bulkImportQuestions', { fileBase64: base64 });
      setImportResult(d);
      if (d.success) fetchQuestions();
      setImporting(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const pageCount = Math.ceil(qTotal / 15);

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '960px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="text-transparent-gradient">安全科管理后台</h2>
        <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }} onClick={() => navigate('/admin')}>返回管理台</button>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {([
          ['videos',    <Video size={16} />,    '教学视频管理'],
          ['questions', <BookOpen size={16} />, '题库管理'],
          ['settings',  <Settings2 size={16} />, '考试设置'],
        ] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500,
            background: tab === key ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            color: tab === key ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s'
          }}>{icon}{label}</button>
        ))}
      </div>

      {/* ══════════ VIDEO TAB ══════════ */}
      {tab === 'videos' && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>教学视频列表</h3>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
              onClick={() => setVModal({ sort_order: 0, status: 'active' })}>
              <Plus size={16} />新增视频
            </button>
          </div>
          {vLoading ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载中...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {videos.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>暂无视频，点击右上角新增</p>}
              {videos.map(v => (
                <div key={v._id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.85rem 1rem', background: 'rgba(15,23,42,0.5)',
                  border: '1px solid var(--border-color)', borderRadius: '10px', flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {v.title}
                      <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: '20px',
                        background: v.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: v.status === 'active' ? '#10b981' : '#ef4444', border: `1px solid ${v.status === 'active' ? '#10b981' : '#ef4444'}` }}>
                        {v.status === 'active' ? '启用' : '停用'}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      文件ID: {v.file_id} &nbsp;|&nbsp; 排序: {v.sort_order}
                    </div>
                    {v.description && <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>{v.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={() => setVModal(v)}><Edit2 size={13} />编辑</button>
                    <button style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                      onClick={() => deleteVideo(v._id)}><Trash2 size={13} />删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ QUESTION TAB ══════════ */}
      {tab === 'questions' && (
        <div>
          {/* Toolbar */}
          <div className="glass-panel" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <select value={qType} onChange={e => { setQType(e.target.value); setQPage(1); }}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(15,23,42,0.8)', color: 'var(--text-color)', fontSize: '0.9rem' }}>
              <option value="">全部题型</option>
              <option value="single">单选题</option>
              <option value="multiple">多选题</option>
              <option value="judge">判断题</option>
            </select>
            <input value={qKeyword} onChange={e => setQKeyword(e.target.value)} placeholder="搜索题目关键词..."
              style={{ flex: 1, minWidth: '160px', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(15,23,42,0.8)', color: 'var(--text-color)' }}
              onKeyDown={e => e.key === 'Enter' && fetchQuestions()} />
            <button className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }} onClick={fetchQuestions}>搜索</button>
            <div style={{ flex: 1 }} />
            {selected.length > 0 && (
              <button onClick={deleteSelected} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.9rem',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <Trash2 size={14} />删除选中({selected.length})
              </button>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload size={14} />{importing ? '导入中...' : 'Excel批量导入'}
            </button>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              onClick={() => setQModal({ type: 'single', options: ['', '', '', ''], status: 'active' })}>
              <Plus size={14} />新增题目
            </button>
          </div>

          {/* Import result */}
          {importResult && (
            <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: '10px',
              background: importResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${importResult.success ? '#10b981' : '#ef4444'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: importResult.success ? '#10b981' : '#ef4444', fontWeight: 500 }}>{importResult.message}</span>
                <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
              </div>
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: '0.5rem 0 0', padding: '0 0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Question list */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>共 {qTotal} 道题</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.length === questions.length && questions.length > 0}
                  onChange={e => setSelected(e.target.checked ? questions.map(q => q._id) : [])} />
                全选当页
              </label>
            </div>
            {qLoading ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载中...</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {questions.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>暂无题目</p>}
                {questions.map(q => (
                  <div key={q._id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.85rem 1rem', background: selected.includes(q._id) ? 'rgba(59,130,246,0.08)' : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${selected.includes(q._id) ? 'rgba(59,130,246,0.4)' : 'var(--border-color)'}`,
                    borderRadius: '10px', transition: 'all 0.15s'
                  }}>
                    <input type="checkbox" style={{ marginTop: '2px' }} checked={selected.includes(q._id)}
                      onChange={e => setSelected(e.target.checked ? [...selected, q._id] : selected.filter(id => id !== q._id))} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.72rem', padding: '1px 8px', borderRadius: '20px',
                          background: `${TYPE_COLOR[q.type]}22`, border: `1px solid ${TYPE_COLOR[q.type]}`,
                          color: TYPE_COLOR[q.type], fontWeight: 500 }}>
                          {TYPE_LABEL[q.type] || q.type}
                        </span>
                        <span style={{ fontSize: '0.9rem' }}>{q.question}</span>
                      </div>
                      {q.type !== 'judge' && q.options?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                          {q.options.map((opt, i) => (
                            <span key={i} style={{ fontSize: '0.78rem', padding: '1px 8px',
                              borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.35rem' }}>
                        ✓ {Array.isArray(q.correct_answer) ? q.correct_answer.join('、') : q.correct_answer}
                        {q.explanation && <span style={{ color: 'var(--text-muted)', marginLeft: '0.75rem' }}>解析: {q.explanation}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => setQModal(q)}><Edit2 size={12} /></button>
                      <button style={{ padding: '0.25rem 0.6rem', background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}
                        onClick={() => { setSelected([q._id]); deleteSelected(); }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Pagination */}
            {pageCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }} disabled={qPage <= 1} onClick={() => setQPage(p => p - 1)}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: '0.85rem' }}>第 {qPage} / {pageCount} 页</span>
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }} disabled={qPage >= pageCount} onClick={() => setQPage(p => p + 1)}><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ SETTINGS TAB ══════════ */}
      {tab === 'settings' && (
        <div className="glass-panel" style={{ maxWidth: '620px' }}>
          <h3 style={{ marginBottom: '0.4rem' }}>考试参数设置</h3>
          <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1.5rem' }}>
            设置后对此后所有考试生效；题目从题库按题型随机抽取。
          </p>

          {settingsLoading ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载中...</p> : (
            <>
              {/* 题型设置表 */}
              {([
                ['single',   '单选题', '#3b82f6'],
                ['multiple', '多选题', '#8b5cf6'],
                ['judge',    '判断题', '#10b981'],
              ] as const).map(([key, label, color]) => (
                <div key={key} style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '10px',
                  background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', color, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
                    {label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="input-label">抽题数量</label>
                      <input type="number" min={0} max={200} className="input-field"
                        value={examSettings[key].count}
                        onChange={e => setExamSettings(prev => ({ ...prev, [key]: { ...prev[key], count: +e.target.value } }))} />
                    </div>
                    <div>
                      <label className="input-label">每题分値</label>
                      <input type="number" min={0} max={100} className="input-field"
                        value={examSettings[key].score}
                        onChange={e => setExamSettings(prev => ({ ...prev, [key]: { ...prev[key], score: +e.target.value } }))} />
                    </div>
                  </div>
                </div>
              ))}

              {/* 合格分数线 */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '10px',
                background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🎯 合格分数线
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label className="input-label">合格分数（满分 {totalMax} 分）</label>
                    <input type="number" min={0} max={totalMax || 200} className="input-field"
                      value={examSettings.pass_score}
                      onChange={e => setExamSettings(prev => ({ ...prev, pass_score: +e.target.value }))} />
                  </div>
                  <div style={{ padding: '0.5rem 1rem', borderRadius: '8px',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                    fontSize: '0.85rem', color: '#10b981', lineHeight: 1.6 }}>
                    考试总分: <b>{totalMax}</b> 分<br />
                    单选: {examSettings.single.count}题×{examSettings.single.score} &nbsp;
                    多选: {examSettings.multiple.count}题×{examSettings.multiple.score} &nbsp;
                    判断: {examSettings.judge.count}题×{examSettings.judge.score}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button className="btn btn-primary" style={{ padding: '0.6rem 2rem' }}
                  onClick={saveExamSettings} disabled={settingsSaving}>
                  {settingsSaving ? '保存中...' : '保存设置'}
                </button>
                {settingsSaved && <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ 已保存</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ Video Modal ══ */}
      {vModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{vModal._id ? '编辑视频' : '新增视频'}</h3>

            {/* 标题 */}
            <label className="input-label">标题 *</label>
            <input className="input-field" style={{ marginBottom: '0.85rem' }} value={vModal.title || ''}
              onChange={e => setVModal({ ...vModal, title: e.target.value })} placeholder="例：安全监护人培训第一课" />

            {/* 视频 / PPT 文件上传 */}
            <label className="input-label">课程视频 / PPT 文稿 *</label>
            <input ref={videoUploadRef} type="file" accept="video/*,.mp4,.mov,.avi,.mkv,.m4v,.webm,.pptx,.ppt" style={{ display: 'none' }} onChange={handleVideoFileSelect} />
            <div style={{ marginBottom: '0.85rem' }}>
              {vModal.file_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}>
                  <span style={{ color: '#10b981', fontSize: '0.85rem', flex: 1, wordBreak: 'break-all' }}>✓ {vUploadName || vModal.file_id}</span>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', flexShrink: 0 }}
                    onClick={() => videoUploadRef.current?.click()} disabled={vUploading}>重新上传</button>
                </div>
              ) : (
                <button onClick={() => videoUploadRef.current?.click()} disabled={vUploading}
                  style={{ width: '100%', padding: '1.25rem', border: '2px dashed var(--border-color)',
                    borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)',
                    cursor: vUploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                  <Upload size={24} color="var(--primary-color)" />
                  {vUploading ? `${vStatusText || '处理中...'} (${vUploadProgress}%)` : '点击选择 MP4 视频 或 PPTX 演示文稿'}
                  <span style={{ fontSize: '0.75rem' }}>支持 MP4/MOV 或 PPTX（自动带配音合成为视频）</span>
                </button>
              )}
              {/* 上传 / 转换进度条 */}
              {vUploading && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${vUploadProgress}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s' }} />
                  </div>
                  {vStatusText && <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', marginTop: '4px', textAlign: 'center' }}>{vStatusText}</div>}
                </div>
              )}
            </div>

            {/* 简介 */}
            <label className="input-label">简介</label>
            <input className="input-field" style={{ marginBottom: '0.85rem' }} value={vModal.description || ''}
              onChange={e => setVModal({ ...vModal, description: e.target.value })} placeholder="可选" />

            {/* 排序 */}
            <label className="input-label">排序（数字越小越靠前）</label>
            <input type="number" className="input-field" style={{ marginBottom: '0.85rem' }} value={vModal.sort_order ?? 0}
              onChange={e => setVModal({ ...vModal, sort_order: +e.target.value })} />

            {/* 状态 */}
            <label className="input-label">状态</label>
            <select className="input-field" value={vModal.status || 'active'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '1rem' }}
              onChange={e => setVModal({ ...vModal, status: e.target.value })}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { resetUploadState(); setVModal(null); }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveVideo} disabled={vSaving || vUploading}>
                {vSaving ? '保存中...' : vUploading ? '上传中...' : '确认保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Question Modal ══ */}
      {qModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem', overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', margin: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>{qModal._id ? '编辑题目' : '新增题目'}</h3>
            <label className="input-label">题型 *</label>
            <select className="input-field" value={qModal.type || 'single'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '0.85rem' }}
              onChange={e => {
                const t = e.target.value;
                setQModal({ ...qModal, type: t, options: t === 'judge' ? ['正确', '错误'] : ['', '', '', ''], correct_answer: '' });
              }}>
              <option value="single">单选题</option>
              <option value="multiple">多选题</option>
              <option value="judge">判断题</option>
            </select>

            <label className="input-label">题目内容 *</label>
            <textarea className="input-field" rows={3} value={qModal.question || ''} style={{ marginBottom: '0.85rem', resize: 'vertical' }}
              onChange={e => setQModal({ ...qModal, question: e.target.value })} />

            {qModal.type !== 'judge' && (
              <>
                <label className="input-label">选项（每行一个）</label>
                {(qModal.options || ['', '', '', '']).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ width: '20px', fontWeight: 600, color: 'var(--text-muted)' }}>{String.fromCharCode(65 + i)}.</span>
                    <input className="input-field" style={{ flex: 1, marginBottom: 0 }} value={opt}
                      onChange={e => { const opts = [...(qModal.options || [])]; opts[i] = e.target.value; setQModal({ ...qModal, options: opts }); }} />
                  </div>
                ))}
                <label className="input-label" style={{ marginTop: '0.25rem' }}>
                  正确答案 * {qModal.type === 'single' ? '（填字母，如 A）' : '（填字母，如 AB 或 ABC）'}
                </label>
                <input className="input-field" value={typeof qModal.correct_answer === 'string' ? qModal.correct_answer : (qModal.correct_answer || []).join('')}
                  style={{ marginBottom: '0.85rem' }}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    if (qModal.type === 'multiple') {
                      const opts = qModal.options || [];
                      const letters = val.split('').filter(l => /[A-D]/.test(l) && opts[l.charCodeAt(0) - 65]);
                      setQModal({ ...qModal, correct_answer: letters.map(l => opts[l.charCodeAt(0) - 65]) });
                    } else {
                      setQModal({ ...qModal, correct_answer: val });
                    }
                  }} />
              </>
            )}
            {qModal.type === 'judge' && (
              <>
                <label className="input-label">正确答案 *</label>
                <select className="input-field" value={qModal.correct_answer || '正确'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '0.85rem' }}
                  onChange={e => setQModal({ ...qModal, correct_answer: e.target.value })}>
                  <option value="正确">正确</option>
                  <option value="错误">错误</option>
                </select>
              </>
            )}

            <label className="input-label">解析（可选）</label>
            <textarea className="input-field" rows={2} value={qModal.explanation || ''} style={{ marginBottom: '1rem', resize: 'vertical' }}
              onChange={e => setQModal({ ...qModal, explanation: e.target.value })} />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setQModal(null)}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveQuestion} disabled={qSaving}>{qSaving ? '保存中...' : '确认保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
