import type { Request } from 'express';

export interface Principal {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  roles: { key: string; name: string }[];
  permissions: string[];
}

export interface AppRequest extends Request {
  user?: Principal;
}

/** Minimal request context passed into services for audit logging. */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  return {
    ip: req.ip ?? null,
    userAgent: (req.headers['user-agent'] ?? '').slice(0, 300) || null,
  };
}
