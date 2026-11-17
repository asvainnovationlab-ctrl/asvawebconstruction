import { Boxes, BrainCircuit, Cloud, Database, FlaskConical, LayoutPanelLeft, PenTool, Server, Smartphone, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import {
  siDjango,
  siDocker,
  siFigma,
  siGithubactions,
  siLaravel,
  siMongodb,
  siMysql,
  siNestjs,
  siNextdotjs,
  siNodedotjs,
  siPostgresql,
  siPython,
  siReact,
  siRedis,
  siTailwindcss,
  siTypescript,
  siVitest,
  siVuedotjs,
  type SimpleIcon,
} from 'simple-icons';
import type { TechnologyCategory } from '@asva/shared';
import type { TechnologyRef } from '@/lib/types';

const CATEGORY_ICON: Record<TechnologyCategory, LucideIcon> = {
  FRONTEND: LayoutPanelLeft,
  BACKEND: Server,
  MOBILE: Smartphone,
  DATABASE: Database,
  CLOUD_DEVOPS: Cloud,
  DESIGN: PenTool,
  TESTING: FlaskConical,
  AI_DATA: BrainCircuit,
  OTHER: Boxes,
};

/** Official brand marks for the technologies we suggest out of the box. AWS, OpenAI and Playwright don't allow
 * redistribution of their marks, so those (and anything an admin adds that isn't listed here) fall back to a
 * category icon below — unless the admin uploads a logo for it, which always wins. */
const BRAND_ICONS: Record<string, SimpleIcon> = {
  react: siReact,
  'react-native': siReact,
  nextjs: siNextdotjs,
  typescript: siTypescript,
  'tailwind-css': siTailwindcss,
  vuejs: siVuedotjs,
  nodejs: siNodedotjs,
  nestjs: siNestjs,
  laravel: siLaravel,
  django: siDjango,
  postgresql: siPostgresql,
  mysql: siMysql,
  mongodb: siMongodb,
  redis: siRedis,
  docker: siDocker,
  'github-actions': siGithubactions,
  figma: siFigma,
  python: siPython,
  'jest-vitest': siVitest,
};

/**
 * One continuous row of technology logos that scrolls itself and pauses on hover.
 * The list is rendered twice back-to-back so the track can loop seamlessly at -50%;
 * the duplicate is hidden from assistive tech, which instead gets a plain, unanimated list.
 */
export function TechMarquee({ technologies }: { technologies: TechnologyRef[] }) {
  if (technologies.length === 0) return null;
  const loop = [...technologies, ...technologies];
  // ~2s of travel per logo keeps the strip visibly moving without being distracting.
  const duration = Math.max(technologies.length * 2, 14);

  return (
    <div className="tech-marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <ul className="tech-marquee-track flex w-max gap-3" style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties} aria-hidden>
        {loop.map((t, i) => {
          const brand = BRAND_ICONS[t.slug];
          const CategoryIcon = CATEGORY_ICON[(t.category as TechnologyCategory) ?? 'OTHER'] ?? Boxes;
          return (
            <li key={`${t.id}-${i}`} className="flex shrink-0 items-center gap-2.5 rounded-md border bg-white px-4 py-3 shadow-sm">
              {t.logo ? (
                <span className="relative size-6 shrink-0">
                  <Image src={t.logo.url} alt="" fill sizes="24px" className="object-contain" />
                </span>
              ) : brand ? (
                <svg role="img" viewBox="0 0 24 24" className="size-5 shrink-0" fill={`#${brand.hex}`} aria-hidden>
                  <path d={brand.path} />
                </svg>
              ) : (
                <CategoryIcon className="size-5 shrink-0 text-muted-ink" aria-hidden />
              )}
              <span className="whitespace-nowrap text-[14px] font-medium text-ink">{t.name}</span>
            </li>
          );
        })}
      </ul>
      <ul className="sr-only">
        {technologies.map((t) => (
          <li key={t.id}>{t.name}</li>
        ))}
      </ul>
    </div>
  );
}
