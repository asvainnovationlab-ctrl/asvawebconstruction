import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load the root .env first, then an app-level .env if present (later files do not override).
for (const file of ['.env', '../../.env']) {
  if (existsSync(file)) config({ path: file, quiet: true });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` does not need a database, so fall back to a dummy URL when unset.
    url: process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/placeholder',
  },
});
