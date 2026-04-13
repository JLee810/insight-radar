import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Radar, LogIn, LogOut, User, Settings, PenLine, ShieldAlert, X, Bookmark, Sun, Moon, MessageSquare, Flame, Clock, Menu } from 'lucide-react';
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
      className="absolute right-0 top-10 w-screen max-w-sm bg-navy-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-sm font-semibold text-white">Notifications</span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button className="text-xs text-cyan-400 hover:underline" onClick={onMarkAllRead}>
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {!notifications?.length ? (
          <p className="text-sm text-gray-500 text-center py-8">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map(n => {
              const isReply = n.type === 'reply';
              const isDebate = n.type === 'debate_open';
              const linkTo = isReply || isDebate ? `/debate/${n.data?.articleId}` : '/';
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
                      {isDebate && `Debate opened: "${n.data?.articleTitle?.slice(0, 50)}"`}
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

/** Mobile slide-in menu */
function MobileMenu({ user, onClose, onLogin, onLogout, toggleTheme, isDark }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div ref={ref} className="absolute right-0 top-0 bottom-0 w-72 bg-navy-800 border-l border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <span className="font-bold text-white">Menu</span>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        {user && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{user.username}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {[
            { to: '/', icon: <Radar size={17} />, label: 'Home' },
            { to: '/search', icon: <Search size={17} />, label: 'Search' },
            { to: '/opinions', icon: <PenLine size={17} />, label: 'Opinions' },
            { to: '/bookmarks', icon: <Bookmark size={17} />, label: 'Bookmarks' },
            { to: '/history', icon: <Clock size={17} />, label: 'Reading History' },
            { to: '/settings', icon: <Settings size={17} />, label: 'Settings' },
            ...(user ? [{ to: `/profile/${user.username}`, icon: <User size={17} />, label: 'Profile' }] : []),
            ...(user?.role === 'admin' ? [{ to: '/admin', icon: <ShieldAlert size={17} className="text-amber-400" />, label: 'Admin Panel' }] : []),
          ].map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="text-gray-400">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-white/5 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            {isDark ? <Sun size={17} className="text-gray-400" /> : <Moon size={17} className="text-gray-400" />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>

          {user ? (
            <button
              onClick={() => { onLogout(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
            >
              <LogOut size={17} /> Sign Out
            </button>
          ) : (
            <button
              onClick={() => { onLogin(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-cyan-400 hover:bg-cyan-400/10 transition-colors"
            >
              <LogIn size={17} /> Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function useTheme() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark'); root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark'); root.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(v => !v) };
}

export default function Header({ onSearch }) {
  const [query, setQuery] = useState('');
  const [authModal, setAuthModal] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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
    if (onSearch) onSearch(query);
    else navigate(`/?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
              <Radar size={18} className="text-navy-900" />
            </div>
            <span className="font-bold text-white tracking-tight hidden sm:block">InsightRadar</span>
          </Link>

          {/* Search — hidden on mobile, shown on sm+ */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                className="input pl-9 pr-4 w-full"
                placeholder="Search articles…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">

            {/* Mobile: search icon */}
            <Link to="/search" className="btn-ghost p-2 sm:hidden" title="Search">
              <Search size={18} />
            </Link>

            {/* Desktop only icons */}
            <Link to="/bookmarks" className="btn-ghost p-2 hidden md:flex" title="Bookmarks">
              <Bookmark size={18} />
            </Link>
            <Link to="/history" className="btn-ghost p-2 hidden md:flex" title="Reading History">
              <Clock size={18} />
            </Link>
            <button className="btn-ghost p-2 hidden md:flex" onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification bell */}
            {user && (
              <div className="relative">
                <button className="relative btn-ghost p-2" onClick={() => setShowNotif(v => !v)} title="Notifications">
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

            {/* Desktop: Opinions, Settings, Admin, User */}
            <Link to="/opinions" className="btn-ghost px-3 py-1.5 hidden md:flex items-center gap-1.5 text-xs font-medium">
              <PenLine size={14} />
              <span>Opinions</span>
            </Link>
            <Link to="/settings" className="btn-ghost p-2 hidden md:flex" title="Settings">
              <Settings size={18} />
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className="btn-ghost p-2 hidden md:flex" title="Admin">
                <ShieldAlert size={18} className="text-amber-400" />
              </Link>
            )}
            {user ? (
              <div className="hidden md:flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
                <Link to={`/profile/${user.username}`} className="text-sm text-gray-400 flex items-center gap-1 hover:text-white transition-colors px-2 py-1">
                  <User size={13} /> {user.username}
                </Link>
                <button className="btn-ghost p-2 text-gray-400 hover:text-red-400" onClick={logout} title="Sign out">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button className="btn-primary hidden md:flex items-center gap-1.5 text-sm ml-1" onClick={() => setAuthModal('login')}>
                <LogIn size={15} /> Sign In
              </button>
            )}

            {/* Mobile: Sign in button (when not logged in) */}
            {!user && (
              <button className="btn-primary flex items-center gap-1.5 text-sm md:hidden" onClick={() => setAuthModal('login')}>
                <LogIn size={15} /> Sign In
              </button>
            )}

            {/* Mobile: hamburger */}
            <button className="btn-ghost p-2 md:hidden" onClick={() => setShowMenu(true)} title="Menu">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {showMenu && (
        <MobileMenu
          user={user}
          onClose={() => setShowMenu(false)}
          onLogin={() => setAuthModal('login')}
          onLogout={logout}
          toggleTheme={toggleTheme}
          isDark={isDark}
        />
      )}

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
    </>
  );
}
