import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Pages here are server-rendered on every request (see force-dynamic in app/(public)/layout.tsx),
// so there's no ISR/static cache to persist — the default in-memory cache is sufficient.
export default defineCloudflareConfig();
