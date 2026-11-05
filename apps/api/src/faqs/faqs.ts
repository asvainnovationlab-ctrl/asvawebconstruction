import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { faqCategoryInputSchema, faqInputSchema, idSchema, listQuerySchema, PERMISSIONS } from '@asva/shared';
import { z } from 'zod';
import { createCrudController, CrudService, type CrudOptions } from '../common/crud.js';
import { Public } from '../common/decorators.js';
import { sanitizeRichText } from '../common/sanitize.js';

@Injectable()
export class FaqCategoriesService extends CrudService {
  protected readonly options: CrudOptions = {
    model: 'faqCategory',
    entity: 'faq_category',
    label: 'FAQ category',
    tags: ['faqs'],
    searchFields: ['name'],
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { faqs: true } } },
  };
}

@Injectable()
export class FaqsService extends CrudService<z.output<typeof faqInputSchema>> {
  protected readonly options: CrudOptions = {
    model: 'faq',
    entity: 'faq',
    label: 'FAQ',
    tags: ['faqs'],
    searchFields: ['question', 'answer'],
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    include: { category: { select: { id: true, name: true, slug: true } } },
  };

  protected override async toData(input: z.output<typeof faqInputSchema>) {
    return { ...input, answer: sanitizeRichText(input.answer) };
  }

  protected override listWhere(query: Record<string, string | undefined>) {
    return { ...super.listWhere(query), ...(query.categoryId ? { categoryId: query.categoryId } : {}) };
  }

  /** Published FAQs grouped by category, in display order. */
  async listPublic() {
    const [categories, faqs] = await Promise.all([
      this.prisma.faqCategory.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true } }),
      this.prisma.faq.findMany({ where: { isPublished: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, question: true, answer: true, categoryId: true } }),
    ]);
    const groups = categories
      .map((c) => ({ ...c, faqs: faqs.filter((f) => f.categoryId === c.id) }))
      .filter((g) => g.faqs.length);
    const uncategorised = faqs.filter((f) => !f.categoryId);
    if (uncategorised.length) groups.push({ id: 'general', name: 'General', slug: 'general', faqs: uncategorised });
    return groups;
  }
}

@ApiTags('FAQs')
@Controller('faqs')
export class FaqsPublicController {
  constructor(private readonly faqs: FaqsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Published FAQs grouped by category' })
  list() {
    return this.faqs.listPublic();
  }
}

@Module({
  providers: [FaqsService, FaqCategoriesService],
  controllers: [
    FaqsPublicController,
    createCrudController({
      path: 'faqs',
      tag: 'FAQs',
      permission: PERMISSIONS.FAQS_MANAGE,
      inputSchema: faqInputSchema,
      querySchema: listQuerySchema.extend({ categoryId: idSchema.optional(), pageSize: z.coerce.number().int().min(1).max(200).default(100) }),
      service: FaqsService,
    }),
    createCrudController({ path: 'faq-categories', tag: 'FAQ categories', permission: PERMISSIONS.FAQS_MANAGE, inputSchema: faqCategoryInputSchema, service: FaqCategoriesService }),
  ],
})
export class FaqsModule {}
