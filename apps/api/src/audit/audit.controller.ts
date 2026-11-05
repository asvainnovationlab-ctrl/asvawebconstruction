import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EMAIL_STATUSES, listQuerySchema, PERMISSIONS } from '@asva/shared';
import { z } from 'zod';
import { RequirePermissions } from '../common/decorators.js';
import { paginate, pageArgs } from '../common/http.js';
import { ApiZodQuery, createZodDto } from '../common/zod.js';
import { PrismaService } from '../prisma/prisma.service.js';

class AuditQueryDto extends createZodDto(
  listQuerySchema.extend({
    action: z.string().max(100).optional(),
    actorId: z.uuid().optional(),
    targetType: z.string().max(60).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  }),
) {}

class EmailQueryDto extends createZodDto(listQuerySchema.extend({ status: z.enum(EMAIL_STATUSES).optional() })) {}

@ApiTags('Audit & email log')
@Controller('admin')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiZodQuery(AuditQueryDto)
  @ApiOperation({ summary: 'Audit trail of administrative and security events' })
  async list(@Query() q: AuditQueryDto) {
    const where = {
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.q ? { OR: [{ actorEmail: { contains: q.q, mode: 'insensitive' as const } }, { action: { contains: q.q, mode: 'insensitive' as const } }, { targetId: q.q }] } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86_400_000) } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: q.order }, ...pageArgs(q), include: { actor: { select: { id: true, name: true } } } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, q.page, q.pageSize);
  }

  @Get('email-messages')
  @RequirePermissions(PERMISSIONS.EMAIL_READ)
  @ApiZodQuery(EmailQueryDto)
  @ApiOperation({ summary: 'Email outbox delivery log (bodies are omitted)' })
  async emails(@Query() q: EmailQueryDto) {
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ toAddress: { contains: q.q, mode: 'insensitive' as const } }, { subject: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
        select: { id: true, toAddress: true, subject: true, category: true, status: true, attempts: true, lastError: true, sentAt: true, createdAt: true },
      }),
      this.prisma.emailMessage.count({ where }),
    ]);
    return paginate(items, total, q.page, q.pageSize);
  }
}
