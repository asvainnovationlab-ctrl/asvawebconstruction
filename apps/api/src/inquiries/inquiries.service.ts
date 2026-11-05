import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { canTransitionLead, LABELS, LEAD_TRANSITIONS, toCsv, type InquiryUpdateInput, type projectInquirySchema } from '@asva/shared';
import type { z } from 'zod';
import { InquiryActivityType, LeadStatus, MediaPurpose, MediaVisibility, type Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { dateRange } from '../common/multipart.js';
import { SpamService } from '../common/spam.service.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { NotificationsService } from '../email/notifications.service.js';
import { MediaService, type UploadedFile } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type InquiryInput = z.output<typeof projectInquirySchema>;

export interface InquiryQuery {
  page: number;
  pageSize: number;
  q?: string;
  order: 'asc' | 'desc';
  status?: LeadStatus;
  assignedToId?: string;
  from?: string;
  to?: string;
}

const DUPLICATE_WINDOW_MS = 10 * 60_000;
const RECEIVED = { received: true, message: 'Thank you! Your project inquiry has been received. Our team will contact you shortly.' };
const ATTACHMENT_SELECT = { id: true, originalName: true, mimeType: true, size: true } as const;

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spam: SpamService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
  ) {}

  async submit(input: InquiryInput, file: UploadedFile | undefined, ip: string | null) {
    const verdict = await this.spam.check(input, ip);
    if (!verdict.ok) return RECEIVED;
    const contentHash = this.spam.contentHash(input.email, input.description);
    this.spam.assertNotDuplicate(
      await this.prisma.projectInquiry.findFirst({ where: { contentHash, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } }, select: { id: true } }),
    );
    const attachment = file
      ? await this.media.upload(file, { kind: 'attachment', purpose: MediaPurpose.INQUIRY_ATTACHMENT, visibility: MediaVisibility.PRIVATE })
      : null;
    const inquiry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectInquiry.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          companyName: input.companyName,
          projectType: input.projectType,
          description: input.description,
          hasExistingProduct: input.hasExistingProduct,
          existingUrl: input.existingUrl,
          budgetRange: input.budgetRange,
          timeline: input.timeline,
          preferredContact: input.preferredContact,
          attachmentId: attachment?.id,
          consentAt: new Date(),
          ipHash: this.spam.ipHash(ip),
          contentHash,
        },
      });
      await tx.inquiryActivity.create({ data: { inquiryId: created.id, type: InquiryActivityType.CREATED, toValue: LeadStatus.NEW } });
      return created;
    });
    await this.notifications.inquiryReceived({ ...inquiry, hasAttachment: Boolean(attachment) });
    return RECEIVED;
  }

  private where(query: Omit<InquiryQuery, 'page' | 'pageSize' | 'order'>): Prisma.ProjectInquiryWhereInput {
    return {
      ...(query.status ? { status: query.status } : { status: { not: LeadStatus.ARCHIVED } }),
      ...(query.assignedToId === 'unassigned' ? { assignedToId: null } : query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
      ...searchFilter(query.q, ['fullName', 'email', 'companyName', 'phone', 'description']),
    };
  }

  async list(query: InquiryQuery) {
    const where = this.where(query);
    const [items, total, counts] = await Promise.all([
      this.prisma.projectInquiry.findMany({
        where,
        orderBy: { createdAt: query.order },
        ...pageArgs(query),
        select: {
          id: true, fullName: true, email: true, phone: true, companyName: true, projectType: true, budgetRange: true,
          timeline: true, status: true, createdAt: true, assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.projectInquiry.count({ where }),
      this.prisma.projectInquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const page = paginate(items, total, query.page, query.pageSize);
    return Object.assign(page, { meta: { ...page.meta, statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) } });
  }

  async get(id: string) {
    const inquiry = await this.prisma.projectInquiry.findUnique({
      where: { id },
      omit: { ipHash: true, contentHash: true },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        attachment: { select: ATTACHMENT_SELECT },
        notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true } } } },
        activities: { orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { id: true, name: true } } } },
      },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    return { ...inquiry, allowedTransitions: LEAD_TRANSITIONS[inquiry.status] };
  }

  async update(id: string, input: InquiryUpdateInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.projectInquiry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Inquiry not found');

    if (input.status && !canTransitionLead(existing.status, input.status)) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: `A lead cannot move from ${LABELS.leadStatus[existing.status]} to ${LABELS.leadStatus[input.status]}.`,
      });
    }
    if (input.assignedToId) {
      const assignee = await this.prisma.adminUser.findFirst({
        where: { id: input.assignedToId, isActive: true, roles: { some: { role: { permissions: { some: { permission: { key: 'inquiries.read' } } } } } } },
      });
      if (!assignee) throw new BadRequestException({ code: 'INVALID_ASSIGNEE', message: 'Leads can only be assigned to active users with access to inquiries.' });
    }

    await this.prisma.$transaction(async (tx) => {
      const statusChanged = input.status && input.status !== existing.status;
      const assigneeChanged = input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId;
      await tx.projectInquiry.update({
        where: { id },
        data: {
          ...(statusChanged ? { status: input.status, archivedAt: input.status === LeadStatus.ARCHIVED ? new Date() : null } : {}),
          ...(assigneeChanged ? { assignedToId: input.assignedToId } : {}),
        },
      });
      if (statusChanged) {
        await tx.inquiryActivity.create({ data: { inquiryId: id, actorId: actor.id, type: InquiryActivityType.STATUS_CHANGED, fromValue: existing.status, toValue: input.status } });
        await this.audit.log({ actor, action: 'inquiry.status_changed', targetType: 'ProjectInquiry', targetId: id, metadata: { from: existing.status, to: input.status }, meta }, tx);
      }
      if (assigneeChanged) {
        await tx.inquiryActivity.create({ data: { inquiryId: id, actorId: actor.id, type: InquiryActivityType.ASSIGNED, fromValue: existing.assignedToId, toValue: input.assignedToId ?? null } });
        await this.audit.log({ actor, action: 'inquiry.assigned', targetType: 'ProjectInquiry', targetId: id, metadata: { to: input.assignedToId ?? null }, meta }, tx);
      }
    });
    return this.get(id);
  }

  async addNote(id: string, body: string, actor: Principal) {
    await this.prisma.projectInquiry.findUniqueOrThrow({ where: { id }, select: { id: true } }).catch(() => {
      throw new NotFoundException('Inquiry not found');
    });
    await this.prisma.$transaction([
      this.prisma.inquiryNote.create({ data: { inquiryId: id, authorId: actor.id, body } }),
      this.prisma.inquiryActivity.create({ data: { inquiryId: id, actorId: actor.id, type: InquiryActivityType.NOTE_ADDED } }),
    ]);
    return this.get(id);
  }

  async exportCsv(query: Omit<InquiryQuery, 'page' | 'pageSize'>, actor: Principal, meta: RequestMeta) {
    const rows = await this.prisma.projectInquiry.findMany({
      where: this.where(query),
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: { assignedTo: { select: { name: true } } },
    });
    await this.audit.log({ actor, action: 'inquiry.exported', targetType: 'ProjectInquiry', metadata: { count: rows.length, filters: { status: query.status, q: query.q, from: query.from, to: query.to } }, meta });
    return toCsv(
      ['Submitted', 'Name', 'Email', 'Phone', 'Company', 'Project type', 'Budget', 'Timeline', 'Preferred contact', 'Status', 'Assigned to', 'Existing product URL', 'Description'],
      rows.map((r) => [
        r.createdAt, r.fullName, r.email, r.phone, r.companyName, r.projectType, r.budgetRange, r.timeline,
        LABELS.preferredContact[r.preferredContact], LABELS.leadStatus[r.status], r.assignedTo?.name, r.existingUrl, r.description,
      ]),
    );
  }

  async attachment(id: string, actor: Principal, meta: RequestMeta) {
    const inquiry = await this.prisma.projectInquiry.findUnique({ where: { id }, include: { attachment: true } });
    if (!inquiry?.attachment) throw new NotFoundException('Attachment not found');
    await this.audit.log({ actor, action: 'inquiry.attachment_downloaded', targetType: 'ProjectInquiry', targetId: id, meta });
    return inquiry.attachment;
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const inquiry = await this.prisma.projectInquiry.findUnique({ where: { id }, include: { attachment: true } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.projectInquiry.delete({ where: { id } });
      await this.audit.log({ actor, action: 'inquiry.deleted', targetType: 'ProjectInquiry', targetId: id, meta }, tx);
    });
    if (inquiry.attachment) await this.media.deleteAsset(inquiry.attachment);
  }
}
