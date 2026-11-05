import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'Demo-Passw0rd!2026';
export const USERS = {
  admin: 'admin@demo.asva.local',
  editor: 'editor@demo.asva.local',
  sales: 'sales@demo.asva.local',
  hr: 'hr@demo.asva.local',
} as const;

export const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** Public forms reject submissions made faster than FORM_MIN_FILL_SECONDS (default 3s). */
export const humanPause = (page: Page) => page.waitForTimeout(3200);

export async function loginAs(page: Page, who: keyof typeof USERS) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(USERS[who]);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Authenticated API call through the web origin, with the CSRF header the admin app would send. */
export async function adminApi(context: BrowserContext, request: APIRequestContext, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: unknown) {
  const csrf = (await context.cookies()).find((c) => c.name === 'asva_csrf')?.value;
  return request.fetch(`/api/v1${path}`, { method, data, headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {} });
}
