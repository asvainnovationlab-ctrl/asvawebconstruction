import { BadRequestException } from '@nestjs/common';
import { resolvePublication } from '@asva/shared';
import { ContentStatus } from '../generated/prisma/client.js';

/**
 * Prisma filter for publicly visible content. SCHEDULED items whose time has passed are
 * included so visibility never depends on the scheduler having run yet.
 */
export function publiclyVisible(now = new Date()) {
  return {
    status: { in: [ContentStatus.PUBLISHED, ContentStatus.SCHEDULED] },
    publishedAt: { lte: now },
  };
}

export function resolvePublicationOrThrow(
  requested: { status: string; publishedAt?: string | null },
  existingPublishedAt: Date | null,
): { status: ContentStatus; publishedAt: Date | null } {
  try {
    const result = resolvePublication(requested, existingPublishedAt);
    return { status: ContentStatus[result.status], publishedAt: result.publishedAt };
  } catch (error) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: (error as Error).message,
      details: [{ path: 'publishedAt', message: (error as Error).message }],
    });
  }
}

/** Audit action name for a status change, or null when publication state did not change. */
export function publicationAction(before: ContentStatus | null, after: ContentStatus): string | null {
  if (before === after) return null;
  if (after === ContentStatus.PUBLISHED) return 'published';
  if (after === ContentStatus.SCHEDULED) return 'scheduled';
  if (before === ContentStatus.PUBLISHED || before === ContentStatus.SCHEDULED) return 'unpublished';
  return null;
}
