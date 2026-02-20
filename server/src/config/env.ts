import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  // Socrata API
  SOCRATA_APP_TOKEN: z.string().min(1, 'SOCRATA_APP_TOKEN is required'),
  SOCRATA_BASE_URL: z
    .string()
    .url()
    .default('https://data.calgary.ca/resource/vdjc-pybd.json'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CACHE_TTL_SECONDS: z.coerce.number().default(3600),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
