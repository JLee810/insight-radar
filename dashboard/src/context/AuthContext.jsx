/**
 * AuthContext — global auth state.
 *
 * Strategy:
 *  - accessToken  → memory only (never touches storage, short-lived 15min)
 *  - refreshToken → localStorage (7-day, survives tab close)
 *  - user         → localStorage (instant restore on page refresh — no logout flash)
 *
 * On every page load:
 *  1. Restore `user` from localStorage immediately (no flash to logged-out state)
 *  2. Call /auth/refresh in background to get a fresh accessToken
 *  3. If refresh succeeds  → fully authenticated, schedule next refresh
 *  4. If refresh fails 401 → session truly expired, clear everything
 *  5. If refresh fails network error → keep user from localStorage, retry later
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

/* ── helpers ─────────────────────────────────────────────────────────── */

function readUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function saveUser(u) {
  if (u) localStorage.setItem('user', JSON.stringify(u));
  else    localStorage.removeItem('user');
}

/* ── provider ────────────────────────────────────────────────────────── */

export function AuthProvider({ children }) {
  // Restore user immediately from localStorage — prevents logout flash on refresh
  const [user, setUser]               = useState(readUser);
  const [accessToken, setAccessToken] = useState(null);
  // loading = true while we're verifying the session on startup
  const [loading, setLoading]         = useState(true);
  const refreshTimer                  = useRef(null);

  /** Sync user to localStorage whenever it changes */
  useEffect(() => { saveUser(user); }, [user]);

  /** Schedule silent token rotation 1 min before the 15-min expiry */
  function scheduleRefresh() {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(silentRefresh, 14 * 60 * 1000);
  }

  /**
   * Try to get a fresh accessToken using the stored refreshToken.
   * - 401/403 → genuine expiry → log out
   * - Network/5xx error → keep existing user, don't log out
   */
  const silentRefresh = useCallback(async () => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) {
      // No refresh token at all → definitely not logged in
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.auth.refresh(rt);
      setAccessToken(data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // Fetch fresh user profile in background
      api.auth.me(data.accessToken)
        .then(u => setUser(u))
        .catch(() => {/* keep existing user */});
      scheduleRefresh();
    } catch (err) {
      const status = err?.status || (err?.message?.includes('401') ? 401 : 0);
      if (status === 401 || status === 403 ||
          err?.message?.includes('expired') || err?.message?.includes('revoked') ||
          err?.message?.includes('Token')) {
        // Genuine auth failure — clear everything
        _clearSession();
      }
      // Network error / 5xx → keep user from localStorage, try again later
      // (user stays logged in visually, API calls will fail silently)
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    silentRefresh();
    return () => clearTimeout(refreshTimer.current);
  }, []);

  /* ── public actions ──────────────────────────────────────────────────── */

  async function login(email, password) {
    const data = await api.auth.login(email, password);
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    saveUser(data.user);
    scheduleRefresh();
    return data.user;
  }

  async function register(email, username, password, data_consent) {
    const data = await api.auth.register(email, username, password, data_consent);
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    saveUser(data.user);
    scheduleRefresh();
    return data.user;
  }

  function logout() {
    const rt = localStorage.getItem('refreshToken');
    if (rt) api.auth.logout(rt).catch(() => {});
    _clearSession();
  }

  function _clearSession() {
    localStorage.removeItem('refreshToken');
    saveUser(null);
    setAccessToken(null);
    setUser(null);
    clearTimeout(refreshTimer.current);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
