import { useState } from 'react';
import { Search, Bell, Settings, Radar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';

/**
 * Top navigation bar with logo, search, and notification bell.
 * @param {{ onSearch: (q: string) => void }} props
 */
export default function Header({ onSearch }) {
  const [query, setQuery] = useState('');
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 60_000 });

  function handleSearch(e) {
    e.preventDefault();
    onSearch(query);
  }

  return (
    <header className="sticky top-0 z-50 bg-navy-900/80 backdrop-blur border-b border-white/5 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
            <Radar size={18} className="text-navy-900" />
          </div>
          <span className="font-bold text-white tracking-tight">InsightRadar</span>
        </div>

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
          <button className="btn-ghost p-2">
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
