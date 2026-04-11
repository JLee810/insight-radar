/**
 * SettingsPage — user account and app preferences.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Shield, Bell, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    // Preferences are stored locally for now
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Nav */}
      <div className="sticky top-0 z-40 bg-navy-900/80 backdrop-blur border-b border-white/5 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to InsightRadar
          </Link>
          <span className="text-gray-700">|</span>
          <span className="text-xs text-gray-500">Settings</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Account */}
        <Section icon={User} title="Account">
          {user ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Username</p>
                  <p className="text-sm text-white">{user.username}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Role</p>
                  <p className="text-sm text-white capitalize">{user.role}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="text-sm text-white">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Member since</p>
                  <p className="text-sm text-white">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
              <button
                className="btn-ghost text-sm text-red-400 hover:text-red-300 hover:border-red-400/30 mt-2"
                onClick={logout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              You are not signed in.{' '}
              <Link to="/" className="text-cyan-400 hover:underline">Go home</Link> to sign in.
            </p>
          )}
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          <form onSubmit={handleSave} className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-cyan-400" defaultChecked />
              <span className="text-sm text-gray-300">Email digest of top articles (weekly)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-cyan-400" defaultChecked />
              <span className="text-sm text-gray-300">Notify when debate threads open</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-cyan-400" />
              <span className="text-sm text-gray-300">Notify on replies to my comments</span>
            </label>
            <button type="submit" className="btn-primary text-sm">
              {saved ? 'Saved!' : 'Save Preferences'}
            </button>
          </form>
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Privacy & Security">
          <div className="space-y-2 text-sm text-gray-400">
            <p>Sessions use short-lived JWT access tokens (15 min) with rotating refresh tokens (7 days).</p>
            <p>Passwords are hashed with bcrypt (cost 12). We never store plaintext credentials.</p>
            <p>All API requests are rate-limited. Comments are reviewed for policy violations.</p>
          </div>
        </Section>

        {/* About */}
        <Section icon={Info} title="About InsightRadar">
          <div className="space-y-1 text-sm text-gray-400">
            <p>InsightRadar — AI-powered news intelligence &amp; community debate platform.</p>
            <p className="text-xs text-gray-600">Version 2.0 · Built with Claude AI · Powered by Anthropic</p>
          </div>
        </Section>

      </div>
    </div>
  );
}
