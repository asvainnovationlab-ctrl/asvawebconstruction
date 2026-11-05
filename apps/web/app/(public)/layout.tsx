import type { Metadata } from 'next';
import { ConsentProvider } from '@/components/site/cookie-consent';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { JsonLd } from '@/components/site/blocks';
import { Logo } from '@/components/brand/logo';
import { getNavigation, getServices, getSettings } from '@/lib/api/public';
import { buildMetadata, organizationJsonLd, websiteJsonLd } from '@/lib/seo';

// Pages render per request from tag-cached API data, so builds never depend on a running API
// and CMS changes appear as soon as the API triggers revalidation.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    ...buildMetadata(settings, { path: '/' }),
    ...(settings.media.favicon ? { icons: { icon: settings.media.favicon.url } } : {}),
    ...(settings.seo.searchConsoleVerification ? { verification: { google: settings.seo.searchConsoleVerification } } : {}),
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings, navigation, services] = await Promise.all([getSettings(), getNavigation(), getServices()]);
  const { branding, maintenance, cookies, analytics } = settings;
  const themeCss = `:root{${HEX.test(branding.primaryColor) ? `--brand:${branding.primaryColor};` : ''}${HEX.test(branding.accentColor) ? `--accent:${branding.accentColor};` : ''}}`;

  if (maintenance.enabled) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white px-6 text-center">
        <div className="max-w-md">
          <Logo tone="dark" className="mx-auto h-10" uploaded={settings.media.logoForLightBg} />
          <h1 className="type-section mt-10 text-ink">We’ll be right back</h1>
          <p className="mt-4 text-muted-ink">{maintenance.message}</p>
        </div>
      </main>
    );
  }

  return (
    <ConsentProvider enabled={cookies.bannerEnabled} message={cookies.message} policyHref={cookies.policyHref} analytics={analytics}>
      <style>{themeCss}</style>
      <JsonLd data={[organizationJsonLd(settings), websiteJsonLd(settings)]} />
      <a href="#main" className="sr-only z-50 rounded-md border bg-white px-4 py-2 text-sm font-medium text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <SiteHeader items={navigation.HEADER} settings={settings} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} navigation={navigation} services={services} />
    </ConsentProvider>
  );
}
