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
  body('data_consent').equals('true').withMessage('You must agree to data collection to continue'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const { email, username, password } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) return sendError(res, 'Email or username already taken', 409);

    const password_hash = bcrypt.hashSync(password, 12);
    // Auto-grant admin role if email matches ADMIN_EMAIL env var
    const adminEmails = (process.env.ADMIN_EMAIL || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

    const result = db.prepare(
      'INSERT INTO users (email, username, password_hash, role, data_consent, data_consent_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)'
    ).run(email, username, password_hash, role);

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

    const user = db.prepare('SELECT id, email, username, role, bio, created_at FROM users WHERE id = ?').get(payload.sub);
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

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', requireAuth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);

    const valid = bcrypt.compareSync(req.body.currentPassword, user.password_hash);
    if (!valid) return sendError(res, 'Current password is incorrect', 401);

    if (req.body.currentPassword === req.body.newPassword) {
      return sendError(res, 'New password must be different from current password', 400);
    }

    const newHash = bcrypt.hashSync(req.body.newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    // Revoke all refresh tokens so other sessions are logged out
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);

    sendSuccess(res, { changed: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * PATCH /api/auth/profile
 * Update bio for the authenticated user.
 */
router.patch('/profile', requireAuth, [
  body('bio').optional({ nullable: true }).isLength({ max: 300 }).withMessage('Bio max 300 characters'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);
  try {
    const db = getDb();
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(req.body.bio ?? null, req.user.id);
    const updated = db.prepare('SELECT id, email, username, role, bio, created_at FROM users WHERE id = ?').get(req.user.id);
    sendSuccess(res, updated);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/auth/request-reset
 * Generate a password reset token (no email — returns token for copy/paste in dev).
 * In production this would email the token. Body: { email }
 */
router.post('/request-reset', [
  body('email').isEmail().normalizeEmail(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);
  try {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(req.body.email);
    // Always return success to avoid email enumeration
    if (!user) return sendSuccess(res, { sent: true });

    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Invalidate old tokens for this user
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hash, expiresAt);

    // In production: send email. For now, return token in response (dev only).
    const isDev = process.env.NODE_ENV !== 'production';
    sendSuccess(res, { sent: true, ...(isDev ? { token } : {}) });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token. Body: { token, newPassword }
 */
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);
  try {
    const db = getDb();
    const hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const record = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = 0').get(hash);

    if (!record) return sendError(res, 'Invalid or expired reset token', 400);
    if (new Date(record.expires_at) < new Date()) return sendError(res, 'Reset token has expired', 400);

    const newHash = bcrypt.hashSync(req.body.newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(record.id);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(record.user_id);

    sendSuccess(res, { reset: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/auth/make-admin
 * Promotes a user to admin using the ADMIN_SECRET env var.
 * Body: { email, secret }
 */
router.post('/make-admin', (req, res) => {
  const { email, secret } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return sendError(res, 'Admin promotion not configured', 403);
  if (!secret || secret !== adminSecret) return sendError(res, 'Invalid secret', 403);

  try {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(
      email?.toLowerCase?.() ?? ''
    );
    if (!user) return sendError(res, 'User not found', 404);
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
    sendSuccess(res, { promoted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
