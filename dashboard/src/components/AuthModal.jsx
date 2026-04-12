/**
 * AuthModal — login / register modal overlay.
 * @param {{ mode: 'login'|'register', onClose: () => void }} props
 */
import { useState } from 'react';
import { X, Radar, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthModal({ mode: initialMode = 'login', onClose }) {
  const [mode, setMode]         = useState(initialMode);
  const [email, setEmail]       = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, register }     = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && !consent) {
      setError('You must agree to data collection to create an account.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, username, password, consent);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setConsent(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-navy-800 border border-white/10 rounded-xl w-full max-w-sm mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors" onClick={onClose}>
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
            <Radar size={16} className="text-navy-900" />
          </div>
          <span className="font-bold text-white">InsightRadar</span>
        </div>

        <h2 className="text-lg font-semibold text-white mb-1">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          {mode === 'login' ? 'Join the debate. Read smarter.' : 'Vote, debate, and contribute to the public sphere.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="input w-full"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          {mode === 'register' && (
            <input
              className="input w-full"
              type="text"
              placeholder="Username (letters, numbers, _)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
            />
          )}
          <input
            className="input w-full"
            type="password"
            placeholder={mode === 'register' ? 'Password (min 8 characters)' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : 1}
          />

          {/* Data collection consent — register only */}
          {mode === 'register' && (
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-cyan-400 shrink-0"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
              />
              <span className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                <ShieldCheck size={11} className="inline mr-1 text-cyan-400" />
                I agree that InsightRadar may collect and store my interests, tracked websites, and reading activity to personalize my experience. This data is private to my account and is never shared with third parties.
              </span>
            </label>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={loading || (mode === 'register' && !consent)}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-cyan-400 hover:underline"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
