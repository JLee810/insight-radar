import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api } from './services/api.js';
import { AuthProvider } from './context/AuthContext.jsx';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import ArticleCard from './components/ArticleCard.jsx';
import WebsiteList from './components/WebsiteList.jsx';
import InterestTags from './components/InterestTags.jsx';
import AIInsights from './components/AIInsights.jsx';
import DebatePage from './pages/DebatePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import OpinionsPage from './pages/OpinionsPage.jsx';
import OpinionDetailPage from './pages/OpinionDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import BookmarksPage from './pages/BookmarksPage.jsx';
import TagPage from './pages/TagPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SocialFeedPage from './pages/SocialFeedPage.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useAuth } from './context/AuthContext.jsx';
import TrendingWidget from './components/TrendingWidget.jsx';
import OpinionsWidget from './components/OpinionsWidget.jsx';
import { useArticles, useCreateArticle } from './hooks/useArticles.js';
import { LayoutGrid, Globe, Tag, Sparkles, Plus, X, BarChart2, Radio } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** Sidebar navigation tab button (desktop) */
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

/** Bottom nav tab (mobile) */
function BottomTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${active ? 'text-cyan-400' : 'text-gray-500'}`}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
      {label}
    </button>
  );
}

/** Article feed panel with filters */
function ArticleFeed({ searchQuery }) {
  const [filters, setFilters] = useState({ sort: 'discovered_at', order: 'DESC', limit: 20 });
  const [page, setPage] = useState(0);
  const [addUrl, setAddUrl] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading, isError, refetch } = useArticles({ ...filters, search: searchQuery, offset: page * filters.limit });
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-white">Articles</h2>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto text-xs py-1.5"
            value={`${filters.sort}:${filters.order}`}
            onChange={e => {
              const [sort, order] = e.target.value.split(':');
              setFilters(p => ({ ...p, sort, order }));
              setPage(0);
            }}
          >
            <option value="discovered_at:DESC">Newest first</option>
            <option value="relevance_score:DESC">Most relevant</option>
            <option value="published_at:DESC">By publish date</option>
          </select>
          <button className="btn-ghost p-2" onClick={() => refetch()} title="Refresh">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
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
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', filter: {} },
          { label: 'Unread', filter: { is_read: 'false' } },
          { label: 'Bookmarked', filter: { is_bookmarked: 'true' } },
          { label: 'High relevance', filter: { min_score: 70 } },
        ].map(({ label, filter }) => (
          <button
            key={label}
            onClick={() => { setFilters(p => ({ sort: p.sort, order: p.order, limit: p.limit, ...filter })); setPage(0); }}
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

      {/* Pagination */}
      {!isLoading && data && (
        <div className="flex items-center justify-between pt-2">
          <button
            className="btn-ghost text-sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} · {data.total ?? data.articles?.length} articles total
          </span>
          <button
            className="btn-ghost text-sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!data.articles?.length || data.articles.length < filters.limit}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/** For You feed — articles filtered by user's interest keywords */
function ForYouFeed() {
  const { accessToken } = useAuth();
  const { data: interests } = useQuery({
    queryKey: ['interests', accessToken],
    queryFn: () => api.interests.list(accessToken),
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const keywords = (interests || []).map(i => i.keyword);
  const searchQuery = keywords.slice(0, 3).join(' ');

  const { data, isLoading } = useQuery({
    queryKey: ['articles', 'foryou', searchQuery],
    queryFn: () => api.articles.list({ search: searchQuery, sort: 'relevance_score', order: 'DESC', limit: 20 }),
    enabled: keywords.length > 0,
    staleTime: 60_000,
  });

  if (!accessToken) return (
    <div className="card text-center py-12 text-gray-500">
      <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
      <p>Sign in to see personalized articles based on your interests.</p>
    </div>
  );

  if (keywords.length === 0) return (
    <div className="card text-center py-12 text-gray-500">
      <Tag size={32} className="mx-auto mb-3 opacity-30" />
      <p>Add interest keywords in the <strong className="text-white">Interests</strong> tab to get personalized articles.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-white">For You</h2>
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 5).map(k => <span key={k} className="tag text-xs">{k}</span>)}
        </div>
      </div>
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse bg-white/5" />)}
        </div>
      )}
      {!isLoading && data?.articles?.length === 0 && (
        <div className="card text-center py-10 text-gray-500">
          <p>No articles matched your interests yet. Add more websites or keywords.</p>
        </div>
      )}
      <div className="space-y-3">
        {data?.articles?.map(a => <ArticleCard key={a.id} article={a} />)}
      </div>
    </div>
  );
}

function HomePage() {
  const [tab, setTab] = useState('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const tabs = [
    { id: 'articles',  icon: LayoutGrid, label: 'Articles' },
    { id: 'foryou',    icon: Sparkles,   label: 'For You' },
    { id: 'social',    icon: Radio,      label: 'Social',  link: '/social' },
    { id: 'websites',  icon: Globe,      label: 'Websites' },
    { id: 'interests', icon: Tag,        label: 'Interests' },
    { id: 'insights',  icon: BarChart2,  label: 'Insights' },
  ];

  return (
    <div className="min-h-screen bg-navy-900">
      <Header
        onSearch={q => { setSearchQuery(q); setTab('articles'); }}
        onLogoClick={() => setTab('articles')}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:block w-52 shrink-0 sticky top-20 h-fit space-y-1">
          {/* Opinions widget — pinned to top */}
          <OpinionsWidget />

          {/* Nav tabs */}
          {tabs.map(t => (
            <NavTab
              key={t.id}
              icon={t.icon}
              label={t.label}
              active={tab === t.id}
              onClick={() => t.link ? navigate(t.link) : setTab(t.id)}
            />
          ))}

          <div className="pt-4">
            <TrendingWidget />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-6 pb-24 md:pb-6">
          {tab === 'articles' && (
            <>
              <Dashboard />
              <ArticleFeed searchQuery={searchQuery} />
            </>
          )}
          {tab === 'foryou' && <ForYouFeed />}
          {tab === 'websites' && <WebsiteList />}
          {tab === 'interests' && <InterestTags />}
          {tab === 'insights' && <AIInsights />}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-navy-900/95 backdrop-blur border-t border-white/8 flex md:hidden safe-bottom">
        {tabs.map(t => (
          <BottomTab
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={tab === t.id}
            onClick={() => t.link ? navigate(t.link) : setTab(t.id)}
          />
        ))}
      </nav>
    </div>
  );
}

/** Full-screen spinner shown while we're restoring the session on page load */
function AuthGate({ children }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center animate-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-900">
              <path d="M5.07 12.2a7 7 0 1 0 6.93-6.13" /><path d="M12 2v4" /><path d="m16.24 7.76 2.83-2.83" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Loading InsightRadar…</p>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthGate>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/debate/:articleId" element={<DebatePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/opinions" element={<OpinionsPage />} />
            <Route path="/opinions/:id" element={<OpinionDetailPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/tag/:tag" element={<TagPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/social" element={<SocialFeedPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </AuthGate>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
