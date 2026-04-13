import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Tag } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const CATEGORY_COLORS = {
  'POLITICS':       'border-red-500/40 text-red-300 bg-red-500/10',
  'GLOBAL AFFAIRS': 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  'SOCIO-ECONOMIC': 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  'EDUCATION':      'border-purple-500/40 text-purple-300 bg-purple-500/10',
  'technology':     'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  'business':       'border-green-500/40 text-green-300 bg-green-500/10',
  'science':        'border-violet-500/40 text-violet-300 bg-violet-500/10',
  'default':        'border-white/10 text-gray-300 bg-white/5',
};

const CATEGORIES = ['POLITICS', 'GLOBAL AFFAIRS', 'SOCIO-ECONOMIC', 'EDUCATION', 'technology', 'business', 'science', 'other'];

export default function InterestTags() {
  const qc = useQueryClient();
  const { accessToken } = useAuth();

  const { data: interests = [], isLoading } = useQuery({
    queryKey: ['interests', accessToken],
    queryFn: () => api.interests.list(accessToken),
    enabled: !!accessToken,
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.interests.create(accessToken, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests', accessToken] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.interests.delete(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests', accessToken] }),
  });

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!keyword.trim()) return;
    setError('');
    try {
      await addMutation.mutateAsync({ keyword: keyword.trim(), category: category || null, weight: 1.0 });
      setKeyword('');
      setCategory('');
    } catch (err) {
      setError(err.message);
    }
  }

  // Group by category
  const grouped = interests.reduce((acc, interest) => {
    const cat = interest.category || 'General';
    (acc[cat] = acc[cat] || []).push(interest);
    return acc;
  }, {});

  if (!accessToken) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Interest Keywords</h2>
        <p className="text-gray-500 text-sm text-center py-6">Sign in to manage your interest keywords.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag size={14} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-gray-300">Interest Keywords</h2>
        {interests.length > 0 && (
          <span className="ml-auto text-xs text-gray-500">{interests.length} keywords</span>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add keyword… e.g. NATO, inflation"
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setError(''); }}
          />
          <button
            type="submit"
            className="btn-primary shrink-0 flex items-center gap-1"
            disabled={addMutation.isPending || !keyword.trim()}
          >
            <Plus size={14} />
            {addMutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
        <select
          className="input w-full"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">Category (optional)…</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : interests.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm space-y-1">
          <Tag size={24} className="mx-auto opacity-30" />
          <p>No keywords yet. Add some above to personalise your feed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {items.map(interest => {
                  const colorClass = CATEGORY_COLORS[interest.category] || CATEGORY_COLORS.default;
                  return (
                    <span
                      key={interest.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}
                    >
                      {interest.keyword}
                      <button
                        onClick={() => deleteMutation.mutate(interest.id)}
                        className="hover:text-red-400 transition-colors ml-0.5 opacity-60 hover:opacity-100"
                        disabled={deleteMutation.isPending}
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
