import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NewsletterAction } from '@/components/site/newsletter-action';

type Props = { params: Promise<{ action: string }>; searchParams: Promise<{ token?: string }> };

export const metadata: Metadata = { title: 'Newsletter', robots: { index: false, follow: false } };

export default async function NewsletterPage({ params, searchParams }: Props) {
  const [{ action }, { token }] = await Promise.all([params, searchParams]);
  if (action !== 'confirm' && action !== 'unsubscribe') notFound();
  return (
    <section className="bg-surface py-24">
      <div className="container-page max-w-lg">
        <NewsletterAction action={action} token={token ?? ''} />
      </div>
    </section>
  );
}
