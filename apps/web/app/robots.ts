import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const production = process.env.NODE_ENV === 'production' && !/localhost|staging/.test(process.env.NEXT_PUBLIC_SITE_URL ?? '');
  return {
    rules: production
      ? [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/newsletter/'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
