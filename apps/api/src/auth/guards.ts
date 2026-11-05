import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type PermissionKey } from '@asva/shared';
import { allowedOrigins, ENV, type Env } from '../config/env.js';
import { safeEqual } from '../common/crypto.js';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, SKIP_CSRF_KEY } from '../common/decorators.js';
import type { AppRequest } from '../common/types.js';
import { AuthService } from './auth.service.js';
import { ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER, REFRESH_COOKIE } from './cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Deny-by-default authentication. Routes must opt out with @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    const principal = token ? await this.auth.resolvePrincipal(token) : null;
    if (!principal) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' });
    req.user = principal;
    return true;
  }
}

/**
 * CSRF defence for cookie-authenticated requests: unsafe methods must echo the CSRF cookie in
 * the X-CSRF-Token header (double submit), and any Origin header must be an allowed origin.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origins: string[];

  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) env: Env,
  ) {
    this.origins = allowedOrigins(env);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin && !this.origins.includes(origin)) {
      throw new ForbiddenException({ code: 'BAD_ORIGIN', message: 'Request origin not allowed.' });
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [context.getHandler(), context.getClass()]);
    const hasSessionCookie = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
    if (skip || !hasSessionCookie) return true;

    const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const header = req.headers[CSRF_HEADER];
    if (!cookie || typeof header !== 'string' || !safeEqual(cookie, header)) {
      throw new ForbiddenException({ code: 'CSRF_FAILED', message: 'Your session security token is missing or expired. Refresh the page and try again.' });
    }
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest<AppRequest>().user;
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' });
    if (!hasPermission(user.permissions, required)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' });
    }
    return true;
  }
}
