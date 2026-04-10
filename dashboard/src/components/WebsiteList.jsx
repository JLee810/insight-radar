import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ToggleLeft, ToggleRight, Clock } from 'lucide-react';
import { api } from '../services/api.js';

/**
 * Manage tracked websites: add, toggle active, delete, set interval.
 */
export default function WebsiteList() {
  const qc = useQueryClient();
  const { data: websites = [], isLoading } = useQuery({ queryKey: ['websites'], queryFn: api.websites.list });

  const addMutation = useMutation({
    mutationFn: api.websites.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.websites.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: api.websites.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites'] }),
  });

  const [form, setForm] = useState({ url: '', name: '', check_interval: 3600 });
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    await addMutation.mutateAsync(form);
    setForm({ url: '', name: '', check_interval: 3600 });
    setShowForm(false);
  }

  const intervals = [
    { label: '15 min', value: 900 },
    { label: '30 min', value: 1800 },
    { label: '1 hour', value: 3600 },
    { label: '6 hours', value: 21600 },
    { label: '24 hours', value: 86400 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Tracked Websites</h2>
        <button className="btn-primary flex items-center gap-1" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card space-y-2">
          <input className="input" placeholder="Website name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          <input className="input" type="url" placeholder="https://example.com" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} required />
          <select className="input" value={form.check_interval} onChange={e => setForm(p => ({ ...p, check_interval: Number(e.target.value) }))}>
            {intervals.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Adding…' : 'Add Website'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {addMutation.isError && <p className="text-red-400 text-xs">{addMutation.error.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="card h-14 animate-pulse bg-white/5" />)}
        </div>
      ) : websites.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No websites tracked yet.</p>
      ) : (
        <div className="space-y-2">
          {websites.map(site => (
            <div key={site.id} className="card flex items-center gap-3">
              <button
                onClick={() => updateMutation.mutate({ id: site.id, is_active: !site.is_active })}
                className={`shrink-0 ${site.is_active ? 'text-cyan-400' : 'text-gray-600'}`}
                title={site.is_active ? 'Disable' : 'Enable'}
              >
                {site.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{site.name}</p>
                <p className="text-xs text-gray-500 truncate">{site.url}</p>
              </div>

              <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Clock size={12} />
                {intervals.find(i => i.value === site.check_interval)?.label || `${site.check_interval}s`}
              </div>

              <button
                className="p-1 hover:text-red-400 transition-colors shrink-0"
                onClick={() => confirm('Remove this website?') && deleteMutation.mutate(site.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
