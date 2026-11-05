import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@asva/shared';
import { ENV, type Env } from '../config/env.js';
import { TokenPurpose } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { randomToken } from '../common/crypto.js';
import { CurrentUser, Public, SkipCsrf } from '../common/decorators.js';
import { requestMeta, type AppRequest, type Principal } from '../common/types.js';
import { ApiZodBody, createZodDto } from '../common/zod.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { ACCESS_COOKIE, clearAuthCookies, CSRF_COOKIE, REFRESH_COOKIE, setAuthCookies, setCsrfCookie } from './cookies.js';

class LoginDto extends createZodDto(loginSchema) {}
class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Issue a CSRF token cookie (double-submit) if one is not present' })
  csrf(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const existing = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const token = existing ?? randomToken(24);
    if (!existing) setCsrfCookie(res, this.env, token);
    return { csrfToken: token };
  }

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiZodBody(LoginDto)
  @ApiOperation({ summary: 'Sign in; sets HttpOnly access/refresh cookies and a CSRF cookie' })
  async login(@Body() body: LoginDto, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(body.email, body.password, requestMeta(req));
    setAuthCookies(res, this.env, tokens);
    return user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    try {
      const tokens = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE] as string | undefined, requestMeta(req));
      setAuthCookies(res, this.env, tokens);
      return { refreshed: true };
    } catch (error) {
      if ((error as { response?: { code?: string } }).response?.code !== 'REFRESH_RACE') clearAuthCookies(res, this.env);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const access = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    const principal = access ? ((await this.auth.resolvePrincipal(access)) ?? undefined) : undefined;
    await this.auth.logout(principal, req.cookies?.[REFRESH_COOKIE] as string | undefined, requestMeta(req));
    clearAuthCookies(res, this.env);
    return { loggedOut: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiZodBody(ForgotPasswordDto)
  @ApiOperation({ summary: 'Request a password reset link (always returns the same response)' })
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: AppRequest) {
    await this.auth.requestPasswordReset(body.email, requestMeta(req));
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiZodBody(ResetPasswordDto)
  @ApiOperation({ summary: 'Set a new password with a single-use reset token' })
  async resetPassword(@Body() body: ResetPasswordDto, @Req() req: AppRequest) {
    await this.auth.completeTokenFlow(body.token, body.password, TokenPurpose.PASSWORD_RESET, requestMeta(req));
    return { message: 'Your password has been updated. You can now sign in.' };
  }

  @Public()
  @Post('accept-invite')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiZodBody(ResetPasswordDto)
  @ApiOperation({ summary: 'Accept an invitation by choosing a password (verifies the email address)' })
  async acceptInvite(@Body() body: ResetPasswordDto, @Req() req: AppRequest) {
    await this.auth.completeTokenFlow(body.token, body.password, TokenPurpose.INVITATION, requestMeta(req));
    return { message: 'Your account is ready. You can now sign in.' };
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user with roles and effective permissions' })
  me(@CurrentUser() user: Principal) {
    return this.auth.getAuthUser(user.id);
  }

  @Patch('me')
  @ApiZodBody(UpdateProfileDto)
  @ApiOperation({ summary: 'Update your profile' })
  async updateMe(@Body() body: UpdateProfileDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.prisma.adminUser.update({ where: { id: user.id }, data: { name: body.name } });
    await this.audit.log({ actor: user, action: 'user.profile.updated', targetType: 'AdminUser', targetId: user.id, meta: requestMeta(req) });
    return this.auth.getAuthUser(user.id);
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiZodBody(ChangePasswordDto)
  @ApiOperation({ summary: 'Change your password; signs out your other sessions' })
  async changePassword(@Body() body: ChangePasswordDto, @CurrentUser() user: Principal, @Req() req: AppRequest) {
    await this.auth.changePassword(user, body.currentPassword, body.newPassword, requestMeta(req));
    return { message: 'Password changed.' };
  }
}
