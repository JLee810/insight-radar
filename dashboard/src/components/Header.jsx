import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Radar, LogIn, LogOut, User, Settings, PenLine, ShieldAlert, X, Bookmark, Sun, Moon, MessageSquare, Flame } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';

const NOTIF_ICONS = {
  reply: <MessageSquare size={13} className="text-cyan-400 shrink-0 mt-0.5" />,
  debate_open: <Flame size={13} className="text-amber-400 shrink-0 mt-0.5" />,
  like: <span className="text-rose-400 text-xs shrink-0 mt-0.5">♥</span>,
};

/** Notification dropdown panel */
function NotificationPanel({ notifications, unreadCount, onClose, onMarkAllRead }) {
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
      className="absolute right-0 top-10 w-80 bg-navy-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-sm font-semibold text-white">Notifications</span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              className="text-xs text-cyan-400 hover:underline"
              onClick={onMarkAllRead}
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {!notifications?.length ? (
          <p className="text-sm text-gray-500 text-center py-6">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map(n => {
              const isReply = n.type === 'reply';
              const isDebate = n.type === 'debate_open';
              const linkTo = isReply || isDebate
                ? `/debate/${n.data?.articleId}`
                : '/';
              return (
                <Link
                  key={n.id}
                  to={linkTo}
                  onClick={onClose}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-cyan-400/5' : ''}`}
                >
                  {NOTIF_ICONS[n.type] || <Bell size={13} className="text-gray-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 leading-snug">
                      {isReply && `${n.data?.replierUsername} replied to your comment`}
                      {isDebate && `Debate opened: "${n.data?.articleTitle?.slice(0, 60)}"`}
                      {!isReply && !isDebate && 'New notification'}
                    </p>
                    {n.data?.excerpt && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 italic">"{n.data.excerpt}"</p>
                    )}
                    <p className="text-xs text-gray-600 mt-0.5">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Persist and apply dark/light theme preference.
 */
function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored !== 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(v => !v) };
}

/**
 * Top navigation bar — logo (home), search, opinions, settings, auth.
 */
export default function Header({ onSearch }) {
  const [query, setQuery] = useState('');
  const [authModal, setAuthModal] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, accessToken, logout } = useAuth();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', accessToken],
    queryFn: () => api.notifications.list(accessToken),
    enabled: !!accessToken,
    refetchInterval: 30_000,
    retry: false,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(accessToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifData?.unreadCount ?? 0;

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

          {/* Logo */}
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

            <Link to="/search" className="btn-ghost p-2" title="Search articles">
              <Search size={18} />
            </Link>

            <Link to="/bookmarks" className="btn-ghost p-2" title="Bookmarks">
              <Bookmark size={18} />
            </Link>

            <button
              className="btn-ghost p-2"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification bell — only when logged in */}
            {user && (
              <div className="relative">
                <button
                  className="relative btn-ghost p-2"
                  onClick={() => setShowNotif(v => !v)}
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-cyan-400 text-navy-900 text-[10px] font-bold flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotif && (
                  <NotificationPanel
                    notifications={notifData?.notifications}
                    unreadCount={unreadCount}
                    onClose={() => setShowNotif(false)}
                    onMarkAllRead={() => { markAllMutation.mutate(); setShowNotif(false); }}
                  />
                )}
              </div>
            )}

            <Link
              to="/opinions"
              className="btn-ghost px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium"
              title="Community Opinions"
            >
              <PenLine size={14} />
              <span className="hidden md:inline">Opinions</span>
            </Link>

            <Link to="/settings" className="btn-ghost p-2" title="Settings">
              <Settings size={18} />
            </Link>

            {user?.role === 'admin' && (
              <Link to="/admin" className="btn-ghost p-2" title="Admin Panel">
                <ShieldAlert size={18} className="text-amber-400" />
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2 ml-1 pl-2 border-l border-white/10">
                <Link to={`/profile/${user.username}`} className="text-sm text-gray-400 hidden md:flex items-center gap-1 hover:text-white transition-colors">
                  <User size={13} />
                  {user.username}
                </Link>
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
