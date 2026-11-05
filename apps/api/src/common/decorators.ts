import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@asva/shared';
import type { AppRequest, Principal } from './types.js';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opts a route out of the global authentication requirement. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/** Requires every listed permission. Enforced server-side by PermissionsGuard. */
export const RequirePermissions = (...permissions: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const SKIP_CSRF_KEY = 'skipCsrf';
/** Only for endpoints that cannot carry a CSRF token yet (login). Origin is still checked. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal | undefined => {
  return ctx.switchToHttp().getRequest<AppRequest>().user;
});
