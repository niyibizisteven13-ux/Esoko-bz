# Bwenge Deployment Readiness

This app is ready for local demo and internal beta after the current checks pass. It is not yet production-ready for real wallets or paid subscriptions until the database and file-storage requirements below are completed.

## Required Environment

Set these variables in the hosting platform, not in committed files:

- `NODE_ENV=production`
- `APP_URL=https://bwenge.space`
- `FRONTEND_URLS=https://bwenge.space`
- `JWT_SECRET=<at least 32 random characters>`
- `TRUST_PROXY=1` when deployed behind Render, Railway, Fly.io, Nginx, Cloudflare, or another TLS proxy
- `COOKIE_SAMESITE=strict` for same-origin deployments, or `none` only when frontend/backend are cross-site over HTTPS
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `UPLOAD_MAX_MB=10` or lower unless uploads move to object storage
- `DATABASE_URL=<managed PostgreSQL connection string>` after the full data migration is complete

Do not set `DEV_JWT_SECRET` in production.

## Recommended Hosting

- Frontend: Vercel, Netlify, Cloudflare Pages, or static files behind Nginx.
- Backend: Render, Railway, Fly.io, or a VPS with HTTPS termination.
- Database: SQLite is acceptable for beta only. Use PostgreSQL with migrations for serious production money flows.
- Uploads: S3-compatible object storage. Local `uploads/` is not durable on many hosts.
- Email: Resend, SendGrid, Mailgun, or a production SMTP account.
- Monitoring: Sentry plus an uptime monitor.

## Production Safety Gates

Before launch:

- Run `npm run check`.
- Run `npm run build`.
- Confirm `/api/health` returns `status: ok`.
- Confirm production boot fails if `JWT_SECRET`, `APP_URL`, or `FRONTEND_URLS` is missing.
- Confirm browser requests only work from allowed frontend origins.
- Confirm wallet deposit, withdrawal, transfer, purchase, subscription, and refund requests include an `Idempotency-Key` header.
- Confirm admin actions are written to `admin_actions`.
- Confirm database backups are scheduled and restore has been tested.

## Payment-Grade Rules

Money-moving endpoints must be treated as non-repeatable operations:

- Clients must send a unique `Idempotency-Key` per intended payment action.
- Retrying with the same key returns the first stored response.
- Reusing the same key on another route returns a conflict.
- Wallet balance changes must happen inside database transactions.
- Ledger entries should never be edited in place; corrections should be new entries.

## Remaining 10/10 Work

The app is now much closer to production shape, but a true 10/10 launch still needs:

- Full PostgreSQL migration for all transactional, identity, audit, idempotency, and scheduler data. The current PostgreSQL integration mirrors account data only; it is not a complete production database backend.
- Immutable ledger correction entries for every admin money adjustment.
- More route modules split out of `server.ts`.
- File content scanning for public uploads.
- Expand CI with full integration tests for auth, roles, wallet, revenue, subscriptions, and admin refunds.
- Full integration tests for auth, roles, wallet, revenue, subscriptions, and admin refunds.
