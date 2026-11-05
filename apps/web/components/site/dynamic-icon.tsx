import { createElement } from 'react';
import type { LucideProps } from 'lucide-react';
import { getIcon } from '@/lib/icons';

/** Renders a CMS-selected icon by name from the curated icon set. */
export function DynamicIcon({ icon, ...props }: Omit<LucideProps, "name"> & { icon: string | null | undefined }) {
  return createElement(getIcon(icon), props);
}
