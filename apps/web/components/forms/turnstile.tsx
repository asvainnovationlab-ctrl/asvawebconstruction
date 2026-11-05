'use client';

import Script from 'next/script';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme?: string }) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/**
 * Optional Cloudflare Turnstile challenge. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is set (pair it with TURNSTILE_SECRET_KEY on the API, which then requires the token).
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const reset = useCallback(() => {
    setToken(undefined);
    window.turnstile?.reset();
  }, []);
  const widget = SITE_KEY ? <TurnstileWidget onToken={setToken} /> : null;
  return { enabled: Boolean(SITE_KEY), token, widget, reset };
}

function TurnstileWidget({ onToken }: { onToken: (token: string | undefined) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && Boolean(window.turnstile));
  const id = useId();

  useEffect(() => {
    if (!ready || !ref.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: SITE_KEY,
      callback: (t) => onToken(t),
      'expired-callback': () => onToken(undefined),
      'error-callback': () => onToken(undefined),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready, onToken]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div id={id} ref={ref} aria-label="Verification challenge" />
    </>
  );
}
