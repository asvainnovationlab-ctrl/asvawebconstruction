import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV, isEmailConfigured, type Env } from '../config/env.js';
import { EmailStatus } from '../generated/prisma/client.js';
import { LOCKS, withAdvisoryLock } from '../common/locks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RenderedEmail } from './templates.js';

const MAX_ATTEMPTS = 5;

/**
 * Outbox-based email delivery. `enqueue` stores the message; a scheduled worker sends it with
 * exponential back-off. When SMTP is not configured, messages are stored as SKIPPED and a
 * warning is logged — nothing is ever reported as sent unless the SMTP server accepted it.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    if (!isEmailConfigured(this.env)) {
      this.logger.warn('SMTP is not configured (SMTP_HOST / EMAIL_FROM). Emails will be recorded as SKIPPED and not delivered.');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_SECURE,
      auth: this.env.SMTP_USER ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  get configured(): boolean {
    return this.transporter !== null;
  }

  async enqueue(to: string | string[], email: RenderedEmail, category: string): Promise<void> {
    const recipients = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))];
    if (!recipients.length) return;
    const status = this.configured ? EmailStatus.PENDING : EmailStatus.SKIPPED;
    await this.prisma.emailMessage.createMany({
      data: recipients.map((toAddress) => ({
        toAddress,
        subject: email.subject,
        html: email.html,
        text: email.text,
        category,
        status,
        lastError: this.configured ? null : 'SMTP not configured',
      })),
    });
    if (!this.configured) {
      this.logger.warn({ category, recipients: recipients.length }, 'Email not sent: SMTP is not configured');
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'email-outbox', disabled: process.env.SCHEDULER_ENABLED === 'false' })
  async processOutbox(): Promise<number> {
    if (!this.transporter) return 0;
    const transporter = this.transporter;
    const sent = await withAdvisoryLock(this.prisma, LOCKS.EMAIL_OUTBOX, async (tx) => {
      const batch = await tx.emailMessage.findMany({
        where: { status: EmailStatus.PENDING, nextAttemptAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      let count = 0;
      for (const message of batch) {
        try {
          await transporter.sendMail({
            from: this.env.EMAIL_FROM,
            replyTo: this.env.EMAIL_REPLY_TO,
            to: message.toAddress,
            subject: message.subject,
            html: message.html,
            text: message.text,
          });
          await tx.emailMessage.update({ where: { id: message.id }, data: { status: EmailStatus.SENT, sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
          count++;
        } catch (error) {
          const attempts = message.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          await tx.emailMessage.update({
            where: { id: message.id },
            data: {
              attempts,
              status: failed ? EmailStatus.FAILED : EmailStatus.PENDING,
              lastError: (error as Error).message.slice(0, 500),
              nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000),
            },
          });
          this.logger.error({ err: error, emailId: message.id, attempts, failed }, 'Email delivery failed');
        }
      }
      return count;
    });
    return sent ?? 0;
  }
}
