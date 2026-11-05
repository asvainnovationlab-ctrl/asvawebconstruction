import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserInput, ListQuery, UpdateUserInput } from '@asva/shared';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { paginate, pageArgs, searchFilter } from '../common/http.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { NotificationsService } from '../email/notifications.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  lockedUntil: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} as const;

type UserRow = { passwordHash: string | null; roles: { role: { id: string; key: string; name: string } }[] } & Record<string, unknown>;

function toDto({ passwordHash, roles, ...rest }: UserRow) {
  return { ...rest, hasPassword: Boolean(passwordHash), roles: roles.map((r) => r.role) };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  async list(query: ListQuery) {
    const where = searchFilter(query.q, ['email', 'name']);
    const [items, total] = await Promise.all([
      this.prisma.adminUser.findMany({ where, select: userSelect, orderBy: { createdAt: 'asc' }, ...pageArgs(query) }),
      this.prisma.adminUser.count({ where }),
    ]);
    return paginate(items.map(toDto), total, query.page, query.pageSize);
  }

  /** Lightweight list for assignment dropdowns (e.g. assigning leads). */
  async assignable(permission: string) {
    const users = await this.prisma.adminUser.findMany({
      where: { isActive: true, roles: { some: { role: { permissions: { some: { permission: { key: permission } } } } } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    return users;
  }

  async get(id: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('User not found');
    return toDto(user);
  }

  async create(input: CreateUserInput, actor: Principal, meta: RequestMeta) {
    const existing = await this.prisma.adminUser.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException({ code: 'CONFLICT', message: 'A user with this email already exists.' });
    const roles = await this.prisma.role.findMany({ where: { key: { in: input.roles } } });
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: { email: input.email, name: input.name, roles: { create: roles.map((r) => ({ roleId: r.id })) } },
      });
      await this.audit.log({ actor, action: 'user.created', targetType: 'AdminUser', targetId: created.id, metadata: { email: created.email, roles: input.roles }, meta }, tx);
      return created;
    });
    const inviteUrl = await this.auth.createInvitationLink(user.id);
    await this.notifications.invitation(user, inviteUrl, actor.name);
    return { user: await this.get(user.id), inviteUrl, emailDelivered: this.email.configured };
  }

  async update(id: string, input: UpdateUserInput, actor: Principal, meta: RequestMeta) {
    const user = await this.prisma.adminUser.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException('User not found');
    const currentRoles = user.roles.map((r) => r.role.key);

    if (id === actor.id) {
      if (input.isActive === false) throw new BadRequestException({ code: 'SELF_LOCKOUT', message: 'You cannot deactivate your own account.' });
      if (input.roles && currentRoles.includes('ADMINISTRATOR') && !input.roles.includes('ADMINISTRATOR')) {
        throw new BadRequestException({ code: 'SELF_LOCKOUT', message: 'You cannot remove your own Administrator role.' });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const losesAdmin =
        currentRoles.includes('ADMINISTRATOR') &&
        ((input.roles && !input.roles.includes('ADMINISTRATOR')) || input.isActive === false);
      if (losesAdmin) await this.assertAnotherActiveAdmin(tx, id);

      await tx.adminUser.update({ where: { id }, data: { name: input.name, isActive: input.isActive } });
      if (input.roles) {
        const roles = await tx.role.findMany({ where: { key: { in: input.roles } } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
        if (JSON.stringify([...currentRoles].sort()) !== JSON.stringify([...input.roles].sort())) {
          await this.audit.log({ actor, action: 'user.roles.changed', targetType: 'AdminUser', targetId: id, metadata: { from: currentRoles, to: input.roles }, meta }, tx);
        }
      }
      if (input.isActive === false && user.isActive) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'deactivated' } });
        await this.audit.log({ actor, action: 'user.deactivated', targetType: 'AdminUser', targetId: id, meta }, tx);
      } else if (input.isActive === true && !user.isActive) {
        await this.audit.log({ actor, action: 'user.reactivated', targetType: 'AdminUser', targetId: id, meta }, tx);
      }
      if (input.name && input.name !== user.name) {
        await this.audit.log({ actor, action: 'user.updated', targetType: 'AdminUser', targetId: id, metadata: { fields: ['name'] }, meta }, tx);
      }
    });
    return this.get(id);
  }

  /** Sends a fresh invitation (no password yet) or a password reset link (existing password). */
  async sendAccessLink(id: string, actor: Principal, meta: RequestMeta) {
    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException({ code: 'INACTIVE', message: 'Reactivate the user before sending a link.' });
    const isInvite = !user.passwordHash;
    const link = isInvite ? await this.auth.createInvitationLink(id) : await this.auth.createResetLink(id);
    if (isInvite) await this.notifications.invitation(user, link, actor.name);
    else await this.notifications.passwordReset(user, link);
    await this.audit.log({ actor, action: isInvite ? 'user.invitation.resent' : 'user.password_reset.sent', targetType: 'AdminUser', targetId: id, meta });
    return { link, type: isInvite ? 'invitation' : 'password-reset', emailDelivered: this.email.configured };
  }

  async unlock(id: string, actor: Principal, meta: RequestMeta) {
    await this.prisma.adminUser.update({ where: { id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await this.audit.log({ actor, action: 'user.unlocked', targetType: 'AdminUser', targetId: id, meta });
    return this.get(id);
  }

  private async assertAnotherActiveAdmin(tx: Tx, excludingId: string) {
    const others = await tx.adminUser.count({
      where: { id: { not: excludingId }, isActive: true, roles: { some: { role: { key: 'ADMINISTRATOR' } } } },
    });
    if (others === 0) throw new BadRequestException({ code: 'LAST_ADMIN', message: 'At least one active Administrator must remain.' });
  }
}
