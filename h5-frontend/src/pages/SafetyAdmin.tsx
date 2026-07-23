import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, BookOpen, Plus, Trash2, Edit2, Upload, X, ChevronLeft, ChevronRight, Settings2, Presentation, Play, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

const API = (path: string, body: object) =>
  fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(body),
  }).then(r => r.json());

type Tab = 'videos' | 'ppt2video' | 'questions' | 'settings';

interface VideoItem { _id: string; title: string; file_id: string; description: string; sort_order: number; status: string; }
interface Question { _id: string; type: string; question: string; options: string[]; correct_answer: any; explanation: string; status: string; }
interface PptTaskItem {
  _id: string;
  title: string;
  original_filename: string;
  task_id: string;
  voice: string;
  rate: string;
  status: string;
  progress: number;
  completed: boolean;
  error: string | null;
  url: string | null;
  file_id: string | null;
  published: boolean;
  create_time: string;
}

const TYPE_LABEL: Record<string, string> = { single: '单选题', multiple: '多选题', judge: '判断题' };
const TYPE_COLOR: Record<string, string> = { single: '#3b82f6', multiple: '#8b5cf6', judge: '#10b981' };

const VOICE_OPTIONS = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (亲切女声)' },
  { value: 'zh-CN-YunxiNeural', label: '云希 (沉稳男声)' },
  { value: 'zh-CN-YunjianNeural', label: '云健 (讲解男声)' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊 (温柔女声)' }
];

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
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // ── PPT2Video Workbench State ──
  const [pptTasks, setPptTasks] = useState<PptTaskItem[]>([]);
  const [pptLoading, setPptLoading] = useState(false);
  const [pptFile, setPptFile] = useState<File | null>(null);
  const [pptTitle, setPptTitle] = useState('');
  const [pptVoice, setPptVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [pptRate, setPptRate] = useState('+0%');
  const [pptSubmitting, setPptSubmitting] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const pptFileRef = useRef<HTMLInputElement>(null);

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

  // 轮询 PPT 转换任务
  useEffect(() => {
    if (tab === 'ppt2video') {
      fetchPptTasks();
      const timer = setInterval(() => fetchPptTasks(true), 3000);
      return () => clearInterval(timer);
    }
  }, [tab]);

  const fetchVideos = async () => {
    setVLoading(true);
    const d = await API('safety/getVideos', {});
    if (d.success) setVideos(d.data);
    setVLoading(false);
  };

  const fetchPptTasks = async (silent = false) => {
    if (!silent) setPptLoading(true);
    const token = localStorage.getItem('token');
    try {
      const r = await fetch('/api/upload/ppt-tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      if (d.success) setPptTasks(d.data || []);
    } catch (e) {
      console.error(e);
    }
    if (!silent) setPptLoading(false);
  };

  const fetchQuestions = async () => {
    setQLoading(true);
    const d = await API('safety/getQuestions', { page: qPage, pageSize: 15, type: qType, keyword: qKeyword });
    if (d.success) { setQuestions(d.data); setQTotal(d.total); }
    setQLoading(false);
  };

  const fetchExamSettings = async () => {
    setSettingsLoading(true);
    const d = await API('safety/getExamSettings', {});
    if (d.success && d.data) {
      setExamSettings({
        single:   d.data.single   || { count: 20, score: 2 },
        multiple: d.data.multiple || { count: 10, score: 2 },
        judge:    d.data.judge    || { count: 20, score: 2 },
        pass_score: d.data.pass_score ?? 80,
      });
    }
    setSettingsLoading(false);
  };

  const saveExamSettings = async () => {
    setSettingsSaving(true);
    const d = await API('safety/updateExamSettings', examSettings);
    if (d.success) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); }
    else alert('保存失败：' + d.message);
    setSettingsSaving(false);
  };

  const totalMax = examSettings.single.count * examSettings.single.score
    + examSettings.multiple.count * examSettings.multiple.score
    + examSettings.judge.count * examSettings.judge.score;

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (xhrRef.current) xhrRef.current.abort();

    setVUploading(true);
    setVUploadProgress(0);
    setVUploadName(file.name);
    e.target.value = '';

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/upload/video');
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setVUploadProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      xhrRef.current = null;
      try {
        const res = JSON.parse(xhr.responseText);
        if (res.success) {
          setVModal(prev => ({ ...prev, file_id: res.file_id }));
        } else {
          alert('上传失败：' + (res.message || '服务器错误'));
        }
      } catch (_) {
        alert(`上传失败（服务器返回异常，状态码: ${xhr.status}）`);
      }
      setVUploading(false);
    };

    xhr.onerror = () => { xhrRef.current = null; alert('网络错误，上传失败'); setVUploading(false); };
    xhr.onabort = () => { xhrRef.current = null; setVUploading(false); setVUploadProgress(0); };
    xhr.send(formData);
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

  // 提交 PPT 异步转换任务
  const submitPptTask = async () => {
    if (!pptFile) return alert('请先选择 PPTX 演示文稿文件');
    const title = pptTitle.trim() || pptFile.name.replace(/\.[^/.]+$/, "");

    setPptSubmitting(true);
    const formData = new FormData();
    formData.append('file', pptFile);
    formData.append('title', title);
    formData.append('voice', pptVoice);
    formData.append('rate', pptRate);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload/ppt', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const d = await res.json();
      if (d.success) {
        alert('🎉 PPT 转换任务已成功提交！系统正在后台自动生成语音与视频，你可以随时查看列表进度。');
        setPptFile(null);
        setPptTitle('');
        if (pptFileRef.current) pptFileRef.current.value = '';
        fetchPptTasks();
      } else {
        alert('提交失败：' + d.message);
      }
    } catch (e: any) {
      alert('提交异常：' + e.message);
    }
    setPptSubmitting(false);
  };

  // 发布转换完成的任务到教学视频列表
  const publishPptTask = async (taskId: string) => {
    const d = await API('upload/publish-ppt', { taskId });
    if (d.success) {
      alert('✅ ' + d.message);
      fetchPptTasks();
      fetchVideos();
    } else {
      alert('发布失败：' + d.message);
    }
  };

  // 删除转换任务记录
  const deletePptTask = async (taskId: string) => {
    if (!confirm('确认删除该转换任务记录？')) return;
    const d = await API('upload/delete-ppt-task', { taskId });
    if (d.success) fetchPptTasks();
  };

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = (ev.target?.result as string).split(',')[1];
      const d = await API('safety/bulkImportQuestions', { fileBase64: base64 });
      if (d.success) {
        fetchQuestions();
        alert(`导入完成！成功: ${d.insertedCount || 0} 道题`);
      } else {
        alert('导入失败: ' + d.message);
      }
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
          ['videos',    <Video size={16} />,        '教学视频管理'],
          ['ppt2video', <Presentation size={16} />, 'PPT 转视频工作台'],
          ['questions', <BookOpen size={16} />,     '题库管理'],
          ['settings',  <Settings2 size={16} />,    '考试设置'],
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

      {/* ══════════ PPT TO VIDEO WORKBENCH TAB ══════════ */}
      {tab === 'ppt2video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Submit PPT Form Card */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Presentation color="var(--primary-color)" size={20} />
              提交 PPT 转视频任务
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              只需在 PPT 备注栏中填写各页讲解文案，系统会在后台自动将其渲染为高清画面，并通过 AI 合成语音压制为 MP4 课程视频。提交后后台自动处理，无需停留在此页面等待。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="input-label">课程视频名称 *</label>
                <input className="input-field" value={pptTitle} onChange={e => setPptTitle(e.target.value)}
                  placeholder="例：安全监护人职责与规范（若留空则自动使用 PPT 文件名）" />
              </div>

              <div>
                <label className="input-label">选择 PPTX 演示文稿文件 *</label>
                <input ref={pptFileRef} type="file" accept=".pptx,.ppt" style={{ display: 'none' }}
                  onChange={e => setPptFile(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => pptFileRef.current?.click()}
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px dashed var(--border-color)',
                    background: 'rgba(15,23,42,0.8)', color: pptFile ? '#10b981' : 'var(--text-muted)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                  <Upload size={16} />
                  {pptFile ? `已选择: ${pptFile.name}` : '点击上传 .pptx 文件'}
                </button>
              </div>

              <div>
                <label className="input-label">AI 讲解配音人</label>
                <select className="input-field" value={pptVoice} onChange={e => setPptVoice(e.target.value)}
                  style={{ backgroundColor: 'rgba(15,23,42,0.9)' }}>
                  {VOICE_OPTIONS.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">语速调整</label>
                <select className="input-field" value={pptRate} onChange={e => setPptRate(e.target.value)}
                  style={{ backgroundColor: 'rgba(15,23,42,0.9)' }}>
                  <option value="-15%">较慢 (-15%)</option>
                  <option value="+0%">标准语速 (+0%)</option>
                  <option value="+15%">较快 (+15%)</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem' }}
              onClick={submitPptTask} disabled={pptSubmitting}>
              {pptSubmitting ? '提交处理中...' : '🚀 提交后台转换任务'}
            </button>
          </div>

          {/* Task History & Status List */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={18} /> 转换任务处理记录
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} onClick={() => fetchPptTasks()}>
                刷新列表
              </button>
            </div>

            {pptLoading ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载任务记录中...</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {pptTasks.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>暂无转换任务记录</p>}
                {pptTasks.map(t => (
                  <div key={t._id} style={{
                    padding: '1rem', background: 'rgba(15,23,42,0.6)',
                    border: '1px solid var(--border-color)', borderRadius: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {t.title}
                          {t.published && (
                            <span style={{ fontSize: '0.72rem', padding: '1px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>
                              已发布到课程库
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                          文件: {t.original_filename || 'PPTX'} &nbsp;|&nbsp;
                          配音: {VOICE_OPTIONS.find(v => v.value === t.voice)?.label || t.voice} &nbsp;|&nbsp;
                          时间: {new Date(t.create_time).toLocaleString()}
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div>
                        {t.completed ? (
                          t.error ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 500 }}>
                              <AlertCircle size={15} /> 转换失败
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 500 }}>
                              <CheckCircle size={15} /> 转换成功 (100%)
                            </span>
                          )
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 500 }}>
                            <RefreshCw size={14} className="animate-spin" /> 后台处理中 ({t.progress}%)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar for Ongoing Task */}
                    {!t.completed && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${t.progress}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--primary-color)', marginTop: '4px' }}>
                          {t.status || '转换处理中...'}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {t.completed && t.error && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '0.82rem' }}>
                        错误原因: {t.error}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.85rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {t.completed && t.url && (
                        <>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={() => setPreviewVideoUrl(t.url)}>
                            <Play size={14} /> 预览视频
                          </button>
                          {!t.published && (
                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={() => publishPptTask(t.task_id)}>
                              <CheckCircle size={14} /> 发布到教学视频
                            </button>
                          )}
                        </>
                      )}
                      <button style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => deletePptTask(t.task_id)}>
                        <Trash2 size={13} /> 删除记录
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ QUESTION TAB ══════════ */}
      {tab === 'questions' && (
        <div>
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

          {qLoading ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载中...</p> : (
            <div className="glass-panel">
              {questions.length === 0 ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>暂无题目</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {questions.map(q => (
                    <div key={q._id} style={{ padding: '0.85rem 1rem', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 500, flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', marginRight: '0.5rem',
                            background: `${TYPE_COLOR[q.type]}22`, color: TYPE_COLOR[q.type], border: `1px solid ${TYPE_COLOR[q.type]}` }}>
                            {TYPE_LABEL[q.type]}
                          </span>
                          {q.question}
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => setQModal(q)}><Edit2 size={13} /></button>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {q.options.map((opt, i) => <div key={i}>{String.fromCharCode(65 + i)}. {opt}</div>)}
                        </div>
                      )}
                      <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.4rem' }}>
                        正确答案: {Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : String(q.correct_answer)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pageCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button className="btn btn-secondary" disabled={qPage <= 1} onClick={() => setQPage(p => p - 1)}><ChevronLeft size={16} /></button>
                  <span style={{ fontSize: '0.85rem' }}>{qPage} / {pageCount}</span>
                  <button className="btn btn-secondary" disabled={qPage >= pageCount} onClick={() => setQPage(p => p + 1)}><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ SETTINGS TAB ══════════ */}
      {tab === 'settings' && (
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.25rem' }}>考试抽题与及格线配置</h3>
          {settingsLoading ? <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>加载配置中...</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#3b82f6' }}>单选题</div>
                  <label className="input-label">抽题数量</label>
                  <input type="number" min={0} className="input-field" style={{ marginBottom: '0.5rem' }} value={examSettings.single.count}
                    onChange={e => setExamSettings(p => ({ ...p, single: { ...p.single, count: +e.target.value } }))} />
                  <label className="input-label">每题分值</label>
                  <input type="number" min={0} className="input-field" value={examSettings.single.score}
                    onChange={e => setExamSettings(p => ({ ...p, single: { ...p.single, score: +e.target.value } }))} />
                </div>

                <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#8b5cf6' }}>多选题</div>
                  <label className="input-label">抽题数量</label>
                  <input type="number" min={0} className="input-field" style={{ marginBottom: '0.5rem' }} value={examSettings.multiple.count}
                    onChange={e => setExamSettings(p => ({ ...p, multiple: { ...p.multiple, count: +e.target.value } }))} />
                  <label className="input-label">每题分值</label>
                  <input type="number" min={0} className="input-field" value={examSettings.multiple.score}
                    onChange={e => setExamSettings(p => ({ ...p, multiple: { ...p.multiple, score: +e.target.value } }))} />
                </div>

                <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#10b981' }}>判断题</div>
                  <label className="input-label">抽题数量</label>
                  <input type="number" min={0} className="input-field" style={{ marginBottom: '0.5rem' }} value={examSettings.judge.count}
                    onChange={e => setExamSettings(p => ({ ...p, judge: { ...p.judge, count: +e.target.value } }))} />
                  <label className="input-label">每题分值</label>
                  <input type="number" min={0} className="input-field" value={examSettings.judge.score}
                    onChange={e => setExamSettings(p => ({ ...p, judge: { ...p.judge, score: +e.target.value } }))} />
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>合格分数线</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label className="input-label">合格分数（满分 {totalMax} 分）</label>
                    <input type="number" min={0} max={totalMax || 200} className="input-field" value={examSettings.pass_score}
                      onChange={e => setExamSettings(prev => ({ ...prev, pass_score: +e.target.value }))} />
                  </div>
                  <div style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.85rem', color: '#10b981', lineHeight: 1.6 }}>
                    考试总分: <b>{totalMax}</b> 分<br />
                    单选: {examSettings.single.count}题×{examSettings.single.score} &nbsp;
                    多选: {examSettings.multiple.count}题×{examSettings.multiple.score} &nbsp;
                    判断: {examSettings.judge.count}题×{examSettings.judge.score}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button className="btn btn-primary" style={{ padding: '0.6rem 2rem' }} onClick={saveExamSettings} disabled={settingsSaving}>
                  {settingsSaving ? '保存中...' : '保存设置'}
                </button>
                {settingsSaved && <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ 已保存</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ Video Edit Modal ══ */}
      {vModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{vModal._id ? '编辑视频' : '新增视频'}</h3>

            <label className="input-label">标题 *</label>
            <input className="input-field" style={{ marginBottom: '0.85rem' }} value={vModal.title || ''}
              onChange={e => setVModal({ ...vModal, title: e.target.value })} placeholder="例：安全监护人培训第一课" />

            <label className="input-label">视频文件 *</label>
            <input ref={videoUploadRef} type="file" accept="video/*,.mp4,.mov,.avi,.mkv,.m4v,.webm" style={{ display: 'none' }} onChange={handleVideoFileSelect} />
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
                  {vUploading ? `上传中... ${vUploadProgress}%` : '点击选择 MP4 视频文件'}
                  <span style={{ fontSize: '0.75rem' }}>支持最大 500MB</span>
                </button>
              )}
              {vUploading && (
                <div style={{ marginTop: '0.5rem', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${vUploadProgress}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.2s' }} />
                </div>
              )}
            </div>

            <label className="input-label">简介</label>
            <input className="input-field" style={{ marginBottom: '0.85rem' }} value={vModal.description || ''}
              onChange={e => setVModal({ ...vModal, description: e.target.value })} placeholder="可选" />

            <label className="input-label">排序（数字越小越靠前）</label>
            <input type="number" className="input-field" style={{ marginBottom: '0.85rem' }} value={vModal.sort_order ?? 0}
              onChange={e => setVModal({ ...vModal, sort_order: +e.target.value })} />

            <label className="input-label">状态</label>
            <select className="input-field" value={vModal.status || 'active'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '1rem' }}
              onChange={e => setVModal({ ...vModal, status: e.target.value })}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setVModal(null)}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveVideo} disabled={vSaving || vUploading}>
                {vSaving ? '保存中...' : vUploading ? '上传中...' : '确认保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Question Edit Modal ══ */}
      {qModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>{qModal._id ? '编辑题目' : '新增题目'}</h3>

            <label className="input-label">题型 *</label>
            <select className="input-field" value={qModal.type || 'single'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '0.85rem' }}
              onChange={e => {
                const t = e.target.value;
                setQModal({ ...qModal, type: t, options: t === 'judge' ? [] : (qModal.options?.length ? qModal.options : ['', '', '', '']) });
              }}>
              <option value="single">单选题</option>
              <option value="multiple">多选题</option>
              <option value="judge">判断题</option>
            </select>

            <label className="input-label">题目描述 *</label>
            <textarea className="input-field" rows={3} value={qModal.question || ''} style={{ marginBottom: '0.85rem', resize: 'vertical' }}
              onChange={e => setQModal({ ...qModal, question: e.target.value })} placeholder="输入题目内容..." />

            {qModal.type !== 'judge' && (
              <>
                <label className="input-label">选项列表 *</label>
                {(qModal.options || ['', '', '', '']).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, minWidth: '20px' }}>{String.fromCharCode(65 + i)}.</span>
                    <input className="input-field" value={opt} onChange={e => {
                      const opts = [...(qModal.options || [])];
                      opts[i] = e.target.value;
                      setQModal({ ...qModal, options: opts });
                    }} placeholder={`选项 ${String.fromCharCode(65 + i)}`} />
                  </div>
                ))}
              </>
            )}

            <label className="input-label">正确答案 *</label>
            {qModal.type === 'single' && (
              <select className="input-field" value={qModal.correct_answer || 'A'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '0.85rem' }}
                onChange={e => setQModal({ ...qModal, correct_answer: e.target.value })}>
                {(qModal.options || ['', '', '', '']).map((_, i) => (
                  <option key={i} value={String.fromCharCode(65 + i)}>{String.fromCharCode(65 + i)}</option>
                ))}
              </select>
            )}
            {qModal.type === 'multiple' && (
              <input className="input-field" value={Array.isArray(qModal.correct_answer) ? qModal.correct_answer.join('') : (qModal.correct_answer || '')}
                style={{ marginBottom: '0.85rem' }} placeholder="例：AB 或 ABC"
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  const letters = val.split('').filter(l => /[A-D]/.test(l));
                  setQModal({ ...qModal, correct_answer: letters });
                }} />
            )}
            {qModal.type === 'judge' && (
              <select className="input-field" value={qModal.correct_answer || '正确'} style={{ backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: '0.85rem' }}
                onChange={e => setQModal({ ...qModal, correct_answer: e.target.value })}>
                <option value="正确">正确</option>
                <option value="错误">错误</option>
              </select>
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

      {/* ══ Video Preview Modal ══ */}
      {previewVideoUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', position: 'relative', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0 }}>合成视频预览</h4>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setPreviewVideoUrl(null)}>
                <X size={20} />
              </button>
            </div>
            <video src={previewVideoUrl} controls autoPlay style={{ width: '100%', borderRadius: '8px', maxHeight: '70vh', background: '#000' }} />
          </div>
        </div>
      )}
    </div>
  );
}
