import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6">
      <div className="w-full max-w-lg">
        <Link href="/" aria-label="Home">
          <Logo tone="dark" className="h-9" />
        </Link>
        <p className="mt-16 font-mono text-sm text-muted-ink">404</p>
        <h1 className="type-page mt-3 text-ink">This page could not be found</h1>
        <p className="mt-4 text-[17px] text-muted-ink">The page may have moved, or the link may be incorrect.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/services">Our services</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Contact</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
