import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ENV, type Env } from '../config/env.js';
import { ApplicationStatus, EmailStatus, LeadStatus } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { LOCKS, withAdvisoryLock } from '../common/locks.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const days = (n: number) => new Date(Date.now() - n * 86_400_000);

/**
 * Personal-data retention policy (all periods configurable via environment variables):
 * - archived contact submissions: RETENTION_CONTACT_DAYS after archiving
 * - archived / lost leads: RETENTION_INQUIRY_DAYS after their last update (attachments deleted too)
 * - rejected / withdrawn applications: RETENTION_APPLICATION_DAYS after the status change (resumes deleted)
 * - audit logs: RETENTION_AUDIT_DAYS; delivered email bodies: RETENTION_EMAIL_DAYS
 * - expired sessions and auth tokens: hourly
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'data-retention', disabled: process.env.SCHEDULER_ENABLED === 'false' })
  async purge() {
    const result = await withAdvisoryLock(this.prisma, LOCKS.RETENTION, async (tx) => {
      const contact = await tx.contactSubmission.deleteMany({ where: { isArchived: true, archivedAt: { lt: days(this.env.RETENTION_CONTACT_DAYS) } } });

      const inquiries = await tx.projectInquiry.findMany({
        where: { status: { in: [LeadStatus.ARCHIVED, LeadStatus.LOST] }, updatedAt: { lt: days(this.env.RETENTION_INQUIRY_DAYS) } },
        select: { id: true, attachment: { select: { id: true, storageKey: true } } },
      });
      await tx.projectInquiry.deleteMany({ where: { id: { in: inquiries.map((i) => i.id) } } });

      const applications = await tx.jobApplication.findMany({
        where: { status: { in: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] }, statusChangedAt: { lt: days(this.env.RETENTION_APPLICATION_DAYS) } },
        select: { id: true, resume: { select: { id: true, storageKey: true } } },
      });
      await tx.jobApplication.deleteMany({ where: { id: { in: applications.map((a) => a.id) } } });

      const audit = await tx.auditLog.deleteMany({ where: { createdAt: { lt: days(this.env.RETENTION_AUDIT_DAYS) } } });
      const emails = await tx.emailMessage.deleteMany({ where: { status: { not: EmailStatus.PENDING }, createdAt: { lt: days(this.env.RETENTION_EMAIL_DAYS) } } });

      return {
        files: [...inquiries.map((i) => i.attachment), ...applications.map((a) => a.resume)].filter((f): f is { id: string; storageKey: string } => Boolean(f)),
        counts: { contact: contact.count, inquiries: inquiries.length, applications: applications.length, audit: audit.count, emails: emails.count },
      };
    });
    if (!result) return null;
    for (const file of result.files) await this.media.deleteAsset(file).catch((err: unknown) => this.logger.warn({ err, id: file.id }, 'Could not delete file during retention purge'));
    if (Object.values(result.counts).some(Boolean)) {
      await this.audit.log({ actorEmail: 'system:retention', action: 'retention.purged', metadata: result.counts });
      this.logger.log(result.counts, 'Retention purge complete');
    }
    return result.counts;
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'token-cleanup', disabled: process.env.SCHEDULER_ENABLED === 'false' })
  async cleanupTokens() {
    await withAdvisoryLock(this.prisma, LOCKS.TOKEN_CLEANUP, async (tx) => {
      const cutoff = days(1);
      await tx.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] } });
      await tx.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] } });
    });
  }
}
