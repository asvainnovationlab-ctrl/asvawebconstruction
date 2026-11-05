import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import pg from 'pg';

/** Migrates the disposable test database, wipes it and seeds base data (roles, settings, pages). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/test/i.test(new URL(url).pathname)) {
    throw new Error('Set TEST_DATABASE_URL to a dedicated database whose name contains "test" (e.g. postgresql://postgres:postgres@localhost:5432/asva_test).');
  }
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`);
  if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await client.end();

  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env });
  rmSync('storage-test', { recursive: true, force: true });

  return () => rmSync('storage-test', { recursive: true, force: true });
}
