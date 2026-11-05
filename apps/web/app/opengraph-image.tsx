import { ImageResponse } from 'next/og';

export const alt = 'Asva Innovation Lab — software development company in Pokhara, Nepal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default social sharing image. Replace it by uploading one in Admin → Settings → Branding. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0B1020 0%, #111827 60%, #0c2a4a 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="380" height="92" viewBox="205 365 870 210">
          <g fill="#FFFFFF">
            <polygon points="217,515 310,379 363,379 452,515 405,515 336,411 304,459 347,460 364,486 285,486 265,515" />
            <path d="M632,379 H535 C495,379 476,388 472,410 C469,425 469,440 474,448 C482,458 498,463 520,463 H590 C602,463 607,467 607,474 C607,482 600,486 588,486 H474 V515 H600 C635,515 648,503 650,485 C652,470 651,455 647,447 C640,438 625,433 598,433 H527 C518,433 514,428 514,421 C514,414 520,409 529,409 H632 Z" />
            <polygon points="649,379 697,379 769,482 831,379 878,379 793,515 746,515" />
            <polygon points="843,515 931,379 979,379 1062,515 1017,515 954,411 924,459 963,459 979,486 905,486 888,515" />
          </g>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>Building digital experiences that move businesses forward.</div>
          <div style={{ marginTop: 24, fontSize: 28, color: '#94A3B8' }}>Software development · Pokhara, Nepal</div>
        </div>
        <div style={{ height: 6, width: 220, background: 'linear-gradient(90deg, #3B82F6, #06B6D4)', borderRadius: 3 }} />
      </div>
    ),
    size,
  );
}
