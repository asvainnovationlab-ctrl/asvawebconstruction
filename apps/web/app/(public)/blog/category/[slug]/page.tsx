import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogListing } from '@/components/site/blog-listing';
import { getBlogTaxonomies, getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, tax] = await Promise.all([getSettings(), getBlogTaxonomies()]);
  const category = tax.categories.find((c) => c.slug === slug);
  if (!category) return { title: 'Category not found' };
  return buildMetadata(settings, { title: `${category.name} articles`, description: category.description ?? `Articles about ${category.name}.`, path: `/blog/category/${slug}` });
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const [{ slug }, { page }] = await Promise.all([params, searchParams]);
  const tax = await getBlogTaxonomies();
  const category = tax.categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return (
    <BlogListing
      title={category.name}
      description={category.description ?? `Articles about ${category.name}.`}
      basePath={`/blog/category/${slug}`}
      crumbs={[{ name: 'Blog', path: '/blog' }, { name: category.name, path: `/blog/category/${slug}` }]}
      page={Math.max(1, Number(page) || 1)}
      category={slug}
    />
  );
}
