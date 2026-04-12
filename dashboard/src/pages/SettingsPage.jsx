/**
 * SettingsPage — account info, change password, preferences, security.
 */
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Shield, Bell, Info, Copy, Check, KeyRound, LogOut, PenLine } from 'lucide-react';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { useMutation } from '@tanstack/react-query';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-white/5">
        <Icon size={15} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Copyable info row */
function InfoRow({ label, value, copyable }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm text-white font-mono">{value}</p>
      </div>
      {copyable && (
        <button
          className="btn-ghost p-1.5 text-gray-500 hover:text-cyan-400 transition-colors"
          onClick={copy}
          title="Copy"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

/** Bio edit form */
function BioForm({ accessToken, initialBio }) {
  const [bio, setBio] = useState(initialBio);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.auth.updateProfile(accessToken, bio.trim() || null),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
    onError: (err) => setError(err.message),
  });

  return (
    <Section icon={PenLine} title="Bio">
      <div className="space-y-2">
        <textarea
          className="input w-full resize-none text-sm"
          rows={3}
          placeholder="Tell the community a bit about yourself… (max 300 characters)"
          value={bio}
          onChange={e => { setBio(e.target.value); setError(''); }}
          maxLength={300}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{bio.length}/300</span>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            {saved && <span className="text-xs text-green-400">✓ Saved</span>}
            <button
              className="btn-primary text-sm"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Save Bio'}
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Change password form */
function ChangePasswordForm({ accessToken }) {
  const currentRef = useRef(null);
  const nextRef = useRef(null);
  const confirmRef = useRef(null);
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Read directly from DOM to bypass autofill/React state sync issues
    const current = currentRef.current.value;
    const next = nextRef.current.value;
    const confirm = confirmRef.current.value;

    if (!current) { setError('Current password is required'); return; }
    if (next !== confirm) { setError('New passwords do not match'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters'); return; }

    setStatus('loading');
    try {
      await api.auth.changePassword(accessToken, current, next);
      setStatus('success');
      currentRef.current.value = '';
      nextRef.current.value = '';
      confirmRef.current.value = '';
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        ref={currentRef}
        className="input w-full"
        type="password"
        placeholder="Current password"
        autoComplete="current-password"
        required
      />
      <input
        ref={nextRef}
        className="input w-full"
        type="password"
        placeholder="New password (min 8 characters)"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <input
        ref={confirmRef}
        className="input w-full"
        type="password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        required
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {status === 'success' && (
        <p className="text-green-400 text-xs flex items-center gap-1">
          <Check size={12} /> Password changed successfully. Other sessions have been logged out.
        </p>
      )}

      <button
        type="submit"
        className="btn-primary text-sm"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const { user, accessToken, logout } = useAuth();
  const [prefSaved, setPrefSaved] = useState(false);

  function handleSavePref(e) {
    e.preventDefault();
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />
      <div className="bg-navy-900/60 border-b border-white/5 px-6 py-2">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-gray-700">|</span>
          <span className="text-xs text-gray-500">Settings</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Account Info */}
        <Section icon={User} title="Account">
          {user ? (
            <div className="space-y-1 divide-y divide-white/5">
              <InfoRow label="User ID" value={`#${user.id}`} copyable />
              <InfoRow label="Username" value={user.username} copyable />
              <InfoRow label="Email" value={user.email} copyable />
              <InfoRow label="Role" value={user.role === 'admin' ? '👑 Admin' : 'Member'} />
              <InfoRow
                label="Member since"
                value={user.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              />
              <div className="pt-3">
                <button
                  className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                  onClick={logout}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Not signed in.{' '}
              <Link to="/" className="text-cyan-400 hover:underline">Go home</Link> to sign in.
            </p>
          )}
        </Section>

        {/* Bio */}
        {user && <BioForm accessToken={accessToken} initialBio={user.bio || ''} />}

        {/* Change Password */}
        {user && (
          <Section icon={KeyRound} title="Change Password">
            <ChangePasswordForm accessToken={accessToken} />
            <p className="text-xs text-gray-600 pt-1">
              Forgot your password?{' '}
              <Link to="/reset-password" className="text-cyan-400 hover:underline">Reset it here</Link>
            </p>
          </Section>
        )}

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          <form onSubmit={handleSavePref} className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-cyan-400" defaultChecked />
              <span className="text-sm text-gray-300">Email digest of top articles (weekly)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-cyan-400" defaultChecked />
              <span className="text-sm text-gray-300">Notify when a debate thread opens</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-cyan-400" />
              <span className="text-sm text-gray-300">Notify on replies to my comments</span>
            </label>
            <button type="submit" className="btn-primary text-sm">
              {prefSaved ? '✓ Saved' : 'Save Preferences'}
            </button>
          </form>
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Privacy & Security">
          <div className="space-y-2 text-sm text-gray-400">
            <p>Sessions use short-lived JWT access tokens (15 min) with rotating refresh tokens (7 days).</p>
            <p>Passwords are hashed with bcrypt (cost 12). Changing your password logs out all other sessions.</p>
            <p>All API requests are rate-limited. Comments are reviewed for policy violations.</p>
          </div>
        </Section>

        {/* About */}
        <Section icon={Info} title="About InsightRadar">
          <div className="space-y-1 text-sm text-gray-400">
            <p>InsightRadar — AI-powered news intelligence &amp; community debate platform.</p>
            <p className="text-xs text-gray-600">Version 2.0 · NewPublicSphere · Built with Claude AI</p>
          </div>
        </Section>

      </div>
    </div>
  );
}
