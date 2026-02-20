import { CacheService } from './CacheService';

// Force NODE_ENV=test so CacheService never attempts Redis connection
process.env.NODE_ENV = 'test';
process.env.SOCRATA_APP_TOKEN = 'test-token';
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';

describe('CacheService (in-memory backend)', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(60);
  });

  it('returns null for a cache miss', async () => {
    const result = await cache.get('missing-key');
    expect(result).toBeNull();
  });

  it('stores and retrieves a value', async () => {
    await cache.set('key1', { foo: 'bar' });
    const result = await cache.get<{ foo: string }>('key1');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('stores arrays', async () => {
    await cache.set('arr', [1, 2, 3]);
    const result = await cache.get<number[]>('arr');
    expect(result).toEqual([1, 2, 3]);
  });

  it('invalidates a key', async () => {
    await cache.set('key2', 'value');
    await cache.invalidate('key2');
    const result = await cache.get('key2');
    expect(result).toBeNull();
  });

  it('reports in-memory backend when Redis is unavailable', () => {
    expect(cache.isRedis).toBe(false);
  });

  describe('CacheService.buildKey', () => {
    it('produces deterministic keys for the same params', () => {
      const k1 = CacheService.buildKey('calgary', 'bbox', { north: 51.1, south: 51.0 });
      const k2 = CacheService.buildKey('calgary', 'bbox', { north: 51.1, south: 51.0 });
      expect(k1).toBe(k2);
    });

    it('produces different keys for different params', () => {
      const k1 = CacheService.buildKey('calgary', 'bbox', { north: 51.1 });
      const k2 = CacheService.buildKey('calgary', 'bbox', { north: 51.2 });
      expect(k1).not.toBe(k2);
    });

    it('produces different keys for different sources', () => {
      const k1 = CacheService.buildKey('calgary', 'bbox', { north: 51.1 });
      const k2 = CacheService.buildKey('edmonton', 'bbox', { north: 51.1 });
      expect(k1).not.toBe(k2);
    });

    it('is order-independent for params object keys', () => {
      const k1 = CacheService.buildKey('calgary', 'nearby', { lat: 51.0, lng: -114.0 });
      const k2 = CacheService.buildKey('calgary', 'nearby', { lng: -114.0, lat: 51.0 });
      expect(k1).toBe(k2);
    });
  });
});
