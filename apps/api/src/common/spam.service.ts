import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { hashIp, sha256 } from './crypto.js';

export interface SpamFields {
  website?: string;
  formStartedAt?: number;
  turnstileToken?: string;
}

export type SpamVerdict = { ok: true } | { ok: false; reason: 'honeypot' };

/**
 * Layered bot protection for public forms: honeypot field, minimum fill time, optional
 * Cloudflare Turnstile verification and duplicate-content detection. Rate limiting is applied
 * separately by the throttler on each public form endpoint.
 */
@Injectable()
export class SpamService {
  private readonly logger = new Logger(SpamService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  async check(fields: SpamFields, ip: string | null): Promise<SpamVerdict> {
    if (fields.website && fields.website.trim() !== '') {
      this.logger.warn({ ipHash: this.ipHash(ip) }, 'Honeypot triggered; submission discarded');
      return { ok: false, reason: 'honeypot' };
    }
    if (fields.formStartedAt) {
      const elapsed = (Date.now() - fields.formStartedAt) / 1000;
      if (elapsed >= 0 && elapsed < this.env.FORM_MIN_FILL_SECONDS) {
        throw new BadRequestException({ code: 'SUBMITTED_TOO_FAST', message: 'That was quick! Please wait a few seconds and submit again.' });
      }
    }
    if (this.env.TURNSTILE_SECRET_KEY) await this.verifyTurnstile(fields.turnstileToken, ip);
    return { ok: true };
  }

  ipHash(ip: string | null): string | null {
    return hashIp(this.env.TOKEN_HASH_SECRET, ip);
  }

  contentHash(...parts: (string | null | undefined)[]): string {
    return sha256(parts.map((p) => (p ?? '').trim().toLowerCase().replace(/\s+/g, ' ')).join('\u0000'));
  }

  /** Throws 409 if an identical submission was received within the window. */
  assertNotDuplicate(existing: unknown): void {
    if (existing) {
      throw new ConflictException({ code: 'DUPLICATE_SUBMISSION', message: 'We have already received this message. Our team will be in touch soon.' });
    }
  }

  private async verifyTurnstile(token: string | undefined, ip: string | null): Promise<void> {
    if (!token) throw new BadRequestException({ code: 'CAPTCHA_REQUIRED', message: 'Please complete the verification challenge.' });
    try {
      const body = new URLSearchParams({ secret: this.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) });
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as { success?: boolean };
      if (!data.success) throw new Error('rejected');
    } catch {
      throw new BadRequestException({ code: 'CAPTCHA_FAILED', message: 'Verification failed. Please refresh the page and try again.' });
    }
  }
}
