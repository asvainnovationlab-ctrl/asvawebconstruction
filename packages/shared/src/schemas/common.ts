import { z } from 'zod';
import { CONTENT_STATUSES } from '../enums.js';
import { isSafeHref, SLUG_PATTERN } from '../utils.js';

export const idSchema = z.uuid({ error: 'Invalid identifier' });

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(120, 'Slug is too long')
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens only');

/** Optional text: empty strings become null so the database stores NULL rather than "". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

export const requiredText = (max: number, label = 'This field') =>
  z.string().trim().min(1, `${label} is required`).max(max, `Must be at most ${max} characters`);

export const safeHrefSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(isSafeHref, 'Use a site path (/about), an https:// URL, mailto: or tel: link');

export const optionalHref = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isSafeHref(v), 'Use a site path (/about), an https:// URL, mailto: or tel: link');

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Enter a full URL starting with https://');

export const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => {
    if (v === null) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Enter a full URL starting with https://');

export const isoDateSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

export const optionalIsoDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Invalid date');

export const optionalMediaId = idSchema.nullish().transform((v) => v ?? null);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: 'Enter a valid email address' }));

/** International phone: optional +, digits, spaces, dashes, parentheses; 7–15 digits in total. */
export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine((v) => /^\+?[0-9\s\-()]{7,24}$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15, 'Enter a valid phone number including country code, e.g. +977 98XXXXXXXX');

export const optionalPhone = z
  .string()
  .trim()
  .max(32)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\+?[0-9\s\-()]{7,24}$/.test(v) && v.replace(/\D/g, '').length >= 7), 'Enter a valid phone number including country code');

export const contentStatusSchema = z.enum(CONTENT_STATUSES);

/** Rich text from the editor. Sanitised server-side before storage and before rendering. */
export const richTextSchema = z.string().max(200_000, 'Content is too long').default('');

export const seoFields = {
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
};

export const publicationFields = {
  status: contentStatusSchema.default('DRAFT'),
  publishedAt: optionalIsoDate,
};

export const displayOrderSchema = z.coerce.number().int().min(0).max(100_000).default(0);

/** Bot traps for public forms: a hidden field that must stay empty, and the time the form was rendered. */
export const spamFields = {
  website: z.string().max(200).optional().default(''),
  formStartedAt: z.coerce.number().int().optional(),
  turnstileToken: z.string().max(4096).optional(),
};

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  sort: z.string().trim().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const reorderSchema = z.object({
  items: z
    .array(z.object({ id: idSchema, displayOrder: z.number().int().min(0).max(100_000) }))
    .min(1)
    .max(500),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const bulkIdsSchema = z.object({
  ids: z.array(idSchema).min(1).max(200),
});
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId?: string;
  };
}
