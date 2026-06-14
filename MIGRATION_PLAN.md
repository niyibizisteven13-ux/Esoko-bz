# ESOKO Nexus Firestore Migration Plan

## Goal
Make this app independent from Firestore and Firebase while preserving the current UI and server architecture. The migration will be incremental: keep the existing Firestore backend as a fallback during development and replace data access with a custom REST API and new database.

## Current architecture
- Frontend: React + Vite
- Backend: Express server in `server.ts`
- Database/Auth: Firestore + Firebase Auth
- Additional services: Stripe, Nodemailer, email templates
- Existing service pattern: `src/services/*` and `src/context/*`

## Migration strategy

### 1. Keep Firestore as fallback
- Do not remove existing Firestore code.
- Add a new API service layer for custom backend calls.
- Replace one page/component at a time.

### 2. Create a data access abstraction
- New files in `src/services/` will wrap REST API calls.
- Existing components will later call these services instead of using Firestore SDK directly.
- Example service files:
  - `src/services/apiClient.ts`
  - `src/services/authService.ts`
  - `src/services/userService.ts`
  - `src/services/notificationService.ts`
  - `src/services/transactionService.ts`

### 3. Build the custom backend APIs
- Use `server.ts` as the starting point. It already uses Express.
- Replace Firestore queries in server routes with your own database queries.
- Use either SQL or NoSQL depending on preference.

## Backend API design

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/verify-reset-token`

### Users
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `GET /api/users` (admin)
- `GET /api/users/search?query=...`
- `POST /api/admin/bootstrap`

### Transactions
- `GET /api/transactions`
- `GET /api/transactions/:id`
- `POST /api/transactions`
- `GET /api/transactions/user/:userId`

### Notifications
- `GET /api/notifications`
- `POST /api/notifications`
- `PATCH /api/notifications/:id/read`
- `DELETE /api/notifications/:id`

### System config
- `GET /api/system/config`
- `PUT /api/system/config`

### Admin
- `GET /api/admin/users`
- `POST /api/admin/update-user`
- `POST /api/admin/delete-user`
- `GET /api/admin/system-stats`
- `GET /api/admin/config`
- `POST /api/admin/config`
- `POST /api/admin/request-otp`
- `POST /api/admin/verify-otp`

### Payment and email
- `POST /api/webhook`
- `POST /api/welcome-email`
- `POST /api/password-reset`
- `POST /api/transaction-email`
- `POST /api/ussd`

## Data model mapping

### Users
- `id` / `uid`
- `email`
- `name`
- `role` (`admin`, `trader`, `customer`, `team_member`)
- `walletBalance`
- `appNumber`
- `verificationStatus`
- `createdAt`
- `updatedAt`
- `tier`
- `upgradedAt`

### Transactions
- `id`
- `userId`
- `type` (`deposit`, `withdrawal`, `p2p`, `payment`, etc.)
- `amount`
- `fee`
- `category`
- `status`
- `reference`
- `metadata`
- `createdAt`

### Notifications
- `id`
- `userId`
- `title`
- `body`
- `read`
- `createdAt`

### System config
- `id` or `key`
- `name`
- `value`
- `updatedAt`
- `updatedBy`

### Loans / linked_accounts / tasks / team_members / referrals
- keep same collection semantics
- map to separate tables or collections
- `userId`, `traderId`, `assignedTo` fields

## Frontend migration path

### Phase 1: Create API layer
- Add generic `apiClient` wrapper.
- Add resource services for auth, users, notifications, transactions.
- Keep `src/firebase.ts` intact.

### Phase 2: Redirect one page/component
- Identify a low-risk page such as `ProfilePage`, `SettingsPage`, or `NotificationContext`.
- Replace Firestore logic there with new service API calls.
- Confirm behavior with the existing backend still in place.

### Phase 3: Migrate auth
- Replace `firebase/auth` usage gradually.
- Build new session/jwt handling.
- Once auth is stable, remove Firebase auth dependencies.

### Phase 4: Remove Firestore from frontend
- Convert remaining page components.
- Replace `onSnapshot` listeners with REST or real-time WebSocket/SSE if required.
- Keep the UI identical.

### Phase 5: Replace Firestore in backend
- Replace `firebase-admin` / `getFirestore()` calls with your own DB library.
- Keep the Express routes and business logic.
- Verify admin/OTP/email routes still work.

## Notes
- Existing `server.ts` already has reusable Express structure and email/Stripe logic.
- The most frequent Firestore operations are in `App.tsx`, `WalletComponent.tsx`, `TraderDashboard.tsx`, `NotificationContext.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, and `RegisterPage.tsx`.
- You can preserve the UI while moving the data layer behind a new REST API.

## Recommended first concrete tasks
1. Add `src/services/apiClient.ts`.
2. Add `src/services/authService.ts` and `src/services/userService.ts`.
3. Add `src/services/notificationService.ts` and `src/services/transactionService.ts`.
4. Replace one simple page with a REST call.
5. Convert backend Firestore route logic to database queries.
