import Image from 'next/image';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Vector paths traced from the supplied Asva Innovation Lab logo. Uploaded logo files in
 * Admin → Settings → Branding take precedence over this built-in version.
 */
const A_LEFT = '217,515 310,379 363,379 452,515 405,515 336,411 304,459 347,460 364,486 285,486 265,515';
const S_PATH =
  'M632,379 H535 C495,379 476,388 472,410 C469,425 469,440 474,448 C482,458 498,463 520,463 H590 C602,463 607,467 607,474 C607,482 600,486 588,486 H474 V515 H600 C635,515 648,503 650,485 C652,470 651,455 647,447 C640,438 625,433 598,433 H527 C518,433 514,428 514,421 C514,414 520,409 529,409 H632 Z';
const V = '649,379 697,379 769,482 831,379 878,379 793,515 746,515';
const A_RIGHT = '843,515 931,379 979,379 1062,515 1017,515 954,411 924,459 963,459 979,486 905,486 888,515';

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
  const fill = tone === 'light' ? '#FFFFFF' : '#0B1020';
  if (variant === 'icon') {
    return (
      <svg viewBox="184.5 297 300 300" className={cn('h-9 w-9', className)} role="img" aria-label="Asva Innovation Lab">
        <polygon points={A_LEFT} fill={fill} />
      </svg>
    );
  }
  const full = variant === 'full';
  return (
    <svg
      viewBox={full ? '205 365 870 210' : '205 365 870 165'}
      className={cn(full ? 'h-10 w-auto' : 'h-7 w-auto', className)}
      role="img"
      aria-label="Asva Innovation Lab Private Limited"
    >
      <g fill={fill}>
        <polygon points={A_LEFT} />
        <path d={S_PATH} />
        <polygon points={V} />
        <polygon points={A_RIGHT} />
        {full && (
          <text x="219" y="562" textLength="843" lengthAdjust="spacingAndGlyphs" fontFamily="var(--font-inter), Inter, Arial, sans-serif" fontSize="43" fontWeight="500">
            INNOVATION LAB PRIVATE LIMITED
          </text>
        )}
      </g>
    </svg>
  );
}
