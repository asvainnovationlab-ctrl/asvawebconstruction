import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { Principal, RequestMeta } from '../common/types.js';

export interface AuditEntry {
  actor?: Pick<Principal, 'id' | 'email'> | null;
  /** Used for unauthenticated events such as failed logins. */
  actorEmail?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  /** Context only — never passwords, tokens or full personal records. */
  metadata?: Record<string, unknown>;
  meta?: RequestMeta;
}

const FORBIDDEN_KEYS = /pass(word)?|token|secret|hash|cookie|authorization/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !FORBIDDEN_KEYS.test(key))
      .map(([key, v]) => [key, scrub(v, depth + 1)]),
  );
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Tx): Promise<void> {
    const db = tx ?? this.prisma;
    try {
      await db.auditLog.create({
        data: {
          actorId: entry.actor?.id ?? null,
          actorEmail: entry.actor?.email ?? entry.actorEmail ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          metadata: entry.metadata ? (scrub(entry.metadata) as Prisma.InputJsonValue) : Prisma.JsonNull,
          ipAddress: entry.meta?.ip ?? null,
          userAgent: entry.meta?.userAgent ?? null,
        },
      });
    } catch (error) {
      // Inside a transaction the failure must propagate so the whole operation rolls back.
      if (tx) throw error;
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}
