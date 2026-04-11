import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Radar, LogIn, LogOut, User, Settings, PenLine, ShieldAlert, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';

/** Notification dropdown */
function NotificationPanel({ stats, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 w-72 bg-navy-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-sm font-semibold text-white">Notifications</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {stats?.unreadCount > 0 ? (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">
                {stats.unreadCount} unread {stats.unreadCount === 1 ? 'article' : 'articles'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">New articles matched your interests</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-2">No new notifications</p>
        )}
        {stats?.articlesToday > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">
                {stats.articlesToday} new {stats.articlesToday === 1 ? 'article' : 'articles'} today
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Discovered by your tracked websites</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Top navigation bar — logo (home), search, opinions, settings, auth.
 * @param {{ onSearch?: (q: string) => void }} props
 */
export default function Header({ onSearch }) {
  const [query, setQuery] = useState('');
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [showNotif, setShowNotif] = useState(false);
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    refetchInterval: 60_000,
    retry: false,
  });
  const { user, logout } = useAuth();

  function handleSearch(e) {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    } else {
      navigate(`/?q=${encodeURIComponent(query)}`);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-navy-900/80 backdrop-blur border-b border-white/5 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">

          {/* Logo — always navigates home */}
          <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
              <Radar size={18} className="text-navy-900" />
            </div>
            <span className="font-bold text-white tracking-tight hidden sm:block">InsightRadar</span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                className="input pl-9 pr-4"
                placeholder="Search articles…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </form>

          <div className="flex items-center gap-1 ml-auto">

            {/* Notification bell */}
            <div className="relative">
              <button
                className="relative btn-ghost p-2"
                onClick={() => setShowNotif(v => !v)}
                title="Notifications"
              >
                <Bell size={18} />
                {stats?.unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                )}
              </button>
              {showNotif && (
                <NotificationPanel stats={stats} onClose={() => setShowNotif(false)} />
              )}
            </div>

            {/* Opinions link */}
            <Link
              to="/opinions"
              className="btn-ghost px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium"
              title="Community Opinions"
            >
              <PenLine size={14} />
              <span className="hidden md:inline">Opinions</span>
            </Link>

            {/* Settings */}
            <Link to="/settings" className="btn-ghost p-2" title="Settings">
              <Settings size={18} />
            </Link>

            {/* Admin — only for admin users */}
            {user?.role === 'admin' && (
              <Link to="/admin" className="btn-ghost p-2" title="Admin Panel">
                <ShieldAlert size={18} className="text-amber-400" />
              </Link>
            )}

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-2 ml-1 pl-2 border-l border-white/10">
                <span className="text-sm text-gray-400 hidden md:flex items-center gap-1">
                  <User size={13} />
                  {user.username}
                </span>
                <button
                  className="btn-ghost p-2 text-gray-400 hover:text-red-400"
                  onClick={logout}
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                className="btn-primary flex items-center gap-1.5 text-sm ml-1"
                onClick={() => setAuthModal('login')}
              >
                <LogIn size={15} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {authModal && (
        <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />
      )}
    </>
  );
}
