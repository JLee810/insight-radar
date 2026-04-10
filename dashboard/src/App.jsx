import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import ArticleCard from './components/ArticleCard.jsx';
import WebsiteList from './components/WebsiteList.jsx';
import InterestTags from './components/InterestTags.jsx';
import AIInsights from './components/AIInsights.jsx';
import { useArticles, useCreateArticle } from './hooks/useArticles.js';
import { LayoutGrid, Globe, Tag, Sparkles, BookMarked, Plus, X, Filter } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** Sidebar navigation tab button */
function NavTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-cyan-400/10 text-cyan-400 font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/** Article feed panel with filters */
function ArticleFeed({ searchQuery }) {
  const [filters, setFilters] = useState({ sort: 'discovered_at', order: 'DESC', limit: 20 });
  const [addUrl, setAddUrl] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading, isError } = useArticles({ ...filters, search: searchQuery });
  const createArticle = useCreateArticle();

  async function handleAddUrl(e) {
    e.preventDefault();
    if (!addUrl.trim()) return;
    await createArticle.mutateAsync({ url: addUrl.trim() });
    setAddUrl('');
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">Articles</h2>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto text-xs py-1.5"
            value={`${filters.sort}:${filters.order}`}
            onChange={e => {
              const [sort, order] = e.target.value.split(':');
              setFilters(p => ({ ...p, sort, order }));
            }}
          >
            <option value="discovered_at:DESC">Newest first</option>
            <option value="relevance_score:DESC">Most relevant</option>
            <option value="published_at:DESC">By publish date</option>
          </select>
          <button className="btn-primary flex items-center gap-1" onClick={() => setShowAdd(v => !v)}>
            {showAdd ? <X size={14} /> : <Plus size={14} />}
            {showAdd ? 'Cancel' : 'Add URL'}
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAddUrl} className="flex gap-2">
          <input className="input flex-1" type="url" placeholder="https://…" value={addUrl} onChange={e => setAddUrl(e.target.value)} required />
          <button type="submit" className="btn-primary shrink-0" disabled={createArticle.isPending}>
            {createArticle.isPending ? 'Analyzing…' : 'Add & Analyze'}
          </button>
        </form>
      )}
      {createArticle.isError && <p className="text-red-400 text-xs">{createArticle.error.message}</p>}

      {/* Quick filter pills */}
      <div className="flex gap-2">
        {[
          { label: 'All', filter: {} },
          { label: 'Unread', filter: { is_read: 'false' } },
          { label: 'Bookmarked', filter: { is_bookmarked: 'true' } },
          { label: 'High relevance', filter: { min_score: 70 } },
        ].map(({ label, filter }) => (
          <button
            key={label}
            onClick={() => setFilters(p => ({ sort: p.sort, order: p.order, limit: p.limit, ...filter }))}
            className="tag hover:border-cyan-400/40 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-white/5" />
          ))}
        </div>
      )}

      {isError && <p className="text-red-400 text-sm">Failed to load articles. Is the server running?</p>}

      {!isLoading && data?.articles?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-1">No articles yet</p>
          <p className="text-sm">Add websites to track or paste an article URL above.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.articles?.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}

function AppInner() {
  const [tab, setTab] = useState('articles');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'articles', icon: LayoutGrid, label: 'Articles' },
    { id: 'websites', icon: Globe, label: 'Websites' },
    { id: 'interests', icon: Tag, label: 'Interests' },
    { id: 'insights', icon: Sparkles, label: 'AI Insights' },
  ];

  return (
    <div className="min-h-screen bg-navy-900">
      <Header onSearch={q => { setSearchQuery(q); setTab('articles'); }} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 space-y-1 sticky top-20 h-fit">
          {tabs.map(t => (
            <NavTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-6">
          {tab === 'articles' && (
            <>
              <Dashboard />
              <ArticleFeed searchQuery={searchQuery} />
            </>
          )}
          {tab === 'websites' && <WebsiteList />}
          {tab === 'interests' && <InterestTags />}
          {tab === 'insights' && <AIInsights />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
