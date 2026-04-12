/**
 * OpinionDetailPage — full opinion view.
 * Route: /opinions/:id
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, User, Calendar, Tag, PenLine, Heart } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';

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
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isError || !opinion) return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center text-gray-400">
      Opinion not found.
    </div>
  );

  const date = new Date(opinion.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const updatedDate = opinion.updated_at !== opinion.created_at
    ? new Date(opinion.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      {/* Back nav */}
      <div className="bg-navy-900/60 border-b border-white/5 px-6 py-2">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/opinions" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to opinions
          </Link>
          <span className="text-gray-700">|</span>
          <PenLine size={13} className="text-cyan-400" />
          <span className="text-xs text-gray-500">NewPublicSphere</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <article className="space-y-8">

          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-white leading-tight">{opinion.title}</h1>

            <div className="flex items-center gap-4 flex-wrap">
              <Link
                to={`/profile/${opinion.author}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-navy-900 font-bold text-xs">
                  {opinion.author?.[0]?.toUpperCase()}
                </div>
                {opinion.author}
              </Link>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={11} /> {date}
              </span>
              {updatedDate && (
                <span className="text-xs text-gray-600 italic">Updated {updatedDate}</span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {opinion.tags?.map(t => (
                <Link key={t} to={`/tag/${encodeURIComponent(t)}`} className="tag hover:border-cyan-400/40 hover:text-cyan-400 transition-colors">
                  <Tag size={10} className="inline mr-1" />{t}
                </Link>
              ))}
              <button
                className={`flex items-center gap-1.5 text-sm transition-colors ml-auto ${opinion.hasLiked ? 'text-rose-400' : 'text-gray-500 hover:text-rose-400'}`}
                onClick={() => { if (!user) return; likeMutation.mutate(); }}
                title={user ? (opinion.hasLiked ? 'Unlike' : 'Like') : 'Sign in to like'}
              >
                <Heart size={15} className={opinion.hasLiked ? 'fill-rose-400' : ''} />
                <span>{opinion.like_count > 0 ? opinion.like_count : ''} {opinion.hasLiked ? 'Liked' : 'Like'}</span>
              </button>
            </div>

            <div className="border-b border-white/5" />
          </div>

          {/* Body */}
          <div className="prose prose-sm prose-invert max-w-none">
            {opinion.body.split('\n').map((para, i) =>
              para.trim() ? (
                <p key={i} className="text-gray-300 leading-relaxed mb-4">{para}</p>
              ) : (
                <div key={i} className="mb-2" />
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 pt-6 flex items-center justify-between">
            <Link
              to={`/profile/${opinion.author}`}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-navy-900 font-bold">
                {opinion.author?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">{opinion.author}</p>
                <p className="text-xs text-gray-500">View profile</p>
              </div>
            </Link>
            <Link to="/opinions" className="btn-ghost text-sm">
              More opinions →
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
