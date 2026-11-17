import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { PostCard as PostCardData, ProjectCard as ProjectCardData, Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { serviceImage, type SiteImage } from '@/lib/site-images';
import { cn, formatDate } from '@/lib/utils';

/** A service as a row: name, one-line explanation and an arrow. Rows are separated by dividers, not boxes. */
export function ServiceRow({ service, index = 0 }: { service: Pick<Service, 'name' | 'slug' | 'shortDescription'> & { coverImage?: Service['coverImage'] }; index?: number }) {
  const image: SiteImage = service.coverImage ? { src: service.coverImage.url, alt: service.coverImage.alt } : serviceImage(service, index);
  return (
    <Link href={`/services/${service.slug}`} className="group grid items-center gap-3 py-6 sm:grid-cols-12 sm:gap-6">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border bg-neutral-100 sm:col-span-3 sm:aspect-[4/3]">
        <Image src={image.src} alt={image.alt} fill sizes="(min-width: 640px) 20vw, 100vw" style={image.position ? { objectPosition: image.position } : undefined} className="object-cover" />
      </div>
      <h3 className="text-lg font-medium text-ink transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-brand sm:col-span-3">{service.name}</h3>
      <p className="text-[15px] leading-relaxed text-muted-ink sm:col-span-5">{service.shortDescription}</p>
      <ArrowUpRight className="hidden size-4 justify-self-end text-neutral-400 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand sm:col-span-1 sm:block" aria-hidden />
    </Link>
  );
}

/**
 * A service on the home page: a photo on one side and the explanation on the other, swapping sides
 * on every other service so the section reads as a zig-zag rather than a list. The photo repeats the
 * heading's link, so it is hidden from assistive tech to avoid announcing the same destination twice.
 */
export function ServiceFeature({ service, index = 0 }: { service: Pick<Service, 'name' | 'slug' | 'shortDescription' | 'coverImage'>; index?: number }) {
  const photo: SiteImage = service.coverImage ? { src: service.coverImage.url, alt: service.coverImage.alt } : serviceImage(service, index);
  const flipped = index % 2 === 1;

  return (
    <div className="group grid items-center gap-7 lg:grid-cols-2 lg:gap-16">
      <Link
        href={`/services/${service.slug}`}
        tabIndex={-1}
        aria-hidden
        className={cn('relative block aspect-[4/3] overflow-hidden rounded-lg border bg-surface sm:aspect-[16/10]', flipped && 'lg:order-2')}
      >
        <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 46vw, 100vw" style={photo.position ? { objectPosition: photo.position } : undefined} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/5" />
      </Link>

      <div className={cn(flipped && 'lg:order-1')}>
        <span aria-hidden className="font-mono text-[12px] font-semibold tracking-[0.12em] text-brand">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="mt-3 text-[26px] font-medium leading-tight tracking-tight text-ink sm:text-[30px]">
          <Link href={`/services/${service.slug}`} className="transition-colors hover:text-brand focus-visible:text-brand">
            {service.name}
          </Link>
        </h3>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-ink">{service.shortDescription}</p>
        <Button asChild variant="outline" className="mt-7">
          <Link href={`/services/${service.slug}`}>
            Learn more
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Honest, typographic stand-in for a project without a screenshot — never mimics a real product UI. */
export function PlaceholderArt({ seed, className }: { seed: string; className?: string }) {
  const initials = seed
    .replace(/^sample[- ]/i, '')
    .split(/[-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <div className={cn('grid place-items-center bg-neutral-100 text-neutral-300', className)} aria-hidden>
      <span className="select-none text-6xl font-semibold tracking-tighter sm:text-7xl">{initials}</span>
    </div>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900', className)} title="Demonstration content — not a real client project">
      Sample
    </span>
  );
}

export function ProjectCard({ project, priority = false, size = 'md' }: { project: ProjectCardData; priority?: boolean; size?: 'lg' | 'md' }) {
  const tech = project.technologies.slice(0, 4).map((t) => t.name).join(' · ');
  return (
    <Link href={`/portfolio/${project.slug}`} className="group block">
      <div className={cn('relative overflow-hidden rounded-lg border bg-white', size === 'lg' ? 'aspect-[16/10]' : 'aspect-[4/3]')}>
        {project.featuredImage ? (
          <Image
            src={project.featuredImage.url}
            alt={project.featuredImage.alt || project.title}
            fill
            sizes={size === 'lg' ? '(min-width: 1024px) 58vw, 100vw' : '(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw'}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            priority={priority}
          />
        ) : (
          <PlaceholderArt seed={project.slug} className="h-full w-full" />
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={cn('font-medium text-ink transition-colors group-hover:text-brand', size === 'lg' ? 'text-xl' : 'text-lg')}>{project.title}</h3>
          <p className="mt-1.5 line-clamp-2 max-w-xl text-[15px] leading-relaxed text-muted-ink">{project.summary}</p>
          <p className="mt-3 text-[13px] text-muted-ink">
            {[project.category?.name, tech].filter(Boolean).join('  ·  ')}
            {project.isSample && <SampleBadge className="ml-2" />}
          </p>
        </div>
        <ArrowUpRight className="mt-1.5 size-4 shrink-0 text-neutral-400 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
      </div>
    </Link>
  );
}

/** Article as a list row: date, title and category — navigation first, decoration last. */
export function PostRow({ post }: { post: PostCardData }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group grid items-baseline gap-1 py-5 sm:grid-cols-12 sm:gap-6">
      <time dateTime={post.publishedAt} className="text-[14px] text-muted-ink sm:col-span-2">
        {formatDate(post.publishedAt)}
      </time>
      <h3 className="text-lg font-medium text-ink transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-brand sm:col-span-7">{post.title}</h3>
      <p className="text-[14px] text-muted-ink sm:col-span-3 sm:text-right">
        {[post.category?.name, `${post.readingTimeMinutes} min read`].filter(Boolean).join(' · ')}
      </p>
    </Link>
  );
}

export function PostCard({ post, priority = false }: { post: PostCardData; priority?: boolean }) {
  return (
    <article className="group relative">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border bg-neutral-100">
        {post.featuredImage ? (
          <Image src={post.featuredImage.url} alt={post.featuredImage.alt || ''} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" priority={priority} />
        ) : (
          <PlaceholderArt seed={post.slug} className="h-full w-full" />
        )}
      </div>
      <p className="mt-4 text-[13px] text-muted-ink">
        {[post.category?.name, formatDate(post.publishedAt), `${post.readingTimeMinutes} min read`].filter(Boolean).join(' · ')}
      </p>
      <h3 className="mt-1.5 text-lg font-medium leading-snug text-ink">
        <Link href={`/blog/${post.slug}`} className="transition-colors after:absolute after:inset-0 group-hover:text-brand">
          {post.title}
        </Link>
      </h3>
      {post.excerpt && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted-ink">{post.excerpt}</p>}
    </article>
  );
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-1 text-sm">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className="rounded-md px-3 py-2 font-medium text-ink hover:bg-neutral-100">
          Previous
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-2 text-neutral-400">…</span>}
          <Link href={hrefFor(p)} aria-current={p === page ? 'page' : undefined} className={cn('grid size-9 place-items-center rounded-md font-medium', p === page ? 'bg-brand text-white' : 'text-ink hover:bg-neutral-100')}>
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} rel="next" className="rounded-md px-3 py-2 font-medium text-ink hover:bg-neutral-100">
          Next
        </Link>
      )}
    </nav>
  );
}
