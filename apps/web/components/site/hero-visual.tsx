import Image from 'next/image';
import Link from 'next/link';
import { SITE_IMAGES } from '@/lib/site-images';
import type { Service } from '@/lib/types';

interface HeroVisualProps {
  services: Pick<Service, 'id' | 'name' | 'slug'>[];
  /** Photo uploaded in Admin → Settings → Media. Falls back to the built-in home hero photo. */
  image?: { src: string; alt: string } | null;
  /** Small location chip in the card's top bar, e.g. "Pokhara, Nepal". Hidden when empty. */
  location?: string | null;
}

/**
 * The hero's single visual: the studio whiteboard presented like a device — navy chrome on top,
 * the board flush and unobstructed, and the services we provide listed underneath.
 */
export function HeroVisual({ services, image, location }: HeroVisualProps) {
  const photo = image ?? SITE_IMAGES.homeHero;
  const shown = services.slice(0, 4);

  return (
    <figure className="group relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Soft brand wash behind the card — depth without a heavy shadow. */}
      <div aria-hidden className="pointer-events-none absolute -inset-5 -z-10 rounded-3xl bg-gradient-to-br from-brand/20 via-accent/10 to-transparent blur-2xl" />
      {/* Editorial corner bracket. */}
      <div aria-hidden className="pointer-events-none absolute -right-2 -top-2 size-14 rounded-tr-lg border-r-2 border-t-2 border-brand/45 sm:-right-3 sm:-top-3 sm:size-20" />

      <div className="relative overflow-hidden rounded-lg border border-ink/15 bg-ink shadow-xl">
        {/* Navy chrome */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-ink to-navy-800 px-4 py-2.5">
          {location && (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-wide text-white">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-vivid opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand-vivid" />
              </span>
              {location}
            </span>
          )}
          <span aria-hidden className="ml-auto font-mono text-[11px] text-mist">
            {'// how we work'}
          </span>
        </div>

        <div aria-hidden className="h-px bg-gradient-to-r from-brand via-brand/40 to-transparent" />

        {/* The board itself — flush and uncropped, with nothing laid over the writing. */}
        <div className="relative bg-white">
          <Image src={photo.src} alt={photo.alt} width={1360} height={1100} priority sizes="(min-width: 1024px) 46vw, (min-width: 640px) 32rem, 100vw" className="block w-full" />
          <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/5" />
        </div>

        {shown.length > 0 && (
          <div className="bg-white">
            <div className="flex items-center justify-between gap-3 border-y bg-gradient-to-r from-surface to-white px-4 py-2.5">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-ink">
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                What we build
              </span>
              <span className="font-mono text-[11px] text-muted-ink">{services.length} services</span>
            </div>
            <ul className="grid grid-cols-2">
              {shown.map((service, i) => (
                <li key={service.id} className="border-t [&:nth-child(-n+2)]:border-t-0 [&:nth-child(odd)]:border-r">
                  <Link href={`/services/${service.slug}`} className="group/item flex h-full items-center gap-2.5 px-3 py-3 transition-colors hover:bg-brand/5 focus-visible:bg-brand/5 sm:px-4">
                    <span className="font-mono text-[11px] text-brand">{String(i + 1).padStart(2, '0')}</span>
                    <span className="line-clamp-2 text-[13.5px] font-medium leading-tight text-ink transition-colors group-hover/item:text-brand">{service.name}</span>
                    <span aria-hidden className="ml-auto shrink-0 text-brand opacity-0 transition duration-300 group-hover/item:translate-x-0.5 group-hover/item:opacity-100">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </figure>
  );
}
