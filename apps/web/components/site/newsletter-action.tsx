'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';

/**
 * Confirmation/unsubscribe requires an explicit click (a POST), so email link scanners that
 * prefetch URLs cannot subscribe or unsubscribe people by accident.
 */
export function NewsletterAction({ action, token }: { action: 'confirm' | 'unsubscribe'; token: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; message?: string }>({ status: 'idle' });
  const confirm = action === 'confirm';

  async function run() {
    setState({ status: 'loading' });
    try {
      const result = await api<{ message: string }>(`/newsletter/${action}`, { method: 'POST', body: { token } });
      setState({ status: 'done', message: result.message });
    } catch (e) {
      setState({ status: 'error', message: e instanceof ApiError ? e.message : 'Something went wrong. Please try again.' });
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-2xl font-semibold text-ink">{confirm ? 'Confirm your subscription' : 'Unsubscribe from the newsletter'}</h1>
      {!token ? (
        <Alert variant="error" className="mt-6">
          This link is incomplete. Please use the link from your email.
        </Alert>
      ) : state.status === 'done' ? (
        <Alert variant="success" className="mt-6">
          {state.message}
        </Alert>
      ) : (
        <>
          <p className="mt-3 text-muted-ink">{confirm ? 'Click below to start receiving occasional updates from us.' : 'Click below and we will stop sending you newsletters.'}</p>
          {state.status === 'error' && (
            <Alert variant="error" className="mt-6">
              {state.message}
            </Alert>
          )}
          <Button className="mt-6" variant={confirm ? 'accent' : 'outline'} loading={state.status === 'loading'} onClick={run}>
            {confirm ? 'Confirm subscription' : 'Unsubscribe'}
          </Button>
        </>
      )}
      <p className="mt-8 text-sm">
        <Link href="/" className="text-brand hover:underline">
          Return to the homepage
        </Link>
      </p>
    </div>
  );
}
