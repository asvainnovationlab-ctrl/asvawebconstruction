import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { breadcrumbJsonLd } from '@/lib/seo';
import { sanitize } from '@/lib/sanitize';
import { cn } from '@/lib/utils';

/** Serialises structured data safely (escapes `<` so content cannot close the script tag). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

/** Page section. `muted` is the light-gray band, `dark` is reserved for the closing call to action. */
export function Section({ className, children, tone = 'white', id, labelledBy }: { className?: string; children: React.ReactNode; tone?: 'white' | 'muted' | 'dark' | 'light'; id?: string; labelledBy?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('py-16 sm:py-20 lg:py-28', (tone === 'muted' || tone === 'light') && 'bg-surface', tone === 'white' && 'bg-white', tone === 'dark' && 'bg-dark text-mist', className)}
    >
      {children}
    </section>
  );
}

/** Photo behind a dark section's content. The parent Section gets `relative overflow-hidden` and its content `relative`. */
export function BackdropImage({ src, alt = '' }: { src: string; alt?: string }) {
  return (
    <>
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover opacity-30" />
      <div aria-hidden className="absolute inset-0 bg-dark/70" />
    </>
  );
}

/** Wide rounded photo placed between sections. */
export function PhotoBanner({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className="container-page">
      <div className={cn('relative aspect-[16/9] overflow-hidden rounded-lg border bg-neutral-100 sm:aspect-[21/9]', className)}>
        <Image src={src} alt={alt} fill sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
      </div>
    </div>
  );
}

export function Eyebrow({ children, dark = false, className }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return <p className={cn('type-label font-semibold', dark ? '!text-mist' : '!text-brand', className)}>{children}</p>;
}

/** Left-aligned section heading with an optional supporting paragraph and trailing action. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  dark = false,
  action,
  className,
}: {
  id?: string;
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  align?: 'left' | 'center';
  dark?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}
        <h2 id={id} className={cn('type-section', eyebrow && 'mt-3', dark ? 'text-white' : 'text-ink')}>
          {title}
        </h2>
        {description && <p className={cn('mt-4 max-w-xl text-base leading-relaxed sm:text-[17px]', dark ? 'text-mist' : 'text-muted-ink')}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Text link with an animated underline; the standard way to link inside content. */
export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('group link-underline inline-flex items-center gap-1 pb-0.5 text-[15px] font-medium text-ink', className)}>
      {children}
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

export interface Crumb {
  name: string;
  path: string;
}

/** Page introduction with breadcrumbs (and BreadcrumbList structured data). */
export function PageHero({ title, description, eyebrow, crumbs, children }: { title: string; description?: string | null; eyebrow?: string; crumbs: Crumb[]; children?: React.ReactNode }) {
  const all = [{ name: 'Home', path: '/' }, ...crumbs];
  return (
    <div className="border-b bg-white pb-12 pt-8 sm:pb-16 sm:pt-10 lg:pb-20">
      <JsonLd data={breadcrumbJsonLd(all)} />
      <div className="container-page">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted-ink">
            {all.map((c, i) => (
              <li key={c.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                {i === all.length - 1 ? (
                  <span aria-current="page" className="text-ink">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.path} className="hover:text-ink">
                    {c.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-10 max-w-3xl sm:mt-14">
          {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
          <h1 className="type-page text-ink">{title}</h1>
          {description && <p className="type-lead mt-5 max-w-2xl text-muted-ink">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Renders sanitised CMS rich text. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose prose-neutral prose-asva max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium', className)} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

export function EmptyState({ title, description, action, dark = false }: { title: string; description: string; action?: React.ReactNode; dark?: boolean }) {
  return (
    <div className={cn('border-y py-14', dark ? 'border-white/15 text-mist' : 'text-muted-ink')}>
      <p className={cn('text-lg font-medium', dark ? 'text-white' : 'text-ink')}>{title}</p>
      <p className="mt-2 max-w-md text-[15px]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
