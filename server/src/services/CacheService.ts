import NodeCache from 'node-cache';
import { env } from '../config/env';

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  quit?(): Promise<void>;
}

class InMemoryBackend implements CacheBackend {
  private readonly store = new NodeCache({ useClones: false });

  async get(key: string): Promise<string | null> {
    const val = this.store.get<string>(key);
    return Promise.resolve(val ?? null);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, value, ttlSeconds);
    return Promise.resolve();
  }

  async del(key: string): Promise<void> {
    this.store.del(key);
    return Promise.resolve();
  }
}

class RedisBackend implements CacheBackend {
  private client: import('ioredis').Redis | null = null;
  private ready = false;

  async connect(url: string): Promise<void> {
    const { default: Redis } = await import('ioredis');
    this.client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });

    this.client.on('ready', () => {
      this.ready = true;
    });
    this.client.on('error', () => {
      this.ready = false;
    });

    try {
      await this.client.connect();
    } catch {
      this.ready = false;
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.ready) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.ready) return;
    await this.client.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.ready) return;
    await this.client.del(key);
  }

  async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

export class CacheService {
  private backend: CacheBackend;
  private readonly fallback = new InMemoryBackend();
  private readonly ttl: number;
  private usingRedis = false;

  constructor(ttlSeconds = env.CACHE_TTL_SECONDS) {
    this.ttl = ttlSeconds;
    this.backend = this.fallback;
  }

  async connect(redisUrl = env.REDIS_URL): Promise<void> {
    if (env.NODE_ENV === 'test') return;

    const redisBackend = new RedisBackend();
    await redisBackend.connect(redisUrl);

    if (redisBackend.isReady) {
      this.backend = redisBackend;
      this.usingRedis = true;
      console.info('✅ CacheService: connected to Redis');
    } else {
      console.warn('⚠️  CacheService: Redis unavailable, falling back to in-memory cache');
    }
  }

  get isRedis(): boolean {
    return this.usingRedis;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.backend.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = this.ttl): Promise<void> {
    try {
      await this.backend.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      console.warn('CacheService.set failed:', err);
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.backend.del(key);
    } catch (err) {
      console.warn('CacheService.invalidate failed:', err);
    }
  }

  async quit(): Promise<void> {
    if (this.backend.quit) {
      await this.backend.quit();
    }
  }

  /**
   * Build a deterministic cache key.
   * Format: {source}:{endpoint}:{stable-hash-of-params}
   */
  static buildKey(source: string, endpoint: string, params: Record<string, unknown>): string {
    const stable = JSON.stringify(params, Object.keys(params).sort());
    // Simple djb2-style hash — good enough for cache keying
    let hash = 5381;
    for (let i = 0; i < stable.length; i++) {
      hash = ((hash << 5) + hash) ^ stable.charCodeAt(i);
    }
    return `${source}:${endpoint}:${(hash >>> 0).toString(16)}`;
  }
}

export const cacheService = new CacheService();
