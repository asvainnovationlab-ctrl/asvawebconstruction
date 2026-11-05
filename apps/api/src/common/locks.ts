import type { PrismaService, Tx } from '../prisma/prisma.service.js';

/** Stable advisory-lock keys, one per background job. */
export const LOCKS = {
  PUBLISH_SCHEDULED: 7_310_001,
  EMAIL_OUTBOX: 7_310_002,
  RETENTION: 7_310_003,
  TOKEN_CLEANUP: 7_310_004,
} as const;

/**
 * Runs `fn` only if this instance obtains the transaction-scoped advisory lock. With several API
 * replicas, exactly one runs each scheduled job; the others skip it.
 */
export async function withAdvisoryLock<T>(prisma: PrismaService, key: number, fn: (tx: Tx) => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn(tx);
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
