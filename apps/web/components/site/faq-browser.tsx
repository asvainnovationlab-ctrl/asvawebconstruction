'use client';

import { ChevronDown, Search } from 'lucide-react';
import { Accordion } from 'radix-ui';
import { useMemo, useState } from 'react';
import type { FaqGroup } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Searchable, categorised FAQ accordion. Answers arrive pre-sanitised from the server. */
export function FaqBrowser({ groups }: { groups: FaqGroup[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => category === 'all' || g.id === category)
      .map((g) => ({ ...g, faqs: g.faqs.filter((f) => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)) }))
      .filter((g) => g.faqs.length);
  }, [groups, query, category]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-2" aria-label="FAQ categories">
          {[{ id: 'all', name: 'All' }, ...groups].map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setCategory(g.id)}
                aria-pressed={category === g.id}
                className={cn('rounded-md border px-3 py-1.5 text-sm font-medium transition-colors', category === g.id ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-ink hover:border-slate-400')}
              >
                {g.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="relative sm:w-72">
          <label htmlFor="faq-search" className="sr-only">
            Search questions
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
      </div>
      <p className="sr-only" role="status">
        {filtered.reduce((n, g) => n + g.faqs.length, 0)} questions shown
      </p>
      {filtered.length === 0 && <p className="mt-10 text-center text-muted-ink">No questions match your search.</p>}
      {filtered.map((g) => (
        <section key={g.id} aria-labelledby={`faq-${g.id}`} className="mt-10">
          <h2 id={`faq-${g.id}`} className="type-label">
            {g.name}
          </h2>
          <Accordion.Root type="multiple" className="mt-4 divide-y border-y">
            {g.faqs.map((f) => (
              <Accordion.Item key={f.id} value={f.id}>
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-medium text-ink hover:text-brand">
                    {f.question}
                    <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-data-[state=open]:rotate-180" aria-hidden />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="pb-6">
                  <div className="prose prose-neutral prose-asva max-w-none" dangerouslySetInnerHTML={{ __html: f.answer }} />
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </section>
      ))}
    </div>
  );
}
