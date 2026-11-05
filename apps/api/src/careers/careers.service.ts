import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  APPLICANT_NOTIFIABLE_STATUSES,
  APPLICATION_TRANSITIONS,
  canTransitionApplication,
  LABELS,
  type ApplicationUpdateInput,
  type jobApplicationSchema,
  type jobInputSchema,
  type ListQuery,
} from '@asva/shared';
import type { z } from 'zod';
import { ApplicationStatus, JobStatus, MediaPurpose, MediaVisibility, type Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { sanitizeRichText } from '../common/sanitize.js';
import { SpamService } from '../common/spam.service.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { NotificationsService } from '../email/notifications.service.js';
import { MediaService, type UploadedFile } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { SettingsService } from '../settings/settings.service.js';

type JobInput = z.output<typeof jobInputSchema>;
type ApplicationInput = z.output<typeof jobApplicationSchema>;

const RECEIVED = { received: true, message: 'Thank you for applying! We have received your application and will be in touch if your profile matches.' };

/** Open vacancies whose deadline has not passed (deadline is inclusive of the whole day). */
function openJobsWhere(now = new Date()): Prisma.JobWhereInput {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  return { status: JobStatus.OPEN, publishedAt: { lte: now }, OR: [{ deadline: null }, { deadline: { gte: startOfToday } }] };
}

@Injectable()
export class CareersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spam: SpamService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly revalidation: RevalidationService,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------ public

  listOpen() {
    return this.prisma.job.findMany({
      where: openJobsWhere(),
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, slug: true, department: true, location: true, employmentType: true, workplaceType: true, summary: true, deadline: true, publishedAt: true },
    });
  }

  async getOpen(slug: string) {
    const job = await this.prisma.job.findFirst({ where: { slug, ...openJobsWhere() }, omit: { closedAt: true } });
    if (!job) throw new NotFoundException('This vacancy is not available.');
    return job;
  }

  async apply(jobId: string | null, input: ApplicationInput, file: UploadedFile | undefined, ip: string | null) {
    let job: { id: string; title: string } | null = null;
    if (jobId) {
      job = await this.prisma.job.findFirst({ where: { id: jobId, ...openJobsWhere() }, select: { id: true, title: true } });
      if (!job) throw new NotFoundException({ code: 'JOB_CLOSED', message: 'This vacancy is closed or no longer available.' });
    } else {
      const careers = await this.settings.getGroup('careers');
      if (!careers.acceptGeneralApplications) throw new BadRequestException({ code: 'NOT_ACCEPTING', message: 'General applications are not being accepted at the moment.' });
    }
    const verdict = await this.spam.check(input, ip);
    if (!verdict.ok) return RECEIVED;
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Please attach your CV / resume.', details: [{ path: 'resume', message: 'Required' }] });

    const recent = await this.prisma.jobApplication.findFirst({
      where: { email: input.email, jobId, createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
      select: { id: true },
    });
    this.spam.assertNotDuplicate(recent);

    const resume = await this.media.upload(file, { kind: 'resume', purpose: MediaPurpose.RESUME, visibility: MediaVisibility.PRIVATE });
    const application = await this.prisma.jobApplication.create({
      data: {
        jobId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        coverLetter: input.coverLetter,
        portfolioUrl: input.portfolioUrl,
        linkedinUrl: input.linkedinUrl,
        resumeId: resume.id,
        consentAt: new Date(),
        ipHash: this.spam.ipHash(ip),
      },
    });
    await this.notifications.applicationReceived({ ...application, jobTitle: job?.title ?? null });
    return RECEIVED;
  }

  // ------------------------------------------------------------ admin: jobs

  async listJobs(query: ListQuery & { status?: JobStatus }) {
    const where = { ...(query.status ? { status: query.status } : {}), ...searchFilter(query.q, ['title', 'department', 'location']) };
    const [items, total] = await Promise.all([
      this.prisma.job.findMany({ where, orderBy: { updatedAt: 'desc' }, ...pageArgs(query), include: { _count: { select: { applications: true } } } }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async getJob(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private jobData(input: JobInput, existing: { status: JobStatus; publishedAt: Date | null; closedAt: Date | null } | null) {
    const now = new Date();
    return {
      title: input.title,
      slug: input.slug,
      department: input.department,
      location: input.location,
      employmentType: input.employmentType,
      workplaceType: input.workplaceType,
      summary: input.summary,
      description: sanitizeRichText(input.description),
      salaryRange: input.salaryRange,
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: input.status,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      publishedAt: input.status === JobStatus.OPEN ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null),
      closedAt: input.status === JobStatus.CLOSED || input.status === JobStatus.ARCHIVED ? (existing?.closedAt ?? now) : null,
    };
  }

  async createJob(input: JobInput, actor: Principal, meta: RequestMeta) {
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({ data: this.jobData(input, null) });
      await this.audit.log({ actor, action: 'job.created', targetType: 'Job', targetId: created.id, metadata: { slug: created.slug, status: created.status }, meta }, tx);
      return created;
    });
    this.revalidation.revalidate('jobs');
    return this.getJob(job.id);
  }

  async updateJob(id: string, input: JobInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.job.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id }, data: this.jobData(input, existing) });
      const action = existing.status === input.status ? 'updated' : { OPEN: 'published', CLOSED: 'closed', ARCHIVED: 'archived', DRAFT: 'unpublished' }[input.status];
      await this.audit.log({ actor, action: `job.${action}`, targetType: 'Job', targetId: id, metadata: { slug: input.slug, status: input.status }, meta }, tx);
    });
    this.revalidation.revalidate('jobs');
    return this.getJob(id);
  }

  async removeJob(id: string, actor: Principal, meta: RequestMeta) {
    const job = await this.getJob(id);
    if (job._count.applications > 0) {
      throw new BadRequestException({ code: 'HAS_APPLICATIONS', message: 'This vacancy has applications. Archive it instead of deleting it.' });
    }
    await this.prisma.job.delete({ where: { id } });
    await this.audit.log({ actor, action: 'job.deleted', targetType: 'Job', targetId: id, metadata: { slug: job.slug }, meta });
    this.revalidation.revalidate('jobs');
  }

  // ------------------------------------------------------------ admin: applications

  async listApplications(query: ListQuery & { status?: ApplicationStatus; jobId?: string }) {
    const where: Prisma.JobApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobId === 'general' ? { jobId: null } : query.jobId ? { jobId: query.jobId } : {}),
      ...searchFilter(query.q, ['fullName', 'email', 'phone']),
    };
    const [items, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where,
        orderBy: { createdAt: query.order },
        ...pageArgs(query),
        select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true, job: { select: { id: true, title: true } }, resumeId: true },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);
    return paginate(items.map(({ resumeId, ...a }) => ({ ...a, hasResume: Boolean(resumeId) })), total, query.page, query.pageSize);
  }

  async getApplication(id: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      omit: { ipHash: true },
      include: { job: { select: { id: true, title: true, slug: true } }, resume: { select: { id: true, originalName: true, mimeType: true, size: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    return { ...application, allowedTransitions: APPLICATION_TRANSITIONS[application.status], notifiableStatuses: APPLICANT_NOTIFIABLE_STATUSES };
  }

  async updateApplication(id: string, input: ApplicationUpdateInput & { notifyApplicant: boolean }, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.jobApplication.findUnique({ where: { id }, include: { job: { select: { title: true } } } });
    if (!existing) throw new NotFoundException('Application not found');
    if (input.status && !canTransitionApplication(existing.status, input.status)) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: `An application cannot move from ${LABELS.applicationStatus[existing.status]} to ${LABELS.applicationStatus[input.status]}.`,
      });
    }
    const statusChanged = Boolean(input.status && input.status !== existing.status);
    await this.prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({
        where: { id },
        data: {
          ...(statusChanged ? { status: input.status, statusChangedAt: new Date() } : {}),
          ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
        },
      });
      if (statusChanged) {
        await this.audit.log(
          { actor, action: 'application.status_changed', targetType: 'JobApplication', targetId: id, metadata: { from: existing.status, to: input.status, notified: input.notifyApplicant }, meta },
          tx,
        );
      }
    });
    if (statusChanged && input.notifyApplicant && APPLICANT_NOTIFIABLE_STATUSES.includes(input.status!)) {
      await this.notifications.applicationStatusChanged({ fullName: existing.fullName, email: existing.email, jobTitle: existing.job?.title ?? null, status: input.status! });
    }
    return this.getApplication(id);
  }

  async resume(id: string, actor: Principal, meta: RequestMeta) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id }, include: { resume: true } });
    if (!application?.resume) throw new NotFoundException('Resume not found');
    await this.audit.log({ actor, action: 'application.resume_downloaded', targetType: 'JobApplication', targetId: id, meta });
    return application.resume;
  }

  async removeApplication(id: string, actor: Principal, meta: RequestMeta) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id }, include: { resume: true } });
    if (!application) throw new NotFoundException('Application not found');
    await this.prisma.jobApplication.delete({ where: { id } });
    if (application.resume) await this.media.deleteAsset(application.resume);
    await this.audit.log({ actor, action: 'application.deleted', targetType: 'JobApplication', targetId: id, meta });
  }
}
