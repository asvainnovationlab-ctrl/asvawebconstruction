import type { Metadata } from 'next';
import { ContactForm } from '@/components/forms/contact-form';
import { Eyebrow, PageHero, Section, TextLink } from '@/components/site/blocks';
import { getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), {
    title: 'Contact Us',
    description: 'Get in touch with Asva Innovation Lab, a software development company in Pokhara, Nepal.',
    path: '/contact',
  });
}

export default async function ContactPage() {
  const { contact, social } = await getSettings();
  const address = [contact.addressLine, contact.city, contact.country].filter(Boolean).join(', ');
  const hasDetails = contact.email || contact.phone || contact.whatsapp || address;

  return (
    <>
      <PageHero title="Contact" description="Questions, ideas or a project brief. Send us a message and our team will get back to you." crumbs={[{ name: 'Contact', path: '/contact' }]} />
      <Section>
        <div className="container-page grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <h2 className="text-xl font-semibold">Send us a message</h2>
            <p className="mt-1 text-[14px] text-muted-ink">Fields marked * are required.</p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
          <aside className="space-y-10 lg:col-span-4 lg:col-start-9">
            <div>
              <Eyebrow>Details</Eyebrow>
              <dl className="mt-3 divide-y border-y text-[15px]">
                {contact.email && (
                  <div className="py-3">
                    <dt className="text-[13px] text-muted-ink">Email</dt>
                    <dd>
                      <a href={`mailto:${contact.email}`} className="link-underline text-ink">
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.phone && (
                  <div className="py-3">
                    <dt className="text-[13px] text-muted-ink">Phone</dt>
                    <dd>
                      <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="link-underline text-ink">
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.whatsapp && (
                  <div className="py-3">
                    <dt className="text-[13px] text-muted-ink">WhatsApp</dt>
                    <dd>
                      <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="link-underline text-ink">
                        {contact.whatsapp}
                      </a>
                    </dd>
                  </div>
                )}
                {address && (
                  <div className="py-3">
                    <dt className="text-[13px] text-muted-ink">Office</dt>
                    <dd>
                      <address className="not-italic text-ink">{address}</address>
                    </dd>
                  </div>
                )}
                {contact.businessHours.map((h) => (
                  <div key={h.label} className="py-3">
                    <dt className="text-[13px] text-muted-ink">{h.label}</dt>
                    <dd className="text-ink">{h.hours}</dd>
                  </div>
                ))}
                {!hasDetails && <div className="py-3 text-muted-ink">Use the form and our team will reply by email.</div>}
              </dl>
              {social.links.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                  {social.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="link-underline text-ink">
                        {l.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Eyebrow>New project?</Eyebrow>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">Share scope, budget and timeline in our short project form so we can prepare a useful first conversation.</p>
              <div className="mt-4">
                <TextLink href="/start-a-project">Start a project</TextLink>
              </div>
            </div>
            {contact.mapEmbedUrl && (
              <iframe src={contact.mapEmbedUrl} title="Office location map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups" className="aspect-[4/3] w-full rounded-lg border" />
            )}
          </aside>
        </div>
      </Section>
    </>
  );
}
