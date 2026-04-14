/**
 * OpinionsWidget — compact sidebar preview of recent opinions.
 * Shows 3 latest opinions with author avatar, title, like count.
 * Links to /opinions for the full section.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PenLine, Heart, ArrowRight } from 'lucide-react';
import { api } from '../services/api.js';

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-cyan-400 to-blue-500',
  'from-orange-400 to-red-500',
  'from-green-400 to-emerald-500',
  'from-pink-400 to-rose-500',
];

export default function OpinionsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['opinions-widget'],
    queryFn: () => api.opinions.list({ limit: 3, sort: 'created_at', order: 'DESC' }),
    staleTime: 60_000,
  });

  const opinions = data?.opinions || data || [];

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider">
          <PenLine size={12} className="text-cyan-400" />
          Opinions
        </span>
        <Link
          to="/opinions"
          className="flex items-center gap-0.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          All <ArrowRight size={10} />
        </Link>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Opinion list */}
      {!isLoading && opinions.length === 0 && (
        <Link
          to="/opinions"
          className="block text-center py-4 rounded-lg border border-dashed border-white/10 text-xs text-gray-600 hover:border-cyan-400/30 hover:text-cyan-400 transition-colors"
        >
          Be the first to write an opinion →
        </Link>
      )}

      <div className="space-y-1.5">
        {opinions.slice(0, 3).map((op, i) => {
          const initial  = (op.username || op.author || '?')[0].toUpperCase();
          const gradient = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <Link
              key={op.id}
              to={`/opinions/${op.id}`}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>
                {initial}
              </div>

              {/* Title */}
              <span className="flex-1 min-w-0 text-xs text-gray-400 group-hover:text-gray-200 transition-colors line-clamp-1 leading-snug">
                {op.title}
              </span>

              {/* Like count */}
              {op.like_count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-600 shrink-0">
                  <Heart size={9} />
                  {op.like_count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Write CTA */}
      <Link
        to="/opinions"
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-cyan-400/20 text-xs text-cyan-400 hover:bg-cyan-400/5 transition-colors"
      >
        <PenLine size={11} /> Write an opinion
      </Link>
    </div>
  );
}
