import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Keyed, non-reversible IP fingerprint for abuse detection without storing raw addresses. */
export function hashIp(secret: string, ip: string | null | undefined): string | null {
  return ip ? hmac(secret, `ip:${ip}`).slice(0, 32) : null;
}

/** Self-verifying token `<id>.<signature>` bound to a purpose, e.g. newsletter unsubscribe links. */
export function signToken(secret: string, purpose: string, id: string): string {
  return `${id}.${hmac(secret, `${purpose}:${id}`)}`;
}

export function verifySignedToken(secret: string, purpose: string, token: string): string | null {
  const [id, signature] = token.split('.');
  if (!id || !signature) return null;
  return safeEqual(signature, hmac(secret, `${purpose}:${id}`)) ? id : null;
}
