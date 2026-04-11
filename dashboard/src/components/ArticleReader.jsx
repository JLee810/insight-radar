/**
 * ArticleReader — full-text article reader modal.
 * Fetches full article content from the backend and renders it inline.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, MessageSquare, Bookmark, BookmarkCheck, BookOpen, BookMarked, Loader } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUpdateArticle } from '../hooks/useArticles.js';
import { api } from '../services/api.js';

export default function ArticleReader({ article, onClose }) {
  const navigate = useNavigate();
  const update = useUpdateArticle();

  // Fetch full article content
  const { data: full, isLoading } = useQuery({
    queryKey: ['article', article.id, 'full'],
    queryFn: () => api.articles.get(article.id),
    staleTime: 10 * 60_000,
  });

  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    // Mark as read when opened
    if (!article.is_read) update.mutate({ id: article.id, is_read: true });
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggleBookmark(e) {
    e.stopPropagation();
    update.mutate({ id: article.id, is_bookmarked: !article.is_bookmarked });
  }

  function goToDebate() {
    onClose();
    navigate(`/debate/${article.id}`);
  }

  const content = full?.content || article.content;
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const tags = Array.isArray(article.ai_tags) ? article.ai_tags : [];

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
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {article.website_name && (
                <p className="text-xs text-cyan-400 font-medium mb-1">{article.website_name}</p>
              )}
              <h2 className="text-base font-bold text-white leading-snug">{article.title}</h2>
              <p className="text-xs text-gray-500 mt-1">{date}</p>
            </div>
            <button className="shrink-0 text-gray-500 hover:text-white transition-colors" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-3">
              {tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

          {/* AI Summary */}
          {article.summary && (
            <div className="bg-cyan-400/5 border border-cyan-400/15 rounded-xl p-4">
              <p className="text-xs text-cyan-400 uppercase tracking-widest mb-2">AI Summary</p>
              <p className="text-sm text-gray-300 leading-relaxed">{article.summary}</p>
            </div>
          )}

          {article.ai_insights && (
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Key Insight</p>
              <p className="text-sm text-cyan-300 leading-relaxed italic">💡 {article.ai_insights}</p>
            </div>
          )}

          {/* Full content */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Article Content</p>
            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader size={16} className="animate-spin" />
                <span className="text-sm">Loading content…</span>
              </div>
            ) : content ? (
              <div className="prose prose-sm prose-invert max-w-none">
                {content.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm text-gray-300 leading-relaxed mb-3">{para}</p>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-gray-500">Full text not available inline.</p>
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
          </div>
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
            onClick={goToDebate}
          >
            <MessageSquare size={14} /> Open Debate
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              className={`btn-ghost p-2 ${article.is_bookmarked ? 'text-cyan-400' : 'text-gray-500'}`}
              onClick={toggleBookmark}
              title={article.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              {article.is_bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
