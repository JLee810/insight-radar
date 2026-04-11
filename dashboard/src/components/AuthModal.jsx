/**
 * AuthModal — login / register modal overlay.
 * @param {{ mode: 'login'|'register', onClose: () => void }} props
 */
import { useState } from 'react';
import { X, Radar } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthModal({ mode: initialMode = 'login', onClose }) {
  const [mode, setMode]       = useState(initialMode);
  const [email, setEmail]     = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register }   = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-cyan-400 hover:underline"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
