/** Stock photography stored in `public/images` (Unsplash, free to use under the Unsplash License). */
export const SITE_IMAGES = {
  teamCollab: { src: '/images/team-collab.jpg', alt: 'A software team working together on laptops around a table' },
  teamReview: { src: '/images/team-review.jpg', alt: 'Two colleagues reviewing code together at a desk' },
  workspace: { src: '/images/workspace.jpg', alt: 'Overhead view of a team workspace with laptops and phones' },
  webDev: { src: '/images/web-dev.jpg', alt: 'Laptop showing source code on a developer’s desk' },
  webDesign: { src: '/images/website-design.jpg', alt: 'Desktop monitor displaying a website layout next to a code editor' },
  customSoftware: { src: '/images/custom-software.jpg', alt: 'A team planning a project around sticky notes on a whiteboard' },
  webApp: { src: '/images/web-app-dev.jpg', alt: 'A dual-monitor developer setup showing a web app’s code' },
  mobileApp: { src: '/images/mobile-app.jpg', alt: 'Smartphone showing a home screen of mobile apps' },
  analytics: { src: '/images/analytics.jpg', alt: 'Analytics dashboard with charts on a laptop screen' },
  cloud: { src: '/images/cloud-network.jpg', alt: 'Earth at night with glowing city lights connected across the globe' },
  ai: { src: '/images/ai.jpg', alt: 'A sheet of paper reading "Artificial Intelligence" rolled into a typewriter' },
  uiux: { src: '/images/ui-ux-design.jpg', alt: 'A hand sketching app wireframes on a tablet with a stylus' },
  ecommerce: { src: '/images/ecommerce.jpg', alt: 'Person entering a credit card while checking out on a laptop' },
  integration: { src: '/images/integration.jpg', alt: 'Network patch panel with cables connecting different systems' },
  enterprise: { src: '/images/enterprise.jpg', alt: 'Two colleagues discussing work with a laptop at a meeting table' },
  teamCareers: { src: '/images/team-careers.jpg', alt: 'A team working together on laptops around a table' },
} as const;

const SERVICE_FALLBACKS = [SITE_IMAGES.webDev, SITE_IMAGES.mobileApp, SITE_IMAGES.analytics, SITE_IMAGES.cloud, SITE_IMAGES.ai, SITE_IMAGES.teamReview];

/** Checked in order — more specific services (e.g. "Website Design") must be matched before the generic web/software catch-all. */
const SERVICE_KEYWORDS: [RegExp, (typeof SITE_IMAGES)[keyof typeof SITE_IMAGES]][] = [
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
