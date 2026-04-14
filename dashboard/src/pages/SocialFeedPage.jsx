/**
 * SocialFeedPage — tracks Reddit / Bluesky sources and surfaces posts
 * relevant to: politics, socio-economic, health, education, technology.
 * Posts are AI-filtered and shown with bias analysis + inline debate.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, RefreshCw, X, Globe,
  BookOpen, TrendingUp, Heart, ShieldAlert, Cpu, Lock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';
import SocialPostCard from '../components/SocialPostCard.jsx';

/* ── Constants ─────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: '',              label: 'All Topics',    icon: Globe },
  { id: 'politics',      label: 'Politics',      icon: ShieldAlert },
  { id: 'socio-economic',label: 'Socio-Economic',icon: TrendingUp },
  { id: 'health',        label: 'Health',        icon: Heart },
  { id: 'education',     label: 'Education',     icon: BookOpen },
  { id: 'technology',    label: 'Technology',    icon: Cpu },
];

const ALL_PLATFORMS = [
  { id: 'reddit',    label: 'Reddit',    placeholder: 'r/worldnews  or  u/username',  pill: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
  { id: 'bluesky',   label: 'Bluesky',   placeholder: 'user.bsky.social',              pill: 'bg-sky-500/15 text-sky-400 border-sky-500/25'          },
  { id: 'x',         label: 'X',         placeholder: '@username',                      pill: 'bg-gray-500/15 text-gray-300 border-gray-500/25'        },
  { id: 'instagram', label: 'Instagram', placeholder: 'your_account',                  pill: 'bg-pink-500/15 text-pink-400 border-pink-500/25'        },
  { id: 'facebook',  label: 'Facebook',  placeholder: 'page-name-or-id',               pill: 'bg-blue-600/15 text-blue-400 border-blue-600/25'        },
];

const PLATFORM_PILL = {
  reddit:    'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  bluesky:   'bg-sky-500/15    text-sky-400    border border-sky-500/25',
  x:         'bg-gray-500/15   text-gray-300   border border-gray-500/25',
  instagram: 'bg-pink-500/15   text-pink-400   border border-pink-500/25',
  facebook:  'bg-blue-600/15   text-blue-400   border border-blue-600/25',
};

/* ── Source manager panel ─────────────────────────────────────────────── */

function SourceManager({ onClose }) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [platform, setPlatform] = useState('reddit');
  const [handle, setHandle]     = useState('');
  const [error, setError]       = useState('');

  const { data: sources = [] } = useQuery({
    queryKey: ['social-sources'],
    queryFn: api.social.sources,
    staleTime: 30_000,
  });

  const { data: platformStatus = {} } = useQuery({
    queryKey: ['social-platform-status'],
    queryFn: api.social.platformStatus,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: () => api.social.addSource(accessToken, { platform, handle }),
    onSuccess: () => {
      setHandle('');
      setError('');
      qc.invalidateQueries({ queryKey: ['social-sources'] });
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.social.deleteSource(accessToken, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-sources'] });
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id) => api.social.refresh(accessToken, id),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['social-posts'] }), 3000),
  });

  function handleAdd(e) {
    e.preventDefault();
    if (!handle.trim()) return;
    setError('');
    addMutation.mutate();
  }

  const currentPlat   = ALL_PLATFORMS.find(p => p.id === platform);
  const currentStatus = platformStatus[platform];
  const isLocked      = currentStatus && !currentStatus.available;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm">Tracked Sources</h3>
        <button className="text-gray-500 hover:text-white p-1" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Platform selector grid */}
      <div className="grid grid-cols-5 gap-1">
        {ALL_PLATFORMS.map(p => {
          const status  = platformStatus[p.id];
          const locked  = status && !status.available;
          const active  = platform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              title={locked ? status.note : p.label}
              className={`relative flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] font-medium transition-colors border ${
                active
                  ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30'
                  : locked
                  ? 'text-gray-600 border-white/5 cursor-pointer'
                  : 'text-gray-400 border-white/10 hover:border-white/25 hover:text-gray-200'
              }`}
            >
              {p.label}
              {locked && <Lock size={9} className="text-gray-600" />}
            </button>
          );
        })}
      </div>

      {/* Locked platform notice */}
      {isLocked && (
        <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
          <span className="font-semibold">Setup required:</span> {currentStatus.note}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder={currentPlat?.placeholder}
            value={handle}
            onChange={e => setHandle(e.target.value)}
            disabled={isLocked}
            required
          />
          <button
            type="submit"
            className="btn-primary shrink-0 flex items-center gap-1"
            disabled={addMutation.isPending || !handle.trim() || isLocked}
          >
            <Plus size={14} />
            {addMutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>

      <p className="text-[11px] text-gray-600">
        Posts are AI-filtered to politics, economics, health, education &amp; tech only.
      </p>

      {/* Source list */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {sources.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">No sources yet. Add one above.</p>
        )}
        {sources.map(src => (
          <div key={src.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 border ${PLATFORM_PILL[src.platform]}`}>
              {src.platform}
            </span>
            <span className="text-sm text-white flex-1 min-w-0 truncate">{src.handle}</span>
            <span className="text-[10px] text-gray-600 shrink-0">{src.post_count} posts</span>
            <button
              className="text-gray-600 hover:text-cyan-400 p-1 shrink-0 transition-colors"
              onClick={() => refreshMutation.mutate(src.id)}
              title="Refresh"
            >
              <RefreshCw size={12} className={refreshMutation.isPending ? 'animate-spin' : ''} />
            </button>
            <button
              className="text-gray-600 hover:text-red-400 p-1 shrink-0 transition-colors"
              onClick={() => { if (confirm(`Remove ${src.handle}?`)) deleteMutation.mutate(src.id); }}
              title="Remove"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function SocialFeedPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [page, setPage]         = useState(0);
  const [showManager, setShowManager] = useState(false);
  const LIMIT = 15;

  const { data: sources = [] } = useQuery({
    queryKey: ['social-sources'],
    queryFn: api.social.sources,
    staleTime: 60_000,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['social-posts', category, page],
    queryFn: () => api.social.posts({ category: category || undefined, limit: LIMIT, offset: page * LIMIT }),
    staleTime: 60_000,
  });

  const refreshAll = useMutation({
    mutationFn: () => api.social.refresh(accessToken),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['social-posts'] }), 5000),
  });

  const posts = data?.posts || [];
  const total = data?.total || 0;

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 pb-24 md:pb-6">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">Social Feed</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AI-curated social media on politics, economy, health, education &amp; tech — join the debate.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {accessToken && (
              <>
                <button
                  className="btn-ghost flex items-center gap-1.5 text-sm"
                  onClick={() => refreshAll.mutate()}
                  disabled={refreshAll.isPending}
                >
                  <RefreshCw size={14} className={refreshAll.isPending ? 'animate-spin' : ''} />
                  {refreshAll.isPending ? 'Refreshing…' : 'Refresh'}
                </button>
                <button
                  className="btn-primary flex items-center gap-1.5 text-sm"
                  onClick={() => setShowManager(v => !v)}
                >
                  <Plus size={14} />
                  Manage Sources
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Source manager panel ── */}
        {showManager && accessToken && (
          <SourceManager onClose={() => setShowManager(false)} />
        )}

        {/* Empty state — no sources */}
        {sources.length === 0 && !showManager && (
          <div className="card text-center py-12 text-gray-500 space-y-3">
            <Globe size={40} className="mx-auto opacity-20" />
            <p className="text-base font-medium text-gray-400">No social sources yet</p>
            <p className="text-sm">
              Add Reddit subs or Bluesky accounts to start tracking relevant discussions.
            </p>
            {accessToken && (
              <button className="btn-primary mx-auto" onClick={() => setShowManager(true)}>
                <Plus size={14} className="mr-1.5" /> Add First Source
              </button>
            )}
            {!accessToken && (
              <p className="text-sm text-cyan-400">Sign in to add social sources.</p>
            )}
          </div>
        )}

        {/* ── Category filter chips ── */}
        {sources.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setCategory(id); setPage(0); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  category === id
                    ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30'
                    : 'text-gray-400 border-white/10 hover:border-white/25 hover:text-gray-200'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Feed ── */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-32 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-400 text-sm card">Failed to load posts. Is the server running?</p>
        )}

        {!isLoading && posts.length === 0 && sources.length > 0 && (
          <div className="card text-center py-10 text-gray-500">
            <p className="text-sm">
              {category
                ? `No ${CATEGORIES.find(c => c.id === category)?.label} posts found yet.`
                : 'No relevant posts found yet. Posts are AI-filtered — try refreshing sources.'}
            </p>
            {accessToken && (
              <button
                className="btn-ghost text-xs mt-3"
                onClick={() => refreshAll.mutate()}
                disabled={refreshAll.isPending}
              >
                <RefreshCw size={12} className={`mr-1 ${refreshAll.isPending ? 'animate-spin' : ''}`} />
                Refresh all sources
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {posts.map(post => <SocialPostCard key={post.id} post={post} />)}
        </div>

        {/* ── Pagination ── */}
        {!isLoading && total > LIMIT && (
          <div className="flex items-center justify-between pt-2">
            <button
              className="btn-ghost text-sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} · {total} posts total
            </span>
            <button
              className="btn-ghost text-sm"
              onClick={() => setPage(p => p + 1)}
              disabled={posts.length < LIMIT}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
