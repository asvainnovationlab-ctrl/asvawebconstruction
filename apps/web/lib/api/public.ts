import 'server-only';
import { cache } from 'react';
import { DEFAULT_SETTINGS } from '@asva/shared';
import type {
  CmsPage,
  FaqGroup,
  Job,
  JobSummary,
  Navigation,
  Post,
  PostCard,
  Project,
  ProjectCard,
  PublicSettings,
  Service,
  TeamMember,
  TechnologyRef,
  Testimonial,
} from '../types';
import { apiGet, apiGetPaged } from './server';

const FALLBACK_SETTINGS: PublicSettings = {
  ...(({ notifications: _n, ...rest }) => rest)(DEFAULT_SETTINGS),
  media: { logoForDarkBg: null, logoForLightBg: null, logoIcon: null, favicon: null, ogImage: null, heroImage: null },
};

/** Deduplicated per request via React cache; cached across requests by tag. */
export const getSettings = cache(async (): Promise<PublicSettings> => {
  return (await apiGet<PublicSettings>('/settings/public', { tags: ['settings'] })) ?? FALLBACK_SETTINGS;
});

export const getNavigation = cache(async (): Promise<Navigation> => {
  return (await apiGet<Navigation>('/navigation', { tags: ['navigation'] })) ?? { HEADER: [], FOOTER_QUICK_LINKS: [], FOOTER_LEGAL: [] };
});

export const getServices = cache(async () => (await apiGet<Service[]>('/services', { tags: ['services'] })) ?? []);
export const getService = (slug: string) => apiGet<Service>(`/services/${encodeURIComponent(slug)}`, { tags: ['services'] });

export const getTechnologies = cache(async () => (await apiGet<TechnologyRef[]>('/technologies', { tags: ['technologies'] })) ?? []);

export const getProjects = (query: { page?: number; pageSize?: number; q?: string; category?: string; technology?: string; featured?: 'true' }) =>
  apiGetPaged<ProjectCard>('/projects', { tags: ['projects'], query });
export const getProject = (slug: string) => apiGet<Project>(`/projects/${encodeURIComponent(slug)}`, { tags: ['projects'] });
export const getProjectCategories = () => apiGet<{ id: string; name: string; slug: string }[]>('/project-categories', { tags: ['projects'] }).then((r) => r ?? []);

export const getPosts = (query: { page?: number; pageSize?: number; q?: string; category?: string; tag?: string; author?: string; featured?: 'true' }) =>
  apiGetPaged<PostCard>('/blog', { tags: ['blog'], query });
export const getPost = (slug: string) => apiGet<Post>(`/blog/${encodeURIComponent(slug)}`, { tags: ['blog'] });
export const getBlogTaxonomies = cache(async () =>
  (await apiGet<{ categories: { id: string; name: string; slug: string; description: string | null }[]; tags: { id: string; name: string; slug: string }[] }>('/blog/taxonomies', { tags: ['blog'] })) ?? { categories: [], tags: [] },
);

export const getPage = (slug: string) => apiGet<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { tags: ['pages'] });
export const getTestimonials = cache(async () => (await apiGet<Testimonial[]>('/testimonials', { tags: ['testimonials'] })) ?? []);
export const getFaqs = cache(async () => (await apiGet<FaqGroup[]>('/faqs', { tags: ['faqs'] })) ?? []);
export const getTeam = cache(async () => (await apiGet<TeamMember[]>('/team', { tags: ['team'] })) ?? []);
export const getJobs = cache(async () => (await apiGet<JobSummary[]>('/jobs', { tags: ['jobs'] })) ?? []);
export const getJob = (slug: string) => apiGet<Job>(`/jobs/${encodeURIComponent(slug)}`, { tags: ['jobs'] });

export const getSitemapEntries = () => apiGet<{ entries: { path: string; updatedAt: string }[] }>('/seo/sitemap', { tags: ['pages', 'services', 'projects', 'blog', 'jobs'] });

/** Looks up a redirect for an unknown path. Not cached: hits are counted. */
export async function resolveRedirect(path: string): Promise<{ toPath: string; statusCode: number } | null> {
  const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  try {
    const res = await fetch(`${API_URL}/api/v1/redirects/resolve?path=${encodeURIComponent(path)}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return ((await res.json()) as { data: { toPath: string; statusCode: number } | null }).data;
  } catch {
    return null;
  }
}
