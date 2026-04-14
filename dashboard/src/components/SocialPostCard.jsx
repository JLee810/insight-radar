import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Heart, Repeat2, MessageSquare, ExternalLink, Zap,
  Send, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import BiasBar from './BiasBar.jsx';

/* ── Helpers ──────────────────────────────────────────────────────────── */

const PLATFORM = {
  reddit:  { label: 'Reddit',  pill: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  bluesky: { label: 'Bluesky', pill: 'bg-sky-500/20    text-sky-400    border border-sky-500/30'    },
  twitter: { label: 'X',       pill: 'bg-gray-500/20   text-gray-300   border border-gray-500/30'   },
};

const CATEGORY = {
  politics:        { label: 'Politics',       bg: 'bg-red-900/40    text-red-400'    },
  'socio-economic':{ label: 'Socio-Economic', bg: 'bg-amber-900/40  text-amber-400'  },
  health:          { label: 'Health',         bg: 'bg-green-900/40  text-green-400'  },
  education:       { label: 'Education',      bg: 'bg-blue-900/40   text-blue-400'   },
  technology:      { label: 'Technology',     bg: 'bg-purple-900/40 text-purple-400' },
};

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-cyan-400   to-blue-500',
  'from-orange-400 to-red-500',
  'from-green-400  to-emerald-500',
  'from-pink-400   to-rose-500',
  'from-yellow-400 to-amber-500',
];

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Inline comment thread ─────────────────────────────────────────────── */

function CommentThread({ postId }) {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['social-comments', postId],
    queryFn: () => api.social.getComments(postId),
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: () => api.social.addComment(accessToken, postId, text),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['social-comments', postId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.social.deleteComment(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-comments', postId] }),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addMutation.mutate();
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
      {/* Comment list */}
      {isLoading && <p className="text-xs text-gray-600 animate-pulse">Loading discussion…</p>}
      {comments.map(c => (
        <div key={c.id} className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {c.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-white">{c.username}</span>
              <span className="text-[10px] text-gray-600">{timeAgo(c.created_at)}</span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">{c.content}</p>
          </div>
          {user && (user.id === c.user_id || user.role === 'admin') && (
            <button
              className="text-gray-600 hover:text-red-400 p-1 shrink-0"
              onClick={() => deleteMutation.mutate(c.id)}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}

      {!isLoading && comments.length === 0 && (
        <p className="text-xs text-gray-600 italic">No discussion yet — be the first to weigh in.</p>
      )}

      {/* Input */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
          <input
            className="input flex-1 text-xs py-1.5"
            placeholder="Share your take on this…"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!text.trim() || addMutation.isPending}
            className="btn-primary px-2 py-1.5 shrink-0"
          >
            <Send size={13} />
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-600">Sign in to join the discussion.</p>
      )}
    </div>
  );
}

/* ── Main card ─────────────────────────────────────────────────────────── */

export default function SocialPostCard({ post }) {
  const [bias, setBias]             = useState(post.bias ?? null);
  const [biasLoading, setBiasLoading] = useState(false);
  const [showThread, setShowThread]   = useState(false);

  const platform = PLATFORM[post.platform] || PLATFORM.twitter;
  const category = CATEGORY[post.topic_category];

  const initials  = (post.author || post.handle || '?').slice(0, 2).toUpperCase();
  const gradient  = AVATAR_GRADIENTS[(post.author || '').charCodeAt(0) % AVATAR_GRADIENTS.length];

  async function handleBias(e) {
    e.stopPropagation();
    if (biasLoading) return;
    setBiasLoading(true);
    try {
      const result = await api.social.getBias(post.id);
      setBias(result);
    } catch { /* ignore */ }
    setBiasLoading(false);
  }

  return (
    <article className="card hover:border-white/15 transition-all">

      {/* ── Header row: avatar · name · platform · category · time ── */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {post.author || post.handle}
            </span>
            {post.author && post.handle && (
              <span className="text-xs text-gray-600 truncate">@{post.handle}</span>
            )}
            {/* Platform badge */}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${platform.pill}`}>
              {platform.label}
            </span>
            {/* Topic category badge */}
            {category && (
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${category.bg}`}>
                {category.label}
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-600">{timeAgo(post.posted_at)}</span>
        </div>
      </div>

      {/* ── Post content ── */}
      <p className="text-sm text-gray-300 mt-3 leading-relaxed line-clamp-5 whitespace-pre-line">
        {post.content}
      </p>

      {/* ── Engagement + actions row ── */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/5 flex-wrap">
        {/* Engagement stats */}
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Heart size={12} /> {formatCount(post.likes)}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Repeat2 size={12} /> {formatCount(post.shares)}
        </span>

        {/* Discuss button */}
        <button
          className={`flex items-center gap-1 text-xs transition-colors font-medium ${
            showThread ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'
          }`}
          onClick={() => setShowThread(v => !v)}
        >
          <MessageSquare size={12} />
          <span>{post.comment_count > 0 ? post.comment_count : ''} Discuss</span>
          {showThread ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {/* Bias analyze button */}
        {!bias && (
          <button
            className="flex items-center gap-0.5 text-[11px] text-gray-600 hover:text-yellow-400 transition-colors"
            onClick={handleBias}
            disabled={biasLoading}
          >
            <Zap size={11} className={biasLoading ? 'animate-pulse text-yellow-400' : ''} />
            {biasLoading ? 'Analyzing…' : 'Bias'}
          </button>
        )}

        {/* External link */}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-cyan-400 transition-colors ml-auto"
        >
          <ExternalLink size={11} /> View
        </a>
      </div>

      {/* ── Bias bar ── */}
      {bias && <BiasBar bias={bias} />}

      {/* ── Inline discussion thread ── */}
      {showThread && <CommentThread postId={post.id} />}
    </article>
  );
}
