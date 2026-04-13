/**
 * TagPage — all articles with a given AI tag.
 * Route: /tag/:tag
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Tag } from 'lucide-react';
import { api } from '../services/api.js';
import ArticleCard from '../components/ArticleCard.jsx';
import Header from '../components/Header.jsx';

export default function TagPage() {
  const { tag } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['articles', 'tag', tag],
    queryFn: () => api.articles.list({ search: tag, limit: 100 }),
    staleTime: 60_000,
  });

  // Client-side filter: only articles whose ai_tags actually include this tag
  const articles = data?.articles?.filter(a => {
    const tags = Array.isArray(a.ai_tags) ? a.ai_tags : [];
    return tags.some(t => t.toLowerCase() === tag.toLowerCase());
  }) ?? [];

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      <div className="bg-navy-900/60 border-b border-white/5 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to feed
          </Link>
          <span className="text-gray-700">|</span>
          <Tag size={13} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">{tag}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="tag text-sm px-3 py-1">#{tag}</span>
          </h1>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-2">
              {articles.length} {articles.length === 1 ? 'article' : 'articles'} tagged with "{tag}"
            </p>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card h-24 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-400 text-sm">Failed to load articles.</p>
        )}

        {!isLoading && articles.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Tag size={32} className="mx-auto mb-3 opacity-30" />
            <p>No articles found with tag "{tag}".</p>
          </div>
        )}

        <div className="space-y-3">
          {articles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
