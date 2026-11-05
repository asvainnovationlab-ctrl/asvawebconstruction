import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 block w-fit" aria-label="Back to website">
          <Logo tone="dark" className="h-9" />
        </Link>
        <div className="rounded-lg border bg-white p-7 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Restricted area. Access is logged.</p>
      </div>
    </main>
  );
}
