import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';

export const ACCESS_COOKIE = 'asva_at';
export const REFRESH_COOKIE = 'asva_rt';
export const CSRF_COOKIE = 'asva_csrf';
export const CSRF_HEADER = 'x-csrf-token';
/** Non-secret hint so the web app can redirect signed-out visitors; never used for authorization. */
export const SESSION_HINT_COOKIE = 'asva_session';

/** Refresh cookie is only sent to auth endpoints, limiting its exposure. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function base(env: Env): CookieOptions {
  return { secure: env.COOKIE_SECURE, sameSite: 'lax', domain: env.COOKIE_DOMAIN };
}

export function setAuthCookies(res: Response, env: Env, tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date; csrfToken: string }) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base(env), httpOnly: true, path: '/', maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base(env), httpOnly: true, path: REFRESH_COOKIE_PATH, expires: tokens.refreshExpiresAt });
  setCsrfCookie(res, env, tokens.csrfToken, tokens.refreshExpiresAt);
  res.cookie(SESSION_HINT_COOKIE, '1', { ...base(env), httpOnly: false, path: '/', expires: tokens.refreshExpiresAt });
}

/** Readable by the admin app's JavaScript, which echoes it in the X-CSRF-Token header (double submit). */
export function setCsrfCookie(res: Response, env: Env, token: string, expires?: Date) {
  res.cookie(CSRF_COOKIE, token, { ...base(env), httpOnly: false, path: '/', ...(expires ? { expires } : {}) });
}

export function clearAuthCookies(res: Response, env: Env) {
  res.clearCookie(ACCESS_COOKIE, { ...base(env), httpOnly: true, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(env), httpOnly: true, path: REFRESH_COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE, { ...base(env), path: '/' });
  res.clearCookie(SESSION_HINT_COOKIE, { ...base(env), path: '/' });
}
