import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { CalgaryBusinessLicenseAdapter } from '../adapters/CalgaryBusinessLicenseAdapter';
import { cacheService, CacheService } from '../services/CacheService';
import { toStaffRecords } from '../transformers/staffBusinessTransformer';
import { requireJwt, requireRole } from '../middleware/jwtAuth.middleware';
import { env } from '../config/env';

const router = Router();
const adapter = new CalgaryBusinessLicenseAdapter();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const bboxSchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  west: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().positive().max(5000).default(1000),
});

/**
 * POST /api/v1/auth/login
 * Issues JWT access + refresh tokens for GoA staff.
 *
 * NOTE: In production, validate credentials against GoA IdP (MyAlberta Digital ID / Entra ID).
 * This stub uses a hardcoded check and is replaced by real auth in Phase 2.
 */
router.post('/auth/login', (req: Request, res: Response): void => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid credentials format' });
    return;
  }

  const { email } = parsed.data;

  // ⚠️  MVP stub — replace with Entra ID / OIDC in Phase 2
  // Never log or return the password
  const payload = { sub: email, email, role: 'staff' as const };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  res.json({
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
});

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token from a valid refresh token.
 */
router.post('/auth/refresh', (req: Request, res: Response): void => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, env.JWT_SECRET) as {
      sub: string;
      email: string;
      role: 'staff' | 'admin';
    };

    const accessToken = jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    res.json({ accessToken, tokenType: 'Bearer', expiresIn: env.JWT_ACCESS_EXPIRES_IN });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * GET /api/v1/staff/businesses
 * Returns full payload (including PII fields) for authenticated staff.
 */
router.get(
  '/staff/businesses',
  requireJwt,
  requireRole('staff'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = bboxSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
      return;
    }

    const { north, south, east, west, limit } = parsed.data;
    const cacheKey = CacheService.buildKey('calgary', 'staff-bbox', { north, south, east, west, limit });

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached);
      return;
    }

    try {
      const records = await adapter.fetchByBoundingBox({ north, south, east, west }, limit);
      const result = toStaffRecords(records);
      // Staff data cached with shorter TTL (15 min) to ensure freshness for operational use
      await cacheService.set(cacheKey, result, 900);
      res.setHeader('X-Cache', 'MISS');
      res.json(result);
    } catch (err) {
      console.error('staff fetchByBoundingBox error:', err);
      res.status(502).json({ error: 'Upstream data source unavailable' });
    }
  },
);

export default router;
