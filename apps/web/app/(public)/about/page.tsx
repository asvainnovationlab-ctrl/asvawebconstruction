import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BackdropImage, Eyebrow, PageHero, PhotoBanner, Section } from '@/components/site/blocks';
import { SITE_IMAGES } from '@/lib/site-images';
import { Button } from '@/components/ui/button';
import { getSettings, getTeam } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings, { title: 'About Us', description: settings.about.intro.slice(0, 160), path: '/about' });
}

/** Editorial company profile: text-led, two-column rows, no decoration. */
export default async function AboutPage() {
  const [settings, team] = await Promise.all([getSettings(), getTeam()]);
  const { about, general } = settings;
  const place = [general.city, general.country].filter(Boolean).join(', ');

  return (
    <>
      <PageHero eyebrow={place ? `About · ${place}` : 'About'} title={about.heading} description={about.intro} crumbs={[{ name: 'About', path: '/about' }]} />

      <PhotoBanner src={SITE_IMAGES.workspace.src} alt={SITE_IMAGES.workspace.alt} />

      <Section labelledBy="mission-title">
        <div className="container-page grid gap-12 lg:grid-cols-12 lg:gap-10">
          <h2 id="mission-title" className="sr-only">
            Mission and vision
          </h2>
          <div className="lg:col-span-5">
            <Eyebrow>Mission</Eyebrow>
            <p className="mt-3 text-2xl leading-snug tracking-tight text-ink">{about.mission}</p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <Eyebrow>Vision</Eyebrow>
            <p className="mt-3 text-2xl leading-snug tracking-tight text-ink">{about.vision}</p>
          </div>
        </div>
      </Section>

      <Section tone="muted" labelledBy="approach-title">
        <div className="container-page grid gap-8 lg:grid-cols-12 lg:gap-10">
          <h2 id="approach-title" className="type-section lg:col-span-4">
            {about.approachHeading}
          </h2>
          <p className="type-lead whitespace-pre-line text-neutral-700 lg:col-span-7 lg:col-start-6">{about.approach}</p>
        </div>
      </Section>

      {about.values.length > 0 && (
        <Section labelledBy="values-title">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <h2 id="values-title" className="type-section lg:col-span-4">
              Values
            </h2>
            <dl className="lg:col-span-8">
              {about.values.map((v) => (
                <div key={v.title} className="grid gap-1 border-t py-5 sm:grid-cols-3 sm:gap-6">
                  <dt className="text-[17px] font-medium text-ink">{v.title}</dt>
                  <dd className="text-[15px] leading-relaxed text-muted-ink sm:col-span-2">{v.description}</dd>
                </div>
              ))}
              <div className="border-t" />
            </dl>
          </div>
        </Section>
      )}

      {about.timeline.length > 0 && (
        <Section tone="muted" labelledBy="timeline-title">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <h2 id="timeline-title" className="type-section lg:col-span-4">
              Timeline
            </h2>
            <ol className="lg:col-span-8">
              {about.timeline.map((t) => (
                <li key={`${t.year}-${t.title}`} className="grid gap-1 border-t py-5 sm:grid-cols-4 sm:gap-6">
                  <span className="font-mono text-sm text-muted-ink">{t.year}</span>
                  <div className="sm:col-span-3">
                    <h3 className="text-[17px] font-medium text-ink">{t.title}</h3>
                    {t.description && <p className="mt-1 text-[15px] text-muted-ink">{t.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {about.showTeam && team.length > 0 && (
        <Section labelledBy="team-title">
          <div className="container-page">
            <h2 id="team-title" className="type-section">
              Team
            </h2>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m) => (
                <li key={m.id}>
                  <div className="relative aspect-square overflow-hidden rounded-lg border bg-neutral-100">
                    {m.photo ? (
                      <Image src={m.photo.url} alt={m.photo.alt || m.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-5xl font-semibold tracking-tighter text-neutral-300" aria-hidden>
                        {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-medium text-ink">{m.name}</p>
                  <p className="text-[14px] text-muted-ink">{m.role}</p>
                  {m.bio && <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">{m.bio}</p>}
                  {m.linkedinUrl && (
                    <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="link-underline mt-2 inline-block text-[14px] text-ink">
                      LinkedIn ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section tone="dark" className="relative overflow-hidden">
        <BackdropImage src={SITE_IMAGES.teamCollab.src} />
        <div className="container-page relative grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="type-section text-white">Let’s talk about your project</h2>
            <p className="mt-4 max-w-xl text-[17px] text-neutral-400">Tell us where you want to get to. We will help you decide how.</p>
          </div>
          <div className="flex gap-3 lg:col-span-4 lg:justify-self-end">
            <Button asChild size="lg">
              <Link href="/start-a-project">Discuss a project</Link>
            </Button>
            <Button asChild size="lg" variant="outline-dark">
              <Link href="/contact">Contact</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
