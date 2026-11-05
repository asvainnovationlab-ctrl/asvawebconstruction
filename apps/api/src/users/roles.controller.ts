import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ALL_PERMISSIONS, PERMISSIONS, updateRolePermissionsSchema } from '@asva/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, createZodDto } from '../common/zod.js';
import { PrismaService } from '../prisma/prisma.service.js';

class UpdateRoleDto extends createZodDto(updateRolePermissionsSchema) {}

/** Permissions the Administrator role must always keep, so nobody can lock the system. */
const ADMIN_LOCKED = [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SETTINGS_MANAGE];

@ApiTags('Roles & permissions')
@Controller('admin')
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('roles')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Roles with their permissions and member counts' })
  async roles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key).sort(),
    }));
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  permissions() {
    return this.prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }], select: { id: true, key: true, group: true, description: true } });
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiZodBody(UpdateRoleDto)
  @ApiOperation({ summary: 'Replace the permissions granted to a role' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateRoleDto, @CurrentUser() actor: Principal, @Req() req: AppRequest) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException('Role not found');
    const unknown = body.permissions.filter((p) => !(ALL_PERMISSIONS as string[]).includes(p));
    if (unknown.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `Unknown permissions: ${unknown.join(', ')}` });
    if (role.key === 'ADMINISTRATOR' && ADMIN_LOCKED.some((p) => !body.permissions.includes(p))) {
      throw new BadRequestException({ code: 'LOCKED_PERMISSION', message: 'The Administrator role must keep user, role and settings management.' });
    }
    const before = role.permissions.map((p) => p.permission.key);
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: body.permissions } } });
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: id, permissionId: p.id })) });
      if (body.description !== undefined) await tx.role.update({ where: { id }, data: { description: body.description } });
      await this.audit.log(
        {
          actor,
          action: 'role.permissions.changed',
          targetType: 'Role',
          targetId: id,
          metadata: { role: role.key, added: body.permissions.filter((p) => !before.includes(p)), removed: before.filter((p) => !body.permissions.includes(p)) },
          meta: requestMeta(req),
        },
        tx,
      );
    });
    return (await this.roles()).find((r) => r.id === id);
  }
}
