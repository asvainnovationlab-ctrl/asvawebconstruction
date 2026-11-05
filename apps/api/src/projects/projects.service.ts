import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ListQuery, projectInputSchema, ReorderInput } from '@asva/shared';
import type { z } from 'zod';
import { ContentStatus, type Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { CrudService, type CrudOptions } from '../common/crud.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { publicationAction, publiclyVisible, resolvePublicationOrThrow } from '../common/publication.js';
import { sanitizeRichText } from '../common/sanitize.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { MEDIA_SELECT, MediaUrlService, type MediaRef } from '../media/media-url.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedirectsService } from '../redirects/redirects.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

type ProjectInput = z.output<typeof projectInputSchema>;

const include = {
  featuredImage: { select: MEDIA_SELECT },
  category: { select: { id: true, name: true, slug: true } },
  technologies: { include: { technology: { select: { id: true, name: true, slug: true, category: true } } } },
  gallery: { orderBy: { displayOrder: 'asc' as const }, include: { media: { select: MEDIA_SELECT } } },
} satisfies Prisma.ProjectInclude;

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  isFeatured: true,
  isSample: true,
  completedAt: true,
  featuredImage: { select: MEDIA_SELECT },
  category: { select: { id: true, name: true, slug: true } },
  technologies: { select: { technology: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectCategoriesService extends CrudService {
  protected readonly options: CrudOptions = {
    model: 'projectCategory',
    entity: 'project_category',
    label: 'Project category',
    tags: ['projects'],
    searchFields: ['name'],
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { projects: true } } },
  };

  async listPublic() {
    return this.prisma.projectCategory.findMany({
      where: { projects: { some: publiclyVisible() } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, description: true },
    });
  }
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
    private readonly redirects: RedirectsService,
    private readonly mediaUrl: MediaUrlService,
  ) {}

  private card<T extends { featuredImage: MediaRef | null; technologies: { technology: unknown }[] }>(p: T) {
    return { ...p, featuredImage: this.mediaUrl.dto(p.featuredImage), technologies: p.technologies.map((t) => t.technology) };
  }

  private full<T extends { featuredImage: MediaRef | null; technologies: { technology: unknown }[]; gallery: { id: string; caption: string | null; media: MediaRef }[] }>(p: T) {
    return {
      ...p,
      featuredImage: this.mediaUrl.dto(p.featuredImage),
      technologies: p.technologies.map((t) => t.technology),
      gallery: p.gallery.map((g) => ({ id: g.id, caption: g.caption, media: this.mediaUrl.dto(g.media) })).filter((g) => g.media),
    };
  }

  // ------------------------------------------------------------ public

  async listPublic(query: ListQuery & { category?: string; technology?: string; featured?: 'true' | 'false' }) {
    const where: Prisma.ProjectWhereInput = {
      ...publiclyVisible(),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.technology ? { technologies: { some: { technology: { slug: query.technology } } } } : {}),
      ...(query.featured ? { isFeatured: query.featured === 'true' } : {}),
      ...searchFilter(query.q, ['title', 'summary', 'clientName']),
    };
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({ where, select: cardSelect, orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }, { completedAt: 'desc' }], ...pageArgs(query) }),
      this.prisma.project.count({ where }),
    ]);
    return paginate(items.map((p) => this.card(p)), total, query.page, query.pageSize);
  }

  async getPublic(slug: string) {
    const project = await this.prisma.project.findFirst({ where: { slug, ...publiclyVisible() }, include });
    if (!project) throw new NotFoundException('Project not found');
    const techIds = project.technologies.map((t) => t.technology.id);
    const related = await this.prisma.project.findMany({
      where: {
        ...publiclyVisible(),
        id: { not: project.id },
        OR: [{ categoryId: project.categoryId ?? undefined }, { technologies: { some: { technologyId: { in: techIds } } } }],
      },
      select: cardSelect,
      take: 3,
      orderBy: { publishedAt: 'desc' },
    });
    return { ...this.full(project), related: related.map((p) => this.card(p)) };
  }

  // ------------------------------------------------------------ admin

  async list(query: ListQuery & { status?: ContentStatus }) {
    const where = { ...(query.status ? { status: query.status } : {}), ...searchFilter(query.q, ['title', 'slug', 'clientName']) };
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { updatedAt: 'desc' }],
        ...pageArgs(query),
        select: { id: true, title: true, slug: true, status: true, isFeatured: true, isSample: true, publishedAt: true, displayOrder: true, updatedAt: true, category: { select: { name: true } } },
      }),
      this.prisma.project.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async get(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id }, include });
    if (!project) throw new NotFoundException('Project not found');
    return {
      ...this.full(project),
      technologyIds: project.technologies.map((t) => t.technology.id),
      galleryInput: project.gallery.map((g) => ({ mediaId: g.mediaId, caption: g.caption, url: this.mediaUrl.dto(g.media)?.url ?? null })),
    };
  }

  private data(input: ProjectInput) {
    return {
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      caseStudy: sanitizeRichText(input.caseStudy),
      clientName: input.clientName,
      featuredImageId: input.featuredImageId,
      categoryId: input.categoryId,
      objectives: input.objectives,
      challenges: input.challenges,
      solution: input.solution,
      results: input.results,
      projectUrl: input.projectUrl,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      isFeatured: input.isFeatured,
      isSample: input.isSample,
      displayOrder: input.displayOrder,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  async create(input: ProjectInput, actor: Principal, meta: RequestMeta) {
    const publication = resolvePublicationOrThrow(input, null);
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          ...this.data(input),
          ...publication,
          technologies: { create: input.technologyIds.map((technologyId) => ({ technologyId })) },
          gallery: { create: input.gallery.map((g, i) => ({ mediaId: g.mediaId, caption: g.caption, displayOrder: i })) },
        },
      });
      await this.audit.log({ actor, action: 'project.created', targetType: 'Project', targetId: created.id, metadata: { slug: created.slug, status: created.status }, meta }, tx);
      return created;
    });
    this.revalidation.revalidate('projects');
    return this.get(project.id);
  }

  async update(id: string, input: ProjectInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');
    const publication = resolvePublicationOrThrow(input, existing.publishedAt);
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data: { ...this.data(input), ...publication } });
      await tx.projectTechnology.deleteMany({ where: { projectId: id } });
      if (input.technologyIds.length) await tx.projectTechnology.createMany({ data: input.technologyIds.map((technologyId) => ({ projectId: id, technologyId })) });
      await tx.projectImage.deleteMany({ where: { projectId: id } });
      if (input.gallery.length) await tx.projectImage.createMany({ data: input.gallery.map((g, i) => ({ projectId: id, mediaId: g.mediaId, caption: g.caption, displayOrder: i })) });
      if (existing.slug !== input.slug && existing.publishedAt) await this.redirects.recordPathChange(tx, `/portfolio/${existing.slug}`, `/portfolio/${input.slug}`);
      const action = publicationAction(existing.status, publication.status);
      await this.audit.log({ actor, action: `project.${action ?? 'updated'}`, targetType: 'Project', targetId: id, metadata: { slug: input.slug, status: publication.status }, meta }, tx);
    });
    this.revalidation.revalidate('projects');
    return this.get(id);
  }

  async reorder(input: ReorderInput, actor: Principal, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) await tx.project.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } });
      await this.audit.log({ actor, action: 'project.reordered', targetType: 'Project', meta }, tx);
    });
    this.revalidation.revalidate('projects');
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.status === ContentStatus.PUBLISHED) throw new BadRequestException({ code: 'UNPUBLISH_FIRST', message: 'Unpublish the project before deleting it.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.project.delete({ where: { id } });
      await this.audit.log({ actor, action: 'project.deleted', targetType: 'Project', targetId: id, metadata: { slug: project.slug, title: project.title }, meta }, tx);
    });
    this.revalidation.revalidate('projects');
  }
}
