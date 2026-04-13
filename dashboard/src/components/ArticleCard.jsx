import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ExternalLink, Trash2, MessageSquare, Zap } from 'lucide-react';
import { useUpdateArticle, useDeleteArticle } from '../hooks/useArticles.js';
import ArticleModal from './ArticleModal.jsx';
import { api } from '../services/api.js';

/** Relevance score badge */
function RelevanceBadge({ score }) {
  const color = score >= 70 ? 'text-green-400 bg-green-400/10 border-green-400/20'
              : score >= 40 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
              : 'text-red-400 bg-red-400/10 border-red-400/20';
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {Math.round(score)}%
    </span>
  );
}

/**
 * Visual political-lean spectrum bar with factual + tone badges.
 * lean: 'far-left' | 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'far-right' | 'unknown'
 */
function BiasBar({ bias }) {
  const leanMap = {
    'far-left':     { pos: 0,     label: 'Far Left',     dotColor: 'bg-blue-700' },
    'left':         { pos: 1 / 6, label: 'Left',         dotColor: 'bg-blue-500' },
    'center-left':  { pos: 2 / 6, label: 'Center-Left',  dotColor: 'bg-sky-400' },
    'center':       { pos: 3 / 6, label: 'Center',       dotColor: 'bg-gray-400' },
    'center-right': { pos: 4 / 6, label: 'Center-Right', dotColor: 'bg-orange-400' },
    'right':        { pos: 5 / 6, label: 'Right',        dotColor: 'bg-red-500' },
    'far-right':    { pos: 1,     label: 'Far Right',    dotColor: 'bg-red-700' },
    'unknown':      { pos: null,  label: 'Unknown',      dotColor: 'bg-gray-500' },
  };

  const info = leanMap[bias.lean] || leanMap['unknown'];

  const factualClass = bias.factual_reporting === 'high'
    ? 'bg-green-900/40 text-green-400'
    : bias.factual_reporting === 'mixed'
    ? 'bg-yellow-900/40 text-yellow-400'
    : 'bg-red-900/40 text-red-400';

  const toneClass = bias.emotional_language === 'low'
    ? 'bg-green-900/40 text-green-400'
    : bias.emotional_language === 'medium'
    ? 'bg-yellow-900/40 text-yellow-400'
    : 'bg-red-900/40 text-red-400';

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5" title={bias.framing || ''}>
      {/* Spectrum bar: blue → gray → red */}
      <div
        className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-600 via-gray-500 to-red-600 shrink-0"
        style={{ width: 72 }}
      >
        {info.pos !== null && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-gray-900 shadow ${info.dotColor}`}
            style={{ left: `calc(${info.pos * 100}% - 6px)` }}
          />
        )}
      </div>

      {/* Lean label */}
      <span className="text-[11px] text-gray-300 font-medium shrink-0 min-w-[72px]">{info.label}</span>

      {/* Badges pushed to right */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${factualClass}`}>
          Facts: {bias.factual_reporting}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${toneClass}`}>
          Tone: {bias.emotional_language}
        </span>
      </div>
    </div>
  );
}

export default function ArticleCard({ article }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [bias, setBias] = useState(article.bias ?? null);
  const [biasLoading, setBiasLoading] = useState(false);
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

  async function handleAnalyzeBias(e) {
    e.stopPropagation();
    if (biasLoading) return;
    setBiasLoading(true);
    try {
      const result = await api.bias.get(article.id);
      setBias(result);
    } catch { /* ignore */ }
    setBiasLoading(false);
  }

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <article
        className={`card cursor-pointer hover:border-white/15 hover:bg-white/[0.03] transition-all group ${article.is_read ? 'opacity-60' : ''}`}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setModalOpen(true)}
      >
        {/* Row 1: Title + actions */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors flex-1 min-w-0">
            {article.title}
          </h3>
          <div className="flex items-center gap-0.5 shrink-0 ml-1" onClick={e => e.stopPropagation()}>
            <button
              className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-cyan-400 transition-colors"
              onClick={toggleBookmark}
              title="Bookmark"
            >
              {article.is_bookmarked
                ? <BookmarkCheck size={14} className="text-cyan-400" />
                : <Bookmark size={14} />}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-cyan-400 transition-colors"
              title="Open article"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
            <button
              className="p-1.5 rounded-lg hover:bg-red-400/10 text-gray-500 hover:text-red-400 transition-colors"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Summary */}
        {article.summary && (
          <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
            {article.summary}
          </p>
        )}

        {/* Row 3: AI insight */}
        {article.ai_insights && (
          <p className="text-cyan-400/70 text-xs mt-1.5 italic line-clamp-1">
            💡 {article.ai_insights}
          </p>
        )}

        {/* Row 4: Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2" onClick={e => e.stopPropagation()}>
          {article.website_name && (
            <span className="text-xs text-gray-500 shrink-0">{article.website_name}</span>
          )}
          <span className="text-xs text-gray-600 shrink-0">{date}</span>
          <RelevanceBadge score={article.relevance_score} />

          {(article.ai_tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="tag text-[11px] px-2 py-0.5">{tag}</span>
          ))}

          {/* Analyze bias button — only shown when no bias data yet */}
          {!bias && (
            <button
              className="flex items-center gap-0.5 text-[11px] text-gray-600 hover:text-yellow-400 transition-colors shrink-0"
              onClick={handleAnalyzeBias}
              disabled={biasLoading}
              title="Analyze media bias for this article"
            >
              <Zap size={11} className={biasLoading ? 'animate-pulse text-yellow-400' : ''} />
              <span>{biasLoading ? 'Analyzing…' : 'Bias'}</span>
            </button>
          )}

          <Link
            to={`/debate/${article.id}`}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-400 transition-colors ml-auto shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <MessageSquare size={12} />
            <span>Debate</span>
          </Link>
        </div>

        {/* Row 5: Bias bar — only shown when bias data is available */}
        {bias && <BiasBar bias={bias} />}
      </article>

      {modalOpen && (
        <ArticleModal article={article} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
