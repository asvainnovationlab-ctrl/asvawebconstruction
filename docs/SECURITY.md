# Security overview

| Area | Implementation |
| --- | --- |
| Passwords | Argon2id (19 MiB, t=2, p=1). Policy: ≥ 12 chars, 3 of 4 character classes, must not contain the email name. No default accounts; first admin created via CLI. |
| Sessions | 15-minute access JWT (HS256) in an HttpOnly, SameSite=Lax, Secure cookie. Opaque refresh token (only its SHA-256 hash is stored) scoped to `/api/v1/auth`, rotated on every use; replaying a rotated token revokes the whole session family. Every request re-checks the session row, so logout/deactivation is immediate. |
| CSRF | Double-submit token (`asva_csrf` cookie ↔ `X-CSRF-Token` header) on all cookie-authenticated unsafe requests, plus an Origin allow-list check. |
| Brute force | Per-IP rate limits (login 5/min, forms 3–5 per 10 min, global 300/min) and progressive account lockout (15 min after 5 failures, doubling, max 24 h). Generic "Invalid email or password" responses; timing equalised for unknown accounts. |
| Password reset / invites | 32-byte single-use tokens stored hashed, 30-minute (reset) / 72-hour (invite) expiry; the forgot-password response never reveals whether an account exists. Completing a reset revokes all sessions. |
| Authorization | Deny-by-default global guard; permission keys checked server-side on every admin endpoint. The UI hides controls only for convenience. Safeguards prevent removing the last administrator or the Administrator role's core permissions. |
| Input validation | Shared Zod schemas validate every body/query on the server; unknown fields are stripped. Prisma parameterises all queries (the few raw queries use tagged templates). |
| XSS | Rich text is sanitised with an allow-list on save (API) and again on render (web). No SVG uploads. Links restricted to http(s)/mailto/tel/site paths; `javascript:` and `data:` blocked in navigation, redirects and content. JSON-LD output is escaped. |
| Uploads | Allow-listed extensions, verified by magic bytes; size limits per type; images re-encoded (strips EXIF/GPS); server-generated storage keys; private files (resumes, attachments) only via permission-checked, audited downloads with `Content-Disposition: attachment`, `nosniff` and a sandboxing CSP. |
| Spam | Honeypot field, minimum fill time, duplicate-content detection, rate limits, optional Cloudflare Turnstile. |
| Headers | Helmet on the API (CSP, HSTS in production, frame-ancestors none); Next.js sends `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production, and `X-Robots-Tag: noindex` + `no-store` for `/admin`. |
| CORS | Restricted to `FRONTEND_URL` and `CORS_ORIGINS`, credentials enabled only for those origins. |
| Privacy | IP addresses stored only as keyed HMACs on public submissions; consent timestamps recorded; configurable retention purges; internal notes and private settings are never returned by public endpoints. |
| Audit | Logins (success/failure/lockout), refresh-token reuse, user/role changes, publication changes, deletions, settings changes, lead status changes, exports and resume downloads. Metadata is scrubbed of password/token/secret keys. |
| Secrets | Only via environment variables; `.env` is git-ignored; production refuses placeholder secrets and insecure cookies. Nothing secret is stored in site settings or `NEXT_PUBLIC_*`. |
| Dependencies | `npm run audit:deps` (also in CI). At the time of writing: 0 known vulnerabilities in production dependencies (multer pinned to ≥ 2.5.0 via `overrides`). |
| Logging | Structured JSON (pino) with request IDs; cookies, authorization and CSRF headers are redacted. Unexpected errors are logged in full but returned to clients as a generic message. |

## Reporting

Report suspected vulnerabilities privately to the site administrator (configure a `security@` address and consider publishing `/.well-known/security.txt`).

## Operational recommendations

- Put the site behind a CDN/WAF (e.g. Cloudflare) for TLS, DDoS protection and edge rate limiting.
- Keep the database on a private network; use a least-privilege database user for the API.
- Rotate `JWT_ACCESS_SECRET` (signs everyone out) and SMTP/storage keys periodically.
- Review audit logs and the email log regularly; run `npm run audit:deps` and update dependencies monthly.
