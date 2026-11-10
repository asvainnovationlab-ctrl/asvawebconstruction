import type { Metadata } from 'next';
import Link from 'next/link';
import { ServiceRow } from '@/components/site/cards';
import { BackdropImage, EmptyState, PageHero, Section } from '@/components/site/blocks';
import { SITE_IMAGES } from '@/lib/site-images';
import { Button } from '@/components/ui/button';
import { getServices, getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), {
    title: 'Software Development Services',
    description: 'Custom software, web and mobile application development, UI/UX design, cloud and IT consulting services from Pokhara, Nepal.',
    path: '/services',
  });
}

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageHero
        title="Software development services"
        description="From discovery to deployment and beyond, we help businesses in Nepal and abroad design, build and run reliable digital products."
        crumbs={[{ name: 'Services', path: '/services' }]}
      />
      <Section>
        <div className="container-page">
          {services.length ? (
            <ul className="divide-y border-y">
              {services.map((service, i) => (
                <li key={service.id}>
                  <ServiceRow service={service} index={i} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Services coming soon" description="We are preparing detailed descriptions of our services. In the meantime, tell us what you need." action={<Button asChild><Link href="/contact">Contact us</Link></Button>} />
          )}
        </div>
      </Section>
      <Section tone="dark" className="relative overflow-hidden">
        <BackdropImage src={SITE_IMAGES.ai.src} />
        <div className="container-page relative grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="type-section text-white">Not sure which service fits?</h2>
            <p className="mt-4 max-w-xl text-[17px] text-mist">Describe the problem you are solving and we will recommend an approach.</p>
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
