import Image from 'next/image';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Vector paths from the Asva Innovation Lab logo pack: a mountain-peak symbol (navy or white body,
 * Himalayan Snow cap, Electric/Bright Blue flag) plus the "ASVA" wordmark. Uploaded logo files in
 * Admin → Settings → Branding take precedence over this built-in version.
 */
const MOUNTAIN = '279,712 622,252 957,712 828,712 622,428 407,712';
const SNOW_CAP = '622,252 678.8,330 650,312 622,342 594,312 563.8,330';
const FLAG = '694,248 1270,248 968,672 901,580 1068,343 760,343';

const WORDMARK_A_LEFT = 'M280 663 L400 488 L468 488 L583 663 L522 663 L434 530 L343 663 Z';
const WORDMARK_A_BAR = 'M392 592 L448 592 L470 626 L368 626 Z';
const WORDMARK_S = 'M815 488 H668 C625 488 610 505 610 530 V550 C610 580 630 597 668 597 H762 C776 597 782 603 782 611 C782 620 776 626 762 626 H610 V663 H778 C822 663 838 645 838 620 V600 C838 570 820 557 780 557 H672 C664 557 661 554 661 546 V540 C661 532 664 527 672 527 H815 Z';
const WORDMARK_V = 'M836 488 L902 488 L990 620 L1073 488 L1132 488 L1024 663 L962 663 Z';

function Wordmark({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d={WORDMARK_A_LEFT} />
      <path d={WORDMARK_A_BAR} />
      <path d={WORDMARK_S} />
      <path d={WORDMARK_V} />
      <path transform="translate(807 0)" d={WORDMARK_A_LEFT} />
      <path transform="translate(807 0)" d={WORDMARK_A_BAR} />
    </g>
  );
}

interface LogoProps {
  /** `light` = white logo for dark backgrounds; `dark` = navy logo for light backgrounds. */
  tone?: 'light' | 'dark';
  variant?: 'full' | 'wordmark' | 'icon';
  className?: string;
  uploaded?: Media | null;
}

export function Logo({ tone = 'dark', variant = 'full', className, uploaded }: LogoProps) {
  if (uploaded) {
    return (
      <Image
        src={uploaded.url}
        alt={uploaded.alt || 'Asva Innovation Lab'}
        width={uploaded.width ?? 240}
        height={uploaded.height ?? 60}
        className={cn('h-9 w-auto object-contain', className)}
        priority
        unoptimized={uploaded.mimeType === 'image/gif'}
      />
    );
  }
  const mountainFill = tone === 'light' ? '#FFFFFF' : '#0B1736';
  const flagFill = tone === 'light' ? '#3D7BFF' : '#2F6BFF';
  const wordmarkFill = tone === 'light' ? '#FFFFFF' : '#0B1736';

  if (variant === 'icon') {
    return (
      <svg viewBox="0 0 240 240" className={cn('h-9 w-9', className)} role="img" aria-label="Asva Innovation Lab">
        <g transform="translate(120 122) scale(0.18) translate(-774.5 -480)">
          <polygon points={MOUNTAIN} fill={mountainFill} />
          <polygon points={SNOW_CAP} fill="#7FB0FF" />
          <polygon points={FLAG} fill={flagFill} />
        </g>
      </svg>
    );
  }
  if (variant === 'wordmark') {
    return (
      <svg viewBox="240 448 1190 255" className={cn('h-7 w-auto', className)} role="img" aria-label="Asva Innovation Lab">
        <Wordmark fill={wordmarkFill} />
      </svg>
    );
  }
  return (
    <svg viewBox="239 208 2513 544" className={cn('h-10 w-auto', className)} role="img" aria-label="Asva Innovation Lab">
      <polygon points={MOUNTAIN} fill={mountainFill} />
      <polygon points={SNOW_CAP} fill="#7FB0FF" />
      <polygon points={FLAG} fill={flagFill} />
      <g transform="translate(1380 375) scale(1.2) translate(-280 -488)">
        <Wordmark fill={wordmarkFill} />
      </g>
    </svg>
  );
}
