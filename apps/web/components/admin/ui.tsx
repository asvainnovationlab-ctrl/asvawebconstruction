'use client';

import { ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LABELS } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Hide on small screens to keep tables readable. */
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  empty,
  onRowClick,
  rowHref,
  selectable,
  selected,
  onSelectedChange,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Renders the first cell as a link so rows are reachable by keyboard and screen readers. */
  rowHref?: (row: T) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
}) {
  const allSelected = Boolean(rows?.length && selected && rows.every((r) => selected.has(r.id)));
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    onChange={(e) => onSelectedChange?.(new Set(e.target.checked ? rows?.map((r) => r.id) : []))}
                    className="size-4 accent-[var(--brand)]"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('whitespace-nowrap px-4 py-3 font-semibold', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  {selectable && <td className="px-4 py-3" />}
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3', c.hideOnMobile && 'hidden md:table-cell')}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows?.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-muted/50', selected?.has(row.id) && 'bg-primary/5')}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected?.has(row.id) ?? false}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          onSelectedChange?.(next);
                        }}
                        className="size-4 accent-[var(--brand)]"
                      />
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      {ci === 0 && rowHref ? (
                        <Link href={rowHref(row)} onClick={(e) => e.stopPropagation()} className="block rounded-sm hover:underline focus-visible:underline">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && rows?.length === 0 && (
        <div className="px-6 py-14 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <div className="mt-3 text-sm text-muted-foreground">{empty ?? 'Nothing here yet.'}</div>
        </div>
      )}
    </div>
  );
}

export function PaginationBar({ meta, onPage }: { meta?: { page: number; totalPages: number; total: number; pageSize: number }; onPage: (p: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <p>
        {from}–{to} of {meta.total}
      </p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="grid place-items-center px-2">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'secondary' | 'info' | 'danger' | 'violet' | 'default'> = {
  PUBLISHED: 'success',
  SCHEDULED: 'info',
  DRAFT: 'secondary',
  ARCHIVED: 'warning',
  OPEN: 'success',
  CLOSED: 'warning',
  NEW: 'info',
  CONTACTED: 'violet',
  QUALIFIED: 'default',
  PROPOSAL_SENT: 'violet',
  WON: 'success',
  LOST: 'danger',
  RECEIVED: 'info',
  UNDER_REVIEW: 'violet',
  SHORTLISTED: 'default',
  INTERVIEW: 'violet',
  SELECTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'secondary',
  PENDING: 'warning',
  APPROVED: 'success',
  SUBSCRIBED: 'success',
  UNSUBSCRIBED: 'secondary',
  SENT: 'success',
  FAILED: 'danger',
  SKIPPED: 'warning',
};

const ALL_LABELS: Record<string, string> = {
  ...LABELS.contentStatus,
  ...LABELS.jobStatus,
  ...LABELS.leadStatus,
  ...LABELS.applicationStatus,
  ...LABELS.testimonialStatus,
  ...LABELS.subscriberStatus,
  ...LABELS.emailStatus,
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'}>{label ?? ALL_LABELS[status] ?? status}</Badge>;
}

export function StatCard({ label, value, hint, icon: Icon, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; href?: string }) {
  const body = (
    <div className="rounded-xl border bg-background p-5 transition hover:shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <a href={href} className="block rounded-xl">
      {body}
    </a>
  ) : (
    body
  );
}

/** Warns before leaving the page (reload, close tab, in-app link) when there are unsaved changes. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (!window.confirm('You have unsaved changes. Leave this page and discard them?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}

export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
