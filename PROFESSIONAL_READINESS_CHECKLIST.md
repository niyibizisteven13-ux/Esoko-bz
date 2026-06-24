# Professional App Readiness Checklist

This checklist maps high-level professionalization requirements to concrete acceptance criteria and suggested tests/evidence. Use this as a developer-facing implementation plan.

1. Permission matrix + negative authorization tests for every `/api/*` route
   - Acceptance: Every route has an associated permission role list and automated negative tests that assert 403 on unauthorized requests.
   - Evidence: `tests/permissions/*.spec.ts` running in CI, permission matrix CSV attached to PR.

2. Zod validation for every money/admin endpoint
   - Acceptance: Incoming payloads validated by Zod schemas; invalid payloads return 400 with standardized error format.
   - Evidence: `schemas/` directory, unit tests for schema edge-cases, integration tests hitting wallet/purchase endpoints.

3. Idempotency regression tests under concurrency
   - Acceptance: Critical endpoints (deposit/withdraw/transfer/purchase) accept an idempotency key and remain consistent under concurrent retries.
   - Evidence: Concurrency test harness reproducing race conditions; CI job that runs stress tests.

4. Upload hardening beyond MIME
   - Acceptance: Uploaded files are validated by magic-bytes, scanned by malware scanner (local or SaaS), stored with safe-serving headers and randomized names.
   - Evidence: Upload middleware implementation, sample scanned report, unit tests for magic-byte rejection.

5. Numbered migrations + applied-state tracking
   - Acceptance: Migrations are numbered, idempotent, and applied-state is tracked in DB (`migrations_applied` table).
   - Evidence: `migrations/` folder, migration runner script, applied-state table populated in staging.

6. CSRF: proper token strategy for cookie auth
   - Acceptance: Cookie-based auth uses rotating CSRF tokens (double-submit or SameSite+CSRF token) and Rejects requests missing tokens.
   - Evidence: Middleware code, unit tests, end-to-end tests for token-required flows.

7. Observability: structured audit logs + metrics + alerts
   - Acceptance: Auth/OTP abuse, wallet failures, and admin actions emit structured logs and metrics; alerts configured for thresholds.
   - Evidence: Example structured log lines, metrics dashboards, alert rules in monitoring config.

8. Multi-instance scheduler safety
   - Acceptance: Background jobs (loan reminders, exports) use a leader election or distributed lock to avoid duplicate runs across instances.
   - Evidence: Scheduler implementation using DB locks or Redis locks; tests simulating multi-instance scheduling.

Cross-cutting requirements
- Secrets & keys: use vault/secure env with rotation policy.
- Least privilege: DB and service accounts follow least-privilege principle.
- CI gating: Tests for permission matrix, schema validation, idempotency, and upload checks must pass before merge.

Suggested immediate tasks (first PRs)
- Add `rg`-based repo search to identify all `/api/*` routes and list their current handlers.
- Add Zod schemas for top 5 critical endpoints (wallet deposit/withdraw, purchase, admin-adjust, file upload).
- Add idempotency key middleware and tests for deposit/withdraw endpoints.
- Add upload magic-byte checks to the existing upload middleware.

Use this file as the canonical checklist to track implementation and evidence. Link PRs and test results against each acceptance item.
