/**
 * AdminPage — moderation queue, site stats, and user management. Admin-only.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Trash2, CheckCircle, ArrowLeft,
  Users, MessageSquare, FileText, ThumbsUp, PenLine,
  Ban, Crown, Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';

function StatCard({ icon: Icon, label, value, color = 'text-cyan-400' }) {
  return (
    <div className="card flex items-center gap-3">
      <Icon size={18} className={color} />
      <div>
        <p className="text-xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function UsersTab({ accessToken }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api.admin.users(accessToken, { search, limit: 50 }),
    staleTime: 15_000,
  });

  const banMutation = useMutation({
    mutationFn: ({ id, banned }) => api.admin.banUser(accessToken, id, banned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const promoteMutation = useMutation({
    mutationFn: (id) => api.admin.promoteUser(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.admin.deleteUser(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <Users size={14} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">User Management</h2>
        {data?.total != null && (
          <span className="text-xs text-gray-500">{data.total} users</span>
        )}
      </div>

      <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input w-full pl-8"
            placeholder="Search by username or email…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">Search</button>
        {search && <button type="button" className="btn-ghost" onClick={() => { setSearch(''); setSearchInput(''); }}>Clear</button>}
      </form>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />)}
        </div>
      )}

      {data?.users?.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-6">No users found.</p>
      )}

      {data?.users && data.users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">Activity</th>
                <th className="pb-2 pr-4 font-medium">Joined</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.users.map(u => (
                <tr key={u.id} className={`align-middle ${u.is_banned ? 'opacity-50' : ''}`}>
                  <td className="py-3 pr-4">
                    <Link to={`/profile/${u.username}`} className="font-medium text-white hover:text-cyan-400 transition-colors">
                      {u.username}
                    </Link>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-amber-400/10 text-amber-400' : 'bg-white/5 text-gray-400'}`}>
                      {u.role === 'admin' ? '👑 Admin' : 'User'}
                    </span>
                    {u.is_banned && <span className="ml-1 text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full">Banned</span>}
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-500">
                    {u.opinion_count} opinions · {u.comment_count} comments
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.role !== 'admin' && (
                        <button
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${u.is_banned ? 'text-green-400 hover:bg-green-400/10' : 'text-amber-400 hover:bg-amber-400/10'}`}
                          onClick={() => banMutation.mutate({ id: u.id, banned: !u.is_banned })}
                          disabled={banMutation.isPending}
                          title={u.is_banned ? 'Unban' : 'Ban'}
                        >
                          <Ban size={11} /> {u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                      <button
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:bg-cyan-400/10 px-2 py-1 rounded transition-colors"
                        onClick={() => { if (confirm(`${u.role === 'admin' ? 'Remove admin from' : 'Promote'} ${u.username}?`)) promoteMutation.mutate(u.id); }}
                        disabled={promoteMutation.isPending}
                        title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      >
                        <Crown size={11} /> {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          className="flex items-center gap-1 text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                          onClick={() => { if (confirm(`Permanently delete ${u.username} and all their content?`)) deleteMutation.mutate(u.id); }}
                          disabled={deleteMutation.isPending}
                          title="Delete user"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('moderation');

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center flex-col gap-4 text-gray-400">
        <ShieldAlert size={40} className="text-red-400" />
        <p className="text-lg font-semibold text-white">Admin access required.</p>
        <Link to="/" className="btn-ghost flex items-center gap-2"><ArrowLeft size={14} /> Back to home</Link>
      </div>
    );
  }

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.admin.stats(accessToken),
    staleTime: 30_000,
  });

  const { data: reported, isLoading: loadingReported } = useQuery({
    queryKey: ['admin', 'reported-comments'],
    queryFn: () => api.admin.reportedComments(accessToken),
    staleTime: 15_000,
    enabled: tab === 'moderation',
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => api.admin.dismissComment(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.admin.deleteComment(accessToken, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />
      <div className="bg-navy-900/60 border-b border-white/5 px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-gray-700">|</span>
          <ShieldAlert size={14} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Admin Panel</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard icon={Users}         label="Total Users"      value={stats?.totalUsers} />
          <StatCard icon={FileText}      label="Articles"         value={stats?.totalArticles} />
          <StatCard icon={MessageSquare} label="Comments"         value={stats?.totalComments} />
          <StatCard icon={ShieldAlert}   label="Reported"         value={stats?.reportedComments} color="text-red-400" />
          <StatCard icon={ThumbsUp}      label="Total Votes"      value={stats?.totalVotes} />
          <StatCard icon={MessageSquare} label="Open Threads"     value={stats?.openThreads} color="text-green-400" />
          <StatCard icon={Users}         label="Banned Users"     value={stats?.bannedUsers} color="text-amber-400" />
          <StatCard icon={PenLine}       label="Opinions"         value={stats?.totalOpinions} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/5 pb-0">
          {[
            { id: 'moderation', label: 'Moderation Queue', badge: stats?.reportedComments },
            { id: 'users', label: 'Users' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === t.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-white'}`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="text-xs bg-red-400/20 text-red-400 px-1.5 py-0.5 rounded-full">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Moderation tab */}
        {tab === 'moderation' && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-red-400" />
              <h2 className="text-sm font-semibold text-white">Reported Comments</h2>
            </div>

            {loadingReported && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            )}

            {reported?.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Queue is clear — no reported comments.</p>
            )}

            {reported && reported.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                      <th className="pb-2 pr-4 font-medium">Comment</th>
                      <th className="pb-2 pr-4 font-medium">Author</th>
                      <th className="pb-2 pr-4 font-medium">Article</th>
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reported.map(comment => (
                      <tr key={comment.id} className="align-top">
                        <td className="py-3 pr-4 max-w-xs">
                          <p className="text-gray-300 text-xs line-clamp-3 leading-relaxed">{comment.body}</p>
                          <span className="tag mt-1 inline-block">{comment.type}</span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">
                          <Link to={`/profile/${comment.username}`} className="hover:text-cyan-400 transition-colors">
                            {comment.username}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 max-w-[180px]">
                          <Link to={`/debate/${comment.article_id}`} className="text-xs text-cyan-400 hover:underline line-clamp-2">
                            {comment.article_title}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-600 whitespace-nowrap">
                          {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button
                              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-400/10 transition-colors"
                              onClick={() => dismissMutation.mutate(comment.id)}
                              disabled={dismissMutation.isPending}
                            >
                              <CheckCircle size={12} /> Dismiss
                            </button>
                            <button
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-400/10 transition-colors"
                              onClick={() => { if (confirm('Delete this comment?')) deleteMutation.mutate(comment.id); }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && <UsersTab accessToken={accessToken} />}
      </div>
    </div>
  );
}
