import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { PaginationMeta } from '@asva/shared';
import { map, type Observable } from 'rxjs';

/** A paginated result. The response interceptor turns it into `{ data, meta }`. */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: PaginationMeta,
  ) {}
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return new Paginated(items, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export function pageArgs(query: { page: number; pageSize: number }) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

/** UTF-8 byte-order mark so spreadsheet apps detect the encoding of CSV exports. */
export const UTF8_BOM = String.fromCharCode(0xfeff);

/** Raw responses (CSV, files) that must not be wrapped. */
export class RawResponse {
  constructor(public readonly body: string | Buffer) {}
}

/** Wraps every successful JSON response as `{ data }` or `{ data, meta }`. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value instanceof StreamableFile) return value;
        if (value instanceof RawResponse) return value.body;
        if (value instanceof Paginated) return { data: value.items, meta: value.meta };
        return { data: value ?? null };
      }),
    );
  }
}

/** Builds a case-insensitive `contains` filter across several fields. */
export function searchFilter(q: string | undefined, fields: string[]): Record<string, unknown> | undefined {
  if (!q) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: q, mode: 'insensitive' } })) };
}

export function sortArgs<T extends string>(sort: string | undefined, allowed: readonly T[], fallback: T, order: 'asc' | 'desc') {
  const field = allowed.includes(sort as T) ? (sort as T) : fallback;
  return { [field]: order } as Record<T, 'asc' | 'desc'>;
}
