/**
 * AuthContext — global auth state.
 * Stores accessToken in memory, refreshToken in localStorage.
 * Auto-refreshes access token before expiry.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading]         = useState(true);
  const refreshTimer                  = useRef(null);

  /** Schedule access token refresh 1 min before 15-min expiry */
  function scheduleRefresh() {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refreshAccess, 14 * 60 * 1000);
  }

  const refreshAccess = useCallback(async () => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) { setLoading(false); return; }
    try {
      const data = await api.auth.refresh(rt);
      setAccessToken(data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      scheduleRefresh();
    } catch {
      // Refresh expired — log out silently
      logout();
    }
  }, []);

  // On mount: try to restore session from stored refresh token
  useEffect(() => {
    refreshAccess().finally(() => setLoading(false));
    return () => clearTimeout(refreshTimer.current);
  }, []);

  // After access token set, fetch user profile
  useEffect(() => {
    if (!accessToken) { setUser(null); return; }
    api.auth.me(accessToken).then(setUser).catch(() => setUser(null));
  }, [accessToken]);

  async function login(email, password) {
    const data = await api.auth.login(email, password);
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    scheduleRefresh();
    return data.user;
  }

  async function register(email, username, password) {
    const data = await api.auth.register(email, username, password);
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    scheduleRefresh();
    return data.user;
  }

  function logout() {
    const rt = localStorage.getItem('refreshToken');
    if (rt) api.auth.logout(rt).catch(() => {});
    localStorage.removeItem('refreshToken');
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
