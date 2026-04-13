/**
 * BookmarksPage — displays all bookmarked articles in a grid.
 * Route: /bookmarks
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bookmark } from 'lucide-react';
import Header from '../components/Header.jsx';
import ArticleCard from '../components/ArticleCard.jsx';
import { api } from '../services/api.js';

/**
 * Fetch all bookmarked articles.
 */
function useBookmarkedArticles() {
  return useQuery({
    queryKey: ['articles', { is_bookmarked: 'true' }],
    queryFn: () => api.articles.list({ is_bookmarked: 'true', limit: 100, sort: 'discovered_at', order: 'DESC' }),
    staleTime: 30_000,
  });
}

export default function BookmarksPage() {
  const { data, isLoading, isError, refetch } = useBookmarkedArticles();
  const articles = data?.articles || [];

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      {/* Breadcrumb */}
      <div className="bg-navy-900/60 border-b border-white/5 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-gray-400">Bookmarks</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Bookmark size={22} className="text-cyan-400" />
              Bookmarks
            </h1>
            <p className="text-gray-400 text-sm">Articles you have saved for later.</p>
          </div>
          {!isLoading && (
            <span className="tag text-xs">
              {articles.length} {articles.length === 1 ? 'article' : 'articles'}
            </span>
          )}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-24 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="card text-center py-8 space-y-3">
            <p className="text-red-400 text-sm">Failed to load bookmarks. Is the server running?</p>
            <button className="btn-ghost text-sm" onClick={() => refetch()}>Try again</button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && articles.length === 0 && (
          <div className="card text-center py-16 space-y-3">
            <Bookmark size={36} className="text-gray-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-gray-400 font-medium">No bookmarks yet</p>
              <p className="text-gray-600 text-sm">
                Click the bookmark icon on any article to save it here.
              </p>
            </div>
            <Link to="/" className="btn-primary inline-flex items-center gap-2 text-sm mt-2">
              Browse articles
            </Link>
          </div>
        )}

        {/* Article grid */}
        {!isLoading && !isError && articles.length > 0 && (
          <div className="space-y-3">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
