import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ServiceRow } from '@/components/site/cards';
import { Eyebrow, JsonLd, PageHero, RichText, Section } from '@/components/site/blocks';
import { Button } from '@/components/ui/button';
import { getService, getSettings } from '@/lib/api/public';
import { notFoundOrRedirect } from '@/lib/not-found';
import { buildMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, service] = await Promise.all([getSettings(), getService(slug)]);
  if (!service) return { title: 'Service not found' };
  return buildMetadata(settings, {
    title: service.seoTitle ?? service.name,
    description: service.seoDescription ?? service.shortDescription,
    path: `/services/${service.slug}`,
    image: service.coverImage?.url,
  });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const [service, settings] = await Promise.all([getService(slug), getSettings()]);
  if (!service) return notFoundOrRedirect(`/services/${slug}`);
  const steps = settings.home.process.enabled ? settings.home.process.steps : [];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: service.name,
          description: service.shortDescription,
          url: absoluteUrl(`/services/${service.slug}`),
          provider: { '@type': 'Organization', name: settings.general.companyName, url: absoluteUrl('/') },
          areaServed: ['NP', 'Worldwide'],
        }}
      />
      <PageHero eyebrow="Service" title={service.name} description={service.shortDescription} crumbs={[{ name: 'Services', path: '/services' }, { name: service.name, path: `/services/${service.slug}` }]}>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/start-a-project?service=${encodeURIComponent(service.name)}`}>Discuss this service</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/portfolio">See our work</Link>
          </Button>
        </div>
      </PageHero>

      <Section>
        <div className="container-page grid gap-14 lg:grid-cols-12 lg:gap-10">
          <article className="lg:col-span-7">
            {service.coverImage && (
              <Image src={service.coverImage.url} alt={service.coverImage.alt || service.name} width={service.coverImage.width ?? 1200} height={service.coverImage.height ?? 675} className="mb-10 w-full rounded-lg border object-cover" priority sizes="(min-width: 1024px) 58vw, 100vw" />
            )}
            <RichText html={service.description} />
          </article>
          <aside className="space-y-10 lg:col-span-4 lg:col-start-9">
            {service.features.length > 0 && (
              <div>
                <Eyebrow>Capabilities</Eyebrow>
                <ul className="mt-3 divide-y border-y">
                  {service.features.map((f) => (
                    <li key={f} className="py-3 text-[15px] text-ink">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {service.technologies.length > 0 && (
              <div>
                <Eyebrow>Technologies</Eyebrow>
                <p className="mt-3 text-[15px] leading-relaxed text-ink">{service.technologies.map((t) => t.name).join('  ·  ')}</p>
              </div>
            )}
          </aside>
        </div>
      </Section>

      {steps.length > 0 && (
        <Section tone="muted" labelledBy="approach">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <h2 id="approach" className="type-section lg:col-span-4">
              Our approach
            </h2>
            <ol className="divide-y border-y lg:col-span-8">
              {steps.map((s, i) => (
                <li key={s.title} className="grid gap-1 py-4 sm:grid-cols-12 sm:gap-6">
                  <span className="font-mono text-[12px] text-muted-ink sm:col-span-1 sm:pt-1">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-[15px] font-medium text-ink sm:col-span-5">{s.title}</h3>
                  <p className="text-[15px] text-muted-ink sm:col-span-6">{s.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {service.related && service.related.length > 0 && (
        <Section labelledBy="related-services">
          <div className="container-page">
            <h2 id="related-services" className="type-section">
              Related services
            </h2>
            <ul className="mt-8 divide-y border-y">
              {service.related.map((s) => (
                <li key={s.id}>
                  <ServiceRow service={s} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section tone="dark">
        <div className="container-page grid items-end gap-6 lg:grid-cols-12">
          <h2 className="type-section text-white lg:col-span-8">Have a project in mind?</h2>
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
