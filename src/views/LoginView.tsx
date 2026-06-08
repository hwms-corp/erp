import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';

const SAVE_EMAIL_KEY = 'hms_saved_email';

export function LoginView() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const savedEmail = localStorage.getItem(SAVE_EMAIL_KEY) || '';
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [saveEmail, setSaveEmail] = useState(!!savedEmail);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (saveEmail) localStorage.setItem(SAVE_EMAIL_KEY, email);
    else localStorage.removeItem(SAVE_EMAIL_KEY);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="HMS" className="h-16 mx-auto mb-4" />
          <p className="text-slate-400">영업·구매 통합 관리 시스템</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">이메일</label>
            <input
              type="email"
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 placeholder-slate-400 transition-colors"
              placeholder="이메일 입력"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">비밀번호</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 placeholder-slate-400 transition-colors"
              placeholder="비밀번호 입력"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveEmail}
              onChange={e => setSaveEmail(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900/50 text-indigo-500 focus:ring-indigo-400/30 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-slate-400">이메일 저장</span>
          </label>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
