import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, Radar, LogIn, LogOut, User, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';

/**
 * Top navigation bar with logo, search, auth, and notification bell.
 * @param {{ onSearch: (q: string) => void }} props
 */
export default function Header({ onSearch }) {
  const [query, setQuery] = useState('');
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 60_000 });
  const { user, logout } = useAuth();

  function handleSearch(e) {
    e.preventDefault();
    onSearch(query);
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-navy-900/80 backdrop-blur border-b border-white/5 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* Logo — clickable, navigates home */}
          <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
              <Radar size={18} className="text-navy-900" />
            </div>
            <span className="font-bold text-white tracking-tight">InsightRadar</span>
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

          <div className="flex items-center gap-2 ml-auto">
            {/* Unread badge */}
            <button className="relative btn-ghost p-2">
              <Bell size={18} />
              {stats?.unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </button>

            {/* Settings */}
            <Link to="/settings" className="btn-ghost p-2" title="Settings">
              <Settings size={18} />
            </Link>

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <User size={14} />
                  {user.username}
                </span>
                <button className="btn-ghost p-2" onClick={logout} title="Sign out">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                className="btn-primary flex items-center gap-1 text-sm"
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
