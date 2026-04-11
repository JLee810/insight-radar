/**
 * Auth routes: register, login, refresh, logout, me.
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/refresh
 * POST /api/auth/logout
 * GET  /api/auth/me
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { requireAuth, signAccessToken, signRefreshToken, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

const VOTE_THRESHOLD = 5; // votes needed to open a debate thread

/** Hash a refresh token for DB storage */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/register
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('password').isLength({ min: 8 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const { email, username, password } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) return sendError(res, 'Email or username already taken', 409);

    const password_hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(
      'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)'
    ).run(email, username, password_hash);

    const user = db.prepare('SELECT id, email, username, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);

    // Store hashed refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, hashToken(refreshToken), expiresAt);

    sendSuccess(res, { user, accessToken, refreshToken }, 201);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return sendError(res, 'Invalid email or password', 401);
    }
    if (user.is_banned) return sendError(res, 'Account suspended', 403);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, hashToken(refreshToken), expiresAt);

    const { password_hash: _, ...safeUser } = user;
    sendSuccess(res, { user: safeUser, accessToken, refreshToken });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return sendError(res, 'Refresh token required', 400);

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') return sendError(res, 'Invalid token type', 401);

    const db = getDb();
    const stored = db.prepare(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime("now")'
    ).get(hashToken(refreshToken));
    if (!stored) return sendError(res, 'Token revoked or expired', 401);

    const user = db.prepare('SELECT id, email, username, role FROM users WHERE id = ?').get(payload.sub);
    if (!user) return sendError(res, 'User not found', 401);

    // Rotate: delete old, issue new
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(refreshToken));
    const newAccess = signAccessToken(user);
    const newRefresh = signRefreshToken(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, hashToken(newRefresh), expiresAt);

    sendSuccess(res, { accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    sendError(res, 'Invalid or expired refresh token', 401);
  }
});

/**
 * POST /api/auth/logout
 * Revokes the provided refresh token.
 */
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      const db = getDb();
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(refreshToken));
    } catch { /* silent */ }
  }
  sendSuccess(res, { loggedOut: true });
});

/**
 * GET /api/auth/me
 * Returns current user info.
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);
    sendSuccess(res, user);
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
