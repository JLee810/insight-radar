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

/** Authenticated request — injects Bearer token */
function authRequest(token, path, options = {}) {
  return request(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
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
  auth: {
    register: (email, username, password) => request('/auth/register', { method: 'POST', body: { email, username, password } }),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: { refreshToken } }),
    refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: { refreshToken } }),
    me: (token) => authRequest(token, '/auth/me'),
  },
  bias: {
    get: (articleId) => request(`/bias/${articleId}`),
  },
  debate: {
    vote: (token, articleId) => authRequest(token, `/debate/${articleId}/vote`, { method: 'POST' }),
    getThread: (articleId, token) => token
      ? authRequest(token, `/debate/${articleId}`)
      : request(`/debate/${articleId}`),
    addComment: (token, articleId, body) => authRequest(token, `/debate/${articleId}/comments`, { method: 'POST', body }),
    deleteComment: (token, commentId) => authRequest(token, `/debate/comments/${commentId}`, { method: 'DELETE' }),
    reportComment: (token, commentId) => authRequest(token, `/debate/comments/${commentId}/report`, { method: 'POST' }),
  },
};
