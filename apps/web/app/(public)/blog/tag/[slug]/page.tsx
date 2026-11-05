import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogListing } from '@/components/site/blog-listing';
import { getBlogTaxonomies, getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, tax] = await Promise.all([getSettings(), getBlogTaxonomies()]);
  const tag = tax.tags.find((t) => t.slug === slug);
  if (!tag) return { title: 'Tag not found' };
  return buildMetadata(settings, { title: `Articles tagged ${tag.name}`, path: `/blog/tag/${slug}`, noIndex: true });
}

export default async function BlogTagPage({ params, searchParams }: Props) {
  const [{ slug }, { page }] = await Promise.all([params, searchParams]);
  const tax = await getBlogTaxonomies();
  const tag = tax.tags.find((t) => t.slug === slug);
  if (!tag) notFound();
  return (
    <BlogListing
      title={`#${tag.name}`}
      description={`Articles tagged “${tag.name}”.`}
      basePath={`/blog/tag/${slug}`}
      crumbs={[{ name: 'Blog', path: '/blog' }, { name: tag.name, path: `/blog/tag/${slug}` }]}
      page={Math.max(1, Number(page) || 1)}
      tag={slug}
    />
  );
}
