/**
 * JWT authentication middleware.
 * Attaches req.user = { id, email, username, role } on success.
 */
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'insightradar-dev-secret-change-in-prod';

/**
 * Require a valid JWT. Returns 401 if missing/invalid.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return sendError(res, 'Authentication required', 401);

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

/**
 * Require admin role. Must be used after requireAuth.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return sendError(res, 'Admin access required', 403);
  next();
}

/**
 * Optional auth — attaches req.user if token present, continues regardless.
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch { /* ignore */ }
  }
  next();
}

/**
 * Sign a short-lived access token (15 min).
 * @param {{ id: number, email: string, username: string, role: string }} user
 */
export function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Sign a long-lived refresh token (7 days).
 */
export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

export { JWT_SECRET };
