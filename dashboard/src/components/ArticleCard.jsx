import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ExternalLink, Trash2, MessageSquare } from 'lucide-react';
import { useUpdateArticle, useDeleteArticle } from '../hooks/useArticles.js';
import ArticleModal from './ArticleModal.jsx';

/**
 * Relevance ring component. Color: green ≥70, yellow ≥40, red <40.
 * @param {{ score: number }} props
 */
function RelevanceRing({ score }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="relative w-12 h-12 shrink-0" title={`Relevance: ${score}`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke={color} strokeWidth="3.5"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

/**
 * Article card — click to open detail modal.
 * @param {{ article: object }} props
 */
export default function ArticleCard({ article }) {
  const [modalOpen, setModalOpen] = useState(false);
  const update = useUpdateArticle();
  const remove = useDeleteArticle();

  function toggleBookmark(e) {
    e.stopPropagation();
    update.mutate({ id: article.id, is_bookmarked: !article.is_bookmarked });
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (confirm('Delete this article?')) remove.mutate(article.id);
  }

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Reading time estimate: word count of content or summary / 200 wpm
  const readingMinutes = (() => {
    const text = article.content || article.summary || '';
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  })();

  return (
    <>
      <article
        className={`card flex gap-4 hover:border-white/15 hover:bg-white/[0.03] transition-all group cursor-pointer ${article.is_read ? 'opacity-60' : ''}`}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setModalOpen(true)}
      >
        <RelevanceRing score={Math.round(article.relevance_score)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {/* Title */}
            <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors">
              {article.title}
            </h3>
            <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <button className="p-1 hover:text-cyan-400 transition-colors" onClick={toggleBookmark} title="Bookmark">
                {article.is_bookmarked ? <BookmarkCheck size={15} className="text-cyan-400" /> : <Bookmark size={15} />}
              </button>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-cyan-400 transition-colors" title="Open article" onClick={e => e.stopPropagation()}>
                <ExternalLink size={15} />
              </a>
              <button className="p-1 hover:text-red-400 transition-colors" onClick={handleDelete} title="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {article.summary && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{article.summary}</p>
          )}

          {article.ai_insights && (
            <p className="text-cyan-400/70 text-xs mt-1 italic line-clamp-1">💡 {article.ai_insights}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {article.website_name && (
              <span className="text-xs text-gray-500">{article.website_name}</span>
            )}
            <span className="text-xs text-gray-600">{date}</span>
            <span className="text-xs text-gray-600">~{readingMinutes} min read</span>
            <div className="flex gap-1 flex-wrap flex-1">
              {(article.ai_tags || []).slice(0, 4).map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            {/* Debate link */}
            <Link
              to={`/debate/${article.id}`}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-400 transition-colors shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <MessageSquare size={13} />
              Debate
            </Link>
          </div>
        </div>
      </article>

      {modalOpen && (
        <ArticleModal article={article} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
