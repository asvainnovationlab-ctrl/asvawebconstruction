import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { AuthUser } from '@asva/shared';
import { ENV, type Env } from '../config/env.js';
import { TokenPurpose } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { randomToken, sha256 } from '../common/crypto.js';
import type { Principal, RequestMeta } from '../common/types.js';
import { NotificationsService } from '../email/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
const LOCK_THRESHOLD = 5;
const BASE_LOCK_MINUTES = 15;
const MAX_LOCK_MINUTES = 24 * 60;
const RESET_TTL_MINUTES = 30;
const INVITE_TTL_HOURS = 72;
const ISSUER = 'asva-api';
const AUDIENCE = 'asva-admin';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  csrfToken: string;
}

const principalInclude = {
  user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } },
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly key: Uint8Array;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {
    this.key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  // ---------------------------------------------------------------- login / sessions

  async login(email: string, password: string, meta: RequestMeta): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    const now = new Date();

    if (user?.lockedUntil && user.lockedUntil > now) {
      await this.passwords.verify(null, password); // keep timing uniform
      await this.audit.log({ actor: user, action: 'auth.login.locked', targetType: 'AdminUser', targetId: user.id, meta });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: GENERIC_LOGIN_ERROR });
    }

    const valid = await this.passwords.verify(user?.passwordHash, password);
    if (!user || !valid || !user.isActive) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const lockMinutes = attempts >= LOCK_THRESHOLD ? Math.min(BASE_LOCK_MINUTES * 2 ** (attempts - LOCK_THRESHOLD), MAX_LOCK_MINUTES) : 0;
        await this.prisma.adminUser.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts, lockedUntil: lockMinutes ? new Date(now.getTime() + lockMinutes * 60_000) : null },
        });
        if (lockMinutes) this.logger.warn({ userId: user.id, attempts, lockMinutes }, 'Account temporarily locked after repeated failures');
      }
      await this.audit.log({ actor: user ?? null, actorEmail: email, action: 'auth.login.failed', targetType: 'AdminUser', targetId: user?.id, meta });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: GENERIC_LOGIN_ERROR });
    }

    await this.prisma.adminUser.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now } });
    const tokens = await this.createSession(user.id, randomUUID(), meta);
    await this.audit.log({ actor: user, action: 'auth.login.success', targetType: 'AdminUser', targetId: user.id, meta });
    return { user: await this.getAuthUser(user.id), tokens };
  }

  /**
   * Rotates a refresh token. Presenting an already-rotated token is treated as theft: the whole
   * session family is revoked and the user must log in again.
   */
  async refresh(refreshToken: string | undefined, meta: RequestMeta): Promise<IssuedTokens> {
    if (!refreshToken) throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' });
    const session = await this.prisma.session.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
    const now = new Date();
    if (!session) throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' });

    if (session.revokedAt) {
      // Two tabs refreshing at the same moment: the loser simply retries with the new cookie.
      if (session.revokedReason === 'rotated' && now.getTime() - session.revokedAt.getTime() < 15_000) {
        throw new UnauthorizedException({ code: 'REFRESH_RACE', message: 'Session was just refreshed. Retry the request.' });
      }
      if (session.revokedReason === 'rotated') {
        await this.prisma.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: now, revokedReason: 'reuse-detected' } });
        await this.audit.log({ actor: session.user, action: 'auth.refresh.reuse_detected', targetType: 'Session', targetId: session.familyId, meta });
        this.logger.warn({ userId: session.userId, familyId: session.familyId }, 'Refresh token reuse detected; session family revoked');
      }
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' });
    }
    if (session.expiresAt <= now || !session.user.isActive) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' });
    }

    const tokens = await this.createSession(session.userId, session.familyId, meta);
    const next = await this.prisma.session.findUniqueOrThrow({ where: { tokenHash: sha256(tokens.refreshToken) } });
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: now, revokedReason: 'rotated', replacedById: next.id } });
    return tokens;
  }

  async logout(principal: Principal | undefined, refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    const now = new Date();
    if (refreshToken) {
      const session = await this.prisma.session.findUnique({ where: { tokenHash: sha256(refreshToken) } });
      if (session) await this.prisma.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: now, revokedReason: 'logout' } });
    }
    if (principal) {
      await this.prisma.session.updateMany({ where: { id: principal.sessionId, revokedAt: null }, data: { revokedAt: now, revokedReason: 'logout' } });
      await this.audit.log({ actor: principal, action: 'auth.logout', targetType: 'AdminUser', targetId: principal.id, meta });
    }
  }

  private async createSession(userId: string, familyId: string, meta: RequestMeta): Promise<IssuedTokens> {
    const refreshToken = randomToken(48);
    const refreshExpiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const session = await this.prisma.session.create({
      data: { userId, familyId, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt, ipAddress: meta.ip, userAgent: meta.userAgent },
    });
    const accessToken = await new SignJWT({ sid: session.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.env.JWT_ACCESS_TTL_SECONDS}s`)
      .sign(this.key);
    return { accessToken, refreshToken, refreshExpiresAt, csrfToken: randomToken(24) };
  }

  /** Verifies an access token and re-checks the backing session and user on every request. */
  async resolvePrincipal(accessToken: string): Promise<Principal | null> {
    let sub: string | undefined;
    let sid: unknown;
    try {
      const { payload } = await jwtVerify(accessToken, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
      sub = payload.sub;
      sid = payload.sid;
    } catch {
      return null;
    }
    if (!sub || typeof sid !== 'string') return null;
    const session = await this.prisma.session.findUnique({ where: { id: sid }, include: principalInclude });
    if (!session || session.userId !== sub || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) return null;

    const roles = session.user.roles.map((ur) => ur.role);
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      sessionId: session.id,
      roles: roles.map((r) => ({ key: r.key, name: r.name })),
      permissions: [...new Set(roles.flatMap((r) => r.permissions.map((rp) => rp.permission.key)))],
    };
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    const roles = user.roles.map((ur) => ur.role);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: roles.map((r) => ({ key: r.key, name: r.name })),
      permissions: [...new Set(roles.flatMap((r) => r.permissions.map((rp) => rp.permission.key)))].sort(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  // ---------------------------------------------------------------- passwords

  async changePassword(principal: Principal, currentPassword: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: principal.id } });
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException({ code: 'INVALID_PASSWORD', message: 'Your current password is incorrect.', details: [{ path: 'currentPassword', message: 'Incorrect password' }] });
    }
    this.passwords.assertStrong(newPassword, user.email);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(newPassword), passwordChangedAt: new Date() } });
      // Sign out every other session.
      await tx.session.updateMany({ where: { userId: user.id, revokedAt: null, NOT: { id: principal.sessionId } }, data: { revokedAt: new Date(), revokedReason: 'password-changed' } });
      await this.audit.log({ actor: principal, action: 'auth.password.changed', targetType: 'AdminUser', targetId: user.id, meta }, tx);
    });
  }

  /** Always resolves the same way so the response never reveals whether an account exists. */
  async requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    await this.audit.log({ actor: user ?? null, actorEmail: email, action: 'auth.password_reset.requested', targetType: 'AdminUser', targetId: user?.id, meta });
    if (!user || !user.isActive || !user.passwordHash) return;
    const token = await this.issueToken(user.id, TokenPurpose.PASSWORD_RESET, RESET_TTL_MINUTES * 60_000);
    await this.notifications.passwordReset(user, `${this.env.FRONTEND_URL}/admin/reset-password?token=${encodeURIComponent(token)}`);
  }

  async createInvitationLink(userId: string): Promise<string> {
    const token = await this.issueToken(userId, TokenPurpose.INVITATION, INVITE_TTL_HOURS * 3_600_000);
    return `${this.env.FRONTEND_URL}/admin/accept-invite?token=${encodeURIComponent(token)}`;
  }

  async createResetLink(userId: string): Promise<string> {
    const token = await this.issueToken(userId, TokenPurpose.PASSWORD_RESET, RESET_TTL_MINUTES * 60_000);
    return `${this.env.FRONTEND_URL}/admin/reset-password?token=${encodeURIComponent(token)}`;
  }

  /** Completes a password reset or an invitation with a single-use token. */
  async completeTokenFlow(token: string, password: string, purpose: TokenPurpose, meta: RequestMeta): Promise<void> {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    const now = new Date();
    if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt <= now || !record.user.isActive) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'This link is invalid or has expired. Please request a new one.' });
    }
    this.passwords.assertStrong(password, record.user.email);
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'This link has already been used.' });
      await tx.adminUser.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(purpose === TokenPurpose.INVITATION || !record.user.emailVerifiedAt ? { emailVerifiedAt: now } : {}),
        },
      });
      await tx.authToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
      await tx.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now, revokedReason: 'password-reset' } });
      await this.audit.log(
        { actor: record.user, action: purpose === TokenPurpose.INVITATION ? 'auth.invitation.accepted' : 'auth.password_reset.completed', targetType: 'AdminUser', targetId: record.userId, meta },
        tx,
      );
    });
  }

  private async issueToken(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
    const token = randomToken(32);
    await this.prisma.$transaction([
      // Only the newest link of each kind is valid.
      this.prisma.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({ data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } }),
    ]);
    return token;
  }
}
