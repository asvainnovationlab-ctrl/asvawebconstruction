'use client';

import Script from 'next/script';
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/form-controls';

/**
 * Consent management. Analytics scripts (GA4 / GTM) are only injected after the visitor opts in;
 * the choice is stored in a first-party cookie for 6 months and can be changed via "Cookie settings".
 */
const COOKIE = 'asva_consent';
type Consent = { analytics: boolean; decidedAt: string };

const CHANGE_EVENT = 'asva:consent-change';

/** Raw cookie value as the external-store snapshot (a string, so it compares by value). */
function readConsentRaw(): string {
  return document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
}

function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Consent;
  } catch {
    return null;
  }
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function writeConsent(consent: Consent) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

interface ConsentContextValue {
  open: () => void;
}
const ConsentContext = createContext<ConsentContextValue>({ open: () => undefined });

interface Props {
  enabled: boolean;
  message: string;
  policyHref: string;
  analytics: { enabled: boolean; ga4MeasurementId: string | null; gtmContainerId: string | null };
  children: React.ReactNode;
}

export function ConsentProvider({ enabled, message, policyHref, analytics, children }: Props) {
  // null on the server and before hydration; the cookie value afterwards.
  const raw = useSyncExternalStore(subscribeConsent, readConsentRaw, () => null);
  const loaded = raw !== null;
  const consent = parseConsent(raw);
  const [reopened, setReopened] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState<boolean | null>(null);
  const hasTracking = analytics.enabled && Boolean(analytics.ga4MeasurementId || analytics.gtmContainerId);
  const showBanner = loaded && (reopened || (enabled && hasTracking && !consent));
  const choice = analyticsChoice ?? consent?.analytics ?? false;

  const save = useCallback((analyticsAllowed: boolean) => {
    const hadAnalytics = consent?.analytics === true;
    writeConsent({ analytics: analyticsAllowed, decidedAt: new Date().toISOString() });
    setReopened(false);
    setShowPrefs(false);
    setAnalyticsChoice(null);
    if (!analyticsAllowed && hadAnalytics) window.location.reload(); // unload already-running trackers
  }, [consent?.analytics]);

  const value = useMemo(() => ({ open: () => { setShowPrefs(true); setReopened(true); } }), []);
  const allowAnalytics = loaded && hasTracking && consent?.analytics === true;

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {allowAnalytics && <Analytics ga4={analytics.ga4MeasurementId} gtm={analytics.gtmContainerId} />}
      {showBanner && (
        <section
          role="dialog"
          aria-live="polite"
          aria-label="Cookie preferences"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-lg border bg-white p-5 text-sm text-neutral-600 shadow-lg sm:inset-x-6 sm:bottom-6"
        >
          <p>
            {hasTracking ? message : 'This website only uses essential cookies.'}{' '}
            <a href={policyHref} className="font-medium text-ink underline underline-offset-2">
              Cookie policy
            </a>
          </p>
          {showPrefs && (
            <div className="mt-4 space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">Essential</p>
                  <p className="text-xs text-muted-ink">Required for the site to work. Always on.</p>
                </div>
                <Switch checked disabled aria-label="Essential cookies (always on)" />
              </div>
              {hasTracking && (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">Analytics</p>
                    <p className="text-xs text-muted-ink">Helps us understand how visitors use the site.</p>
                  </div>
                  <Switch checked={choice} onCheckedChange={setAnalyticsChoice} aria-label="Analytics cookies" />
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {showPrefs ? (
              <Button size="sm" onClick={() => save(choice)}>
                Save preferences
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setShowPrefs(true)}>
                  Preferences
                </Button>
                <Button size="sm" variant="outline" onClick={() => save(false)}>
                  Essential only
                </Button>
                <Button size="sm" onClick={() => save(true)}>
                  Accept analytics
                </Button>
              </>
            )}
          </div>
        </section>
      )}
    </ConsentContext.Provider>
  );
}

export function CookieSettingsButton() {
  const { open } = useContext(ConsentContext);
  return (
    <button type="button" onClick={open} className="transition hover:text-white">
      Cookie settings
    </button>
  );
}

function Analytics({ ga4, gtm }: { ga4: string | null; gtm: string | null }) {
  const safe = (id: string | null) => (id && /^(G|GTM)-[A-Z0-9]+$/.test(id) ? id : null);
  const gaId = safe(ga4);
  const gtmId = safe(gtm);
  return (
    <>
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {gtmId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
    </>
  );
}
