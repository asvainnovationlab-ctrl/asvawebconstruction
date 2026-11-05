import { Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { htmlToPlainText } from '@asva/shared';
import { PostCard } from '@/components/site/cards';
import { JsonLd, PageHero, RichText, Section } from '@/components/site/blocks';
import { ShareLinks } from '@/components/site/share-links';
import { getPost, getSettings } from '@/lib/api/public';
import { notFoundOrRedirect } from '@/lib/not-found';
import { buildMetadata } from '@/lib/seo';
import { absoluteUrl, formatDate } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, post] = await Promise.all([getSettings(), getPost(slug)]);
  if (!post) return { title: 'Article not found' };
  return buildMetadata(settings, {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? htmlToPlainText(post.content, 160),
    path: `/blog/${post.slug}`,
    image: post.featuredImage?.url,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPost(slug), getSettings()]);
  if (!post) return notFoundOrRedirect(`/blog/${slug}`);
  const url = absoluteUrl(`/blog/${post.slug}`);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt ?? htmlToPlainText(post.content, 160),
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          mainEntityOfPage: url,
          ...(post.featuredImage ? { image: absoluteUrl(post.featuredImage.url) } : {}),
          author: post.author ? { '@type': 'Person', name: post.author.name } : { '@type': 'Organization', name: settings.general.companyName },
          publisher: { '@type': 'Organization', name: settings.general.companyName, logo: { '@type': 'ImageObject', url: absoluteUrl('/brand/logo-full-dark.svg') } },
          ...(post.tags.length ? { keywords: post.tags.map((t) => t.name).join(', ') } : {}),
        }}
      />
      <PageHero
        eyebrow={post.category?.name ?? 'Article'}
        title={post.title}
        description={post.excerpt}
        crumbs={[{ name: 'Blog', path: '/blog' }, ...(post.category ? [{ name: post.category.name, path: `/blog/category/${post.category.slug}` }] : []), { name: post.title, path: `/blog/${post.slug}` }]}
      >
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-ink">
          {post.author && <span className="font-medium text-ink">{post.author.name}</span>}
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden /> {post.readingTimeMinutes} min read
          </span>
        </div>
      </PageHero>

      <Section className="pt-12 sm:pt-14 lg:pt-14">
        <div className="container-page">
          <div className="mx-auto max-w-3xl">
            {post.featuredImage && (
              <Image src={post.featuredImage.url} alt={post.featuredImage.alt || ''} width={post.featuredImage.width ?? 1200} height={post.featuredImage.height ?? 675} priority sizes="(min-width: 768px) 768px, 100vw" className="mb-12 w-full rounded-lg border object-cover" />
            )}
            <RichText html={post.content} className="prose-lg" />

            <div className="mt-14 flex flex-col gap-6 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
              {post.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Tags">
                  {post.tags.map((t) => (
                    <li key={t.id}>
                      <Link href={`/blog/tag/${t.slug}`} className="rounded-md bg-surface px-2.5 py-1 text-sm text-muted-ink ring-1 ring-slate-200 hover:text-ink">
                        #{t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <span />
              )}
              <ShareLinks url={url} title={post.title} />
            </div>

            {post.author && (
              <aside aria-label="About the author" className="mt-10 flex gap-5 border-t pt-8">
                {post.author.avatar ? (
                  <Image src={post.author.avatar.url} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-500" aria-hidden>
                    {post.author.name.charAt(0)}
                  </span>
                )}
                <div>
                  <p className="font-semibold text-ink">{post.author.name}</p>
                  {post.author.title && <p className="text-sm text-muted-ink">{post.author.title}</p>}
                  {post.author.bio && <p className="mt-2 text-sm leading-relaxed text-slate-700">{post.author.bio}</p>}
                </div>
              </aside>
            )}
          </div>
        </div>
      </Section>

      {post.related.length > 0 && (
        <Section tone="muted" labelledBy="related-posts">
          <div className="container-page">
            <h2 id="related-posts" className="type-section">
              Related articles
            </h2>
            <ul className="mt-10 grid gap-x-8 gap-y-12 md:grid-cols-3">
              {post.related.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </>
  );
}
