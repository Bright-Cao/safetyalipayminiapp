
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';

export default function ExamResult() {
  const location = useLocation();
  const navigate = useNavigate();

  const result = location.state?.result;

  if (!result) return <Navigate to="/dashboard" />;

  return (
    <div className="app-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        {result.passed ? (
          <div>
            <CheckCircle color="var(--success-color)" size={64} style={{ margin: '0 auto 1rem' }} />
            <h1 className="text-transparent-gradient" style={{ backgroundImage: 'linear-gradient(135deg, #10b981, #34d399)' }}>考试通过！</h1>
            <p className="text-muted" style={{ fontSize: '1.2rem', margin: '1rem 0' }}>太棒了，您已获得监护人资质。</p>
          </div>
        ) : (
          <div>
            <XCircle color="var(--danger-color)" size={64} style={{ margin: '0 auto 1rem' }} />
            <h1 className="text-transparent-gradient" style={{ backgroundImage: 'linear-gradient(135deg, #ef4444, #f87171)' }}>很遗憾，未通过考试</h1>
            <p className="text-muted" style={{ fontSize: '1.2rem', margin: '1rem 0' }}>不要气馁，复习一下再试一次。</p>
          </div>
        )}

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', margin: '2rem 0', display: 'flex', justifyContent: 'space-around' }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{result.score}</div>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>得分</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {result.correct_count}/{result.total_count}
            </div>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>答对题数</div>
          </div>
        </div>

        <div>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            返回工作台
          </button>
        </div>
      </div>
    </div>
  );
}
