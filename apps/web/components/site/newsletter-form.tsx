'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { newsletterSubscribeSchema } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useTurnstile } from '../forms/turnstile';

export function NewsletterForm({ dark = true }: { dark?: boolean }) {
  const id = useId();
  const [startedAt] = useState(() => Date.now());
  const captcha = useTurnstile();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = newsletterSubscribeSchema.safeParse({ email, consent, website, formStartedAt: startedAt, source: 'footer', turnstileToken: captcha.token });
    if (!parsed.success) {
      setState({ status: 'error', message: parsed.error.issues[0]?.message });
      return;
    }
    setState({ status: 'loading' });
    try {
      const result = await api<{ message: string }>('/newsletter/subscribe', { method: 'POST', body: parsed.data });
      setState({ status: 'success', message: result.message });
    } catch (error) {
      setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Could not subscribe. Please try again.' });
      captcha.reset();
    }
  }

  if (state.status === 'success') {
    return (
      <p role="status" className={cn('flex items-start gap-2 text-sm', dark ? 'text-neutral-200' : 'text-foreground')}>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div className="flex gap-2">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={cn(
            'h-10 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20',
            dark ? 'border-white/20 bg-white/5 text-white placeholder:text-neutral-500' : 'border-input bg-white text-ink placeholder:text-neutral-400',
          )}
          aria-invalid={state.status === 'error' || undefined}
          aria-describedby={state.status === 'error' ? `${id}-error` : undefined}
        />
        {/* Honeypot: hidden from people, tempting for bots */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden />
        <Button type="submit" loading={state.status === 'loading'}>
          Subscribe
        </Button>
      </div>
      <label className={cn('flex items-start gap-2 text-xs', dark ? 'text-neutral-400' : 'text-muted-ink')}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-3.5 accent-[var(--accent)]" />
        <span>
          I agree to receive occasional emails and accept the{' '}
          <Link href="/privacy-policy" className={cn('underline', dark ? 'hover:text-white' : 'hover:text-ink')}>
            privacy policy
          </Link>
          . Unsubscribe anytime.
        </span>
      </label>
      {captcha.widget}
      {state.status === 'error' && (
        <p id={`${id}-error`} role="alert" className={cn('text-xs font-medium', dark ? 'text-red-400' : 'text-destructive')}>
          {state.message}
        </p>
      )}
    </form>
  );
}
