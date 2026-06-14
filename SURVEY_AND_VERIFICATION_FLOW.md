# Survey & Email Verification Flow Implementation

## Overview
The system now has a complete survey data collection and email verification flow that routes users through registration → onboarding → survey collection → email verification → dashboard access.

## Database Schema

### survey_questions
```sql
CREATE TABLE survey_questions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  questionType TEXT NOT NULL DEFAULT 'text',  -- text, multiple-choice, rating
  options TEXT,                               -- JSON array of options
  required INTEGER DEFAULT 0,
  orderIndex INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### survey_responses
```sql
CREATE TABLE survey_responses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  questionId TEXT NOT NULL,
  response TEXT NOT NULL,                    -- JSON-serialized answer
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES survey_questions(id) ON DELETE CASCADE
);
```

## User Flow

### 1. Registration Flow
**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password_123",
  "name": "John Doe",
  "role": "customer",
  "phone": "+250788000000",
  "category": "Retail",
  "surveyResponses": [
    { "questionId": "q1", "response": "Option A" },
    { "questionId": "q2", "response": 5 }
  ]  // Optional - can be omitted for later collection
}
```

**Response:**
```json
{
  "success": true,
  "user": { /* user object */ },
  "token": "jwt_token",
  "role": "customer",
  "onboardingComplete": false,
  "redirectTo": "/onboarding"
}
```

**Backend Logic:**
- Creates user account in `users` table
- If `surveyResponses` is provided, stores them in `survey_responses` table
- Creates initial wallet and loyalty points records
- Returns JWT token and redirect path

### 2. Onboarding Flow (Survey Collection)
**Current User Path:** `/onboarding`

**Frontend Component:** `src/pages/OnboardingPage.tsx`

**Survey Question Fetching:**
```
GET /api/survey-questions (authenticated)
```

**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "id": "q1",
      "question": "What is your primary business type?",
      "questionType": "multiple-choice",
      "options": ["Wholesale", "Retail", "Service"],
      "required": 1,
      "orderIndex": 1
    }
  ]
}
```

**Survey Response Submission:**
```
POST /api/survey-responses (authenticated)
```

**Request:**
```json
{
  "responses": [
    { "questionId": "q1", "response": "Retail" },
    { "questionId": "q2", "response": "Medium" },
    { "questionId": "q3", "response": 4 }
  ]
}
```

**Backend Logic:**
- Validates each response matches an enabled question
- Updates or inserts survey responses for the user
- Returns confirmation with submitted responses

### 3. Email Verification Flow

**Trigger:** After registration or on-demand via `/api/auth/send-verification-email`

**Email Generation:**
- System generates 32-byte random token
- Hashes token for storage in `email_verification_tokens` table
- Creates verification link: `{appBaseUrl}/verify-email?token={token}&email={email}`
- Email expires in 24 hours

**Verification URL:**
```
GET /verify-email?token=<32_byte_token>&email=<user_email>
```

**Frontend Component:** `src/pages/VerifyEmail.tsx`

**Logic:**
1. Extracts `token` and `email` from query parameters
2. POSTs to `/api/auth/verify-email` with token and email
3. Backend validates token expiration, usage, and email match
4. Server returns `redirectTo: /{user.role}` (customer, trader, admin, etc.)
5. Frontend auto-redirects to user's dashboard after 2-second confirmation

**Backend Verification Endpoint:**
```
POST /api/auth/verify-email
```

**Request:**
```json
{
  "token": "32_byte_hex_token",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "user": { /* public user object */ },
  "redirectTo": "/customer"  // or /trader, /admin, etc.
}
```

**Backend Logic:**
- Finds token in `email_verification_tokens` table
- Validates: not expired, not already used, email matches
- Updates `users.emailVerified = 1`
- Marks token as verified
- Creates JWT auth token (auto-login)
- Sets `nexus_auth_token` cookie
- Returns role-based redirect path

### 4. Complete User Journey

```
1. User clicks /register
   ↓
2. RegisterPage form submission
   ↓
3. POST /api/auth/register
   ├─ Create user account
   ├─ Store survey responses (if provided)
   └─ Return JWT + redirectTo: /onboarding
   ↓
4. User navigates to /onboarding
   ↓
5. OnboardingPage lifecycle
   ├─ GET /api/survey-questions (load survey form)
   ├─ POST /api/survey-responses (submit answers)
   └─ PUT /api/users/{id} (mark onboardingComplete: true)
   ↓
6. User receives verification email
   ├─ Contains: /verify-email?token=...&email=...
   ↓
7. User clicks verification link
   ↓
8. VerifyEmail component
   ├─ POST /api/auth/verify-email
   └─ Sets emailVerified: 1, auto-login
   ↓
9. Frontend redirects to dashboard
   ├─ GET /{role} (customer, trader, etc.)
   ↓
10. Dashboard loads with full access
```

## API Endpoints Summary

### Survey Management (Admin)
- `GET /api/admin/survey-questions` - List all survey questions
- `POST /api/admin/survey-questions` - Create new question
- `PUT /api/admin/survey-questions/:id` - Update question
- `DELETE /api/admin/survey-questions/:id` - Delete question
- `GET /api/admin/survey-responses` - View all user responses (paginated)

### Survey User Endpoints
- `GET /api/survey-questions` - Get enabled questions (authenticated)
- `POST /api/survey-responses` - Submit/update user responses (authenticated)
- `GET /api/survey-responses` - Get current user's responses (authenticated)

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-email` - Verify email with token
- `GET /api/auth/verify-email` - Also supports GET method
- `POST /api/auth/send-verification-email` - Resend verification email

## Implementation Notes

### Survey Response Storage
- Responses are JSON-serialized in the database for flexibility
- Frontend automatically parses JSON when retrieving responses
- Supports multiple question types: text, multiple-choice, rating

### Email Verification Security
- Tokens are hashed before storage (bcrypt-like hashing)
- Tokens expire after 24 hours
- One-time use enforcement (cannot verify twice)
- Email must match registered user email

### Optional Survey at Registration
- The backend now accepts `surveyResponses` during registration
- Allows capturing quick user preferences before onboarding
- Can be used for personalized dashboard or feature suggestions
- Current implementation collects surveys during onboarding instead

### Frontend Survey Component
- Dynamically renders based on `questionType`
- Supports text, multiple-choice (radio), and rating (1-5 stars)
- Validates required fields before submission
- Allows "Skip Survey" option for users who want to proceed quickly

## Testing the Flow

### Test Registration with Survey Response
```bash
curl -X POST http://localhost:5173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "name": "Test User",
    "role": "customer",
    "surveyResponses": [
      {"questionId": "q1", "response": "Retail"},
      {"questionId": "q2", "response": 4}
    ]
  }'
```

### Test Email Verification
```bash
# Get token from email_verification_tokens table
curl -X POST http://localhost:5173/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "hex_token_from_email",
    "email": "test@example.com"
  }'
```

## Future Enhancements

1. **Progressive Survey Collection** - Collect survey data gradually over time
2. **Survey Branching** - Show different questions based on previous answers
3. **Survey Analytics** - Dashboard for viewing response patterns and trends
4. **Conditional Onboarding** - Skip onboarding steps based on survey answers
5. **Survey Scheduling** - Send follow-up surveys at intervals
6. **Personalized Dashboards** - Customize dashboard based on survey responses

## Configuration

### Survey Settings (Future)
- Admin can enable/disable surveys
- Set required vs optional questions
- Configure survey time limits
- Define question ordering and grouping

### Verification Settings
- Token expiration time (currently 24 hours)
- Retry limits for verification attempts
- Resend frequency limits
- Custom email template support
