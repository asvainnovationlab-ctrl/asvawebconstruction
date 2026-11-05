import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ListQuery, ReorderInput, serviceInputSchema } from '@asva/shared';
import type { z } from 'zod';
import { ContentStatus } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { publicationAction, publiclyVisible, resolvePublicationOrThrow } from '../common/publication.js';
import { sanitizeRichText } from '../common/sanitize.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { MEDIA_SELECT, MediaUrlService, type MediaRef } from '../media/media-url.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedirectsService } from '../redirects/redirects.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

type ServiceInput = z.output<typeof serviceInputSchema>;

const include = {
  coverImage: { select: MEDIA_SELECT },
  technologies: { include: { technology: { include: { logo: { select: MEDIA_SELECT } } } }, orderBy: { technology: { displayOrder: 'asc' as const } } },
};

type TechLink = { technology: { id: string; name: string; slug: string; category: string; logo: MediaRef | null } };

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
    private readonly redirects: RedirectsService,
    private readonly mediaUrl: MediaUrlService,
  ) {}

  private toDto<T extends { coverImage: MediaRef | null; technologies: TechLink[] }>(service: T) {
    return {
      ...service,
      coverImage: this.mediaUrl.dto(service.coverImage),
      technologies: service.technologies.map(({ technology: t }) => ({ id: t.id, name: t.name, slug: t.slug, category: t.category, logo: this.mediaUrl.dto(t.logo) })),
    };
  }

  async listPublic() {
    const services = await this.prisma.service.findMany({ where: publiclyVisible(), include, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
    return services.map((s) => this.toDto(s));
  }

  async getPublic(slug: string) {
    const service = await this.prisma.service.findFirst({ where: { slug, ...publiclyVisible() }, include });
    if (!service) throw new NotFoundException('Service not found');
    const related = await this.prisma.service.findMany({
      where: { ...publiclyVisible(), id: { not: service.id } },
      orderBy: { displayOrder: 'asc' },
      take: 3,
      select: { id: true, name: true, slug: true, shortDescription: true, icon: true },
    });
    return { ...this.toDto(service), related };
  }

  async list(query: ListQuery & { status?: ContentStatus }) {
    const where = { ...(query.status ? { status: query.status } : {}), ...searchFilter(query.q, ['name', 'slug', 'shortDescription']) };
    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        ...pageArgs(query),
        select: { id: true, name: true, slug: true, icon: true, status: true, publishedAt: true, displayOrder: true, updatedAt: true },
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async get(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id }, include });
    if (!service) throw new NotFoundException('Service not found');
    return { ...this.toDto(service), technologyIds: service.technologies.map((t) => t.technology.id) };
  }

  private data(input: ServiceInput) {
    return {
      name: input.name,
      slug: input.slug,
      shortDescription: input.shortDescription,
      description: sanitizeRichText(input.description),
      icon: input.icon,
      coverImageId: input.coverImageId,
      features: input.features,
      displayOrder: input.displayOrder,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  async create(input: ServiceInput, actor: Principal, meta: RequestMeta) {
    const publication = resolvePublicationOrThrow(input, null);
    const service = await this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: { ...this.data(input), ...publication, technologies: { create: input.technologyIds.map((technologyId) => ({ technologyId })) } },
      });
      await this.audit.log({ actor, action: 'service.created', targetType: 'Service', targetId: created.id, metadata: { slug: created.slug, status: created.status }, meta }, tx);
      return created;
    });
    this.revalidation.revalidate('services');
    return this.get(service.id);
  }

  async update(id: string, input: ServiceInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    const publication = resolvePublicationOrThrow(input, existing.publishedAt);
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data: { ...this.data(input), ...publication } });
      await tx.serviceTechnology.deleteMany({ where: { serviceId: id } });
      if (input.technologyIds.length) await tx.serviceTechnology.createMany({ data: input.technologyIds.map((technologyId) => ({ serviceId: id, technologyId })) });
      if (existing.slug !== input.slug && existing.publishedAt) await this.redirects.recordPathChange(tx, `/services/${existing.slug}`, `/services/${input.slug}`);
      const action = publicationAction(existing.status, publication.status);
      await this.audit.log({ actor, action: `service.${action ?? 'updated'}`, targetType: 'Service', targetId: id, metadata: { slug: input.slug, status: publication.status }, meta }, tx);
    });
    this.revalidation.revalidate('services');
    return this.get(id);
  }

  async reorder(input: ReorderInput, actor: Principal, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) await tx.service.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } });
      await this.audit.log({ actor, action: 'service.reordered', targetType: 'Service', metadata: { count: input.items.length }, meta }, tx);
    });
    this.revalidation.revalidate('services');
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    if (service.status === ContentStatus.PUBLISHED) throw new BadRequestException({ code: 'UNPUBLISH_FIRST', message: 'Unpublish the service before deleting it.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.service.delete({ where: { id } });
      await this.audit.log({ actor, action: 'service.deleted', targetType: 'Service', targetId: id, metadata: { slug: service.slug, name: service.name }, meta }, tx);
    });
    this.revalidation.revalidate('services');
  }
}
