/**
 * SearchPage — full-page article search with filters.
 * Route: /search
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, SlidersHorizontal, X } from 'lucide-react';
import Header from '../components/Header.jsx';
import ArticleCard from '../components/ArticleCard.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Fetch the user's tracked websites for the filter dropdown */
function useWebsites(token) {
  return useQuery({
    queryKey: ['websites', token],
    queryFn: () => api.websites.list(token),
    staleTime: 60_000,
    enabled: !!token,
  });
}

/** Fetch articles with the given search/filter params */
function useSearchResults(params) {
  return useQuery({
    queryKey: ['articles', 'search', params],
    queryFn: () => api.articles.list(params),
    staleTime: 15_000,
    enabled: true,
  });
}

export default function SearchPage() {
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [inputVal, setInputVal] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('discovered_at');
  const [order, setOrder] = useState('DESC');
  const [websiteId, setWebsiteId] = useState('');
  const [tag, setTag] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: websitesData } = useWebsites(accessToken);
  const websites = Array.isArray(websitesData) ? websitesData : (websitesData?.websites || []);

  const filterParams = {
    search: query || undefined,
    sort,
    order,
    limit: 50,
    ...(websiteId ? { website_id: websiteId } : {}),
  };

  const { data, isLoading, isError } = useSearchResults(filterParams);

  // Filter by tag client-side (the API doesn't have a tag filter param)
  const articles = (data?.articles || []).filter(a => {
    if (!tag) return true;
    return (a.ai_tags || []).some(t => t.toLowerCase().includes(tag.toLowerCase()));
  });

  /** Collect all unique tags from results for the tag filter suggestions */
  const allTags = Array.from(
    new Set((data?.articles || []).flatMap(a => a.ai_tags || []))
  ).sort();

  function handleSubmit(e) {
    e.preventDefault();
    setQuery(inputVal.trim());
    setSearchParams(inputVal.trim() ? { q: inputVal.trim() } : {});
  }

  function clearSearch() {
    setInputVal('');
    setQuery('');
    setSearchParams({});
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />

      {/* Breadcrumb */}
      <div className="bg-navy-900/60 border-b border-white/5 px-6 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-gray-400">Search</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Search hero */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Search Articles</h1>
          <p className="text-gray-400 text-sm">Search across all tracked articles by title and summary.</p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="input pl-9 pr-9 w-full"
              placeholder="Search articles…"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              autoFocus
            />
            {inputVal && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                onClick={clearSearch}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary flex items-center gap-2">
            <Search size={15} />
            Search
          </button>
          <button
            type="button"
            className={`btn-ghost p-2 ${showFilters ? 'text-cyan-400' : ''}`}
            onClick={() => setShowFilters(v => !v)}
            title="Toggle filters"
          >
            <SlidersHorizontal size={18} />
          </button>
        </form>

        {/* Filter panel */}
        {showFilters && (
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-cyan-400" />
              Filters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Sort */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Sort by</label>
                <select
                  className="input w-full text-sm"
                  value={`${sort}:${order}`}
                  onChange={e => {
                    const [s, o] = e.target.value.split(':');
                    setSort(s);
                    setOrder(o);
                  }}
                >
                  <option value="discovered_at:DESC">Newest first</option>
                  <option value="discovered_at:ASC">Oldest first</option>
                  <option value="relevance_score:DESC">Most relevant</option>
                  <option value="published_at:DESC">By publish date</option>
                  <option value="title:ASC">Title A–Z</option>
                </select>
              </div>

              {/* Website filter */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Source website</label>
                <select
                  className="input w-full text-sm"
                  value={websiteId}
                  onChange={e => setWebsiteId(e.target.value)}
                >
                  <option value="">All websites</option>
                  {websites.map(w => (
                    <option key={w.id} value={w.id}>{w.name || w.url}</option>
                  ))}
                </select>
              </div>

              {/* Tag filter */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Filter by tag</label>
                <input
                  type="text"
                  className="input w-full text-sm"
                  placeholder="e.g. AI, Finance…"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  list="tag-suggestions"
                />
                <datalist id="tag-suggestions">
                  {allTags.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>

            {/* Active filter chips */}
            {(websiteId || tag) && (
              <div className="flex gap-2 flex-wrap pt-1">
                {websiteId && (
                  <button
                    className="tag flex items-center gap-1 hover:border-red-400/40 hover:text-red-300"
                    onClick={() => setWebsiteId('')}
                  >
                    Site: {websites.find(w => String(w.id) === String(websiteId))?.name || websiteId}
                    <X size={11} />
                  </button>
                )}
                {tag && (
                  <button
                    className="tag flex items-center gap-1 hover:border-red-400/40 hover:text-red-300"
                    onClick={() => setTag('')}
                  >
                    Tag: {tag}
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results header */}
        {!isLoading && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {query
                ? <>Showing <span className="text-white font-medium">{articles.length}</span> result{articles.length !== 1 ? 's' : ''} for "<span className="text-cyan-400">{query}</span>"</>
                : <><span className="text-white font-medium">{articles.length}</span> article{articles.length !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-24 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="card text-center py-8 text-red-400 text-sm">
            Failed to fetch articles. Is the server running?
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && articles.length === 0 && (
          <div className="card text-center py-16 space-y-2">
            <Search size={32} className="text-gray-600 mx-auto" />
            <p className="text-gray-400 font-medium">
              {query ? `No articles matching "${query}"` : 'No articles found'}
            </p>
            <p className="text-gray-600 text-sm">Try a different search term or adjust your filters.</p>
          </div>
        )}

        {/* Results */}
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
