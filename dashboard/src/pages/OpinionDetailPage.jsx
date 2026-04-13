/**
 * OpinionDetailPage — full opinion view.
 * Route: /opinions/:id
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Tag, PenLine, Heart, Share2, Clock, ChevronRight } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';

/** Avatar */
function Avatar({ name, size = 'md' }) {
  const colors = [
    'from-cyan-400 to-blue-500',
    'from-purple-400 to-pink-500',
    'from-emerald-400 to-teal-500',
    'from-orange-400 to-red-500',
    'from-yellow-400 to-orange-500',
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sz = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

/** Estimated read time */
function readTime(text = '') {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function OpinionDetailPage() {
  const { id } = useParams();
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();

  const { data: opinion, isLoading, isError } = useQuery({
    queryKey: ['opinion', id],
    queryFn: () => api.opinions.get(id),
  });

  const likeMutation = useMutation({
    mutationFn: () => api.opinions.like(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opinion', id] }),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-navy-900">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-white/5 rounded-lg" />
        <div className="h-10 w-3/4 bg-white/5 rounded-xl" />
        <div className="h-6 w-1/2 bg-white/5 rounded-lg" />
        <div className="space-y-3 pt-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-white/5 rounded" style={{ width: `${85 + Math.random() * 15}%` }} />)}
        </div>
      </div>
    </div>
  );

  if (isError || !opinion) return (
    <div className="min-h-screen bg-navy-900">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
          <PenLine size={28} className="text-gray-600" />
        </div>
        <p className="text-white font-semibold">Opinion not found</p>
        <Link to="/opinions" className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:underline">
          <ArrowLeft size={13} /> Back to opinions
        </Link>
      </div>
    </div>
  );

  const date = new Date(opinion.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const updatedDate = opinion.updated_at !== opinion.created_at
    ? new Date(opinion.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const mins = readTime(opinion.body);

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      {/* Sub-nav */}
      <div className="border-b border-white/5 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs text-gray-500">
          <Link to="/opinions" className="flex items-center gap-1 hover:text-white transition-colors">
            <ArrowLeft size={13} /> Opinions
          </Link>
          <ChevronRight size={12} className="text-gray-700" />
          <span className="text-gray-400 truncate max-w-xs">{opinion.title}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <article>

          {/* ── Article header ── */}
          <header className="space-y-6 mb-10">

            {/* Tags row */}
            {opinion.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {opinion.tags.map(t => (
                  <Link key={t} to={`/tag/${encodeURIComponent(t)}`}
                    className="flex items-center gap-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-full hover:bg-cyan-400/20 transition-colors">
                    <Tag size={9} /> {t}
                  </Link>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
              {opinion.title}
            </h1>

            {/* Excerpt / subtitle */}
            {opinion.excerpt && (
              <p className="text-xl text-gray-400 leading-relaxed font-light border-l-2 border-cyan-400/40 pl-4">
                {opinion.excerpt}
              </p>
            )}

            {/* Author + meta bar */}
            <div className="flex items-center justify-between gap-4 py-4 border-y border-white/8">
              <div className="flex items-center gap-3">
                <Avatar name={opinion.author} size="md" />
                <div>
                  <Link to={`/profile/${opinion.author}`}
                    className="text-sm font-semibold text-white hover:text-cyan-400 transition-colors">
                    {opinion.author}
                  </Link>
                  {opinion.author_bio && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{opinion.author_bio}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                <span className="flex items-center gap-1"><Calendar size={11} /> {date}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {mins} min read</span>
                {updatedDate && <span className="italic text-gray-600">Updated {updatedDate}</span>}
              </div>
            </div>
          </header>

          {/* ── Article body ── */}
          <div className="space-y-5 mb-12">
            {opinion.body.split('\n').map((para, i) =>
              para.trim() ? (
                <p key={i} className="text-gray-300 leading-8 text-[1.05rem]">{para}</p>
              ) : (
                <div key={i} className="h-2" />
              )
            )}
          </div>

          {/* ── Like + share bar ── */}
          <div className="flex items-center justify-between gap-4 py-5 border-y border-white/8 mb-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { if (!user) return; likeMutation.mutate(); }}
                title={user ? (opinion.hasLiked ? 'Unlike' : 'Like this opinion') : 'Sign in to like'}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  opinion.hasLiked
                    ? 'text-rose-400 border-rose-400/30 bg-rose-400/10 hover:bg-rose-400/20'
                    : 'text-gray-400 border-white/10 hover:border-rose-400/30 hover:text-rose-400 hover:bg-rose-400/5'
                }`}
              >
                <Heart size={15} className={opinion.hasLiked ? 'fill-rose-400' : ''} />
                {opinion.like_count > 0 ? `${opinion.like_count} ${opinion.like_count === 1 ? 'Like' : 'Likes'}` : 'Like this'}
              </button>

              <button
                onClick={() => { navigator.clipboard?.writeText(window.location.href); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all"
                title="Copy link"
              >
                <Share2 size={13} /> Share
              </button>
            </div>

            <Link to="/opinions" className="text-sm text-gray-500 hover:text-cyan-400 transition-colors flex items-center gap-1">
              More opinions <ChevronRight size={13} />
            </Link>
          </div>

          {/* ── Author card footer ── */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 flex items-start gap-4">
            <Avatar name={opinion.author} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/profile/${opinion.author}`}
                    className="font-bold text-white hover:text-cyan-400 transition-colors">
                    {opinion.author}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">Community contributor</p>
                </div>
                <Link to={`/profile/${opinion.author}`}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all">
                  View profile <ChevronRight size={11} />
                </Link>
              </div>
              {opinion.author_bio ? (
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">{opinion.author_bio}</p>
              ) : (
                <p className="text-sm text-gray-600 mt-3 italic">No bio yet.</p>
              )}
            </div>
          </div>

        </article>
      </div>
    </div>
  );
}
