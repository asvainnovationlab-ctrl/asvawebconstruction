import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import type { Navigation, PublicSettings, Service } from '@/lib/types';
import { CookieSettingsButton } from './cookie-consent';
import { NewsletterForm } from './newsletter-form';

export function SiteFooter({ settings, navigation, services }: { settings: PublicSettings; navigation: Navigation; services: Service[] }) {
  const { contact, social, footer, general } = settings;
  const address = [contact.addressLine, contact.city, contact.country].filter(Boolean).join(', ');
  const year = new Date().getFullYear();
  const linkClass = 'text-[14px] text-muted-ink transition-colors hover:text-ink';

  return (
    <footer className="border-t bg-white">
      <div className="container-page">
        <div className="grid gap-12 py-14 md:grid-cols-12">
          <div className="md:col-span-4">
            <Logo tone="dark" uploaded={settings.media.logoForLightBg} className="h-9" />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-muted-ink">{footer.description}</p>
            <address className="mt-5 space-y-1 text-[14px] not-italic text-muted-ink">
              {contact.email && (
                <p>
                  <a href={`mailto:${contact.email}`} className="text-ink hover:underline">
                    {contact.email}
                  </a>
                </p>
              )}
              {contact.phone && (
                <p>
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-ink">
                    {contact.phone}
                  </a>
                </p>
              )}
              {address && <p>{address}</p>}
              {contact.businessHours.map((h) => (
                <p key={h.label}>
                  {h.label}: {h.hours}
                </p>
              ))}
              {!contact.email && !contact.phone && (
                <p>
                  <Link href="/contact" className="text-ink hover:underline">
                    Contact us
                  </Link>
                </p>
              )}
            </address>
          </div>

          <FooterColumn title="Company" className="md:col-span-2">
            {navigation.FOOTER_QUICK_LINKS.map((item) => (
              <li key={item.id}>
                <Link href={item.href} target={item.openInNewTab ? '_blank' : undefined} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Services" className="md:col-span-3">
            {services.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/services/${s.slug}`} className={linkClass}>
                  {s.name}
                </Link>
              </li>
            ))}
            {services.length === 0 && <li className="text-[14px] text-muted-ink">Coming soon</li>}
          </FooterColumn>

          <div className="md:col-span-3">
            {footer.newsletterEnabled ? (
              <>
                <h2 className="text-[13px] font-medium text-ink">{footer.newsletterHeading}</h2>
                {footer.newsletterBody && <p className="mt-2 text-[13px] leading-relaxed text-muted-ink">{footer.newsletterBody}</p>}
                <div className="mt-4">
                  <NewsletterForm dark={false} />
                </div>
              </>
            ) : null}
            {social.links.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1" aria-label="Social media">
                {social.links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer me" className={linkClass}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t py-6 text-[13px] text-muted-ink sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {footer.copyrightName} · Company Regd. No. 398769/83/84
            {general.city ? ` · ${general.city}, ${general.country}` : ''}
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1" aria-label="Legal">
            {navigation.FOOTER_LEGAL.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="transition-colors hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <h2 className="text-[13px] font-medium text-ink">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}
