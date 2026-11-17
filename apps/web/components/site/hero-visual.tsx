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
 * The hero's single visual: the studio whiteboard presented like a device — navy chrome on top and
 * the board below it, shown whole and unobstructed at rest.
 *
 * Hovering the card (or tabbing into it) frosts the whole board over and the six services rise into
 * place one after another, so the card reads as a board that turns into a menu rather than a panel
 * sliding in at the bottom. The overlay keeps the handwriting faintly visible behind it.
 *
 * Below `sm` there is no hover to rely on, so the panel is always visible and sits under the photo
 * in normal flow, leaving the whole board readable on a phone.
 */
export function HeroVisual({ services, image, location }: HeroVisualProps) {
  const photo = image ?? SITE_IMAGES.homeHero;
  const shown = services.slice(0, 6);

  /** Shown at rest on phones; faded and staggered in on hover from `sm` up. */
  const revealed =
    'sm:translate-y-3 sm:opacity-0 sm:transition sm:duration-500 sm:ease-out sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 sm:motion-reduce:transform-none sm:motion-reduce:transition-opacity';

  return (
    <figure className="group relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Soft brand wash behind the card — depth without a heavy shadow. */}
      <div aria-hidden className="pointer-events-none absolute -inset-5 -z-10 rounded-3xl bg-gradient-to-br from-brand/20 via-accent/10 to-transparent blur-2xl" />

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

        {/* The board. On hover the services take over the whole of it. */}
        <div className="relative bg-white">
          <Image src={photo.src} alt={photo.alt} width={1360} height={1100} priority sizes="(min-width: 1024px) 46vw, (min-width: 640px) 32rem, 100vw" className="block w-full" />
          <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/5" />

          {shown.length > 0 && (
            <div className="border-t border-ink/10 bg-white sm:absolute sm:inset-0 sm:flex sm:flex-col sm:border-t-0 sm:bg-white/94 sm:opacity-0 sm:backdrop-blur-[5px] sm:transition-opacity sm:duration-300 sm:ease-out sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:motion-reduce:transition-none">
              <div className={`flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3 ${revealed}`}>
                <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-ink">
                  <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                  Services we provide
                </span>
                <span className="font-mono text-[10.5px] tabular-nums text-muted-ink/60">{services.length} total</span>
              </div>

              <ul className="grid grid-cols-2 border-t border-ink/10 sm:flex-1 sm:grid-rows-3">
                {shown.map((service, i) => (
                  <li key={service.id} style={{ transitionDelay: `${90 + i * 70}ms` }} className={`border-ink/10 [&:not(:nth-child(-n+2))]:border-t [&:nth-child(odd)]:border-r ${revealed}`}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="group/item flex h-full min-h-[3.25rem] items-center gap-2 px-2.5 py-2 transition-colors hover:bg-brand/5 focus-visible:bg-brand/5 sm:gap-2.5 sm:px-5"
                    >
                      <span aria-hidden className="shrink-0 font-mono text-[10.5px] tabular-nums text-brand/70">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="line-clamp-2 text-[12px] font-medium leading-[1.3] text-ink transition-colors group-hover/item:text-brand sm:text-[13px]">{service.name}</span>
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
      </div>
    </figure>
  );
}
