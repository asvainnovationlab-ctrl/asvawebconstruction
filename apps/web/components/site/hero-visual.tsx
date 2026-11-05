import Image from 'next/image';
import Link from 'next/link';
import { SITE_IMAGES } from '@/lib/site-images';
import type { Service } from '@/lib/types';

/** The hero's single visual: a team photo with the services we provide listed on top, each linking to its page. */
export function HeroVisual({ services }: { services: Pick<Service, 'id' | 'name' | 'slug'>[] }) {
  return (
    <figure className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <Image
        src={SITE_IMAGES.teamCollab.src}
        alt={SITE_IMAGES.teamCollab.alt}
        width={1600}
        height={1067}
        priority
        sizes="(min-width: 1024px) 40vw, 100vw"
        className="aspect-[4/5] w-full rounded-lg border object-cover sm:aspect-[4/3] lg:aspect-[4/5]"
      />
      {services.length > 0 && (
        <div className="absolute inset-x-3 bottom-3 overflow-hidden rounded-lg border bg-white/95 shadow-sm backdrop-blur sm:inset-x-4 sm:bottom-4">
          <div className="flex items-center justify-between border-b bg-surface px-4 py-2.5">
            <span className="font-mono text-[11px] text-muted-ink">Services we provide</span>
            <span className="font-mono text-[11px] text-muted-ink">{services.length} services</span>
          </div>
          <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0">
            {services.slice(0, 6).map((service, i) => (
              <li key={service.id} className="sm:border-t sm:[&:nth-child(-n+2)]:border-t-0">
                <Link href={`/services/${service.slug}`} className="flex items-center gap-3 px-4 py-3 text-ink hover:text-brand">
                  <span className="font-mono text-[11px] text-muted-ink">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[14px] font-medium leading-tight">{service.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
