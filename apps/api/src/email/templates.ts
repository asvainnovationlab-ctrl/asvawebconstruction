export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface LayoutOptions {
  companyName: string;
  siteUrl: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  rows?: [string, string | null | undefined][];
  button?: { label: string; href: string };
  footerNote?: string;
}

/**
 * Accessible, table-based email layout with a text wordmark (images are often blocked by mail
 * clients). Every dynamic value is HTML-escaped.
 */
export function renderEmail(subject: string, o: LayoutOptions): RenderedEmail {
  const rows = (o.rows ?? []).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font-size:14px">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;color:#64748B;width:38%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;color:#0F172A;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const button = o.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(o.button.href)}" style="background:#3B82F6;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(o.button.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#F8FAFC;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0F172A">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(o.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
<tr><td style="background:#0B1020;padding:20px 28px"><span style="color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:3px">ASVA</span><span style="color:#94A3B8;font-size:11px;letter-spacing:2px;display:block">INNOVATION LAB</span></td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 16px">${escapeHtml(o.heading)}</h1>
${o.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(p)}</p>`).join('')}
${rowsHtml}${button}
</td></tr>
<tr><td style="padding:20px 28px;background:#F8FAFC;color:#64748B;font-size:12px;line-height:1.5">
${escapeHtml(o.footerNote ?? `You are receiving this email because of an interaction with ${o.companyName}.`)}<br>
We process personal data in line with our <a href="${escapeHtml(o.siteUrl)}/privacy-policy" style="color:#3B82F6">Privacy Policy</a>.<br>
&copy; ${new Date().getFullYear()} ${escapeHtml(o.companyName)}
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    o.heading,
    '',
    ...o.paragraphs,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(o.button ? ['', `${o.button.label}: ${o.button.href}`] : []),
    '',
    '—',
    o.footerNote ?? `You are receiving this email because of an interaction with ${o.companyName}.`,
    `Privacy Policy: ${o.siteUrl}/privacy-policy`,
  ].join('\n');

  return { subject, html, text };
}
