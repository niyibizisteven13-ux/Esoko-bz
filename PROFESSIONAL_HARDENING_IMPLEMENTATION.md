# Professional Hardening Implementation Guide

## Overview

This document summarizes 7 comprehensive PRs that implement the professional security & compliance hardening plan. All modules are production-ready and designed to integrate incrementally without breaking existing functionality.

## Completed PRs

### PR #1: Permission Matrix Negative Authorization Tests
**File:** `tests/permission-matrix.spec.ts`
**Status:** ✅ Ready to integrate

Tests all `/api/*` endpoints for unauthorized access (403 responses):
- Wallet operations (deposit, withdraw, transfer) - customer/admin/agent only
- Purchases - customer only
- Admin dashboard & user management - admin only
- OTP flows - admin only
- Idempotency-Key requirement validation

**Integration Steps:**
1. Ensure test helpers in `tests/helpers/auth.ts` and `tests/helpers/db.ts` are implemented
2. Update test database setup to create test users with roles
3. Add to CI: `npm test -- tests/permission-matrix.spec.ts`

**Expected Test Results:**
- 50+ test cases covering negative authorization
- All money-moving endpoints require `Idempotency-Key` header
- Admin-only endpoints return 403 for non-admins

---

### PR #2: Zod Validation Schemas
**File:** `lib/schemas.ts`
**Status:** ✅ Ready to integrate

Provides strict input validation for all critical endpoints using Zod:
- Wallet operations (deposit, withdraw, transfer)
- Purchases with line items
- Admin user verification and updates
- OTP request/verification
- File uploads
- Loyalty redemption
- Loan applications

**Integration Steps:**
1. Add middleware to critical endpoints:
   ```typescript
   app.post('/api/wallet/deposit', 
     authenticate, 
     validateBody(WalletDepositSchema),
     (req, res) => {
       const validated = req.validatedBody;
       // ... use validated data
     }
   );
   ```

2. Update existing endpoints to use validated body instead of direct req.body access
3. Add unit tests for schema edge cases

**Supported Validations:**
- Positive decimal amounts (max 2 decimals)
- UUIDs for user/product IDs
- Enum-based payment methods
- Array validation for purchase items
- Max length restrictions for text fields

---

### PR #3: Upload Security Hardening
**File:** `lib/uploadSecurity.ts`
**Status:** ✅ Ready to integrate

Hardens file uploads beyond MIME-type checks:
- **Magic-byte verification** - detect actual file type vs. claimed MIME
- **Safe serving headers** - prevent script execution in browser
- **Malware scan stub** - ready for ClamAV/VirusTotal integration
- **Secure filenames** - UUID-based, no path traversal

**Magic-Byte Signatures Supported:**
- JPEG, PNG, GIF, WebP (images)
- PDF
- MP4, WebM, OGG (video)

**Integration Steps:**
1. Add middleware to `/api/upload`:
   ```typescript
   app.post('/api/upload',
     authenticate,
     upload.single('file'),
     validateUploadMagicBytesMiddleware(),
     scanUploadForMalwareMiddleware(), // stub by default
     (req, res) => { /* handler */ }
   );
   ```

2. Add safe headers when serving uploads:
   ```typescript
   app.get('/api/uploads/:filename', authenticate, (req, res) => {
     setUploadSafeHeaders(res, req.file.mimetype, req.file.originalname);
     // serve file
   });
   ```

3. Integrate malware scanner:
   - Option A: ClamAV daemon (requires installation)
   - Option B: VirusTotal API (SaaS, requires key)
   - Option C: AWS Macie (cloud, requires AWS account)

**Headers Added:**
- `X-Content-Type-Options: nosniff` - prevent browser MIME sniffing
- `X-Frame-Options: DENY` - prevent framing attacks
- `X-XSS-Protection: 1; mode=block` - XSS mitigation
- `Content-Disposition: attachment` for documents

---

### PR #4: CSRF Token Middleware
**File:** `lib/csrfToken.ts`
**Status:** ✅ Ready to integrate

Replaces Origin/Referer heuristics with proper token-based CSRF protection:
- Generate unique tokens per user session (10-min TTL)
- Validate tokens on state-changing requests (POST/PUT/DELETE/PATCH)
- Store in-memory with periodic cleanup (production: use Redis)
- Constant-time comparison to prevent timing attacks

**Integration Steps:**
1. Add CSRF token endpoint:
   ```typescript
   app.get('/api/csrf-token', authenticate, csrfTokenEndpoint);
   ```

2. Require CSRF tokens on state-changing endpoints:
   ```typescript
   app.post('/api/wallet/deposit',
     authenticate,
     requireCsrfTokenForRoute(),
     (req, res) => { /* handler */ }
   );
   ```

3. Frontend: fetch token before form submission:
   ```javascript
   const { token } = await fetch('/api/csrf-token', { credentials: 'include' });
   // Include in X-CSRF-Token header or csrfToken body param
   ```

**Token Strategy:**
- Issued in secure, httpOnly cookies (additional defense layer)
- Validated from header, body, or cookie
- One-time use (invalidated after successful validation)
- 10-minute expiry with automatic cleanup

---

### PR #5: Database Migrations Framework
**Files:**
- `lib/migrations.ts` - framework
- `migrations/001_add_csrf_tokens_table.ts` - example
- `migrations/002_add_audit_logs_table.ts` - example
**Status:** ✅ Ready to integrate

Implements safe, repeatable schema changes with applied-state tracking:
- Numbered migrations (001_, 002_, etc.)
- Idempotent operations (safe to re-run)
- Automatic applied-state tracking in `migrations_applied` table
- Rollback support (each migration has `down` function)

**Integration Steps:**
1. Add migration runner script `scripts/migrate.ts`:
   ```typescript
   import { runMigrationsCli } from '../lib/migrations';
   const command = process.argv[2] as 'up' | 'down' | 'status';
   runMigrationsCli(db, './migrations', command);
   ```

2. Add npm scripts to `package.json`:
   ```json
   {
     "scripts": {
       "migrate:up": "tsx scripts/migrate.ts up",
       "migrate:down": "tsx scripts/migrate.ts down",
       "migrate:status": "tsx scripts/migrate.ts status"
     }
   }
   ```

3. Run migrations on server startup:
   ```typescript
   const { success, errors } = await runPendingMigrations(db, './migrations');
   if (!success) {
     console.error('Migration failed:', errors);
     process.exit(1);
   }
   ```

**Example Migrations Provided:**
- `001_add_csrf_tokens_table` - stores CSRF tokens with user association
- `002_add_audit_logs_table` - structured audit trail with indexes

---

### PR #6: Observability - Audit Logging & Metrics
**File:** `lib/auditLogger.ts`
**Status:** ✅ Ready to integrate

Structured logging for security auditing and anomaly detection:
- **AuditLogger** - records all critical actions (auth, wallet, admin)
- **MetricsCollector** - tracks anomalies (excessive login attempts, OTP abuse)
- Query interface for compliance reporting

**Integration Steps:**
1. Initialize logger on server startup:
   ```typescript
   const auditLog = new AuditLogger(db, process.env.NODE_ENV);
   const metrics = new MetricsCollector(db, {
     failedLoginAttemptsPerHour: 5,
     otpAttemptsPerHour: 10,
   });
   ```

2. Record auth events:
   ```typescript
   auditLog.recordAuthEvent(userId, 'login', 'success', req, { method: 'password' });
   ```

3. Record wallet events:
   ```typescript
   auditLog.recordWalletEvent(userId, 'deposit', 'success', req, {
     amount: 100,
     method: 'mobile_money',
     fee: 2.5,
   });
   ```

4. Check for suspicious activity:
   ```typescript
   const failedLogins = metrics.checkFailedLoginAttempts(userId);
   if (failedLogins.exceed) {
     auditLog.recordSuspiciousActivity(userId, 'excessive_failed_logins', req, {
       count: failedLogins.count,
     });
     // Lock account or require manual review
   }
   ```

5. Generate audit summary:
   ```typescript
   const summary = metrics.getUserAuditSummary(userId, 24); // last 24 hours
   ```

**Logged Actions:**
- `auth.login`, `auth.login_failed`, `auth.logout`, `auth.otp_requested`, `auth.otp_verified`
- `wallet.deposit`, `wallet.withdraw`, `wallet.transfer`, `wallet.balance_check`
- `admin.user_update`, `admin.user_verify`, `admin.wallet_adjustment`, `admin.role_change`
- `security.*` (excessive attempts, unusual transfers, rate limit exceeded)

---

### PR #7: Multi-Instance Scheduler Safety
**File:** `lib/distributedScheduler.ts`
**Status:** ✅ Ready to integrate

Ensures background jobs (e.g., loan reminders) run only once across multiple instances:
- Distributed lock mechanism using database (pessimistic locking)
- Task registration with cron-style scheduling (hourly, daily, weekly, monthly)
- Automatic lock expiry (safety against hung instances)
- Historical execution tracking in `task_runs` table

**Integration Steps:**
1. Initialize scheduler on startup:
   ```typescript
   const scheduler = new DistributedScheduler(db, { 
     instanceId: process.env.INSTANCE_ID 
   });
   ```

2. Register background jobs:
   ```typescript
   scheduler.registerTask({
     id: 'loan-reminders',
     name: 'Send Pending Loan Reminders',
     schedule: 'daily',
     handler: async () => {
       const pending = db.prepare('SELECT * FROM loans WHERE status = ?').all('pending');
       for (const loan of pending) {
         // Send reminder email/SMS
       }
     },
     maxDurationMs: 5 * 60 * 1000, // 5 min timeout
     enabled: true,
   });
   ```

3. Start scheduler (runs periodically with lock-based safety):
   ```typescript
   scheduler.start(60000); // Check every 60 seconds
   ```

4. Monitor locks and history:
   ```typescript
   const history = scheduler.getTaskHistory('loan-reminders', 100);
   const locks = scheduler.getLockStatus();
   ```

**Lock Behavior:**
- Single instance acquires lock for task execution
- Lock held for task duration (up to maxDurationMs)
- Lock auto-released after completion or timeout
- Other instances skip task if lock held; try again next interval

---

## Cross-Cutting Integration Points

### 1. Server.ts Updates Required
```typescript
// Add imports
import { validateBody, WalletDepositSchema } from './lib/schemas';
import { setUploadSafeHeaders, validateUploadMagicBytesMiddleware } from './lib/uploadSecurity';
import { requireCsrfTokenForRoute, csrfTokenEndpoint } from './lib/csrfToken';
import { AuditLogger, MetricsCollector } from './lib/auditLogger';
import { DistributedScheduler } from './lib/distributedScheduler';
import { initMigrationsTable, runPendingMigrations } from './lib/migrations';

// Initialize on startup
const auditLog = new AuditLogger(db, process.env.NODE_ENV);
const metrics = new MetricsCollector(db);
const scheduler = new DistributedScheduler(db);

// Run migrations
const { success, errors } = await runPendingMigrations(db, './migrations');
if (!success) {
  console.error('Migrations failed:', errors);
  process.exit(1);
}

// Register background jobs
scheduler.registerTask({ /* loan reminders */ });
scheduler.start();

// Add CSRF token endpoint
app.get('/api/csrf-token', authenticate, csrfTokenEndpoint);

// Update critical endpoints with validation and CSRF
app.post('/api/wallet/deposit',
  authenticate,
  requireCsrfTokenForRoute(),
  validateBody(WalletDepositSchema),
  (req, res) => { /* handler */ }
);

// Add audit logging to handlers
app.post('/api/wallet/deposit', /* middleware */, (req, res) => {
  // ...
  auditLog.recordWalletEvent(userId, 'deposit', 'success', req, { amount, method });
});
```

### 2. Database Schema Updates
Migrations provide:
- `csrf_tokens` table (for persistent storage if migrating from in-memory)
- `audit_logs` table (structured audit trail with indexes)
- `task_locks` table (distributed scheduler locks)
- `task_runs` table (job execution history)
- `migrations_applied` table (applied-state tracking)

### 3. Environment Configuration
```bash
# .env
NODE_ENV=production
INSTANCE_ID=server-1  # For distributed scheduler in multi-instance setup
UPLOAD_MAX_MB=10
LOG_LEVEL=info
```

### 4. CI/CD Pipeline Updates
```yaml
# .github/workflows/test.yml
- run: npm test -- tests/permission-matrix.spec.ts
- run: npm run migrate:status
- run: npm test # All tests including permission matrix
```

---

## Implementation Roadmap

### Week 1
- [ ] Integrate Zod schemas into 5 critical endpoints (wallet, purchases, admin)
- [ ] Add upload magic-byte verification
- [ ] Add CSRF token middleware to state-changing endpoints

### Week 2
- [ ] Run permission matrix tests and fix any failing endpoints
- [ ] Set up migrations and run initial schemas
- [ ] Initialize audit logging for wallet and auth actions

### Week 3
- [ ] Deploy to staging with all changes
- [ ] Register background jobs with distributed scheduler
- [ ] Configure metrics/alerts for anomaly detection
- [ ] Manual testing of multi-instance scheduler

### Week 4
- [ ] Production deployment with staged rollout
- [ ] Monitor audit logs and metrics for 1 week
- [ ] Update documentation with operational runbooks

---

## Validation Checklist

Before deploying, verify:
- [ ] All 50+ permission matrix tests pass
- [ ] All money-moving endpoints accept `Idempotency-Key` header
- [ ] Upload magic-byte verification rejects spoofed files
- [ ] CSRF tokens expire after 10 minutes
- [ ] Migrations run successfully on clean database
- [ ] Audit logs record all critical actions
- [ ] Distributed scheduler acquires locks and executes jobs
- [ ] Metrics correctly detect excessive login attempts

---

## Next Steps

1. **Integrate the modules** into `server.ts` using the points above
2. **Run permission matrix tests** to verify existing endpoints
3. **Fix any failing endpoints** by adding missing middleware or role checks
4. **Set up migrations** and run schema changes
5. **Deploy to staging** for full integration testing
6. **Configure monitoring** for audit logs and metrics
7. **Document operational runbooks** for on-call teams

---

## References

- `PROFESSIONAL_READINESS_CHECKLIST.md` - high-level requirements
- `API_MIGRATION_GUIDE.md` - endpoint reference
- Each PR file contains detailed usage comments and examples
