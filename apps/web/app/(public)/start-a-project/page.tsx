import { CalendarCheck, FileText, MessagesSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { InquiryForm } from '@/components/forms/inquiry-form';
import { PageHero, Section } from '@/components/site/blocks';
import { getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), {
    title: 'Start a Project',
    description: 'Tell Asva Innovation Lab about your software, web or mobile project. No account needed — we reply within two business days.',
    path: '/start-a-project',
  });
}

type Props = { searchParams: Promise<{ service?: string }> };

const NEXT_STEPS = [
  { icon: FileText, title: 'We review your brief', body: 'Our team reads your inquiry and any attachment carefully.' },
  { icon: MessagesSquare, title: 'Discovery conversation', body: 'We contact you to clarify goals, users and constraints.' },
  { icon: CalendarCheck, title: 'Proposal', body: 'You receive a scope, timeline and estimate — no obligation.' },
];

export default async function StartProjectPage({ searchParams }: Props) {
  const { service } = await searchParams;
  return (
    <>
      <PageHero eyebrow="Start a project" title="Tell us about your project" description="Three short steps. The more context you share, the more useful our first conversation will be." crumbs={[{ name: 'Start a project', path: '/start-a-project' }]} />
      <Section tone="muted">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <div className="rounded-lg border bg-white p-6 sm:p-10 lg:col-span-8">
            <InquiryForm initialProjectType={service} />
          </div>
          <aside className="lg:col-span-4">
            <h2 className="type-label">What happens next</h2>
            <ol className="mt-6 space-y-6">
              {NEXT_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-white text-neutral-600">
                    <s.icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">
                      {i + 1}. {s.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-ink">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-8 border-t pt-4 text-[13px] leading-relaxed text-muted-ink">
              Your information is stored securely and used only to respond to your inquiry. See our{' '}
              <Link href="/privacy-policy" className="text-brand hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
