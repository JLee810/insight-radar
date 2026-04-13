/**
 * HistoryPage — articles the user has already read.
 * Route: /history
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import { api } from '../services/api.js';
import ArticleCard from '../components/ArticleCard.jsx';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function HistoryPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['articles', 'history'],
    queryFn: () => api.articles.list({ is_read: 'true', sort: 'discovered_at', order: 'DESC', limit: 100 }),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      <div className="bg-navy-900/60 border-b border-white/5 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to feed
          </Link>
          <span className="text-gray-700">|</span>
          <Clock size={13} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">Reading History</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen size={20} className="text-cyan-400" /> Reading History
            </h1>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-1">
                {data?.articles?.length ?? 0} articles read
              </p>
            )}
          </div>
        </div>

        {!user && (
          <div className="card text-center py-10 text-gray-500">
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
            <p>Sign in to track your reading history.</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card h-24 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-400 text-sm">Failed to load reading history.</p>
        )}

        {!isLoading && data?.articles?.length === 0 && (
          <div className="card text-center py-16 text-gray-500">
            <BookOpen size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg">Nothing read yet.</p>
            <p className="text-sm mt-1">Articles you open will appear here.</p>
            <Link to="/" className="btn-primary inline-flex items-center gap-2 mt-4">
              Browse articles
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {data?.articles?.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
