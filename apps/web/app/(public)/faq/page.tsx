import type { Metadata } from 'next';
import Link from 'next/link';
import { htmlToPlainText } from '@asva/shared';
import { EmptyState, JsonLd, PageHero, Section } from '@/components/site/blocks';
import { FaqBrowser } from '@/components/site/faq-browser';
import { Button } from '@/components/ui/button';
import { getFaqs, getSettings } from '@/lib/api/public';
import { sanitize } from '@/lib/sanitize';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), { title: 'Frequently Asked Questions', description: 'Answers to common questions about working with Asva Innovation Lab: process, pricing, timelines and support.', path: '/faq' });
}

export default async function FaqPage() {
  const groups = await getFaqs();
  const safeGroups = groups.map((g) => ({ ...g, faqs: g.faqs.map((f) => ({ ...f, answer: sanitize(f.answer) })) }));
  const all = groups.flatMap((g) => g.faqs);
  return (
    <>
      {all.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: all.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: htmlToPlainText(f.answer) } })),
          }}
        />
      )}
      <PageHero eyebrow="FAQ" title="Frequently asked questions" description="Can’t find what you’re looking for? Get in touch and we’ll be happy to help." crumbs={[{ name: 'FAQ', path: '/faq' }]} />
      <Section tone="light">
        <div className="container-page max-w-4xl">
          {all.length ? <FaqBrowser groups={safeGroups} /> : <EmptyState title="No FAQs yet" description="Questions and answers will be published here soon." />}
          <div className="mt-14 text-center">
            <p className="text-muted-ink">Still have questions?</p>
            <Button asChild variant="outline" className="mt-3">
              <Link href="/contact">Contact our team</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
