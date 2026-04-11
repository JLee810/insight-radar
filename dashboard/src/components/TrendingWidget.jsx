/**
 * TrendingWidget — sidebar widget showing top 5 articles by debate activity.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, MessageSquare, ThumbsUp } from 'lucide-react';
import { api } from '../services/api.js';

export default function TrendingWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: api.trending,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={13} className="text-cyan-400" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-widest">Trending Debates</h3>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      )}

      {data && data.length > 0 && (
        <ol className="space-y-3">
          {data.map((article, i) => (
            <li key={article.id} className="flex items-start gap-2 group">
              <span className="text-xs font-bold text-gray-600 w-4 shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/debate/${article.id}`}
                  className="text-xs text-gray-300 group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug"
                >
                  {article.title}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-0.5 text-xs text-gray-600">
                    <ThumbsUp size={10} /> {article.vote_count}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-600">
                    <MessageSquare size={10} /> {article.comment_count}
                  </span>
                  {article.thread_status === 'open' && (
                    <span className="text-xs text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded-full leading-none">Live</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {data?.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-2">No debate activity yet.</p>
      )}
    </div>
  );
}
