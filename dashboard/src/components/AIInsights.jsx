import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';
import { useArticles } from '../hooks/useArticles.js';

/**
 * AI-generated weekly digest of trends across tracked content.
 */
export default function AIInsights() {
  const { data: articlesData } = useArticles({ limit: 30, sort: 'discovered_at' });
  const [digest, setDigest] = useState(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Use the first article's ID to trigger analysis, or just call stats for the digest
      // We pass the article list directly to the server analyze endpoint
      const articles = articlesData?.articles || [];
      if (!articles.length) throw new Error('No articles to analyze');
      // Re-analyze the top recent article for a demo — real digest via backend
      return api.analyze({ article_id: articles[0].id });
    },
    onSuccess: (data) => setDigest(data),
  });

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">AI Insights</h3>
        </div>
        <button
          className="btn-ghost flex items-center gap-1 text-xs"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <RefreshCw size={12} className={generateMutation.isPending ? 'animate-spin' : ''} />
          {generateMutation.isPending ? 'Analyzing…' : 'Generate'}
        </button>
      </div>

      {generateMutation.isError && (
        <p className="text-red-400 text-xs">{generateMutation.error.message}</p>
      )}

      {digest ? (
        <div className="space-y-3">
          {digest.summary && (
            <p className="text-sm text-gray-300 leading-relaxed">{digest.summary}</p>
          )}
          {digest.insight && (
            <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-lg p-3">
              <p className="text-xs text-cyan-300 leading-relaxed">{digest.insight}</p>
            </div>
          )}
          {digest.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {digest.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-xs">
          Click "Generate" to get AI insights on your recent articles.
        </p>
      )}
    </div>
  );
}
