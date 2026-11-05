import { Pagination, PostCard } from '@/components/site/cards';
import { EmptyState, PageHero, Section } from '@/components/site/blocks';
import { FilterChips, SearchBox } from '@/components/site/search-box';
import { getBlogTaxonomies, getPosts } from '@/lib/api/public';

interface Props {
  title: string;
  description: string;
  basePath: string;
  crumbs: { name: string; path: string }[];
  page: number;
  q?: string;
  category?: string;
  tag?: string;
}

export async function BlogListing({ title, description, basePath, crumbs, page, q, category, tag }: Props) {
  const [posts, taxonomies] = await Promise.all([getPosts({ page, pageSize: 9, q, category, tag }), getBlogTaxonomies()]);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return `${basePath}${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <PageHero title={title} description={description} crumbs={crumbs} />
      <Section>
        <div className="container-page">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips items={taxonomies.categories} active={category} hrefFor={(slug) => (slug ? `/blog/category/${slug}` : '/blog')} allLabel="All articles" />
            <SearchBox action="/blog" defaultValue={q} placeholder="Search articles" />
          </div>
          {taxonomies.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Tags">
              {taxonomies.tags.map((t) => (
                <li key={t.id}>
                  <a href={`/blog/tag/${t.slug}`} aria-current={tag === t.slug ? 'true' : undefined} className={`rounded-md px-2 py-1 ${tag === t.slug ? 'bg-brand text-white' : 'bg-white text-muted-ink ring-1 ring-slate-200 hover:text-ink'}`}>
                    #{t.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm text-muted-ink" role="status">
            {posts.meta.total} {posts.meta.total === 1 ? 'article' : 'articles'}
            {q ? ` matching “${q}”` : ''}
          </p>
          {posts.data.length ? (
            <ul className="mt-8 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {posts.data.map((post, i) => (
                <li key={post.id}>
                  <PostCard post={post} priority={i < 3} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EmptyState title="No articles found" description={q ? 'Try a different search term.' : 'New articles will be published here soon.'} />
            </div>
          )}
          <Pagination page={page} totalPages={posts.meta.totalPages} hrefFor={pageHref} />
        </div>
      </Section>
    </>
  );
}
