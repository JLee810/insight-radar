import { useQuery } from '@tanstack/react-query';
import { FileText, Globe, Star, BookMarked, TrendingUp, Eye } from 'lucide-react';
import { api } from '../services/api.js';

/**
 * Stat card widget.
 */
function StatCard({ icon: Icon, label, value, accent = 'cyan' }) {
  const accentMap = { cyan: 'text-cyan-400 bg-cyan-400/10', amber: 'text-amber-400 bg-amber-400/10', green: 'text-green-400 bg-green-400/10', purple: 'text-purple-400 bg-purple-400/10' };
  const cls = accentMap[accent] || accentMap.cyan;
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/**
 * Dashboard overview: stats + top tags.
 */
export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-20 animate-pulse bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={FileText} label="Total Articles" value={stats?.totalArticles} />
        <StatCard icon={TrendingUp} label="Discovered Today" value={stats?.articlesToday} accent="green" />
        <StatCard icon={Eye} label="Unread" value={stats?.unreadCount} accent="amber" />
        <StatCard icon={BookMarked} label="Bookmarked" value={stats?.bookmarkedCount} accent="purple" />
        <StatCard icon={Star} label="Avg Relevance" value={stats?.avgRelevance ? `${stats.avgRelevance}%` : '—'} accent="amber" />
        <StatCard icon={Globe} label="Active Sites" value={stats?.websiteCount} />
      </div>

      {stats?.topTags?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Topics</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(({ tag, count }) => (
              <span key={tag} className="tag gap-1">
                {tag}
                <span className="text-gray-500 ml-1">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
