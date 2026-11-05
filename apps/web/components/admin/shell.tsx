'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronsLeft, ChevronsRight, ExternalLink, LogOut, Menu, Search, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, SheetContent } from '@/components/ui/overlays';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useAuth } from './auth';
import { ADMIN_NAV, type NavEntry } from './nav';

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

function useVisibleNav() {
  const { user } = useAuth();
  return useMemo(
    () =>
      ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.permissions.length === 0 || i.permissions.some((p) => user.permissions.includes(p))) })).filter((g) => g.items.length),
    [user.permissions],
  );
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = useVisibleNav();
  return (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] transition-colors',
                      active ? 'bg-muted font-medium text-foreground' : 'text-neutral-600 hover:bg-muted/70 hover:text-foreground',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <item.icon className={cn('size-4 shrink-0', active ? 'text-brand' : 'text-neutral-400')} aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && <span className="sr-only">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const all = ADMIN_NAV.flatMap((g) => g.items);
  const section = [...all].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i.href));
  const rest = section ? pathname.slice(section.href.length).split('/').filter(Boolean) : [];
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
        </li>
        {section && section.href !== '/admin' && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            <Link href={section.href} className={cn('hover:text-foreground', rest.length === 0 && 'font-medium text-foreground')} aria-current={rest.length === 0 ? 'page' : undefined}>
              {section.label}
            </Link>
          </li>
        )}
        {rest.length > 0 && (
          <li className="flex items-center gap-1.5 truncate">
            <span aria-hidden>/</span>
            <span className="truncate font-medium text-foreground" aria-current="page">
              {rest[0] === 'new' ? 'New' : rest.length > 1 ? rest.join(' / ') : 'Details'}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}

/** Ctrl/⌘+K quick navigation across every section the user can access. */
function QuickSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const router = useRouter();
  const groups = useVisibleNav();
  const items: (NavEntry & { group: string })[] = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
  const results = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setQ(''); }}>
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border bg-muted/60 px-3 text-sm text-muted-foreground hover:bg-muted">
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search admin…</span>
        <kbd className="hidden rounded border bg-background px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </button>
      <DialogContent>
        <DialogHeader title="Go to…" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              router.push(results[0].href);
              setOpen(false);
            }
          }}
          placeholder="Type a section name"
          aria-label="Search sections"
          className="h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-ring"
        />
        <ul className="max-h-80 overflow-y-auto">
          {results.map((r) => (
            <li key={r.href}>
              <Link href={r.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted">
                <r.icon className="size-4 text-muted-foreground" aria-hidden />
                {r.label}
                <span className="ml-auto text-xs text-muted-foreground">{r.group}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matching sections</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

interface DashboardCounts {
  leads: { new: number } | null;
  contact: { unread: number } | null;
  careers: { newApplications: number } | null;
}

function Notifications() {
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<DashboardCounts>('/admin/dashboard', { query: { days: 7 } }), refetchInterval: 60_000 });
  const items = [
    data?.leads && { label: 'New project inquiries', count: data.leads.new, href: '/admin/inquiries?status=NEW' },
    data?.contact && { label: 'Unread contact messages', count: data.contact.unread, href: '/admin/contact' },
    data?.careers && { label: 'New job applications', count: data.careers.newApplications, href: '/admin/applications?status=RECEIVED' },
  ].filter((i): i is { label: string; count: number; href: string } => Boolean(i));
  const total = items.reduce((n, i) => n + i.count, 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${total ? `: ${total} pending` : ''}`}>
          <Bell />
          {total > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">{total > 99 ? '99+' : total}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
        {items.length === 0 && <p className="px-2.5 py-3 text-sm text-muted-foreground">Nothing to show for your role.</p>}
        {items.map((i) => (
          <DropdownMenuItem key={i.href} asChild>
            <Link href={i.href}>
              <span className="flex-1">{i.label}</span>
              <span className={cn('rounded-full px-2 text-xs font-semibold', i.count ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>{i.count}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted" aria-label="Account menu">
          <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-xs font-medium text-white" aria-hidden>
            {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </span>
          <span className="hidden text-left text-xs leading-tight lg:block">
            <span className="block font-semibold text-foreground">{user.name}</span>
            <span className="text-muted-foreground">{user.roles.map((r) => r.name).join(', ')}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/admin/profile">
            <UserCircle /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink /> View website
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()} className="text-destructive">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SIDEBAR_KEY = 'asva:sidebar';
const SIDEBAR_EVENT = 'asva:sidebar-change';

function readSidebar(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false; // storage unavailable (private mode, blocked site data)
  }
}

function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggle = () => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? 'open' : 'collapsed');
    } catch {
      /* ignore — the preference simply isn't remembered */
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-white transition-[width] duration-200 lg:flex', collapsed ? 'w-[4.5rem]' : 'w-60')}>
        <div className={cn('flex h-14 items-center border-b', collapsed ? 'justify-center' : 'px-5')}>
          <Link href="/admin" aria-label="Admin home">
            <Logo tone="dark" variant={collapsed ? 'icon' : 'wordmark'} className={collapsed ? 'size-8' : 'h-6'} />
          </Link>
        </div>
        <NavList collapsed={collapsed} />
        <button type="button" onClick={toggle} className="flex h-11 items-center justify-center gap-2 border-t text-xs text-muted-foreground hover:text-foreground" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight className="size-4" /> : (<><ChevronsLeft className="size-4" /> Collapse</>)}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4 sm:px-6">
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </DialogPrimitive.Trigger>
            <SheetContent side="left" title="Admin navigation" className="bg-white">
              <div className="flex h-14 items-center border-b px-5">
                <Logo tone="dark" variant="wordmark" className="h-6" />
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </DialogPrimitive.Root>
          <Breadcrumbs />
          <div className="ml-auto flex flex-1 items-center justify-end gap-2">
            <div className="hidden w-full max-w-xs sm:block">
              <QuickSearch />
            </div>
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
