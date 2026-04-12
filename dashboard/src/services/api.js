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
    list: (token) => authRequest(token, '/websites'),
    create: (token, body) => authRequest(token, '/websites', { method: 'POST', body }),
    update: (token, id, body) => authRequest(token, `/websites/${id}`, { method: 'PATCH', body }),
    delete: (token, id) => authRequest(token, `/websites/${id}`, { method: 'DELETE' }),
  },
  interests: {
    list: (token) => authRequest(token, '/interests'),
    create: (token, body) => authRequest(token, '/interests', { method: 'POST', body }),
    bulkCreate: (token, keywords) => authRequest(token, '/interests/bulk', { method: 'POST', body: { keywords } }),
    delete: (token, id) => authRequest(token, `/interests/${id}`, { method: 'DELETE' }),
  },
  stats: () => request('/stats'),
  analyze: (body) => request('/analyze', { method: 'POST', body }),
  trackingLog: (params = {}) => request(`/tracking-log?${new URLSearchParams(params)}`),
  auth: {
    register: (email, username, password, data_consent) => request('/auth/register', { method: 'POST', body: { email, username, password, data_consent: String(data_consent) } }),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: { refreshToken } }),
    refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: { refreshToken } }),
    me: (token) => authRequest(token, '/auth/me'),
    changePassword: (token, currentPassword, newPassword) =>
      authRequest(token, '/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    updateProfile: (token, bio) =>
      authRequest(token, '/auth/profile', { method: 'PATCH', body: { bio } }),
    requestReset: (email) => request('/auth/request-reset', { method: 'POST', body: { email } }),
    resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),
  },
  notifications: {
    list: (token) => authRequest(token, '/notifications'),
    markRead: (token, id) => authRequest(token, `/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: (token) => authRequest(token, '/notifications/read-all', { method: 'POST' }),
  },
  bias: {
    get: (articleId) => request(`/bias/${articleId}`),
  },
  trending: () => request('/trending'),
  admin: {
    stats:            (token) => authRequest(token, '/admin/stats'),
    reportedComments: (token) => authRequest(token, '/admin/reported-comments'),
    dismissComment:   (token, id) => authRequest(token, `/admin/comments/${id}/dismiss`, { method: 'POST' }),
    deleteComment:    (token, id) => authRequest(token, `/admin/comments/${id}`, { method: 'DELETE' }),
    users:            (token, params = {}) => authRequest(token, `/admin/users?${new URLSearchParams(params)}`),
    banUser:          (token, id, banned) => authRequest(token, `/admin/users/${id}/ban`, { method: 'POST', body: { banned } }),
    promoteUser:      (token, id) => authRequest(token, `/admin/users/${id}/promote`, { method: 'POST' }),
    deleteUser:       (token, id) => authRequest(token, `/admin/users/${id}`, { method: 'DELETE' }),
  },
  opinions: {
    list:   (params = {}) => request(`/opinions?${new URLSearchParams(params)}`),
    get:    (id) => request(`/opinions/${id}`),
    create: (token, body) => authRequest(token, '/opinions', { method: 'POST', body }),
    update: (token, id, body) => authRequest(token, `/opinions/${id}`, { method: 'PATCH', body }),
    delete: (token, id) => authRequest(token, `/opinions/${id}`, { method: 'DELETE' }),
    like:   (token, id) => authRequest(token, `/opinions/${id}/like`, { method: 'POST' }),
  },
  debate: {
    vote: (token, articleId) => authRequest(token, `/debate/${articleId}/vote`, { method: 'POST' }),
    getThread: (articleId, token) => token
      ? authRequest(token, `/debate/${articleId}`)
      : request(`/debate/${articleId}`),
    addComment: (token, articleId, body) => authRequest(token, `/debate/${articleId}/comments`, { method: 'POST', body }),
    deleteComment: (token, commentId) => authRequest(token, `/debate/comments/${commentId}`, { method: 'DELETE' }),
    reportComment: (token, commentId) => authRequest(token, `/debate/comments/${commentId}/report`, { method: 'POST' }),
    likeComment: (token, commentId) => authRequest(token, `/debate/comments/${commentId}/like`, { method: 'POST' }),
  },
};
