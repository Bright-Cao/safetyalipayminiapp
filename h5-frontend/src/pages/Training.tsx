import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, PlayCircle, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, Lock
} from 'lucide-react';

interface VideoItem {
  _id: string; title: string; file_id: string;
  description: string; sort_order: number; status: string;
}
interface VideoProgress {
  progress: number; max_watched: number; current_time: number; completed: boolean;
}

function toPlayUrl(id: string): string {
  if (!id) return '';
  if (id.startsWith('http')) return id;
  if (id.startsWith('videos/')) return `/uploads/${id}`;
  return `/uploads/videos/${id}`;
}
function sanitizeKey(k: string) { return k.replace(/\./g, '_').replace(/\$/g, '_').replace(/\//g, '_'); }
function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
const AH = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function Training() {
  const [videos,      setVideos]      = useState<VideoItem[]>([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [progress,    setProgress]    = useState(0);
  const [completed,   setCompleted]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  // 是否已通过车间面试审批（应用状态为 pending_training 或 training_completed）
  const [appApproved, setAppApproved] = useState(false);

  // ── player UI state ──
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [isMuted,      setIsMuted]      = useState(false);
  const [volume,       setVolume]       = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const maxWatchedRef = useRef<number>(0);
  const isResumingRef = useRef<boolean>(false);
  const lastSyncRef   = useRef<number>(0);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedRef      = useRef<Record<string, VideoProgress>>({});
  const navigate      = useNavigate();

  // ── fetch videos + saved progress + 申请状态 ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [vRes, pRes, aRes] = await Promise.all([
          fetch('/api/training/getVideos',  { method: 'POST', headers: AH() }),
          fetch('/api/getVideoProgress',    { method: 'POST', headers: AH() }),
          fetch('/api/getMyApplications',   { method: 'POST', headers: AH() }),
        ]);
        const vD = await vRes.json(), pD = await pRes.json(), aD = await aRes.json();
        if (vD.success && vD.data?.length > 0) setVideos(vD.data);
        else setError('暂无培训视频，请联系安全科管理员上传视频。');
        if (pD.success) savedRef.current = pD.data || {};
        // 检查是否有已通过面试的申请
        if (aD.success && aD.data) {
          const ALLOWED = ['pending_training', 'training_completed', 'qualified'];
          setAppApproved(aD.data.some((a: any) => ALLOWED.includes(a.status)));
        }
      } catch { setError('加载失败，请刷新重试。'); }
      finally  { setLoading(false); }
    })();
  }, []);

  // ── reset when switching video ──────────────────────────────────────
  useEffect(() => {
    maxWatchedRef.current = 0;
    setProgress(0); setCompleted(false);
    setCurrentTime(0); setDuration(0); setIsPlaying(false);
    if (videoRef.current) videoRef.current.load();
  }, [currentIdx]);

  // ── fullscreen change listener ──────────────────────────────────────
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  const currentVideo  = videos[currentIdx];
  const currentFileId = currentVideo?.file_id || '';
  const videoUrl      = toPlayUrl(currentFileId);

  // ── loadedMetadata: resume + lock rate ─────────────────────────────
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.playbackRate = 1;
    setDuration(v.duration);
    const key   = sanitizeKey(currentFileId);
    const saved = savedRef.current[key];
    if (saved) {
      if (saved.completed) setCompleted(true);
      setProgress(saved.progress || 0);
      maxWatchedRef.current = saved.max_watched || 0;
      const resume = saved.current_time || 0;
      if (resume > 1 && resume < v.duration) {
        isResumingRef.current = true;
        v.currentTime = resume;
      }
    }
  }, [currentFileId]);

  // ── seeking: ignore resume, block forward-seek ──────────────────────
  const handleSeeking = useCallback(() => {
    if (isResumingRef.current) { isResumingRef.current = false; return; }
    const v = videoRef.current; if (!v) return;
    // Safety net (shouldn't normally fire without native controls, but handles programmatic seeks)
    if (v.currentTime > maxWatchedRef.current + 1.5) {
      v.currentTime = maxWatchedRef.current;
    }
  }, []);

  // ── rate lock ───────────────────────────────────────────────────────
  const handleRateChange = useCallback(() => {
    const v = videoRef.current;
    if (v && v.playbackRate !== 1) v.playbackRate = 1;
  }, []);

  // ── time update ─────────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(async () => {
    const v = videoRef.current; if (!v || !v.duration) return;
    setCurrentTime(v.currentTime);
    maxWatchedRef.current = Math.max(maxWatchedRef.current, v.currentTime);
    const pct = Math.min((maxWatchedRef.current / v.duration) * 100, 100);
    setProgress(pct);
    if (pct >= 90 && !completed) setCompleted(true);

    const now = Date.now();
    if (now - lastSyncRef.current > 10000) {
      lastSyncRef.current = now;
      try {
        await fetch('/api/updateVideoProgress', {
          method: 'POST', headers: AH(),
          body: JSON.stringify({ videoId: currentFileId, progress: pct,
            currentTime: v.currentTime, maxWatched: maxWatchedRef.current }),
        });
        const k = sanitizeKey(currentFileId);
        savedRef.current[k] = { progress: pct, max_watched: maxWatchedRef.current,
          current_time: v.currentTime, completed: pct >= 90 };
      } catch (e) { console.warn('进度同步失败', e); }
    }
  }, [completed, currentFileId]);

  // ── 视频结束：立即强制同步 100% 进度 ─────────────────────────────────────
  const handleVideoEnded = useCallback(async () => {
    setIsPlaying(false); setShowControls(true);
    const v = videoRef.current;
    const dur = v?.duration || 1;
    setProgress(100); setCompleted(true);
    try {
      await fetch('/api/updateVideoProgress', {
        method: 'POST', headers: AH(),
        body: JSON.stringify({
          videoId: currentFileId, progress: 100,
          currentTime: dur, maxWatched: dur,
        }),
      });
      const k = sanitizeKey(currentFileId);
      savedRef.current[k] = { progress: 100, max_watched: dur, current_time: dur, completed: true };
      lastSyncRef.current = Date.now(); // 防止 handleTimeUpdate 重复同步
    } catch (e) { console.warn('视频结束同步失败', e); }
  }, [currentFileId]);

  // ── custom controls ─────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setIsMuted(v.muted);
  }, []);

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current; if (!v) return;
    const val = Number(e.target.value);
    v.volume = val; setVolume(val); setIsMuted(val === 0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Auto-hide controls after 3s of inactivity
  const showControlsTemp = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  // ── render ──────────────────────────────────────────────────────────
  if (loading) return <div className="app-container">加载培训视频中...</div>;
  if (error) return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="text-transparent-gradient">安全监护人线上培训</h2>
      </header>
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
        <p style={{ marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>返回工作台</button>
      </div>
    </div>
  );

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="text-transparent-gradient">安全监护人线上培训</h2>
        <p className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <Lock size={13} />须完整观看（不可快进 · 不可倍速），支持断点续看，≥90%视为完成
        </p>
      </header>

      {/* 多视频标签 */}
      {videos.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {videos.map((v, i) => (
            <button key={v._id} onClick={() => setCurrentIdx(i)} style={{
              padding: '0.4rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontWeight: 500, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
              background: i === currentIdx ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
              color:      i === currentIdx ? '#fff'                 : 'var(--text-muted)',
            }}>
              <PlayCircle size={14} />{v.title || `视频 ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {currentVideo?.title && (
          <div style={{ padding: '1rem 1.2rem 0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
            {currentVideo.title}
          </div>
        )}

        {/* ── 自定义播放器容器 ── */}
        <div
          ref={containerRef}
          onMouseMove={showControlsTemp}
          onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
          style={{ position: 'relative', background: '#000', userSelect: 'none' }}
        >
          {/* 视频元素：无 controls，防止任何原生进度条 */}
          <video
            ref={videoRef}
            key={currentFileId}
            src={videoUrl}
            muted={isMuted}
            onClick={togglePlay}
            onLoadedMetadata={handleLoadedMetadata}
            onSeeking={handleSeeking}
            onRateChange={handleRateChange}
            onTimeUpdate={handleTimeUpdate}
            onPlay={()  => { setIsPlaying(true);  showControlsTemp(); }}
            onPause={()  => { setIsPlaying(false); setShowControls(true); }}
            onEnded={handleVideoEnded}
            style={{ width: '100%', display: 'block', cursor: 'pointer', maxHeight: '60vh' }}
          />

          {/* 中央播放按钮（暂停时显示） */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.15s',
              }}>
                <Play size={28} color="#fff" style={{ marginLeft: 4 }} />
              </div>
            </div>
          )}

          {/* 底部控制栏（自定义，无原生进度条） */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            padding: '1.5rem 1rem 0.7rem',
            transition: 'opacity 0.3s',
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
          }}>
            {/* 进度条：纯展示，禁止任何交互 */}
            <div style={{ position: 'relative', width: '100%', height: 16, marginBottom: '0.5rem',
                          display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}
              onMouseDown={e => e.preventDefault()}
              onPointerDown={e => e.preventDefault()}
              onTouchStart={e => e.preventDefault()}
            >
              {/* 背景轨道 */}
              <div style={{ position: 'absolute', inset: '50% 0', transform: 'translateY(-50%)',
                            height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
              {/* 已看进度 */}
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                            height: 4, borderRadius: 2, background: '#3b82f6',
                            width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              {/* 锁图标提示 */}
              <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>
                <Lock size={9} color="rgba(255,255,255,0.5)" />
              </div>
            </div>

            {/* 控制按钮行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* 播放/暂停 */}
                <button onClick={togglePlay} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0 }}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                {/* 音量 */}
                <button onClick={toggleMute} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0 }}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  style={{ width: 60, accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                {/* 时间 */}
                <span style={{ color: '#fff', fontSize: '0.8rem' }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* 锁定提示 */}
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Lock size={10} />禁止快进
                </span>
                {/* 全屏 */}
                <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 0 }}>
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 学习进度区域 */}
        <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(15,23,42,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>学习进度</span>
            <span style={{ fontSize: '0.9rem', color: completed ? 'var(--success-color)' : 'var(--text-color)' }}>
              {Math.floor(progress)}%&nbsp;
              {completed && <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />}
            </span>
          </div>
          <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%',
              background: completed ? 'var(--success-color)' : 'var(--primary-color)', transition: 'width 0.3s' }} />
          </div>
          {completed ? (
            <p style={{ marginTop: '0.75rem', color: 'var(--success-color)', fontSize: '0.85rem' }}>
              ✅ 培训视频已完成，可前往参加考试
            </p>
          ) : (
            <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              进度条已锁定 · 请完整观看视频
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>返回工作台</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <button
            className="btn btn-primary"
            disabled={!completed || !appApproved}
            onClick={() => navigate('/exam')}
            style={{ opacity: (completed && appApproved) ? 1 : 0.45, cursor: (completed && appApproved) ? 'pointer' : 'not-allowed' }}
          >
            前往在线考试
          </button>
          {!appApproved && (
            <span style={{ fontSize: '0.72rem', color: '#f59e0b', textAlign: 'right' }}>
              ❗ 需要车间面试审批通过后才可考试
            </span>
          )}
          {appApproved && !completed && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              请先完成视频学习（进度≥9 0%）
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
