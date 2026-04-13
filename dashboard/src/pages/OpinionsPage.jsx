/**
 * OpinionsPage — NewPublicSphere community opinion writing and reading.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PenLine, User, Calendar, Tag, ArrowLeft, X, Send, Trash2, Heart, TrendingUp, Clock, Flame } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from '../components/AuthModal.jsx';
import Header from '../components/Header.jsx';

/** Avatar circle */
function Avatar({ name, size = 'sm' }) {
  const colors = [
    'from-cyan-400 to-blue-500',
    'from-purple-400 to-pink-500',
    'from-emerald-400 to-teal-500',
    'from-orange-400 to-red-500',
    'from-yellow-400 to-orange-500',
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

/** Featured (first) opinion card — large hero style */
function FeaturedCard({ opinion, currentUser, accessToken, onDelete, onLike }) {
  const date = new Date(opinion.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const canDelete = currentUser && (currentUser.id === opinion.author_id || currentUser.role === 'admin');

  return (
    <article className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden group hover:border-cyan-400/30 transition-all duration-300">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500" />

      <div className="p-6 space-y-4">
        {/* Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-full">
            <Flame size={11} /> Featured
          </span>
          {opinion.tags?.slice(0, 2).map(t => (
            <Link key={t} to={`/tag/${encodeURIComponent(t)}`}
              className="text-xs text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full hover:border-cyan-400/40 hover:text-cyan-400 transition-colors">
              {t}
            </Link>
          ))}
        </div>

        {/* Title */}
        <Link to={`/opinions/${opinion.id}`}>
          <h2 className="text-2xl font-bold text-white leading-tight hover:text-cyan-400 transition-colors line-clamp-3">
            {opinion.title}
          </h2>
        </Link>

        {/* Excerpt */}
        <p className="text-gray-400 leading-relaxed line-clamp-3">{opinion.excerpt}</p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-3">
            <Avatar name={opinion.author} size="md" />
            <div>
              <Link to={`/profile/${opinion.author}`} className="text-sm font-medium text-white hover:text-cyan-400 transition-colors">
                {opinion.author}
              </Link>
              <p className="text-xs text-gray-500">{date}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all ${
                opinion.hasLiked
                  ? 'text-rose-400 border-rose-400/30 bg-rose-400/10'
                  : 'text-gray-500 border-white/10 hover:border-rose-400/30 hover:text-rose-400'
              }`}
              onClick={() => onLike(opinion.id)}
            >
              <Heart size={13} className={opinion.hasLiked ? 'fill-rose-400' : ''} />
              {opinion.like_count > 0 ? opinion.like_count : 'Like'}
            </button>
            {canDelete && (
              <button className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                onClick={() => { if (confirm('Delete this opinion?')) onDelete(opinion.id); }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Regular opinion card */
function OpinionCard({ opinion, currentUser, accessToken, onDelete, onLike }) {
  const date = new Date(opinion.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const canDelete = currentUser && (currentUser.id === opinion.author_id || currentUser.role === 'admin');

  return (
    <article className="group flex gap-4 p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
      {/* Left: avatar */}
      <Avatar name={opinion.author} size="md" />

      {/* Right: content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/opinions/${opinion.id}`}
            className="font-semibold text-white leading-snug hover:text-cyan-400 transition-colors line-clamp-2">
            {opinion.title}
          </Link>
          {canDelete && (
            <button className="shrink-0 p-1 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              onClick={() => { if (confirm('Delete this opinion?')) onDelete(opinion.id); }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{opinion.excerpt}</p>

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <Link to={`/profile/${opinion.author}`}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors font-medium">
            {opinion.author}
          </Link>
          <span className="text-gray-700">·</span>
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <Clock size={10} /> {date}
          </span>
          <button
            className={`flex items-center gap-1 text-xs transition-colors ml-auto ${
              opinion.hasLiked ? 'text-rose-400' : 'text-gray-600 hover:text-rose-400'
            }`}
            onClick={() => onLike(opinion.id)}
          >
            <Heart size={11} className={opinion.hasLiked ? 'fill-rose-400' : ''} />
            {opinion.like_count > 0 && <span>{opinion.like_count}</span>}
          </button>
          {opinion.tags?.slice(0, 3).map(t => (
            <Link key={t} to={`/tag/${encodeURIComponent(t)}`}
              className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full border border-white/8 hover:border-cyan-400/30 hover:text-cyan-400 transition-colors">
              {t}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Write form */
function WriteForm({ accessToken, onSuccess, onCancel }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload) => api.opinions.create(accessToken, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opinions'] }); onSuccess(); },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (trimmedTitle.length < 3) { setError('Title must be at least 3 characters'); return; }
    if (trimmedBody.length < 10) { setError('Body must be at least 10 characters'); return; }
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    createMutation.mutate({ title: trimmedTitle, body: trimmedBody, tags });
  }

  const bodyLen = body.length;
  const bodyPct = Math.min((bodyLen / 50000) * 100, 100);

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400 to-blue-500" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <PenLine size={14} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Write an Opinion</h2>
              <p className="text-xs text-gray-500">Share your perspective with the community</p>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:bg-white/8 transition-all text-base font-medium"
              placeholder="Give your opinion a compelling title…"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              maxLength={200}
            />
            <p className="text-xs text-gray-600 mt-1 text-right">{title.length}/200</p>
          </div>

          <div>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:bg-white/8 transition-all resize-none leading-relaxed"
              rows={10}
              placeholder="Write your opinion here… Be clear, be bold, be constructive."
              value={body}
              onChange={e => { setBody(e.target.value); setError(''); }}
              maxLength={50000}
            />
            <div className="flex items-center justify-between mt-1">
              <div className="flex-1 h-1 bg-white/5 rounded-full mr-3">
                <div className="h-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all" style={{ width: `${bodyPct}%` }} />
              </div>
              <span className="text-xs text-gray-600">{bodyLen.toLocaleString()} / 50,000</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-3 border border-white/5">
            <Tag size={13} className="text-gray-500 shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
              placeholder="Add tags: politics, economy, climate… (comma-separated)"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <X size={13} /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              <Send size={14} />
              {createMutation.isPending ? 'Publishing…' : 'Publish Opinion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OpinionsPage() {
  const { user, accessToken } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['opinions'],
    queryFn: () => api.opinions.list({ limit: 50 }),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.opinions.delete(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opinions'] }),
  });

  const likeMutation = useMutation({
    mutationFn: (id) => api.opinions.like(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opinions'] }),
  });

  function handleLike(id) {
    if (!user) return setAuthMode('login');
    likeMutation.mutate(id);
  }

  const opinions = data?.opinions || [];
  const [featured, ...rest] = opinions;

  return (
    <div className="min-h-screen bg-navy-900">
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
      <Header />

      {/* Sub-nav */}
      <div className="border-b border-white/5 px-6 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-1.5">
            <PenLine size={13} className="text-cyan-400" />
            <span className="text-sm font-semibold text-white">NewPublicSphere</span>
            <span className="text-xs text-gray-600">· Community Opinions</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Hero header */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">Community</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Opinions</h1>
            <p className="text-gray-500 text-sm">Long-form perspectives from the InsightRadar community.</p>
          </div>

          {user ? (
            <button
              onClick={() => setShowForm(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                showForm
                  ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/20'
              }`}
            >
              <PenLine size={14} />
              {showForm ? 'Cancel' : 'Write Opinion'}
            </button>
          ) : (
            <button
              onClick={() => setAuthMode('login')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
            >
              <PenLine size={14} /> Sign in to write
            </button>
          )}
        </div>

        {/* Stats bar */}
        {opinions.length > 0 && (
          <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-white/3 border border-white/5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><PenLine size={11} className="text-cyan-400" /> <strong className="text-white">{opinions.length}</strong> opinions</span>
            <span className="flex items-center gap-1.5"><Heart size={11} className="text-rose-400" /> <strong className="text-white">{opinions.reduce((s, o) => s + (o.like_count || 0), 0)}</strong> likes</span>
            <span className="flex items-center gap-1.5"><User size={11} className="text-purple-400" /> <strong className="text-white">{new Set(opinions.map(o => o.author)).size}</strong> contributors</span>
          </div>
        )}

        {/* Write form */}
        {showForm && (
          <WriteForm
            accessToken={accessToken}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 h-48 animate-pulse bg-white/3" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/8 h-24 animate-pulse bg-white/3" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-12 text-red-400 text-sm bg-red-400/5 border border-red-400/10 rounded-xl">
            Failed to load opinions. Is the server running?
          </div>
        )}

        {!isLoading && opinions.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <PenLine size={28} className="text-gray-600" />
            </div>
            <div>
              <p className="text-white font-semibold">No opinions yet</p>
              <p className="text-gray-500 text-sm mt-1">Be the first to share your perspective.</p>
            </div>
            {user && (
              <button onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors">
                <PenLine size={13} /> Write the first opinion
              </button>
            )}
          </div>
        )}

        {/* Featured card */}
        {featured && (
          <FeaturedCard
            opinion={featured}
            currentUser={user}
            accessToken={accessToken}
            onDelete={(id) => deleteMutation.mutate(id)}
            onLike={handleLike}
          />
        )}

        {/* Rest of opinions */}
        {rest.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2">
              <Clock size={13} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">More Opinions</span>
            </div>
            <div className="space-y-2">
              {rest.map(opinion => (
                <OpinionCard
                  key={opinion.id}
                  opinion={opinion}
                  currentUser={user}
                  accessToken={accessToken}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onLike={handleLike}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
