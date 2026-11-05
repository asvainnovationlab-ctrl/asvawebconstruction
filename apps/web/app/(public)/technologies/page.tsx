import type { Metadata } from 'next';
import Image from 'next/image';
import { LABELS, TECHNOLOGY_CATEGORIES } from '@asva/shared';
import { EmptyState, PageHero, Section } from '@/components/site/blocks';
import { getSettings, getTechnologies } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), {
    title: 'Technologies',
    description: 'The frameworks, languages, databases and cloud tools Asva Innovation Lab uses to build web, mobile and enterprise software.',
    path: '/technologies',
  });
}

export default async function TechnologiesPage() {
  const technologies = await getTechnologies();
  const groups = TECHNOLOGY_CATEGORIES.map((category) => ({ category, items: technologies.filter((t) => t.category === category) })).filter((g) => g.items.length);
  return (
    <>
      <PageHero title="Technology" description="We choose well-supported technologies that fit each project’s requirements and long-term maintainability." crumbs={[{ name: 'Technologies', path: '/technologies' }]} />
      <Section>
        <div className="container-page">
          {groups.length ? (
            <dl>
              {groups.map((g) => (
                <div key={g.category} className="grid gap-3 border-t py-6 sm:grid-cols-4 sm:gap-6">
                  <dt className="text-[15px] font-medium text-ink">{LABELS.technologyCategory[g.category]}</dt>
                  <dd className="sm:col-span-3">
                    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink">
                      {g.items.map((t) => (
                        <li key={t.id} className="inline-flex items-center gap-2">
                          {t.logo && <Image src={t.logo.url} alt="" width={18} height={18} className="size-[18px] object-contain" />}
                          {t.name}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
              <div className="border-t" />
            </dl>
          ) : (
            <EmptyState title="Technology overview coming soon" description="We are preparing an overview of the tools we use." />
          )}
        </div>
      </Section>
    </>
  );
}
