// In production (Vercel), set VITE_API_URL to your Railway server URL.
// In development, Vite proxies /api → localhost:3001 (see vite.config.js).
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json.data;
}

export const api = {
  articles: {
    list: (params = {}) => request(`/articles?${new URLSearchParams(params)}`),
    get: (id) => request(`/articles/${id}`),
    create: (body) => request('/articles', { method: 'POST', body }),
    update: (id, body) => request(`/articles/${id}`, { method: 'PATCH', body }),
    delete: (id) => request(`/articles/${id}`, { method: 'DELETE' }),
  },
  websites: {
    list: () => request('/websites'),
    create: (body) => request('/websites', { method: 'POST', body }),
    update: (id, body) => request(`/websites/${id}`, { method: 'PATCH', body }),
    delete: (id) => request(`/websites/${id}`, { method: 'DELETE' }),
  },
  interests: {
    list: () => request('/interests'),
    create: (body) => request('/interests', { method: 'POST', body }),
    delete: (id) => request(`/interests/${id}`, { method: 'DELETE' }),
  },
  stats: () => request('/stats'),
  analyze: (body) => request('/analyze', { method: 'POST', body }),
  trackingLog: (params = {}) => request(`/tracking-log?${new URLSearchParams(params)}`),
};
