import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PlaceholderArt, ProjectCard, SampleBadge } from '@/components/site/cards';
import { JsonLd, PageHero, RichText, Section } from '@/components/site/blocks';
import { Button } from '@/components/ui/button';
import { getProject, getSettings } from '@/lib/api/public';
import { notFoundOrRedirect } from '@/lib/not-found';
import { buildMetadata } from '@/lib/seo';
import { absoluteUrl, formatDate } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, project] = await Promise.all([getSettings(), getProject(slug)]);
  if (!project) return { title: 'Project not found' };
  return buildMetadata(settings, {
    title: project.seoTitle ?? project.title,
    description: project.seoDescription ?? project.summary,
    path: `/portfolio/${project.slug}`,
    image: project.featuredImage?.url,
    type: 'article',
    publishedTime: project.publishedAt,
    modifiedTime: project.updatedAt,
  });
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return notFoundOrRedirect(`/portfolio/${slug}`);

  const story = [
    { title: 'Objectives', body: project.objectives },
    { title: 'The challenge', body: project.challenges },
    { title: 'Our solution', body: project.solution },
    { title: 'Results', body: project.results },
  ].filter((s) => s.body);

  const facts: [string, string][] = [
    ...(project.clientName ? ([['Client', project.clientName]] as [string, string][]) : []),
    ...(project.category ? ([['Category', project.category.name]] as [string, string][]) : []),
    ...(project.completedAt ? ([['Completed', formatDate(project.completedAt)]] as [string, string][]) : []),
    ...(project.technologies.length ? ([['Technologies', project.technologies.map((t) => t.name).join(', ')]] as [string, string][]) : []),
  ];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: project.title,
          abstract: project.summary,
          url: absoluteUrl(`/portfolio/${project.slug}`),
          ...(project.completedAt ? { dateCreated: project.completedAt } : {}),
          keywords: project.technologies.map((t) => t.name).join(', '),
        }}
      />
      <PageHero eyebrow={project.category?.name ?? 'Case study'} title={project.title} description={project.summary} crumbs={[{ name: 'Portfolio', path: '/portfolio' }, { name: project.title, path: `/portfolio/${project.slug}` }]}>
        {project.isSample && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-ink">
            <SampleBadge /> Demonstration content — not a real client project.
          </p>
        )}
      </PageHero>

      <Section className="pt-10 sm:pt-12 lg:pt-14">
        <div className="container-page">
          <div className="relative aspect-[16/8] overflow-hidden rounded-lg border">
            {project.featuredImage ? (
              <Image src={project.featuredImage.url} alt={project.featuredImage.alt || project.title} fill priority sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
            ) : (
              <PlaceholderArt seed={project.slug} className="h-full w-full" />
            )}
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-10">
            <aside className="lg:col-span-3">
              <dl className="divide-y border-y text-[14px]">
                {facts.map(([k, v]) => (
                  <div key={k} className="py-3">
                    <dt className="text-muted-ink">{k}</dt>
                    <dd className="mt-0.5 text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {project.projectUrl && (
                <div className="mt-5">
                  <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" className="link-underline text-[14px] font-medium text-ink">
                    Visit project ↗
                  </a>
                </div>
              )}
            </aside>
            <article className="space-y-12 lg:col-span-8 lg:col-start-5">
              {story.map((s) => (
                <section key={s.title}>
                  <h2 className="type-label">{s.title}</h2>
                  <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-neutral-800">{s.body}</p>
                </section>
              ))}
              {project.caseStudy && <RichText html={project.caseStudy} />}
            </article>
          </div>

          {project.gallery.length > 0 && (
            <section aria-labelledby="gallery" className="mt-20">
              <h2 id="gallery" className="type-section">
                Screens
              </h2>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2">
                {project.gallery.map((g) =>
                  g.media ? (
                    <li key={g.id}>
                      <figure>
                        <Image src={g.media.url} alt={g.media.alt || g.caption || project.title} width={g.media.width ?? 1200} height={g.media.height ?? 800} sizes="(min-width: 640px) 50vw, 100vw" className="w-full rounded-lg border object-cover" />
                        {g.caption && <figcaption className="mt-2 text-[13px] text-muted-ink">{g.caption}</figcaption>}
                      </figure>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          )}
        </div>
      </Section>

      {project.related.length > 0 && (
        <Section tone="muted" labelledBy="related">
          <div className="container-page">
            <h2 id="related" className="type-section">
              More work
            </h2>
            <ul className="mt-10 grid gap-x-8 gap-y-12 md:grid-cols-3">
              {project.related.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section tone="dark">
        <div className="container-page grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="type-section text-white">Planning something similar?</h2>
            <p className="mt-4 max-w-xl text-[17px] text-mist">Tell us about your goals and how we can help.</p>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <Button asChild size="lg">
              <Link href="/start-a-project">Discuss a project</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
