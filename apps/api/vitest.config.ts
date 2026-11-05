import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

for (const file of ['.env', '../../.env']) if (existsSync(file)) config({ path: file, quiet: true });

/**
 * Integration tests need a dedicated, disposable database. The URL must contain "test" so the
 * suite can never wipe a development or production database by accident.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';

const testEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  SCHEDULER_ENABLED: 'false',
  SWAGGER_ENABLED: 'false',
  FORM_MIN_FILL_SECONDS: '0',
  FRONTEND_URL: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'test-only-access-secret-at-least-32-characters-long',
  TOKEN_HASH_SECRET: 'test-only-hash-secret-at-least-32-characters-long!!',
  DATABASE_URL: testDatabaseUrl,
  STORAGE_PROVIDER: 'local',
  STORAGE_LOCAL_DIR: 'storage-test',
  SMTP_HOST: '',
  EMAIL_FROM: '',
  WEB_REVALIDATE_URL: '',
  TURNSTILE_SECRET_KEY: '',
};

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' }, sourceMaps: false })],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'], env: testEnv },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.e2e.test.ts'],
          env: testEnv,
          globalSetup: ['test/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
