import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import type { NavItem, PublicSettings } from '@/lib/types';
import { HeaderShell, MobileNav, NavLink } from './header-client';

const COURSES_LINK: NavItem = {
  id: 'courses',
  label: 'Courses',
  href: '/courses',
  isExternal: false,
  openInNewTab: false,
};

function withCourses(items: NavItem[]) {
  if (items.some((item) => item.href === COURSES_LINK.href)) return items;
  const servicesIndex = items.findIndex((item) => item.href === '/services');
  const insertAt = servicesIndex < 0 ? items.length : servicesIndex + 1;
  return [...items.slice(0, insertAt), COURSES_LINK, ...items.slice(insertAt)];
}

export function SiteHeader({ items, settings }: { items: NavItem[]; settings: PublicSettings }) {
  const siteItems = withCourses(items);
  return (
    <HeaderShell>
      <div className="container-page relative flex h-16 items-center gap-8">
        <Link href="/" className="shrink-0 rounded-sm" aria-label={`${settings.general.shortName} — home`}>
          <Logo tone="dark" variant="full" className="h-9" uploaded={settings.media.logoForLightBg} />
        </Link>
        <nav aria-label="Main" className="hidden lg:absolute lg:left-1/2 lg:block lg:-translate-x-1/2">
          <ul className="flex items-center gap-1">
            {siteItems.map((item) => (
              <li key={item.id}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/start-a-project">Start a project</Link>
          </Button>
          <MobileNav items={siteItems} settings={settings} />
        </div>
      </div>
    </HeaderShell>
  );
}
