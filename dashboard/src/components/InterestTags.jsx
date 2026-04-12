import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const CATEGORY_COLORS = {
  technology: 'border-blue-500/40 text-blue-300',
  business: 'border-green-500/40 text-green-300',
  science: 'border-purple-500/40 text-purple-300',
  politics: 'border-red-500/40 text-red-300',
  default: 'border-white/10 text-gray-300',
};

/**
 * Add/remove interest keywords for the authenticated user.
 */
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.interests.delete(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!keyword.trim()) return;
    await addMutation.mutateAsync({ keyword: keyword.trim(), category: category || null });
    setKeyword('');
    setCategory('');
  }

  const categories = ['technology', 'business', 'science', 'politics', 'other'];

  // Group by category
  const grouped = interests.reduce((acc, interest) => {
    const cat = interest.category || 'general';
    (acc[cat] = acc[cat] || []).push(interest);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">Interest Keywords</h2>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Add keyword…"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <select className="input w-36" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Category…</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn-primary shrink-0" disabled={addMutation.isPending}>
          <Plus size={16} />
        </button>
      </form>

      {addMutation.isError && <p className="text-red-400 text-xs">{addMutation.error.message}</p>}

      {isLoading ? (
        <div className="card h-16 animate-pulse bg-white/5" />
      ) : interests.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No interests added yet. Add keywords to personalize your feed.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {items.map(interest => {
                  const colorClass = CATEGORY_COLORS[interest.category] || CATEGORY_COLORS.default;
                  return (
                    <span key={interest.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-white/5 ${colorClass}`}>
                      {interest.keyword}
                      <button
                        onClick={() => deleteMutation.mutate(interest.id)}
                        className="hover:text-red-400 transition-colors ml-0.5"
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
