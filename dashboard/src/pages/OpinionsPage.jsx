/**
 * OpinionsPage — NewPublicSphere community opinion writing and reading.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PenLine, User, Calendar, Tag, ArrowLeft, X, Send, Trash2 } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from '../components/AuthModal.jsx';
import Header from '../components/Header.jsx';

/** Individual opinion card */
function OpinionCard({ opinion, currentUser, accessToken, onDelete }) {
  const date = new Date(opinion.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const canDelete = currentUser && (currentUser.id === opinion.author_id || currentUser.role === 'admin');

  return (
    <article className="card space-y-3 hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-white leading-snug text-base">{opinion.title}</h2>
        {canDelete && (
          <button
            className="shrink-0 p-1 text-gray-600 hover:text-red-400 transition-colors"
            onClick={() => { if (confirm('Delete this opinion?')) onDelete(opinion.id); }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 leading-relaxed">{opinion.excerpt}</p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <User size={11} /> {opinion.author}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <Calendar size={11} /> {date}
        </span>
        {opinion.tags.slice(0, 5).map(t => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
    </article>
  );
}

/** Inline write form */
function WriteForm({ accessToken, onSuccess, onCancel }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload) => api.opinions.create(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opinions'] });
      onSuccess();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    createMutation.mutate({ title: title.trim(), body: body.trim(), tags });
  }

  return (
    <div className="card space-y-4 border-cyan-400/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenLine size={14} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Write an Opinion</h2>
        </div>
        <button className="btn-ghost p-1.5" onClick={onCancel}><X size={14} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="input w-full"
          placeholder="Title (5–200 characters)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          minLength={5}
          maxLength={200}
        />
        <textarea
          className="input w-full resize-none"
          rows={10}
          placeholder="Write your opinion here… (minimum 50 characters)"
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          minLength={50}
          maxLength={50000}
        />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag size={12} className="text-gray-500" />
            <label className="text-xs text-gray-500">Tags (comma-separated, max 10)</label>
          </div>
          <input
            className="input w-full"
            placeholder="e.g. politics, climate, economy"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{body.length} / 50,000</span>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={createMutation.isPending}>
            <Send size={14} />
            {createMutation.isPending ? 'Publishing…' : 'Publish Opinion'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>
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

  return (
    <div className="min-h-screen bg-navy-900">
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}

      <Header />
      <div className="bg-navy-900/60 border-b border-white/5 px-6 py-2">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to feed
          </Link>
          <span className="text-gray-700">|</span>
          <PenLine size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">NewPublicSphere</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Page title + write button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Community Opinions</h1>
            <p className="text-sm text-gray-500 mt-1">Long-form perspectives from the InsightRadar community.</p>
          </div>
          {user ? (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(v => !v)}>
              <PenLine size={14} />
              {showForm ? 'Cancel' : 'Write Opinion'}
            </button>
          ) : (
            <button className="btn-ghost flex items-center gap-2 text-sm" onClick={() => setAuthMode('login')}>
              <PenLine size={14} /> Sign in to write
            </button>
          )}
        </div>

        {/* Write form */}
        {showForm && (
          <WriteForm
            accessToken={accessToken}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* List */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-28 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-400 text-sm">Failed to load opinions. Is the server running?</p>
        )}

        {!isLoading && data?.opinions?.length === 0 && (
          <div className="text-center py-16 text-gray-500 space-y-2">
            <PenLine size={32} className="mx-auto opacity-30" />
            <p>No opinions published yet. Be the first to contribute.</p>
          </div>
        )}

        <div className="space-y-4">
          {data?.opinions?.map(opinion => (
            <OpinionCard
              key={opinion.id}
              opinion={opinion}
              currentUser={user}
              accessToken={accessToken}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
