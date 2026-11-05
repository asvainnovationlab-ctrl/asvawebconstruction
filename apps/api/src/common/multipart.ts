import { BadRequestException } from '@nestjs/common';

/**
 * Public forms with file uploads send their fields as a JSON string in a `payload` part next to
 * the file. JSON requests without a file are accepted as-is.
 */
export function readPayload(body: unknown): unknown {
  if (body && typeof body === 'object' && 'payload' in body) {
    const raw = (body as { payload: unknown }).payload;
    if (typeof raw !== 'string' || raw.length > 100_000) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid form payload.' });
    try {
      return JSON.parse(raw);
    } catch {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid form payload.' });
    }
  }
  return body;
}

export function dateRange(from?: string, to?: string) {
  const valid = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);
  const start = valid(from);
  const end = valid(to);
  if (!start && !end) return undefined;
  return { ...(start ? { gte: start } : {}), ...(end ? { lt: new Date(end.getTime() + 86_400_000) } : {}) };
}
