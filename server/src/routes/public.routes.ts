import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CalgaryBusinessLicenseAdapter } from '../adapters/CalgaryBusinessLicenseAdapter';
import { cacheService, CacheService } from '../services/CacheService';
import { toPublicRecords } from '../transformers/publicBusinessTransformer';

const router = Router();
const adapter = new CalgaryBusinessLicenseAdapter();

const bboxSchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  west: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().positive().max(2000).default(500),
});

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50_000).default(1000),
  limit: z.coerce.number().int().positive().max(500).default(500),
});

const categoriesSchema = z.object({
  area: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res)).catch((err: unknown) => {
      next(err);
    });
  };

/**
 * GET /api/v1/businesses
 * Returns businesses within a bounding box (public whitelist only).
 */
router.get('/', asyncHandler(async (req, res) => {
  const parsed = bboxSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    return;
  }

  const { north, south, east, west, limit } = parsed.data;
  const cacheKey = CacheService.buildKey('calgary', 'bbox', { north, south, east, west, limit });

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cached);
    return;
  }

  try {
    const records = await adapter.fetchByBoundingBox({ north, south, east, west }, limit);
    const result = toPublicRecords(records);
    await cacheService.set(cacheKey, result);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    console.error('fetchByBoundingBox error:', err);
    res.status(502).json({ error: 'Upstream data source unavailable' });
  }
}));

/**
 * GET /api/v1/businesses/nearby
 * Returns businesses within a radius (metres) of a lat/lng point.
 */
router.get('/nearby', asyncHandler(async (req, res) => {
  const parsed = nearbySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    return;
  }

  const { lat, lng, radius, limit } = parsed.data;
  const cacheKey = CacheService.buildKey('calgary', 'nearby', { lat, lng, radius, limit });

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cached);
    return;
  }

  try {
    const records = await adapter.fetchByRadius({ lat, lng, radiusMetres: radius, limit });
    const result = toPublicRecords(records);
    await cacheService.set(cacheKey, result);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    console.error('fetchByRadius error:', err);
    res.status(502).json({ error: 'Upstream data source unavailable' });
  }
}));

/**
 * GET /api/v1/businesses/categories
 * Returns business category counts for gap analysis.
 */
router.get('/categories', asyncHandler(async (req, res) => {
  const parsed = categoriesSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    return;
  }

  const { area, limit } = parsed.data;
  const cacheKey = CacheService.buildKey('calgary', 'categories', { area, limit });

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cached);
    return;
  }

  try {
    const result = await adapter.fetchCategories({ area, limit });
    await cacheService.set(cacheKey, result);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    console.error('fetchCategories error:', err);
    res.status(502).json({ error: 'Upstream data source unavailable' });
  }
}));

export default router;
