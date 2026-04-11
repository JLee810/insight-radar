/**
 * ArticleModal — full article detail overlay.
 * Shows summary, AI insights, tags, relevance, and debate link.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ExternalLink, MessageSquare, Bookmark, BookmarkCheck,
  BookOpen, BookMarked, Tag, Sparkles, BarChart2
} from 'lucide-react';
import { useUpdateArticle } from '../hooks/useArticles.js';

function RelevanceBar({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Relevance score</span>
        <span className="font-semibold" style={{ color }}>{Math.round(score)}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, score)}%`, background: color }}
        />
      </div>
    </div>
  );
}

/**
 * @param {{ article: object|null, onClose: () => void }} props
 */
export default function ArticleModal({ article, onClose }) {
  const navigate = useNavigate();
  const update = useUpdateArticle();

  // Close on Escape key
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!article) return null;

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const tags = Array.isArray(article.ai_tags) ? article.ai_tags : [];

  function toggleRead(e) {
    e.stopPropagation();
    update.mutate({ id: article.id, is_read: !article.is_read });
  }

  function toggleBookmark(e) {
    e.stopPropagation();
    update.mutate({ id: article.id, is_bookmarked: !article.is_bookmarked });
  }

  function goToDebate() {
    onClose();
    navigate(`/debate/${article.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-navy-800 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-navy-800/95 backdrop-blur border-b border-white/5 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div className="min-w-0">
            {article.website_name && (
              <p className="text-xs text-cyan-400 font-medium mb-1">{article.website_name}</p>
            )}
            <h2 className="text-base font-bold text-white leading-snug">{article.title}</h2>
            <p className="text-xs text-gray-500 mt-1">{date}</p>
          </div>
          <button
            className="shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Relevance */}
          <RelevanceBar score={article.relevance_score || 0} />

          {/* Summary */}
          {article.summary && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 size={13} className="text-gray-500" />
                <p className="text-xs text-gray-500 uppercase tracking-widest">AI Summary</p>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{article.summary}</p>
            </div>
          )}

          {/* Key insight */}
          {article.ai_insights && (
            <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-cyan-400" />
                <p className="text-xs text-cyan-400 uppercase tracking-widest">Key Insight</p>
              </div>
              <p className="text-sm text-cyan-300 leading-relaxed italic">{article.ai_insights}</p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={13} className="text-gray-500" />
                <p className="text-xs text-gray-500 uppercase tracking-widest">Topics</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {!article.summary && !article.ai_insights && tags.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No AI analysis available for this article yet.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-navy-800/95 backdrop-blur border-t border-white/5 px-6 py-4 flex items-center gap-3 rounded-b-2xl flex-wrap">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <ExternalLink size={14} />
            Read Article
          </a>

          <button
            className="btn-primary flex items-center gap-2 text-sm bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={goToDebate}
          >
            <MessageSquare size={14} />
            Open Debate
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              className={`btn-ghost p-2 ${article.is_read ? 'text-cyan-400' : 'text-gray-500'}`}
              onClick={toggleRead}
              title={article.is_read ? 'Mark unread' : 'Mark read'}
            >
              {article.is_read ? <BookMarked size={16} /> : <BookOpen size={16} />}
            </button>
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
