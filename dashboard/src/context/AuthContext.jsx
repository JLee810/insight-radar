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
   *
   * Logout only happens when the JWT is cryptographically invalid/expired
   * (the server could not verify the signature). Any other error — including
   * network issues, server restarts, or a wiped DB — keeps the user logged in
   * visually and retries silently later.
   *
   * Retry logic: on first failure wait 4 s and try once more before deciding.
   */
  const silentRefresh = useCallback(async (isRetry = false) => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) {
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
      const msg = err?.message || '';

      // Only a cryptographically invalid JWT warrants a forced logout.
      // "Invalid or expired refresh token" = jwt.verify() failed = truly invalid.
      // Everything else (network, server restart, DB wipe) = keep user, retry.
      const isJwtInvalid = msg.includes('Invalid or expired refresh token');

      if (isJwtInvalid) {
        // Genuine JWT failure — token is forged or past 7-day window
        _clearSession();
      } else if (!isRetry) {
        // First failure — could be a server cold-start or fluke. Retry once after 4 s.
        setTimeout(() => silentRefresh(true), 4000);
        // Don't clear loading — AuthGate will show spinner until retry resolves
        return;
      }
      // If retry also failed with a non-JWT error, keep the user from localStorage.
      // They'll appear logged in; authenticated API calls may fail silently until
      // the server recovers or they manually log in again.
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
