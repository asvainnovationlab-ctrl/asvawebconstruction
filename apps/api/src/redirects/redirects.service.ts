import { Injectable, NotFoundException } from '@nestjs/common';
import type { ListQuery, RedirectData } from '@asva/shared';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

@Injectable()
export class RedirectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  /**
   * Records a permanent redirect when a public URL changes, re-points older redirects at the
   * new URL (no chains) and removes any redirect that would now shadow the new URL (no loops).
   */
  async recordPathChange(tx: Tx, fromPath: string, toPath: string): Promise<void> {
    if (fromPath === toPath) return;
    await tx.redirect.deleteMany({ where: { fromPath: toPath } });
    await tx.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
    await tx.redirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 308 },
      update: { toPath, statusCode: 308, isActive: true },
    });
    this.revalidation.revalidate('redirects');
  }

  async resolve(path: string) {
    const redirect = await this.prisma.redirect.findFirst({ where: { fromPath: path, isActive: true } });
    if (!redirect) return null;
    await this.prisma.redirect.update({ where: { id: redirect.id }, data: { hits: { increment: 1 } } });
    return { toPath: redirect.toPath, statusCode: redirect.statusCode };
  }

  async list(query: ListQuery) {
    const where = searchFilter(query.q, ['fromPath', 'toPath']);
    const [items, total] = await Promise.all([
      this.prisma.redirect.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.redirect.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async create(input: RedirectData) {
    const created = await this.prisma.redirect.create({ data: input });
    this.revalidation.revalidate('redirects');
    return created;
  }

  async update(id: string, input: RedirectData) {
    await this.findOrThrow(id);
    const updated = await this.prisma.redirect.update({ where: { id }, data: input });
    this.revalidation.revalidate('redirects');
    return updated;
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.redirect.delete({ where: { id } });
    this.revalidation.revalidate('redirects');
  }

  private async findOrThrow(id: string) {
    const redirect = await this.prisma.redirect.findUnique({ where: { id } });
    if (!redirect) throw new NotFoundException('Redirect not found');
    return redirect;
  }
}
