import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isReservedSlug, pageInputSchema, type ListQuery } from '@asva/shared';
import type { z } from 'zod';
import { ContentStatus } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { publicationAction, publiclyVisible, resolvePublicationOrThrow } from '../common/publication.js';
import { sanitizeRichText } from '../common/sanitize.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { MEDIA_SELECT, MediaUrlService } from '../media/media-url.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedirectsService } from '../redirects/redirects.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

type PageInput = z.output<typeof pageInputSchema>;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
    private readonly redirects: RedirectsService,
    private readonly mediaUrl: MediaUrlService,
  ) {}

  // ------------------------------------------------------------ public

  async listPublic() {
    return this.prisma.page.findMany({
      where: { ...publiclyVisible(), noIndex: false },
      select: { slug: true, title: true, updatedAt: true },
      orderBy: { title: 'asc' },
    });
  }

  async getPublic(slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, ...publiclyVisible() },
      include: { featuredImage: { select: MEDIA_SELECT } },
    });
    if (!page) throw new NotFoundException('Page not found');
    return this.toPublic(page);
  }

  toPublic(page: { featuredImage: Parameters<MediaUrlService['dto']>[0] } & Record<string, unknown>) {
    const { featuredImage, featuredImageId: _f, isSystem: _s, ...rest } = page;
    return { ...rest, featuredImage: this.mediaUrl.dto(featuredImage) };
  }

  // ------------------------------------------------------------ admin

  async list(query: ListQuery & { status?: ContentStatus }) {
    const where = { ...(query.status ? { status: query.status } : {}), ...searchFilter(query.q, ['title', 'slug']) };
    const [items, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...pageArgs(query),
        select: { id: true, title: true, slug: true, status: true, publishedAt: true, isSystem: true, noIndex: true, updatedAt: true },
      }),
      this.prisma.page.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async get(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: {
        featuredImage: { select: MEDIA_SELECT },
        revisions: { orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, title: true, note: true, createdAt: true, createdBy: { select: { name: true } } } },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    return { ...page, featuredImage: this.mediaUrl.dto(page.featuredImage) };
  }

  async create(input: PageInput, actor: Principal, meta: RequestMeta) {
    this.assertSlugAllowed(input.slug);
    const publication = resolvePublicationOrThrow(input, null);
    const content = sanitizeRichText(input.content);
    const page = await this.prisma.$transaction(async (tx) => {
      const created = await tx.page.create({
        data: {
          title: input.title,
          slug: input.slug,
          excerpt: input.excerpt,
          content,
          featuredImageId: input.featuredImageId,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          noIndex: input.noIndex,
          ...publication,
        },
      });
      await tx.pageRevision.create({ data: { pageId: created.id, title: created.title, excerpt: created.excerpt, content, note: input.revisionNote ?? 'Created', createdById: actor.id } });
      await this.audit.log({ actor, action: 'page.created', targetType: 'Page', targetId: created.id, metadata: { slug: created.slug, status: created.status }, meta }, tx);
      return created;
    });
    this.revalidation.revalidate('pages');
    return this.get(page.id);
  }

  async update(id: string, input: PageInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.page.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page not found');
    if (existing.isSystem && input.slug !== existing.slug) {
      throw new BadRequestException({ code: 'SYSTEM_PAGE', message: 'The URL of a system page cannot be changed.' });
    }
    this.assertSlugAllowed(input.slug);
    const publication = resolvePublicationOrThrow(input, existing.publishedAt);
    const content = sanitizeRichText(input.content);

    await this.prisma.$transaction(async (tx) => {
      await tx.page.update({
        where: { id },
        data: {
          title: input.title,
          slug: input.slug,
          excerpt: input.excerpt,
          content,
          featuredImageId: input.featuredImageId,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          noIndex: input.noIndex,
          ...publication,
        },
      });
      if (content !== existing.content || input.title !== existing.title || input.excerpt !== existing.excerpt) {
        await tx.pageRevision.create({ data: { pageId: id, title: input.title, excerpt: input.excerpt, content, note: input.revisionNote ?? null, createdById: actor.id } });
      }
      if (existing.slug !== input.slug && existing.publishedAt) {
        await this.redirects.recordPathChange(tx, `/${existing.slug}`, `/${input.slug}`);
      }
      const action = publicationAction(existing.status, publication.status);
      await this.audit.log({ actor, action: action ? `page.${action}` : 'page.updated', targetType: 'Page', targetId: id, metadata: { slug: input.slug, status: publication.status }, meta }, tx);
    });
    this.revalidation.revalidate('pages');
    return this.get(id);
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    if (page.isSystem) throw new BadRequestException({ code: 'SYSTEM_PAGE', message: 'System pages such as legal pages cannot be deleted. Unpublish it instead.' });
    if (page.status === ContentStatus.PUBLISHED) {
      throw new BadRequestException({ code: 'UNPUBLISH_FIRST', message: 'Unpublish the page before deleting it.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.page.delete({ where: { id } });
      await this.audit.log({ actor, action: 'page.deleted', targetType: 'Page', targetId: id, metadata: { slug: page.slug, title: page.title }, meta }, tx);
    });
    this.revalidation.revalidate('pages');
  }

  async getRevision(pageId: string, revisionId: string) {
    const revision = await this.prisma.pageRevision.findFirst({ where: { id: revisionId, pageId } });
    if (!revision) throw new NotFoundException('Revision not found');
    return revision;
  }

  async restoreRevision(pageId: string, revisionId: string, actor: Principal, meta: RequestMeta) {
    const revision = await this.getRevision(pageId, revisionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.page.update({ where: { id: pageId }, data: { title: revision.title, excerpt: revision.excerpt, content: revision.content } });
      await tx.pageRevision.create({
        data: { pageId, title: revision.title, excerpt: revision.excerpt, content: revision.content, note: `Restored revision from ${revision.createdAt.toISOString()}`, createdById: actor.id },
      });
      await this.audit.log({ actor, action: 'page.revision_restored', targetType: 'Page', targetId: pageId, metadata: { revisionId }, meta }, tx);
    });
    this.revalidation.revalidate('pages');
    return this.get(pageId);
  }

  private assertSlugAllowed(slug: string) {
    if (isReservedSlug(slug)) {
      throw new ConflictException({ code: 'RESERVED_SLUG', message: `“${slug}” is reserved by the website and cannot be used for a page.`, details: [{ path: 'slug', message: 'Reserved URL' }] });
    }
  }
}
