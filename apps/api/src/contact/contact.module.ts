import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { contactQuerySchema, contactSubmissionSchema, contactUpdateSchema, PERMISSIONS } from '@asva/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Public, RequirePermissions } from '../common/decorators.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { SpamService } from '../common/spam.service.js';
import { requestMeta, type AppRequest, type Principal, type RequestMeta } from '../common/types.js';
import { ApiZodBody, ApiZodQuery, createZodDto } from '../common/zod.js';
import { NotificationsService } from '../email/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

class ContactDto extends createZodDto(contactSubmissionSchema) {}
class ContactUpdateDto extends createZodDto(contactUpdateSchema) {}
class ContactQueryDto extends createZodDto(contactQuerySchema) {}
class BulkDto extends createZodDto(
  z.object({ ids: z.array(z.uuid()).min(1).max(200), action: z.enum(['read', 'unread', 'archive', 'unarchive', 'delete']) }),
) {}

const DUPLICATE_WINDOW_MS = 10 * 60_000;
const RECEIVED = { received: true, message: 'Thank you! Your message has been received. We will get back to you soon.' };

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spam: SpamService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(input: ContactDto, ip: string | null) {
    const verdict = await this.spam.check(input, ip);
    if (!verdict.ok) return RECEIVED; // bots get the same response but nothing is stored
    const contentHash = this.spam.contentHash(input.email, input.message);
    this.spam.assertNotDuplicate(
      await this.prisma.contactSubmission.findFirst({ where: { contentHash, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } }, select: { id: true } }),
    );
    const submission = await this.prisma.contactSubmission.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        subject: input.subject,
        message: input.message,
        consentAt: new Date(),
        ipHash: this.spam.ipHash(ip),
        contentHash,
      },
    });
    await this.notifications.contactReceived(submission);
    return RECEIVED;
  }

  async list(query: ContactQueryDto) {
    const status = {
      unread: { isArchived: false, isRead: false },
      read: { isArchived: false, isRead: true },
      archived: { isArchived: true },
      active: { isArchived: false },
    }[query.status];
    const where = { ...status, ...searchFilter(query.q, ['name', 'email', 'company', 'subject', 'message']) };
    const [items, total, unread] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: query.order },
        ...pageArgs(query),
        select: { id: true, name: true, email: true, company: true, subject: true, message: true, isRead: true, isArchived: true, createdAt: true },
      }),
      this.prisma.contactSubmission.count({ where }),
      this.prisma.contactSubmission.count({ where: { isRead: false, isArchived: false } }),
    ]);
    const page = paginate(items.map((i) => ({ ...i, message: i.message.slice(0, 160) })), total, query.page, query.pageSize);
    return Object.assign(page, { meta: { ...page.meta, unread } });
  }

  async get(id: string) {
    const item = await this.prisma.contactSubmission.findUnique({ where: { id }, omit: { ipHash: true, contentHash: true } });
    if (!item) throw new NotFoundException('Submission not found');
    return item;
  }

  async update(id: string, input: ContactUpdateDto, actor: Principal, meta: RequestMeta) {
    const existing = await this.get(id);
    const now = new Date();
    const updated = await this.prisma.contactSubmission.update({
      where: { id },
      data: {
        ...(input.isRead !== undefined ? { isRead: input.isRead, readAt: input.isRead ? (existing.readAt ?? now) : null } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived, archivedAt: input.isArchived ? now : null } : {}),
        ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
      },
      omit: { ipHash: true, contentHash: true },
    });
    if (input.isArchived !== undefined && input.isArchived !== existing.isArchived) {
      await this.audit.log({ actor, action: input.isArchived ? 'contact.archived' : 'contact.unarchived', targetType: 'ContactSubmission', targetId: id, meta });
    }
    return updated;
  }

  async bulk(input: BulkDto, actor: Principal, meta: RequestMeta) {
    const where = { id: { in: input.ids } };
    const now = new Date();
    const result =
      input.action === 'delete'
        ? await this.prisma.contactSubmission.deleteMany({ where })
        : await this.prisma.contactSubmission.updateMany({
            where,
            data: {
              read: { isRead: true, readAt: now },
              unread: { isRead: false, readAt: null },
              archive: { isArchived: true, archivedAt: now },
              unarchive: { isArchived: false, archivedAt: null },
            }[input.action],
          });
    await this.audit.log({ actor, action: `contact.bulk_${input.action}`, targetType: 'ContactSubmission', metadata: { count: result.count }, meta });
    return { affected: result.count };
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    await this.get(id);
    await this.prisma.contactSubmission.delete({ where: { id } });
    await this.audit.log({ actor, action: 'contact.deleted', targetType: 'ContactSubmission', targetId: id, meta });
  }
}

@ApiTags('Contact')
@Controller()
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Post('contact')
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @ApiZodBody(ContactDto)
  @ApiOperation({ summary: 'Submit the contact form (stored even if email delivery is unavailable)' })
  submit(@Body() body: ContactDto, @Req() req: AppRequest) {
    return this.contact.submit(body, req.ip ?? null);
  }

  @Get('admin/contact-submissions')
  @RequirePermissions(PERMISSIONS.CONTACT_READ)
  @ApiZodQuery(ContactQueryDto)
  list(@Query() query: ContactQueryDto) {
    return this.contact.list(query);
  }

  @Get('admin/contact-submissions/:id')
  @RequirePermissions(PERMISSIONS.CONTACT_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.contact.get(id);
  }

  @Patch('admin/contact-submissions/:id')
  @RequirePermissions(PERMISSIONS.CONTACT_UPDATE)
  @ApiZodBody(ContactUpdateDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: ContactUpdateDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    return this.contact.update(id, body, user, requestMeta(req));
  }

  @Post('admin/contact-submissions/bulk')
  @RequirePermissions(PERMISSIONS.CONTACT_UPDATE)
  @ApiZodBody(BulkDto)
  @ApiOperation({ summary: 'Bulk mark read/unread, archive/unarchive or delete (delete requires contact.delete)' })
  async bulk(@Body() body: BulkDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    if (body.action === 'delete' && !user.permissions.includes(PERMISSIONS.CONTACT_DELETE)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission to delete submissions.' });
    }
    return this.contact.bulk(body, user, requestMeta(req));
  }

  @Delete('admin/contact-submissions/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.CONTACT_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.contact.remove(id, user, requestMeta(req));
  }
}

@Module({ providers: [ContactService], controllers: [ContactController] })
export class ContactModule {}
