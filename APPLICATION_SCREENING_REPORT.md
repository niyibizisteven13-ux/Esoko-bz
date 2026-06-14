# Esoko Nexus B2B Commerce & Payments - Application Screening Report

**Date:** May 14, 2026  
**Project Type:** Full-stack React + Express + SQLite commerce and wallet app  
**Screening Method:** Static code review, configuration review, TypeScript check, production build, bundled API smoke test  
**Overall Rating:** 7.5/10 - functional and buildable, with the first critical security fixes implemented

---

## Executive Summary

The application is in a much stronger state than the previous report suggested. TypeScript now passes, the production Vite build succeeds, passwords are scrypt-hashed with legacy migration on login, refresh tokens exist, SQLite indexing has been added, and the app has a broad feature set across customer, trader, agent, manager, and admin workflows.

The first critical security issues from this screening have been implemented: generic collection routes now apply ownership checks, transaction email sending requires authentication, system log creation requires admin/manager access, admin OTP values are no longer logged, JWT startup no longer has an implicit fallback secret, browser-origin checks protect state-changing API calls, and the API smoke test now passes under the login-alert protection.

Remaining concerns are mostly around hardening depth: financial/admin flows need broader schema validation, file uploads need content inspection, demo credentials need production safeguards, and the SQLite schema should move to a formal migration system before real production use.

The modularization work has also started: password and token primitives now live in `lib/security.ts`, auth guards in `lib/authMiddleware.ts`, role helpers in `lib/roles.ts`, browser-origin protection in `lib/originGuard.ts`, revenue accounting in `lib/revenueService.ts`, and frontend session code in `src/services/sessionService.ts`.

**Current readiness:** Good for controlled demo or internal pilot. Not ready for public production deployment handling real funds until the high-risk items below are fixed and independently tested.

---

## Verified Checks

| Check | Result | Notes |
|---|---:|---|
| `npm.cmd run lint` | Pass | `tsc --noEmit` completed successfully. |
| `npm.cmd run build` | Pass | Vite production build completed successfully after sandbox approval. Largest chunks include `pdf`, `charts`, `TraderDashboard`, and `qrcode`. |
| `npm.cmd run test:api` | Pass | 7 passed, 0 failed. Test now clears the seeded login alert before wallet operations. |
| Secrets template review | Pass with caution | `.env.example` uses placeholders, not real SMTP credentials. |
| Git status | Not available | Folder is not a git repository. |

---

## Strengths

- Solid full-stack structure: React 19, Vite, Express, SQLite via `better-sqlite3`.
- Authentication has improved: httpOnly auth cookies, 15-minute access tokens, rotating refresh sessions, logout revocation, and suspended-user checks.
- Password storage uses Node `crypto.scryptSync` with per-password salt; legacy plaintext passwords are migrated on successful login.
- Helmet, CORS controls, JSON size limits, file type limits, and production env validation are present.
- Wallet operations use SQLite transactions and conditional balance updates for withdrawals/transfers.
- Database now includes many useful indexes across users, products, purchases, transactions, notifications, fees, subscriptions, and admin tables.
- The frontend uses route-level lazy loading and manual chunks for large vendor groups.
- `.env.example` no longer exposes the Gmail app password shown in the previous report.
- `server.ts` is being split into feature-oriented modules; core auth/security/revenue helpers are now testable without importing the full Express app.

---

## Implemented Critical Fixes

### 1. Generic collection routes are too permissive

**Location:** `server.ts`, `/api/:collectionName` handlers  
**Status:** Implemented  
**Issue Fixed:** Any authenticated user could read, create, update, or delete records in allowed generic document collections.

**Current Behavior:** Admins/managers retain broad access. Normal users are limited to documents tied to their id through ownership or participant fields such as `userId`, `ownerId`, `createdBy`, `customerId`, `traderId`, `senderId`, `recipientId`, `participants`, or `memberIds`. Sensitive generic collections such as `platform_revenue`, `platform_settings`, and `trader_financials` are restricted to elevated roles.

**Remaining Work:** Add explicit permission-matrix tests for every bridge collection.

### 2. Transaction email endpoint now requires auth

**Location:** `server.ts`, `POST /api/transaction-email`  
**Status:** Implemented  
**Issue Fixed:** The endpoint sent transaction confirmation email using server SMTP without authentication.

**Current Behavior:** The route now requires authentication. Normal users can only send transaction email to their own account email; admin/manager roles may send to other recipients.

**Remaining Work:** Prefer sending these emails server-side from trusted transaction completion code instead of accepting client-supplied transaction details.

### 3. Public system log creation

**Location:** `server.ts`, `POST /api/system-logs`  
**Status:** Implemented  
**Issue Fixed:** Anyone could write system log entries without authentication.

**Current Behavior:** `POST /api/system-logs` now requires admin or manager access.

---

## High-Risk Findings

### 4. Admin OTP request storage can be hardened further

**Location:** `server.ts`, `/api/admin/request-otp`, `/api/admin/verify-otp`  
**Issue:** OTP requests now have a dedicated limiter in production and OTPs are hashed in memory, but OTP state is still process-local.

**Impact:** OTPs are lost on restart and are not shared across multiple app instances.

**Recommendation:** Persist hashed OTPs in SQLite with expiry, request metadata, and consumed-at fields.

### 5. Admin OTP delivery audit should avoid email enumeration

**Location:** `server.ts`, admin OTP email flow  
**Issue:** OTP values are no longer logged and non-admin requests return a generic success response. Logs still include the requested email for operations visibility.

**Impact:** In high-security deployments, raw email addresses in logs may be considered sensitive.

**Recommendation:** Log only email hashes/user ids and delivery status in production.

### 6. Client-side role bypass hints removed

**Location:** `src/pages/AgentPortal.tsx`  
**Status:** Implemented  
**Issue Fixed:** Admin visibility no longer depends on hard-coded email checks in the UI.

**Remaining Work:** Keep backend role checks as the source of truth for all privileged actions.

### 7. Demo credentials are documented

**Location:** `README.md`  
**Issue:** Demo accounts and passwords are published in the repo documentation.

**Impact:** If seeded credentials survive in a deployed environment, takeover is immediate.

**Recommendation:** Keep demo credentials only in local/dev docs, require production seed hardening, and force password rotation on first production start.

---

## Medium-Risk Findings

### 8a. Monolithic `server.ts` refactor started

**Location:** `server.ts`, `lib/*`  
**Status:** Partially implemented  
**Issue Fixed:** Cross-cutting helpers have been extracted from `server.ts` into focused modules.

**Current Behavior:** `server.ts` still owns most route registration, but auth middleware, role normalization, origin protection, password/token security, and revenue fee posting are now isolated.

**Remaining Work:** Extract route groups into Express routers: `routes/auth.ts`, `routes/admin.ts`, `routes/wallet.ts`, `routes/products.ts`, `routes/purchases.ts`, and `routes/system.ts`.

### 8. API smoke test now accounts for login-alert protection

**Location:** `test-api.ts`  
**Status:** Implemented  
**Issue Fixed:** `deposit to wallet` failed because wallet operations were blocked by unresolved login alerts.

**Current Behavior:** The smoke test clears the seeded login alert after login and now passes 7/7 checks.

### 9. Financial endpoints need broader schema validation

**Location:** Multiple wallet, purchase, fee, user, and admin routes  
**Issue:** Auth routes use Zod, but many sensitive endpoints still parse request bodies manually.

**Recommendation:** Add Zod schemas for wallet deposit/withdraw/transfer, purchases, admin wallet adjustment, role changes, OTP, and subscription upgrade flows.

### 10. Local user cache reduced and renamed session service added

**Location:** `src/services/sessionService.ts`, `src/services/firebaseAuthService.ts`, `src/firebase.ts`  
**Status:** Partially implemented  
**Issue Fixed:** The confusing `firebaseAuthService` implementation has moved to `sessionService`, with the old filename left as a compatibility re-export. The local cache now stores only a small display/session snapshot instead of the full server user object.

**Remaining Risk:** Any local cache can still become stale or manipulated for display/routing until `/api/me` refreshes.

**Recommendation:** Treat local cache as display-only and keep server checks authoritative for every protected action.

### 10b. JWT fallback secret removed

**Location:** `server.ts`, `.env.example`  
**Status:** Implemented  
**Issue Fixed:** The server no longer falls back to `local-development-secret-change-me`.

**Current Behavior:** Production requires `JWT_SECRET`. Local development requires either `JWT_SECRET` or an explicit `DEV_JWT_SECRET`.

### 10c. Cookie CSRF origin check added

**Location:** `server.ts`  
**Status:** Implemented  
**Issue Fixed:** State-changing browser API requests using cookies now require a trusted `Origin` or `Referer` when those headers are present.

**Remaining Work:** Add a full synchronizer-token or double-submit CSRF token flow for higher assurance.

### 11. File upload validation should inspect content, not only MIME

**Location:** `server.ts`, multer setup  
**Issue:** Uploads restrict extensions/MIME and size, but static serving from `/uploads` relies on client-provided MIME checks.

**Recommendation:** Add magic-byte validation, image/video reprocessing where possible, no-sniff headers, and malware scanning for production.

### 12. No formal migration system

**Location:** `db.ts`  
**Issue:** Schema evolves through `CREATE TABLE IF NOT EXISTS` plus `ensureColumn`.

**Impact:** Works for local development, but production migrations, rollbacks, and data repair will be hard.

**Recommendation:** Introduce numbered migrations with applied-state tracking and backup/rollback procedures.

---

## Product & UX Observations

- The app covers a wide domain: marketplace, wallet, purchases, deliveries, fees, tax chamber, payroll, support, subscriptions, admin controls, and survey/onboarding.
- Scope is ambitious. For launch, the safest path is to freeze a smaller MVP flow: register/login, customer wallet, trader products, purchase, support, and admin oversight.
- The app still contains Firebase compatibility stubs, but auth naming has started moving to `sessionService`. Continue retiring Firebase-era names as modules are touched.
- Service worker registrations are explicitly unregistered in `src/main.tsx`, so PWA/offline expectations should be documented as disabled.

---

## Production Readiness Checklist

**Must fix before production:**
- Add explicit permission-matrix tests for generic collection routes.
- Move admin OTP persistence from memory to SQLite.
- Rotate demo credentials and ensure production cannot start with seeded demo passwords.
- Add validation schemas for wallet, purchase, admin, OTP, and subscription endpoints.

**Should fix soon:**
- Add migration framework.
- Add file content validation and safer upload serving headers.
- Add unit/integration tests for auth, role permissions, wallet atomicity, purchases, and admin operations.
- Add API documentation for frontend/backend contracts.
- Add monitoring for failed login alerts, OTP attempts, wallet failures, and admin actions.

---

## Suggested Next Testing Pass

1. Permission matrix tests: customer, trader, agent, manager, admin against every API route.
2. Wallet concurrency tests: simultaneous transfers/withdrawals cannot overdraft.
3. Auth tests: refresh rotation, revoked refresh token reuse, suspended users, password reset token reuse.
4. Abuse tests: OTP brute force, email relay attempts, upload MIME spoofing, generic collection access.
5. UX smoke tests: register, verify email, login, onboarding, purchase, delivery update, ticket creation, admin review.

---

## Final Assessment

This app is functional, buildable, and now has the first round of critical API hardening in place. The next production-readiness step is depth: add route-level permission tests, move OTP state into SQLite, add validation schemas for money/admin operations, and harden file uploads before handling real public financial traffic.
