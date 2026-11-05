import type { Metadata } from 'next';
import { Pagination, ProjectCard } from '@/components/site/cards';
import { EmptyState, PageHero, Section } from '@/components/site/blocks';
import { FilterChips, SearchBox } from '@/components/site/search-box';
import { getProjectCategories, getProjects, getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

type Props = { searchParams: Promise<{ category?: string; q?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, page } = await searchParams;
  return buildMetadata(await getSettings(), {
    title: 'Portfolio & Case Studies',
    description: 'Software, web and mobile projects designed and engineered by Asva Innovation Lab.',
    path: '/portfolio',
    noIndex: Boolean(q) || Number(page) > 1,
  });
}

export default async function PortfolioPage({ searchParams }: Props) {
  const { category, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [projects, categories] = await Promise.all([getProjects({ category, q, page, pageSize: 9 }), getProjectCategories()]);
  const href = (params: { category?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params.category) sp.set('category', params.category);
    if (q) sp.set('q', q);
    if (params.page && params.page > 1) sp.set('page', String(params.page));
    const s = sp.toString();
    return `/portfolio${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <PageHero title="Work" description="Selected products and platforms: the problem, the approach and what we built." crumbs={[{ name: 'Portfolio', path: '/portfolio' }]} />
      <Section>
        <div className="container-page">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips items={categories} active={category} hrefFor={(slug) => href({ category: slug })} allLabel="All" />
            <SearchBox action="/portfolio" defaultValue={q} placeholder="Search projects" hidden={{ category }} />
          </div>
          <p className="mt-6 text-[14px] text-muted-ink" role="status">
            {projects.meta.total} {projects.meta.total === 1 ? 'project' : 'projects'}
            {q ? ` matching “${q}”` : ''}
          </p>
          {projects.data.length ? (
            <ul className="mt-8 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {projects.data.map((p, i) => (
                <li key={p.id}>
                  <ProjectCard project={p} priority={i < 3} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EmptyState title="No projects found" description={q || category ? 'Try a different search or category.' : 'Case studies will be published here soon.'} />
            </div>
          )}
          <Pagination page={page} totalPages={projects.meta.totalPages} hrefFor={(p) => href({ category, page: p })} />
        </div>
      </Section>
    </>
  );
}
