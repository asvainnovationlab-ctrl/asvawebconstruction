'use client';

/**
 * Browser API client for the admin CMS and public forms. Calls go to /api/v1 on this origin
 * (proxied to the API), carry the HttpOnly session cookies automatically, send the CSRF token on
 * unsafe methods, and transparently rotate the session once when the access token expires.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1];
}

async function ensureCsrf(): Promise<string | undefined> {
  const existing = readCookie('asva_csrf');
  if (existing) return decodeURIComponent(existing);
  await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
  const issued = readCookie('asva_csrf');
  return issued ? decodeURIComponent(issued) : undefined;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const csrf = await ensureCsrf();
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: csrf ? { 'x-csrf-token': csrf } : {} });
      if (res.ok) return true;
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      return body?.error?.code === 'REFRESH_RACE';
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the automatic refresh-and-retry on 401 (used by auth endpoints). */
  noRefresh?: boolean;
}

export function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET') {
    const csrf = await ensureCsrf();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  return fetch(`/api/v1${path}${buildQuery(options.query)}`, { method, headers, body, credentials: 'same-origin' });
}

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  let res = await send(path, options);
  if (res.status === 401 && !options.noRefresh && (await refreshSession())) res = await send(path, options);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: { code: string; message: string; details?: { path: string; message: string }[] } } | null;
    const error = new ApiError(res.status, payload?.error?.code ?? 'ERROR', payload?.error?.message ?? 'Something went wrong. Please try again.', payload?.error?.details);
    if (res.status === 401 && !options.noRefresh && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      window.dispatchEvent(new CustomEvent('asva:unauthenticated'));
    }
    throw error;
  }
  return res;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function apiPaged<T>(path: string, options: RequestOptions = {}): Promise<{ data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } & Record<string, unknown> }> {
  const res = await apiFetch(path, options);
  return res.json();
}

/** Triggers a browser download for an authenticated file/CSV endpoint. */
export async function downloadFile(path: string, query?: RequestOptions['query'], fallbackName = 'download') {
  const res = await apiFetch(path, { query });
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1] ?? match[2] ?? fallbackName) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
