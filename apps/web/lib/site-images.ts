import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Photography used in the fixed page layouts.
 *
 * Defaults are stock photos in `public/images` (Unsplash, free to use under the
 * Unsplash License). The company's own photos go in `public/images/company` and
 * override a stock photo of the same base name — see the README in that folder.
 *
 * Resolved once at server start, so a newly added photo needs a dev-server restart.
 * Server-side only: these components never ship to the browser.
 */
const COMPANY_DIR = path.join(process.cwd(), 'public', 'images', 'company');
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

/** Optional `public/images/company/alt.json` — alt text for replaced photos, keyed by slot name. */
function readAltOverrides(): Record<string, string> {
  try {
    const file = path.join(COMPANY_DIR, 'alt.json');
    if (!existsSync(file)) return {};
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== ''));
  } catch {
    return {};
  }
}

const ALT_OVERRIDES = readAltOverrides();

/** Uses `public/images/company/<name>.<ext>` when present, otherwise the stock photo. */
function photo(slot: string, file: string, alt: string): { src: string; alt: string } {
  const base = file.replace(/\.[^.]+$/, '');
  let src = `/images/${file}`;
  try {
    for (const ext of EXTENSIONS) {
      if (existsSync(path.join(COMPANY_DIR, `${base}${ext}`))) {
        src = `/images/company/${base}${ext}`;
        break;
      }
    }
  } catch {
    // Unreadable folder: keep the stock photo.
  }
  return { src, alt: ALT_OVERRIDES[slot] ?? alt };
}

export const SITE_IMAGES = {
  teamCollab: photo('teamCollab', 'team-collab.jpg', 'A software team working together on laptops around a table'),
  teamReview: photo('teamReview', 'team-review.jpg', 'Two colleagues reviewing code together at a desk'),
  workspace: photo('workspace', 'workspace.jpg', 'Overhead view of a team workspace with laptops and phones'),
  webDev: photo('webDev', 'web-dev.jpg', 'Laptop showing source code on a developer’s desk'),
  webDesign: photo('webDesign', 'website-design.jpg', 'Desktop monitor displaying a website layout next to a code editor'),
  customSoftware: photo('customSoftware', 'custom-software.jpg', 'A team planning a project around sticky notes on a whiteboard'),
  webApp: photo('webApp', 'web-app-dev.jpg', 'A dual-monitor developer setup showing a web app’s code'),
  mobileApp: photo('mobileApp', 'mobile-app.jpg', 'Smartphone showing a home screen of mobile apps'),
  analytics: photo('analytics', 'analytics.jpg', 'Analytics dashboard with charts on a laptop screen'),
  cloud: photo('cloud', 'cloud-network.jpg', 'Earth at night with glowing city lights connected across the globe'),
  ai: photo('ai', 'ai.jpg', 'A sheet of paper reading "Artificial Intelligence" rolled into a typewriter'),
  uiux: photo('uiux', 'ui-ux-design.jpg', 'A hand sketching app wireframes on a tablet with a stylus'),
  ecommerce: photo('ecommerce', 'ecommerce.jpg', 'Person entering a credit card while checking out on a laptop'),
  integration: photo('integration', 'integration.jpg', 'Network patch panel with cables connecting different systems'),
  enterprise: photo('enterprise', 'enterprise.jpg', 'Two colleagues discussing work with a laptop at a meeting table'),
  teamCareers: photo('teamCareers', 'team-careers.jpg', 'A team working together on laptops around a table'),
} satisfies Record<string, { src: string; alt: string }>;

export type SiteImage = (typeof SITE_IMAGES)[keyof typeof SITE_IMAGES];

const SERVICE_FALLBACKS = [SITE_IMAGES.webDev, SITE_IMAGES.mobileApp, SITE_IMAGES.analytics, SITE_IMAGES.cloud, SITE_IMAGES.ai, SITE_IMAGES.teamReview];

/** Checked in order — more specific services (e.g. "Website Design") must be matched before the generic web/software catch-all. */
const SERVICE_KEYWORDS: [RegExp, SiteImage][] = [
  [/mobile|android|ios|app\b/i, SITE_IMAGES.mobileApp],
  [/\bai\b|machine|intelligen|automation/i, SITE_IMAGES.ai],
  [/\bux\b|\bui\b.*design|design.*\bui\b/i, SITE_IMAGES.uiux],
  [/\bwebsite\b/i, SITE_IMAGES.webDesign],
  [/e-?commerce|shop|checkout|cart/i, SITE_IMAGES.ecommerce],
  [/\bapi\b|integrat/i, SITE_IMAGES.integration],
  [/cloud|devops|hosting|infrastructure|deploy/i, SITE_IMAGES.cloud],
  [/data|analytic|dashboard|report|bi\b/i, SITE_IMAGES.analytics],
  [/\btest|\bqa\b|quality assurance/i, SITE_IMAGES.teamReview],
  [/enterprise|consult|strategy/i, SITE_IMAGES.enterprise],
  [/\bcustom\b/i, SITE_IMAGES.customSoftware],
  [/\bweb\b.*\bapp/i, SITE_IMAGES.webApp],
  [/web|software|custom/i, SITE_IMAGES.webDev],
];

/** Picks a relevant photo for a service from its name or slug, falling back to a stable choice by position. */
export function serviceImage(service: { name: string; slug: string }, index = 0) {
  const text = `${service.name} ${service.slug}`;
  return SERVICE_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? SERVICE_FALLBACKS[index % SERVICE_FALLBACKS.length]!;
}
