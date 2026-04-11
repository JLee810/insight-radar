/**
 * DebatePage — full debate thread view.
 * Sections: Article header, AI Analysis, Vote panel, Comments, Comment form, Bias panel (stub)
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ExternalLink, ThumbsUp, MessageSquare,
  AlertTriangle, Trash2, Flag, ChevronDown, ChevronUp, Send
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from '../components/AuthModal.jsx';

const TYPE_CONFIG = {
  argument:  { label: 'Argument',  color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/30' },
  counter:   { label: 'Counter',   color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30' },
  evidence:  { label: 'Evidence',  color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' },
  question:  { label: 'Question',  color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
};

/** Single comment card with reply support */
function CommentCard({ comment, onReply, onDelete, onReport, currentUser }) {
  const [showReplies, setShowReplies] = useState(true);
  const cfg = TYPE_CONFIG[comment.type] || TYPE_CONFIG.argument;
  const canDelete = currentUser && (currentUser.role === 'admin' || currentUser.id === comment.user_id);
  const date = new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={`border-l-2 ${cfg.border} pl-4 py-1`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-xs font-medium text-white">{comment.username}</span>
            {comment.user_role === 'admin' && (
              <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Admin</span>
            )}
            <span className="text-xs text-gray-600">{date}</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{comment.body}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
              onClick={() => onReply(comment)}
            >
              Reply
            </button>
            <button
              className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
              onClick={() => onReport(comment.id)}
            >
              <Flag size={11} className="inline mr-1" />Report
            </button>
            {canDelete && (
              <button
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 size={11} className="inline mr-1" />Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="mt-3">
          <button
            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 mb-2"
            onClick={() => setShowReplies(v => !v)}
          >
            {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && (
            <div className="space-y-3 pl-3">
              {comment.replies.map(r => (
                <CommentCard key={r.id} comment={r} onReply={onReply} onDelete={onDelete} onReport={onReport} currentUser={currentUser} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Vote panel */
function VotePanel({ voteCount, hasVoted, status, onVote, loading }) {
  const threshold = 5;
  const pct = Math.min(100, (voteCount / threshold) * 100);

  return (
    <div className="card text-center">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Open for Debate?</p>
      {status === 'open' ? (
        <div className="flex items-center justify-center gap-2 text-cyan-400">
          <MessageSquare size={18} />
          <span className="font-semibold">Debate is Open</span>
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold text-white mb-1">{voteCount}<span className="text-gray-600 text-lg">/{threshold}</span></div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mb-3">
            <div className="bg-cyan-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {threshold - voteCount > 0 ? `${threshold - voteCount} more votes to open the debate` : 'Opening debate…'}
          </p>
          <button
            className={`btn-primary w-full justify-center ${hasVoted ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={onVote}
            disabled={hasVoted || loading}
          >
            <ThumbsUp size={14} />
            {hasVoted ? 'Voted' : 'Vote to Open'}
          </button>
        </>
      )}
    </div>
  );
}

const LEAN_CONFIG = {
  'far-left':     { label: 'Far Left',     color: '#dc2626', pos: 0 },
  'left':         { label: 'Left',         color: '#ef4444', pos: 16 },
  'center-left':  { label: 'Center Left',  color: '#f97316', pos: 33 },
  'center':       { label: 'Center',       color: '#22c55e', pos: 50 },
  'center-right': { label: 'Center Right', color: '#3b82f6', pos: 67 },
  'right':        { label: 'Right',        color: '#1d4ed8', pos: 83 },
  'far-right':    { label: 'Far Right',    color: '#7c3aed', pos: 100 },
  'unknown':      { label: 'Unknown',      color: '#6b7280', pos: 50 },
};

const EMOTIONAL_CONFIG = { low: 'text-green-400', medium: 'text-amber-400', high: 'text-red-400' };
const FACTUAL_CONFIG   = { low: 'text-red-400',   mixed: 'text-amber-400',  high: 'text-green-400' };

/** Bias analysis panel */
function BiasPanel({ articleId }) {
  const [show, setShow] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bias', articleId],
    queryFn: () => api.bias.get(articleId),
    enabled: show,
    retry: false,
  });

  const lean = data ? (LEAN_CONFIG[data.lean] || LEAN_CONFIG.unknown) : null;

  return (
    <div className="card">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => { setShow(v => !v); }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Source Bias Analysis</h2>
          <span className="text-xs text-gray-500">AI-powered</span>
        </div>
        {show ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {show && (
        <div className="mt-4 space-y-4">
          {isLoading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-red-400">Failed to load bias analysis.</p>
              <button className="text-xs text-cyan-400 hover:underline" onClick={() => refetch()}>Retry</button>
            </div>
          )}
          {data && lean && (
            <>
              {/* Political lean spectrum */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Political Lean</p>
                <div className="relative h-3 rounded-full bg-gradient-to-r from-red-600 via-green-500 to-purple-700">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all"
                    style={{ left: `calc(${lean.pos}% - 8px)`, background: lean.color }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-semibold" style={{ color: lean.color }}>{lean.label}</span>
                  <span className="text-xs text-gray-500">({data.confidence}% confidence)</span>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Emotional Language</p>
                  <p className={`text-sm font-semibold capitalize ${EMOTIONAL_CONFIG[data.emotional_language] || 'text-gray-400'}`}>
                    {data.emotional_language}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Factual Reporting</p>
                  <p className={`text-sm font-semibold capitalize ${FACTUAL_CONFIG[data.factual_reporting] || 'text-gray-400'}`}>
                    {data.factual_reporting}
                  </p>
                </div>
              </div>

              {/* Framing + reasoning */}
              {data.framing && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Framing</p>
                  <p className="text-sm text-gray-300">{data.framing}</p>
                </div>
              )}
              {data.reasoning && (
                <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Reasoning</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{data.reasoning}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DebatePage() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, accessToken } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [commentType, setCommentType] = useState('argument');
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['debate', articleId, user?.id],
    queryFn: () => api.debate.getThread(articleId, accessToken),
    refetchInterval: 30_000,
  });

  const voteMutation = useMutation({
    mutationFn: () => api.debate.vote(accessToken, articleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debate', articleId] }),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body) => api.debate.addComment(accessToken, articleId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debate', articleId] });
      setCommentBody('');
      setReplyTo(null);
      setCommentError('');
    },
    onError: (err) => setCommentError(err.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => api.debate.deleteComment(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debate', articleId] }),
  });

  const reportCommentMutation = useMutation({
    mutationFn: (id) => api.debate.reportComment(accessToken, id),
  });

  function handleVote() {
    if (!user) return setAuthMode('register');
    voteMutation.mutate();
  }

  function handleSubmitComment(e) {
    e.preventDefault();
    if (!user) return setAuthMode('register');
    if (commentBody.trim().length < 10) return setCommentError('Comment must be at least 10 characters.');
    addCommentMutation.mutate({
      body: commentBody.trim(),
      type: commentType,
      parent_id: replyTo?.id ?? null,
    });
  }

  function handleReport(id) {
    if (!user) return setAuthMode('login');
    if (confirm('Report this comment?')) reportCommentMutation.mutate(id);
  }

  function handleDelete(id) {
    if (confirm('Delete this comment?')) deleteCommentMutation.mutate(id);
  }

  if (isLoading) return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center text-gray-400">
      Article not found.
    </div>
  );

  const { article, thread, comments, hasVoted } = data;
  const tags = Array.isArray(article.ai_tags) ? article.ai_tags : [];
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(article.discovered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const relevanceColor = article.relevance_score >= 70 ? '#22c55e' : article.relevance_score >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="min-h-screen bg-navy-900">
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}

      {/* Back nav */}
      <div className="sticky top-0 z-40 bg-navy-900/80 backdrop-blur border-b border-white/5 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back to InsightRadar
          </button>
          <span className="text-gray-700">|</span>
          <span className="text-xs text-gray-500">Debate Thread</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── Section 1: Article header ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {article.website_name && <span>{article.website_name}</span>}
            <span>·</span>
            <span>{date}</span>
          </div>
          <h1 className="text-xl font-bold text-white leading-snug">{article.title}</h1>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:underline"
          >
            <ExternalLink size={14} /> Read original article
          </a>
        </div>

        {/* ── Section 2: AI Analysis ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">AI Analysis</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: relevanceColor, background: `${relevanceColor}18` }}>
              {Math.round(article.relevance_score)}% relevance
            </span>
          </div>
          {article.summary && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Summary</p>
              <p className="text-sm text-gray-300 leading-relaxed">{article.summary}</p>
            </div>
          )}
          {article.ai_insights && (
            <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Key Insight</p>
              <p className="text-sm text-cyan-300 leading-relaxed italic">{article.ai_insights}</p>
            </div>
          )}
        </div>

        {/* ── Section 3: Vote panel ── */}
        <VotePanel
          voteCount={thread.voteCount}
          hasVoted={hasVoted}
          status={thread.status}
          onVote={handleVote}
          loading={voteMutation.isPending}
        />

        {/* ── Section 4: Comments ── */}
        {thread.status === 'open' && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Debate ({comments.length} {comments.length === 1 ? 'contribution' : 'contributions'})
              </h2>
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                  <span key={type} className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                ))}
              </div>
            </div>

            {comments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">
                Be the first to contribute to this debate.
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map(c => (
                  <CommentCard
                    key={c.id}
                    comment={c}
                    onReply={setReplyTo}
                    onDelete={handleDelete}
                    onReport={handleReport}
                    currentUser={user}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Section 5: Comment form ── */}
        {thread.status === 'open' && (
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3">
              {replyTo ? `Replying to ${replyTo.username}` : 'Add to the Debate'}
            </h2>
            {replyTo && (
              <div className="mb-3 text-xs text-gray-500 bg-white/5 rounded p-2 flex items-center justify-between">
                <span className="italic line-clamp-1">"{replyTo.body}"</span>
                <button className="ml-2 text-gray-600 hover:text-white" onClick={() => setReplyTo(null)}>✕</button>
              </div>
            )}

            {!user ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm mb-3">Sign in to contribute to the debate.</p>
                <div className="flex gap-2 justify-center">
                  <button className="btn-primary" onClick={() => setAuthMode('login')}>Sign In</button>
                  <button className="btn-ghost" onClick={() => setAuthMode('register')}>Create Account</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitComment} className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCommentType(type)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${commentType === type ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'border-white/10 text-gray-500 hover:border-white/20'}`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input w-full resize-none"
                  rows={4}
                  placeholder={`Share your ${commentType}… (min 10 characters)`}
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{commentBody.length}/2000</span>
                  <button type="submit" className="btn-primary flex items-center gap-2" disabled={addCommentMutation.isPending}>
                    <Send size={14} />
                    {addCommentMutation.isPending ? 'Posting…' : 'Post'}
                  </button>
                </div>
                {commentError && <p className="text-red-400 text-xs">{commentError}</p>}
              </form>
            )}
          </div>
        )}

        {/* ── Section 6: Bias panel ── */}
        <BiasPanel articleId={articleId} />

      </div>
    </div>
  );
}
