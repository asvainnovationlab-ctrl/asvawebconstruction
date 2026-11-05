import { Search } from 'lucide-react';

/** Progressive-enhancement search: a plain GET form that works without JavaScript. */
export function SearchBox({ action, defaultValue, placeholder, hidden }: { action: string; defaultValue?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} method="get" role="search" className="relative w-full sm:max-w-xs">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor="site-search" className="sr-only">
        {placeholder}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        id="site-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </form>
  );
}

export function FilterChips({ items, active, hrefFor, allLabel = 'All' }: { items: { slug: string; name: string }[]; active?: string; hrefFor: (slug?: string) => string; allLabel?: string }) {
  const chip = (label: string, slug: string | undefined, current: boolean) => (
    <li key={slug ?? 'all'}>
      <a
        href={hrefFor(slug)}
        aria-current={current ? 'true' : undefined}
        className={`inline-flex rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${current ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-neutral-400'}`}
      >
        {label}
      </a>
    </li>
  );
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Filter">
      {chip(allLabel, undefined, !active)}
      {items.map((i) => chip(i.name, i.slug, active === i.slug))}
    </ul>
  );
}
