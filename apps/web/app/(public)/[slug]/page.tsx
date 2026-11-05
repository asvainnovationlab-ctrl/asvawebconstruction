import type { Metadata } from 'next';
import Image from 'next/image';
import { htmlToPlainText } from '@asva/shared';
import { PageHero, RichText, Section } from '@/components/site/blocks';
import { getPage, getSettings } from '@/lib/api/public';
import { notFoundOrRedirect } from '@/lib/not-found';
import { buildMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

/** CMS-managed pages (including legal pages) at /{slug}. Reserved slugs are blocked by the API. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, page] = await Promise.all([getSettings(), getPage(slug)]);
  if (!page) return { title: 'Page not found' };
  return buildMetadata(settings, {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? page.excerpt ?? htmlToPlainText(page.content, 160),
    path: `/${page.slug}`,
    image: page.featuredImage?.url,
    noIndex: page.noIndex,
  });
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return notFoundOrRedirect(`/${slug}`);
  return (
    <>
      <PageHero title={page.title} description={page.excerpt} crumbs={[{ name: page.title, path: `/${page.slug}` }]} />
      <Section tone="white" className="pt-12 sm:pt-16 lg:pt-16">
        <div className="container-page max-w-3xl">
          {page.featuredImage && (
            <Image src={page.featuredImage.url} alt={page.featuredImage.alt || ''} width={page.featuredImage.width ?? 1200} height={page.featuredImage.height ?? 600} className="mb-10 w-full rounded-2xl border object-cover" priority sizes="768px" />
          )}
          <RichText html={page.content} />
          <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-muted-ink">Last updated {formatDate(page.updatedAt)}</p>
        </div>
      </Section>
    </>
  );
}
