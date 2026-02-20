import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { cacheService } from './services/CacheService';
import publicRoutes from './routes/public.routes';
import staffRoutes from './routes/staff.routes';

const app = express();

// ── Security headers (OWASP / GoA standard) ──────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for Leaflet inline styles
        imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  }),
);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ── Body parsing & compression ────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Health checks ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health/cache', (_req, res) => {
  res.json({
    status: 'ok',
    backend: cacheService.isRedis ? 'redis' : 'in-memory',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/businesses', publicRoutes);
app.use('/api/v1', staffRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await cacheService.connect();

  app.listen(env.PORT, () => {
    console.info(`🚀  Server listening on http://localhost:${env.PORT}`);
    console.info(`   NODE_ENV: ${env.NODE_ENV}`);
    console.info(`   Cache backend: ${cacheService.isRedis ? 'Redis' : 'in-memory'}`);
  });
}

if (require.main === module) {
  void start();
}

export { app };
