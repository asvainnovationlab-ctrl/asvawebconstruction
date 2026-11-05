import 'server-only';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { resolveRedirect } from './api/public';

/** For a missing record, follow a configured redirect (e.g. after a slug change) or show 404. */
export async function notFoundOrRedirect(path: string): Promise<never> {
  const target = await resolveRedirect(path);
  if (target) {
    if (target.statusCode === 301 || target.statusCode === 308) permanentRedirect(target.toPath);
    redirect(target.toPath);
  }
  notFound();
}
