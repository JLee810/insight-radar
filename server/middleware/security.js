/**
 * Security middleware configuration.
 * - helmet: secure HTTP headers
 * - rate limiting: per-route limits
 * - CORS: locked to allowed origins in production
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const isProd = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS = [
  'https://insight-rader.info',
  'https://app.insight-rader.info',
  'https://dashboard-jlee810s-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:3001',
];

/** Helmet with relaxed CSP for API server */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

/** CORS — allow dashboard + extension origins */
export const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

/** General API rate limit: 100 req/min */
export const generalLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, slow down.' },
});

/** Auth rate limit: 10 req/15 min (brute force protection) */
export const authLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, try again later.' },
});

/** Comment post limit: 20 per 10 min */
export const commentLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many comments, slow down.' },
});
