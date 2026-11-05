import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const isProd = process.env.NODE_ENV === 'production';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),

    FRONTEND_URL: z.url().default('http://localhost:3000'),
    API_PUBLIC_URL: z.url().default('http://localhost:4000'),
    CORS_ORIGINS: z.string().default(''),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    TOKEN_HASH_SECRET: z.string().min(32, 'TOKEN_HASH_SECRET must be at least 32 characters'),
    COOKIE_SECURE: bool(isProd),
    COOKIE_DOMAIN: optional,

    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: bool(false),
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    EMAIL_FROM: optional,
    EMAIL_REPLY_TO: optional,

    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('storage'),
    STORAGE_BUCKET: optional,
    STORAGE_REGION: z.string().default('auto'),
    STORAGE_ENDPOINT: optional,
    STORAGE_ACCESS_KEY: optional,
    STORAGE_SECRET_KEY: optional,
    STORAGE_FORCE_PATH_STYLE: bool(false),
    STORAGE_PUBLIC_URL: optional,

    MEDIA_MAX_IMAGE_MB: z.coerce.number().min(1).max(50).default(10),
    MEDIA_MAX_DOCUMENT_MB: z.coerce.number().min(1).max(50).default(10),
    RESUME_MAX_MB: z.coerce.number().min(1).max(20).default(5),

    WEB_REVALIDATE_URL: optional,
    REVALIDATE_SECRET: optional,

    TURNSTILE_SECRET_KEY: optional,
    SWAGGER_ENABLED: bool(!isProd),
    SCHEDULER_ENABLED: bool(true),
    FORM_MIN_FILL_SECONDS: z.coerce.number().min(0).max(60).default(3),

    RETENTION_CONTACT_DAYS: z.coerce.number().int().min(30).default(730),
    RETENTION_INQUIRY_DAYS: z.coerce.number().int().min(30).default(1095),
    RETENTION_APPLICATION_DAYS: z.coerce.number().int().min(30).default(365),
    RETENTION_AUDIT_DAYS: z.coerce.number().int().min(90).default(730),
    RETENTION_EMAIL_DAYS: z.coerce.number().int().min(7).default(90),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_PROVIDER === 's3') {
      for (const key of ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when STORAGE_PROVIDER=s3` });
      }
    }
    if (env.NODE_ENV === 'production') {
      if (!env.COOKIE_SECURE) ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE must be true in production' });
      if (env.JWT_ACCESS_SECRET === env.TOKEN_HASH_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['TOKEN_HASH_SECRET'], message: 'Use different secrets for JWT_ACCESS_SECRET and TOKEN_HASH_SECRET' });
      }
      if (/change-me|example|placeholder/i.test(env.JWT_ACCESS_SECRET + env.TOKEN_HASH_SECRET)) {
        ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Replace placeholder secrets before running in production' });
      }
    }
  });

export type Env = z.output<typeof envSchema>;

export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${lines}\nSee .env.example for documentation.`);
  }
  return result.data;
}

export function isEmailConfigured(env: Env): boolean {
  return Boolean(env.SMTP_HOST && env.EMAIL_FROM);
}

export function allowedOrigins(env: Env): string[] {
  return [env.FRONTEND_URL, ...env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)].map((o) => new URL(o).origin);
}
