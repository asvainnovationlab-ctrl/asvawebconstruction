'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { SheetContent } from '@/components/ui/overlays';
import type { NavItem, PublicSettings } from '@/lib/types';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sticky header: always white, gains a hairline border once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <header className={cn('sticky top-0 z-40 bg-white transition-[border-color] duration-200', 'border-b', scrolled ? 'border-line' : 'border-transparent')}>{children}</header>;
}

export function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = !item.isExternal && isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      target={item.openInNewTab ? '_blank' : undefined}
      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative rounded-md px-3 py-2 text-[14px] font-medium transition-colors after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:bg-ink after:transition-transform after:duration-300',
        active ? 'text-ink after:scale-x-100' : 'text-neutral-500 after:scale-x-0 hover:text-ink hover:after:scale-x-100',
      )}
    >
      {item.label}
    </Link>
  );
}

export function MobileNav({ items, settings }: { items: NavItem[]; settings: PublicSettings }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5!" />
        </Button>
      </DialogPrimitive.Trigger>
      <SheetContent title="Site navigation" className="bg-white text-ink">
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Logo tone="dark" variant="wordmark" uploaded={settings.media.logoForLightBg} className="h-6" />
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Close menu">
              <X className="size-5!" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <nav aria-label="Mobile" className="flex-1 px-5 py-4">
          <ul className="divide-y">
            {items.map((item) => {
              const active = !item.isExternal && isActive(pathname, item.href);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn('block py-4 text-xl font-medium tracking-tight', active ? 'text-brand' : 'text-ink')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t p-5">
          <Button asChild size="lg" className="w-full">
            <Link href="/start-a-project" onClick={() => setOpen(false)}>
              Start a project
            </Link>
          </Button>
        </div>
      </SheetContent>
    </DialogPrimitive.Root>
  );
}
