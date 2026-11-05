import type { Metadata } from 'next';
import { BlogListing } from '@/components/site/blog-listing';
import { getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, page } = await searchParams;
  const n = Number(page) || 1;
  return buildMetadata(await getSettings(), {
    title: n > 1 ? `Insights — page ${n}` : 'Insights & Articles',
    description: 'Articles on software engineering, product design and technology for growing businesses, from the team at Asva Innovation Lab.',
    path: n > 1 ? `/blog?page=${n}` : '/blog',
    noIndex: Boolean(q),
  });
}

export default async function BlogPage({ searchParams }: Props) {
  const { q, page } = await searchParams;
  return (
    <BlogListing
      title="Insights"
      description="Practical thinking on software engineering, product design and technology for growing businesses."
      basePath="/blog"
      crumbs={[{ name: 'Blog', path: '/blog' }]}
      page={Math.max(1, Number(page) || 1)}
      q={q}
    />
  );
}
