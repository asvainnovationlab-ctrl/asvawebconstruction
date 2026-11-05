import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LABELS, type TechnologyCategory } from '@asva/shared';
import { PostRow, ProjectCard, ServiceRow } from '@/components/site/cards';
import { BackdropImage, Eyebrow, Section, SectionHeading, TextLink } from '@/components/site/blocks';
import { SITE_IMAGES } from '@/lib/site-images';
import { Reveal } from '@/components/site/reveal';
import { HeroVisual } from '@/components/site/hero-visual';
import { Button } from '@/components/ui/button';
import { getPosts, getProjects, getServices, getSettings, getTechnologies, getTestimonials } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

const enter = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), { path: '/' });
}

export default async function HomePage() {
  const [settings, services, featured, technologies, testimonials, posts] = await Promise.all([
    getSettings(),
    getServices(),
    getProjects({ featured: 'true', pageSize: 3 }),
    getTechnologies(),
    getTestimonials(),
    getPosts({ pageSize: 4 }),
  ]);
  const { home } = settings;
  const techByCategory = Object.entries(
    technologies.reduce<Record<string, typeof technologies>>((acc, t) => {
      (acc[t.category ?? 'OTHER'] ??= []).push(t);
      return acc;
    }, {}),
  );
  const [lead, second, third] = featured.data;

  return (
    <>
      {/* ------------------------------------------------------------------ Hero */}
      <section aria-labelledby="hero-title" className="border-b bg-white">
        <div className="container-page grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-24">
          <div className="lg:col-span-7">
            {home.hero.eyebrow && (
              <p className="hero-in text-[13px] font-medium tracking-[0.06em] text-muted-ink" style={enter(0)}>
                {home.hero.eyebrow}
              </p>
            )}
            <h1 id="hero-title" className="type-hero hero-in mt-6 max-w-3xl text-ink" style={enter(90)}>
              {home.hero.headline}
            </h1>
            <p className="type-lead hero-in mt-6 max-w-xl text-muted-ink" style={enter(190)}>
              {home.hero.subheadline}
            </p>
            <div className="hero-in mt-9 flex flex-col gap-3 sm:flex-row" style={enter(290)}>
              <Button asChild size="lg">
                <Link href={home.hero.primaryCta.href}>{home.hero.primaryCta.label}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={home.hero.secondaryCta.href}>{home.hero.secondaryCta.label}</Link>
              </Button>
            </div>
          </div>
          <div className="hero-in lg:col-span-5" style={enter(380)}>
            {settings.media.heroImage ? (
              <Image
                src={settings.media.heroImage.url}
                alt={settings.media.heroImage.alt}
                width={settings.media.heroImage.width ?? 1200}
                height={settings.media.heroImage.height ?? 900}
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="w-full rounded-lg border"
              />
            ) : (
              <HeroVisual services={services} />
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Introduction (editorial) */}
      <Section labelledBy="intro-title" className="pb-0 sm:pb-0 lg:pb-0">
        <div className="container-page grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">{home.intro.eyebrow && <Eyebrow>{home.intro.eyebrow}</Eyebrow>}</div>
          <Reveal className="lg:col-span-8">
            <h2 id="intro-title" className="type-section max-w-3xl text-ink">
              {home.intro.heading}
            </h2>
            <p className="type-lead mt-6 max-w-2xl text-muted-ink">{home.intro.body}</p>
            <div className="mt-7">
              <TextLink href={home.intro.cta.href}>{home.intro.cta.label}</TextLink>
            </div>
          </Reveal>
        </div>
        {home.whyChooseUs.enabled && home.whyChooseUs.items.length > 0 && (
          <div className="container-page mt-16 lg:mt-20">
            <h3 className="sr-only">{home.whyChooseUs.heading}</h3>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {home.whyChooseUs.items.map((item, i) => (
                <Reveal key={item.title} delay={(i % 3) * 90} className="border-t pt-5">
                  <dt className="text-[15px] font-medium text-ink">{item.title}</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-muted-ink">{item.description}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------------ Services (rows) */}
      {services.length > 0 && (
        <Section labelledBy="services-title">
          <div className="container-page grid gap-10 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <h2 id="services-title" className="type-section text-ink">
                  {home.services.heading}
                </h2>
                {home.services.subheading && <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-muted-ink">{home.services.subheading}</p>}
                <div className="mt-6">
                  <TextLink href="/services">All services</TextLink>
                </div>
              </div>
            </div>
            <ul className="divide-y border-y lg:col-span-8">
              {services.slice(0, home.services.limit).map((service, i) => (
                <li key={service.id}>
                  <Reveal delay={i * 60}>
                    <ServiceRow service={service} index={i} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ Selected work (editorial grid) */}
      {home.projects.enabled && lead && (
        <Section tone="muted" labelledBy="work-title">
          <div className="container-page">
            <SectionHeading id="work-title" title={home.projects.heading} description={home.projects.subheading} action={<TextLink href="/portfolio">All work</TextLink>} />
            <div className="mt-12 grid gap-x-8 gap-y-14 lg:grid-cols-12">
              <Reveal className="lg:col-span-7">
                <ProjectCard project={lead} size="lg" priority />
              </Reveal>
              {second && (
                <Reveal delay={120} className="lg:col-span-5 lg:mt-24">
                  <ProjectCard project={second} />
                </Reveal>
              )}
              {third && (
                <Reveal delay={60} className="lg:col-span-5">
                  <ProjectCard project={third} />
                </Reveal>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ Process (horizontal on wide screens) */}
      {home.process.enabled && home.process.steps.length > 0 && (
        <Section labelledBy="process-title">
          <div className="container-page">
            <SectionHeading id="process-title" title={home.process.heading} description={home.process.subheading} />
            <ol className="mt-12 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {home.process.steps.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 90}>
                    <span className="reveal-line block h-px bg-ink" aria-hidden />
                    <span className="mt-4 block font-mono text-[12px] text-muted-ink">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="mt-3 text-[15px] font-medium leading-snug text-ink">{step.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">{step.description}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ Technologies (plain text) */}
      {home.technologies.enabled && technologies.length > 0 && (
        <Section tone="muted" labelledBy="tech-title">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="tech-title" className="type-section text-ink">
                {home.technologies.heading}
              </h2>
              {home.technologies.subheading && <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-muted-ink">{home.technologies.subheading}</p>}
            </div>
            <dl className="lg:col-span-8">
              {techByCategory.map(([category, items], i) => (
                <Reveal key={category} delay={i * 50} className="grid gap-1 border-t py-4 sm:grid-cols-4 sm:gap-6">
                  <dt className="text-[14px] text-muted-ink">{LABELS.technologyCategory[category as TechnologyCategory] ?? category}</dt>
                  <dd className="text-[15px] text-ink sm:col-span-3">{items.map((t) => t.name).join('  ·  ')}</dd>
                </Reveal>
              ))}
              <div className="border-t" />
            </dl>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ Testimonials (approved + consented only) */}
      {testimonials.length > 0 && (
        <Section labelledBy="testimonials-title">
          <div className="container-page">
            <SectionHeading id="testimonials-title" title={home.testimonials.heading} description={home.testimonials.subheading} />
            <ul className="mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2">
              {testimonials.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <figure>
                    <blockquote className="text-xl leading-snug tracking-tight text-ink">“{t.content}”</blockquote>
                    <figcaption className="mt-5 text-[14px]">
                      <span className="font-medium text-ink">{t.clientName}</span>
                      <span className="text-muted-ink">{[t.designation, t.company].filter(Boolean).length ? `, ${[t.designation, t.company].filter(Boolean).join(', ')}` : ''}</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ Insights (list) */}
      {home.insights.enabled && posts.data.length > 0 && (
        <Section labelledBy="insights-title" className={testimonials.length === 0 && !(home.technologies.enabled && technologies.length) ? '' : 'border-t'}>
          <div className="container-page">
            <SectionHeading id="insights-title" title={home.insights.heading} description={home.insights.subheading} action={<TextLink href="/blog">All articles</TextLink>} />
            <ul className="mt-10 divide-y border-y">
              {posts.data.map((post, i) => (
                <li key={post.id}>
                  <Reveal delay={i * 70}>
                    <PostRow post={post} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ Closing call to action */}
      <Section tone="dark" labelledBy="cta-title" className="relative overflow-hidden">
        <BackdropImage src={SITE_IMAGES.cloud.src} />
        <div className="container-page relative grid items-end gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <h2 id="cta-title" className="type-section max-w-2xl text-white">
              {home.cta.heading}
            </h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-neutral-400">{home.cta.body}</p>
          </Reveal>
          <Reveal delay={140} className="lg:col-span-4 lg:justify-self-end">
            <Button asChild size="lg">
              <Link href={home.cta.button.href}>{home.cta.button.label}</Link>
            </Button>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
