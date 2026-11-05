import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { estimateReadingTime, type blogPostInputSchema, type ListQuery } from '@asva/shared';
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

type PostInput = z.output<typeof blogPostInputSchema>;

const authorSelect = { id: true, name: true, slug: true, title: true, bio: true, avatar: { select: MEDIA_SELECT } } as const;

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  publishedAt: true,
  readingTimeMinutes: true,
  isFeatured: true,
  featuredImage: { select: MEDIA_SELECT },
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.BlogPostSelect;

@Injectable()
export class BlogCategoriesService extends CrudService {
  protected readonly options: CrudOptions = {
    model: 'blogCategory',
    entity: 'blog_category',
    label: 'Blog category',
    tags: ['blog'],
    searchFields: ['name'],
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: true } } },
  };
}

@Injectable()
export class BlogTagsService extends CrudService {
  protected readonly options: CrudOptions = {
    model: 'blogTag',
    entity: 'blog_tag',
    label: 'Blog tag',
    tags: ['blog'],
    searchFields: ['name'],
    orderBy: { name: 'asc' },
    include: { _count: { select: { posts: true } } },
  };
}

@Injectable()
export class AuthorsService extends CrudService {
  protected readonly options: CrudOptions = {
    model: 'author',
    entity: 'author',
    label: 'Author',
    tags: ['blog'],
    searchFields: ['name'],
    orderBy: { name: 'asc' },
    include: { avatar: { select: MEDIA_SELECT }, adminUser: { select: { id: true, name: true, email: true } }, _count: { select: { posts: true } } },
  };

  constructor(prisma: PrismaService, audit: AuditService, revalidation: RevalidationService, private readonly mediaUrl: MediaUrlService) {
    super(prisma, audit, revalidation);
  }

  protected override toDto(row: { avatar: MediaRef | null } & Record<string, unknown>) {
    return { ...row, avatar: this.mediaUrl.dto(row.avatar) };
  }
}

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
    private readonly redirects: RedirectsService,
    private readonly mediaUrl: MediaUrlService,
  ) {}

  private card<T extends { featuredImage: MediaRef | null }>(p: T) {
    return { ...p, featuredImage: this.mediaUrl.dto(p.featuredImage) };
  }

  // ------------------------------------------------------------ public

  async listPublic(query: ListQuery & { category?: string; tag?: string; author?: string; featured?: 'true' | 'false' }) {
    const where: Prisma.BlogPostWhereInput = {
      ...publiclyVisible(),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
      ...(query.author ? { author: { slug: query.author } } : {}),
      ...(query.featured ? { isFeatured: query.featured === 'true' } : {}),
      ...searchFilter(query.q, ['title', 'excerpt', 'content']),
    };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({ where, select: cardSelect, orderBy: { publishedAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.blogPost.count({ where }),
    ]);
    return paginate(items.map((p) => this.card(p)), total, query.page, query.pageSize);
  }

  async getPublic(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, ...publiclyVisible() },
      include: {
        featuredImage: { select: MEDIA_SELECT },
        category: { select: { id: true, name: true, slug: true } },
        author: { select: authorSelect },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    const related = await this.prisma.blogPost.findMany({
      where: {
        ...publiclyVisible(),
        id: { not: post.id },
        OR: [{ categoryId: post.categoryId ?? undefined }, { tags: { some: { tagId: { in: post.tags.map((t) => t.tag.id) } } } }],
      },
      select: cardSelect,
      orderBy: { publishedAt: 'desc' },
      take: 3,
    });
    return {
      ...post,
      featuredImage: this.mediaUrl.dto(post.featuredImage),
      author: post.author ? { ...post.author, avatar: this.mediaUrl.dto(post.author.avatar) } : null,
      tags: post.tags.map((t) => t.tag),
      related: related.map((p) => this.card(p)),
    };
  }

  async taxonomies() {
    const visible = { posts: { some: publiclyVisible() } };
    const [categories, tags] = await Promise.all([
      this.prisma.blogCategory.findMany({ where: visible, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, description: true } }),
      this.prisma.blogTag.findMany({ where: { posts: { some: { post: publiclyVisible() } } }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    ]);
    return { categories, tags };
  }

  // ------------------------------------------------------------ admin

  async list(query: ListQuery & { status?: ContentStatus }) {
    const where = { ...(query.status ? { status: query.status } : {}), ...searchFilter(query.q, ['title', 'slug']) };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...pageArgs(query),
        select: {
          id: true, title: true, slug: true, status: true, publishedAt: true, isFeatured: true, updatedAt: true,
          author: { select: { name: true } }, category: { select: { name: true } },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async get(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: {
        featuredImage: { select: MEDIA_SELECT },
        category: { select: { id: true, name: true, slug: true } },
        author: { select: authorSelect },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        revisions: { orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, title: true, note: true, createdAt: true, createdBy: { select: { name: true } } } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return {
      ...post,
      featuredImage: this.mediaUrl.dto(post.featuredImage),
      author: post.author ? { ...post.author, avatar: this.mediaUrl.dto(post.author.avatar) } : null,
      tags: post.tags.map((t) => t.tag),
      tagIds: post.tags.map((t) => t.tag.id),
    };
  }

  private data(input: PostInput, content: string) {
    return {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content,
      featuredImageId: input.featuredImageId,
      categoryId: input.categoryId,
      authorId: input.authorId,
      isFeatured: input.isFeatured,
      readingTimeMinutes: estimateReadingTime(content),
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  async create(input: PostInput, actor: Principal, meta: RequestMeta) {
    const publication = resolvePublicationOrThrow(input, null);
    const content = sanitizeRichText(input.content);
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.blogPost.create({
        data: { ...this.data(input, content), ...publication, tags: { create: input.tagIds.map((tagId) => ({ tagId })) } },
      });
      await tx.blogPostRevision.create({ data: { postId: created.id, title: created.title, excerpt: created.excerpt, content, note: input.revisionNote ?? 'Created', createdById: actor.id } });
      await this.audit.log({ actor, action: `blog_post.created`, targetType: 'BlogPost', targetId: created.id, metadata: { slug: created.slug, status: created.status }, meta }, tx);
      if (publication.status !== ContentStatus.DRAFT) {
        await this.audit.log({ actor, action: `blog_post.${publication.status === ContentStatus.SCHEDULED ? 'scheduled' : 'published'}`, targetType: 'BlogPost', targetId: created.id, meta }, tx);
      }
      return created;
    });
    this.revalidation.revalidate('blog');
    return this.get(post.id);
  }

  async update(id: string, input: PostInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post not found');
    const publication = resolvePublicationOrThrow(input, existing.publishedAt);
    const content = sanitizeRichText(input.content);
    await this.prisma.$transaction(async (tx) => {
      await tx.blogPost.update({ where: { id }, data: { ...this.data(input, content), ...publication } });
      await tx.blogPostTag.deleteMany({ where: { postId: id } });
      if (input.tagIds.length) await tx.blogPostTag.createMany({ data: input.tagIds.map((tagId) => ({ postId: id, tagId })) });
      if (content !== existing.content || input.title !== existing.title || input.excerpt !== existing.excerpt) {
        await tx.blogPostRevision.create({ data: { postId: id, title: input.title, excerpt: input.excerpt, content, note: input.revisionNote ?? null, createdById: actor.id } });
      }
      if (existing.slug !== input.slug && existing.publishedAt && existing.status !== ContentStatus.DRAFT) {
        await this.redirects.recordPathChange(tx, `/blog/${existing.slug}`, `/blog/${input.slug}`);
      }
      const action = publicationAction(existing.status, publication.status);
      await this.audit.log({ actor, action: `blog_post.${action ?? 'updated'}`, targetType: 'BlogPost', targetId: id, metadata: { slug: input.slug, status: publication.status }, meta }, tx);
    });
    this.revalidation.revalidate('blog');
    return this.get(id);
  }

  async remove(id: string, actor: Principal, meta: RequestMeta) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.status === ContentStatus.PUBLISHED) throw new BadRequestException({ code: 'UNPUBLISH_FIRST', message: 'Unpublish the post before deleting it.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.blogPost.delete({ where: { id } });
      await this.audit.log({ actor, action: 'blog_post.deleted', targetType: 'BlogPost', targetId: id, metadata: { slug: post.slug, title: post.title }, meta }, tx);
    });
    this.revalidation.revalidate('blog');
  }

  async getRevision(postId: string, revisionId: string) {
    const revision = await this.prisma.blogPostRevision.findFirst({ where: { id: revisionId, postId } });
    if (!revision) throw new NotFoundException('Revision not found');
    return revision;
  }

  async restoreRevision(postId: string, revisionId: string, actor: Principal, meta: RequestMeta) {
    const revision = await this.getRevision(postId, revisionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.blogPost.update({
        where: { id: postId },
        data: { title: revision.title, excerpt: revision.excerpt, content: revision.content, readingTimeMinutes: estimateReadingTime(revision.content) },
      });
      await tx.blogPostRevision.create({
        data: { postId, title: revision.title, excerpt: revision.excerpt, content: revision.content, note: `Restored revision from ${revision.createdAt.toISOString()}`, createdById: actor.id },
      });
      await this.audit.log({ actor, action: 'blog_post.revision_restored', targetType: 'BlogPost', targetId: postId, metadata: { revisionId }, meta }, tx);
    });
    this.revalidation.revalidate('blog');
    return this.get(postId);
  }
}
