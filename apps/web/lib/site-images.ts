/** Stock photography stored in `public/images` (Unsplash, free to use under the Unsplash License). */
export const SITE_IMAGES = {
  teamCollab: { src: '/images/team-collab.jpg', alt: 'A software team working together on laptops around a table' },
  teamReview: { src: '/images/team-review.jpg', alt: 'Two colleagues reviewing code together at a desk' },
  workspace: { src: '/images/workspace.jpg', alt: 'Overhead view of a team workspace with laptops and phones' },
  webDev: { src: '/images/web-dev.jpg', alt: 'Laptop showing source code on a developer’s desk' },
  mobileApp: { src: '/images/mobile-app.jpg', alt: 'Smartphone showing a home screen of mobile apps' },
  analytics: { src: '/images/analytics.jpg', alt: 'Analytics dashboard with charts on a laptop screen' },
  cloud: { src: '/images/cloud-network.jpg', alt: 'Earth at night with glowing city lights connected across the globe' },
  ai: { src: '/images/ai.jpg', alt: 'Abstract blue visual of artificial intelligence' },
} as const;

const SERVICE_FALLBACKS = [SITE_IMAGES.webDev, SITE_IMAGES.mobileApp, SITE_IMAGES.analytics, SITE_IMAGES.cloud, SITE_IMAGES.ai, SITE_IMAGES.teamReview];

const SERVICE_KEYWORDS: [RegExp, (typeof SITE_IMAGES)[keyof typeof SITE_IMAGES]][] = [
  [/mobile|android|ios|app\b/i, SITE_IMAGES.mobileApp],
  [/\bai\b|machine|intelligen|automation/i, SITE_IMAGES.ai],
  [/cloud|devops|hosting|infrastructure|deploy/i, SITE_IMAGES.cloud],
  [/data|analytic|dashboard|report|bi\b/i, SITE_IMAGES.analytics],
  [/consult|strategy|support|maintenance|qa|test/i, SITE_IMAGES.teamReview],
  [/web|website|software|custom|design|ui|ux|e-?commerce/i, SITE_IMAGES.webDev],
];

/** Picks a relevant photo for a service from its name or slug, falling back to a stable choice by position. */
export function serviceImage(service: { name: string; slug: string }, index = 0) {
  const text = `${service.name} ${service.slug}`;
  return SERVICE_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? SERVICE_FALLBACKS[index % SERVICE_FALLBACKS.length]!;
}
