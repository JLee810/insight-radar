/**
 * ResetPasswordPage — request reset + enter new password.
 * Route: /reset-password
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Radar, ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '../services/api.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [step, setStep] = useState(tokenFromUrl ? 'reset' : 'request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleRequest(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.auth.requestReset(email);
      // In dev mode the server returns the token directly
      if (result.token) {
        setToken(result.token);
        setStep('reset');
        setSuccess('Token generated. Enter it below to reset your password.');
      } else {
        setSuccess('If that email exists, a reset link has been sent.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.auth.resetPassword(token, newPassword);
      setSuccess('Password reset successfully! You can now sign in.');
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
              <Radar size={16} className="text-navy-900" />
            </div>
            <span className="font-bold text-white">InsightRadar</span>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" />
            <h1 className="text-lg font-semibold text-white">Reset Password</h1>
          </div>

          {step === 'done' ? (
            <div className="text-center space-y-4 py-4">
              <ShieldCheck size={40} className="mx-auto text-green-400" />
              <p className="text-green-400 text-sm">{success}</p>
              <Link to="/" className="btn-primary inline-flex items-center gap-2">
                Go to sign in
              </Link>
            </div>
          ) : step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-3">
              <p className="text-sm text-gray-400">Enter your email address and we'll send you a reset link.</p>
              <input
                className="input w-full"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {success && <p className="text-green-400 text-xs">{success}</p>}
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-3">
              <p className="text-sm text-gray-400">Enter your reset token and choose a new password.</p>
              {success && <p className="text-green-400 text-xs">{success}</p>}
              <input
                className="input w-full font-mono text-xs"
                placeholder="Reset token"
                value={token}
                onChange={e => setToken(e.target.value)}
                required
              />
              <input
                className="input w-full"
                type="password"
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <input
                className="input w-full"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
              <button type="button" className="text-xs text-gray-500 hover:text-white w-full text-center" onClick={() => setStep('request')}>
                ← Back to request step
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600">
          Remember your password?{' '}
          <Link to="/" className="text-cyan-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
