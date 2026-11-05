import { BadRequestException, Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { listQuerySchema, PERMISSIONS, TESTIMONIAL_STATUSES, testimonialInputSchema, type TestimonialInput } from '@asva/shared';
import { z } from 'zod';
import { TestimonialStatus } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { createCrudController, CrudService, type CrudOptions } from '../common/crud.js';
import { Public } from '../common/decorators.js';
import type { Principal } from '../common/types.js';
import { MEDIA_SELECT, MediaUrlService } from '../media/media-url.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';

type Input = z.output<typeof testimonialInputSchema> & TestimonialInput;

@Injectable()
export class TestimonialsService extends CrudService<Input> {
  protected readonly options: CrudOptions = {
    model: 'testimonial',
    entity: 'testimonial',
    label: 'Testimonial',
    tags: ['testimonials'],
    searchFields: ['clientName', 'company', 'content'],
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    include: { avatar: { select: MEDIA_SELECT }, approvedBy: { select: { id: true, name: true } } },
  };

  constructor(prisma: PrismaService, audit: AuditService, revalidation: RevalidationService, private readonly mediaUrl: MediaUrlService) {
    super(prisma, audit, revalidation);
  }

  protected override listWhere(query: Record<string, string | undefined>) {
    return { ...super.listWhere(query), ...(query.status ? { status: query.status } : {}) };
  }

  /** Approval requires confirmation that the client agreed to publication. */
  protected override async toData(input: Input, existing: { status: TestimonialStatus; approvedById: string | null; approvedAt: Date | null } | null, actor: Principal) {
    if (input.status === 'APPROVED' && !input.permissionConfirmed) {
      throw new BadRequestException({
        code: 'PERMISSION_REQUIRED',
        message: 'Confirm that the client has agreed to publication before approving.',
        details: [{ path: 'permissionConfirmed', message: 'Required for approval' }],
      });
    }
    const approvedNow = input.status === 'APPROVED' && existing?.status !== 'APPROVED';
    return {
      ...input,
      isFeatured: input.status === 'APPROVED' ? input.isFeatured : false,
      approvedById: input.status === 'APPROVED' ? (approvedNow ? actor.id : existing?.approvedById ?? actor.id) : null,
      approvedAt: input.status === 'APPROVED' ? (approvedNow ? new Date() : existing?.approvedAt ?? new Date()) : null,
    };
  }

  protected override async afterWrite(tx: Tx, row: { id: string; status: TestimonialStatus }, _input: Input, existing: { status: TestimonialStatus } | null) {
    if (row.status !== existing?.status && row.status === 'APPROVED') {
      await this.audit.log({ action: 'testimonial.approved', targetType: 'Testimonial', targetId: row.id }, tx);
    }
  }

  protected override toDto(row: { avatar: Parameters<MediaUrlService['dto']>[0] } & Record<string, unknown>) {
    return { ...row, avatar: this.mediaUrl.dto(row.avatar) };
  }

  async listPublic() {
    const rows = await this.prisma.testimonial.findMany({
      where: { status: TestimonialStatus.APPROVED, permissionConfirmed: true },
      orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }],
      select: { id: true, clientName: true, designation: true, company: true, content: true, rating: true, isFeatured: true, avatar: { select: MEDIA_SELECT } },
    });
    return rows.map((r) => ({ ...r, avatar: this.mediaUrl.dto(r.avatar) }));
  }
}

@ApiTags('Testimonials')
@Controller('testimonials')
export class TestimonialsPublicController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Approved testimonials (featured first)' })
  list() {
    return this.testimonials.listPublic();
  }
}

@Module({
  providers: [TestimonialsService],
  controllers: [
    TestimonialsPublicController,
    createCrudController({
      path: 'testimonials',
      tag: 'Testimonials',
      permission: PERMISSIONS.TESTIMONIALS_MANAGE,
      inputSchema: testimonialInputSchema,
      querySchema: listQuerySchema.extend({ status: z.enum(TESTIMONIAL_STATUSES).optional() }),
      service: TestimonialsService,
    }),
  ],
})
export class TestimonialsModule {}
