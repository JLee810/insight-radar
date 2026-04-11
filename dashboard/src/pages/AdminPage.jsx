/**
 * AdminPage — moderation queue + site stats. Admin-only.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Trash2, CheckCircle, ArrowLeft,
  Users, MessageSquare, FileText, ThumbsUp, PenLine
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

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

export default function AdminPage() {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();

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
      <div className="sticky top-0 z-40 bg-navy-900/80 backdrop-blur border-b border-white/5 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-gray-700">|</span>
          <ShieldAlert size={14} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Admin Panel</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users}         label="Total Users"      value={stats?.totalUsers} />
          <StatCard icon={FileText}      label="Articles"         value={stats?.totalArticles} />
          <StatCard icon={MessageSquare} label="Comments"         value={stats?.totalComments} />
          <StatCard icon={ShieldAlert}   label="Reported"         value={stats?.reportedComments} color="text-red-400" />
          <StatCard icon={ThumbsUp}      label="Total Votes"      value={stats?.totalVotes} />
          <StatCard icon={MessageSquare} label="Open Threads"     value={stats?.openThreads} color="text-green-400" />
          <StatCard icon={Users}         label="Banned Users"     value={stats?.bannedUsers} color="text-amber-400" />
          <StatCard icon={PenLine}       label="Opinions"         value={stats?.totalOpinions} />
        </div>

        {/* Reported comments */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Reported Comments</h2>
            {stats?.reportedComments > 0 && (
              <span className="text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full">
                {stats.reportedComments} pending
              </span>
            )}
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
                      <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">{comment.username}</td>
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
      </div>
    </div>
  );
}
