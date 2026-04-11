/**
 * ArticleModal — article detail with two tabs: Summary and Full Read.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ExternalLink, MessageSquare, Bookmark, BookmarkCheck,
  Sparkles, BarChart2, Tag, BookOpen, Loader
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUpdateArticle } from '../hooks/useArticles.js';
import { api } from '../services/api.js';

function RelevanceBar({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Relevance score</span>
        <span className="font-semibold" style={{ color }}>{Math.round(score)}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function ArticleModal({ article, onClose }) {
  const [tab, setTab] = useState('summary'); // 'summary' | 'read'
  const navigate = useNavigate();
  const update = useUpdateArticle();

  const { data: full, isLoading: loadingFull } = useQuery({
    queryKey: ['article', article.id, 'full'],
    queryFn: () => api.articles.get(article.id),
    enabled: tab === 'read',
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    if (!article.is_read) update.mutate({ id: article.id, is_read: true });
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggleBookmark(e) {
    e.stopPropagation();
    update.mutate({ id: article.id, is_bookmarked: !article.is_bookmarked });
  }

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const tags = Array.isArray(article.ai_tags) ? article.ai_tags : [];
  const content = full?.content || article.content;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-navy-800 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="shrink-0 px-6 pt-5 pb-0 border-b border-white/5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              {article.website_name && (
                <p className="text-xs text-cyan-400 font-medium mb-1">{article.website_name}</p>
              )}
              <h2 className="text-base font-bold text-white leading-snug">{article.title}</h2>
              <p className="text-xs text-gray-500 mt-1">{date}</p>
            </div>
            <button className="shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {[
              { id: 'summary', label: 'AI Summary', icon: Sparkles },
              { id: 'read',    label: 'Full Article', icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

          {tab === 'summary' && (
            <>
              <RelevanceBar score={article.relevance_score || 0} />

              {article.summary && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BarChart2 size={13} className="text-gray-500" />
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Summary</p>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{article.summary}</p>
                </div>
              )}

              {article.ai_insights && (
                <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={13} className="text-cyan-400" />
                    <p className="text-xs text-cyan-400 uppercase tracking-widest">Key Insight</p>
                  </div>
                  <p className="text-sm text-cyan-300 leading-relaxed italic">{article.ai_insights}</p>
                </div>
              )}

              {tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag size={13} className="text-gray-500" />
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Topics</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                </div>
              )}

              {!article.summary && !article.ai_insights && tags.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No AI analysis yet for this article.</p>
              )}
            </>
          )}

          {tab === 'read' && (
            <>
              {loadingFull ? (
                <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
                  <Loader size={16} className="animate-spin" />
                  <span className="text-sm">Loading article…</span>
                </div>
              ) : content ? (
                <div className="space-y-3">
                  {content.split('\n').filter(p => p.trim()).map((para, i) => (
                    <p key={i} className="text-sm text-gray-300 leading-relaxed">{para}</p>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <BookOpen size={32} className="mx-auto text-gray-600" />
                  <p className="text-sm text-gray-500">Full text not stored for this article.</p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <ExternalLink size={14} /> Read on original site
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <ExternalLink size={14} /> Original Article
          </a>
          <button
            className="btn-ghost flex items-center gap-2 text-sm"
            onClick={() => { onClose(); navigate(`/debate/${article.id}`); }}
          >
            <MessageSquare size={14} /> Debate
          </button>
          <div className="ml-auto">
            <button
              className={`btn-ghost p-2 ${article.is_bookmarked ? 'text-cyan-400' : 'text-gray-500'}`}
              onClick={toggleBookmark}
            >
              {article.is_bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
