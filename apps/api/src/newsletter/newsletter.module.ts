import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { LABELS, newsletterSubscribeSchema, newsletterTokenSchema, PERMISSIONS, subscriberQuerySchema, toCsv } from '@asva/shared';
import { z } from 'zod';
import { ENV, type Env } from '../config/env.js';
import { SubscriberStatus } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { signToken, verifySignedToken } from '../common/crypto.js';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { paginate, pageArgs, RawResponse, searchFilter, UTF8_BOM } from '../common/http.js';
import { SpamService } from '../common/spam.service.js';
import { requestMeta, type AppRequest, type Principal, type RequestMeta } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../email/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

class SubscribeDto extends createZodDto(newsletterSubscribeSchema) {}
class TokenDto extends createZodDto(newsletterTokenSchema) {}
class SubscriberQueryDto extends createZodDto(subscriberQuerySchema) {}
class SubscriberUpdateDto extends createZodDto(z.object({ status: z.literal('UNSUBSCRIBED') })) {}

const CONSENT_TEXT = 'I agree to receive occasional emails with news and insights. I can unsubscribe at any time.';
const CONFIRM = 'newsletter-confirm';
const UNSUBSCRIBE = 'newsletter-unsubscribe';

@Injectable()
export class NewsletterService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly spam: SpamService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  unsubscribeUrl(id: string) {
    return `${this.env.FRONTEND_URL}/newsletter/unsubscribe?token=${encodeURIComponent(signToken(this.env.TOKEN_HASH_SECRET, UNSUBSCRIBE, id))}`;
  }

  /**
   * Double opt-in. The response never reveals whether an address was already subscribed.
   * Marketing emails must only be sent to SUBSCRIBED (confirmed) addresses.
   */
  async subscribe(input: SubscribeDto, ip: string | null) {
    const verdict = await this.spam.check(input, ip);
    const message = this.email.configured
      ? 'Almost done! Please check your inbox and click the confirmation link.'
      : 'Thank you! Your subscription request has been recorded and is awaiting confirmation.';
    if (!verdict.ok) return { message };

    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email: input.email } });
    if (existing?.status === SubscriberStatus.SUBSCRIBED) return { message };
    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email: input.email },
      create: { email: input.email, status: SubscriberStatus.PENDING, consentText: CONSENT_TEXT, consentAt: new Date(), consentIpHash: this.spam.ipHash(ip), source: input.source ?? 'website' },
      update: { status: SubscriberStatus.PENDING, consentText: CONSENT_TEXT, consentAt: new Date(), consentIpHash: this.spam.ipHash(ip), unsubscribedAt: null },
    });
    const link = `${this.env.FRONTEND_URL}/newsletter/confirm?token=${encodeURIComponent(signToken(this.env.TOKEN_HASH_SECRET, CONFIRM, subscriber.id))}`;
    await this.notifications.newsletterConfirm(subscriber.email, link);
    return { message };
  }

  async confirm(token: string) {
    const id = verifySignedToken(this.env.TOKEN_HASH_SECRET, CONFIRM, token);
    const subscriber = id ? await this.prisma.newsletterSubscriber.findUnique({ where: { id } }) : null;
    if (!subscriber || subscriber.status === SubscriberStatus.UNSUBSCRIBED) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'This confirmation link is invalid or no longer active.' });
    }
    if (subscriber.status === SubscriberStatus.PENDING) {
      await this.prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { status: SubscriberStatus.SUBSCRIBED, confirmedAt: new Date() } });
    }
    return { message: 'Your subscription is confirmed. Thank you!' };
  }

  async unsubscribe(token: string) {
    const id = verifySignedToken(this.env.TOKEN_HASH_SECRET, UNSUBSCRIBE, token);
    const subscriber = id ? await this.prisma.newsletterSubscriber.findUnique({ where: { id } }) : null;
    if (!subscriber) throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'This unsubscribe link is invalid.' });
    if (subscriber.status !== SubscriberStatus.UNSUBSCRIBED) {
      await this.prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { status: SubscriberStatus.UNSUBSCRIBED, unsubscribedAt: new Date() } });
    }
    return { message: 'You have been unsubscribed and will not receive further newsletters.' };
  }

  async list(query: SubscriberQueryDto) {
    const where = { ...(query.status ? { status: query.status } : {}), ...searchFilter(query.q, ['email']) };
    const [items, total, counts] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: query.order }, ...pageArgs(query), omit: { consentIpHash: true } }),
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const page = paginate(items, total, query.page, query.pageSize);
    return Object.assign(page, { meta: { ...page.meta, statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) } });
  }

  async exportCsv(status: SubscriberStatus | undefined, actor: Principal, meta: RequestMeta) {
    const rows = await this.prisma.newsletterSubscriber.findMany({ where: { status: status ?? SubscriberStatus.SUBSCRIBED }, orderBy: { createdAt: 'asc' } });
    await this.audit.log({ actor, action: 'newsletter.exported', targetType: 'NewsletterSubscriber', metadata: { count: rows.length, status: status ?? 'SUBSCRIBED' }, meta });
    return toCsv(
      ['Email', 'Status', 'Consent given', 'Confirmed', 'Source', 'Unsubscribe URL'],
      rows.map((r) => [r.email, LABELS.subscriberStatus[r.status], r.consentAt, r.confirmedAt, r.source, this.unsubscribeUrl(r.id)]),
    );
  }

  async markUnsubscribed(id: string, actor: Principal, meta: RequestMeta) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!subscriber) throw new NotFoundException('Subscriber not found');
    await this.prisma.newsletterSubscriber.update({ where: { id }, data: { status: SubscriberStatus.UNSUBSCRIBED, unsubscribedAt: new Date() } });
    await this.audit.log({ actor, action: 'newsletter.unsubscribed_by_admin', targetType: 'NewsletterSubscriber', targetId: id, meta });
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!subscriber) throw new NotFoundException('Subscriber not found');
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    await this.audit.log({ actor, action: 'newsletter.deleted', targetType: 'NewsletterSubscriber', targetId: id, meta });
  }
}

@ApiTags('Newsletter')
@Controller()
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Public()
  @Post('newsletter/subscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @ApiZodBody(SubscribeDto)
  @ApiOperation({ summary: 'Subscribe (double opt-in; consent is recorded)' })
  subscribe(@Body() body: SubscribeDto, @Req() req: AppRequest) {
    return this.newsletter.subscribe(body, req.ip ?? null);
  }

  @Public()
  @Post('newsletter/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @ApiZodBody(TokenDto)
  confirm(@Body() body: TokenDto) {
    return this.newsletter.confirm(body.token);
  }

  @Public()
  @Post('newsletter/unsubscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @ApiZodBody(TokenDto)
  unsubscribe(@Body() body: TokenDto) {
    return this.newsletter.unsubscribe(body.token);
  }

  @Get('admin/newsletter/subscribers')
  @RequirePermissions(PERMISSIONS.NEWSLETTER_READ)
  @ApiZodQuery(SubscriberQueryDto)
  list(@Query() query: SubscriberQueryDto) {
    return this.newsletter.list(query);
  }

  @Get('admin/newsletter/subscribers/export')
  @RequirePermissions(PERMISSIONS.NEWSLETTER_EXPORT)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Export subscribers (confirmed only by default) with unsubscribe links' })
  async export(@Query() query: SubscriberQueryDto, @CurrentUser() user: Principal, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return new RawResponse(UTF8_BOM + (await this.newsletter.exportCsv(query.status, user, requestMeta(req))));
  }

  @Patch('admin/newsletter/subscribers/:id')
  @RequirePermissions(PERMISSIONS.NEWSLETTER_MANAGE)
  @ApiZodBody(SubscriberUpdateDto)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() _body: SubscriberUpdateDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.newsletter.markUnsubscribed(id, user, requestMeta(req));
    return { updated: true };
  }

  @Delete('admin/newsletter/subscribers/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.NEWSLETTER_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.newsletter.remove(id, user, requestMeta(req));
  }
}

@Module({ providers: [NewsletterService], controllers: [NewsletterController] })
export class NewsletterModule {}
