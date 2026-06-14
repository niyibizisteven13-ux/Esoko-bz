# Esoko Nexus Development Screening Report

**Date:** June 14, 2026  
**Purpose:** Quick development-readiness screening for continuing work on the app.

## Summary

The app is developable and the main toolchain is healthy: TypeScript passes and the Vite production build succeeds. The current smoke-test path is not clean, so `npm run check` is not reliable until the config test and two API regressions are fixed.

Overall status: **good for local development after fixing smoke-test blockers; not production-ready for real money workflows yet.**

## Stack

- React 19 + Vite 6 frontend
- TypeScript in strict mode
- Express backend run with `tsx server.ts`
- SQLite via `better-sqlite3` at `data/esoko.db`
- JWT auth with httpOnly cookies and refresh sessions
- Tailwind CSS 4 through the Vite plugin

## Verified Checks

| Check | Result | Notes |
|---|---:|---|
| `npm run lint` | Pass | `tsc --noEmit` completed successfully. |
| `npm run build` | Pass | Vite production build completed successfully. |
| `npm run test:config` | Fail | Test expects `APP_URL` and `FRONTEND_URLS` to be hard production requirements, but current config only warns for those. |
| `npm run test:api` | Fail | 9 passed, 2 failed with the local server running. |

## Current API Smoke Failures

1. `wallet deposit idempotency`
   - Failure: repeated idempotent deposit changed wallet balance more than once.
   - Relevant files: `server.ts`, `lib/idempotency.ts`, `test-api.ts`.
   - First check: confirm whether repeated requests are reading/writing the same `idempotency_keys` row from the server connection, then add an assertion around the stored idempotency row.

2. `buy a product`
   - Failure: `Too many parameter values were provided`.
   - Relevant area: `server.ts`, `POST /api/purchases`.
   - First check: inspect SQL `.prepare(...).run(...)` calls inside the purchase transaction and helpers called from it, especially fee, ledger, loyalty, and notification writes.

3. `test:config`
   - Failure: stale expectation in `test-config.ts`.
   - Current implementation in `lib/env.ts` requires `JWT_SECRET` in production, while `APP_URL` and `FRONTEND_URLS` are warnings.
   - Fix either the test expectation or the config policy, depending on desired deployment strictness.

## Development Notes

- `server.ts` is still very large, above 12k lines. Some helpers are extracted into `lib/*`, but route groups should continue moving into focused routers.
- `db.ts` uses `CREATE TABLE IF NOT EXISTS` plus `ensureColumn`. This is convenient locally but should become numbered migrations before production.
- The repo has a dirty working tree with many existing modified and untracked files. Be careful to avoid mixing unrelated work in commits.
- Demo credentials are documented in `README.md`; do not deploy seeded demo passwords.
- The frontend still contains Firebase-era compatibility naming and services, though local auth now goes through `sessionService`.

## Recommended Next Work

1. Fix `test-config.ts` or make `lib/env.ts` enforce the stricter production policy.
2. Fix purchase smoke failure by tracing the parameter mismatch in the purchase transaction path.
3. Fix or harden wallet idempotency and add a small targeted regression test.
4. Extract core money routes into smaller routers after the smoke path is green.
5. Add Zod schemas for wallet, purchase, admin adjustment, subscription, and OTP endpoints.
6. Introduce a migration framework before using this database flow in production.

## Local Development Commands

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:5173`.

Useful checks:

```bash
npm run lint
npm run build
npm run test:config
npm run test:api
```

`npm run test:api` expects the server to be running and the database to be seeded.
