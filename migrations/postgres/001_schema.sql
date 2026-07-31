-- Esoko Postgres schema (converted from better-sqlite3 schema in db.ts)
-- Run this once against your Render Postgres database before starting the app.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gives us gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  "verificationStatus" TEXT DEFAULT 'pending',
  "walletBalance" REAL DEFAULT 0,
  "appNumber" TEXT UNIQUE,
  tier TEXT DEFAULT 'free',
  phone TEXT,
  "businessName" TEXT,
  "businessCategory" TEXT,
  location TEXT,
  tin TEXT,
  category TEXT,
  "onboardingComplete" INTEGER DEFAULT 0,
  "loyaltyPoints" REAL DEFAULT 0,
  "loyaltyBalance" REAL DEFAULT 0,
  "transactionPin" TEXT,
  "biometricEnabled" INTEGER DEFAULT 0,
  "profilePhoto" TEXT,
  "vatRate" REAL DEFAULT 18,
  "lowStockThreshold" INTEGER DEFAULT 10,
  status TEXT DEFAULT 'active',
  metadata TEXT,
  "upgradedAt" TIMESTAMP,
  "verifiedAt" TIMESTAMP,
  "verifiedBy" TEXT,
  "emailVerified" INTEGER DEFAULT 0,
  "verificationEmailSentAt" TIMESTAMP,
  "verificationReminderSentAt" TIMESTAMP,
  "verificationEmailLastError" TEXT,
  "termsAcceptedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  "verificationStatus" TEXT DEFAULT 'pending',
  "onboardingComplete" INTEGER DEFAULT 0,
  "walletBalance" REAL DEFAULT 0,
  tier TEXT DEFAULT 'free',
  "businessName" TEXT,
  "businessCategory" TEXT,
  "businessLocation" TEXT,
  tin TEXT,
  "rdbCertificateUrl" TEXT,
  category TEXT,
  metadata TEXT,
  "lastSelectedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE("userId", role)
);

CREATE TABLE IF NOT EXISTS license_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT,
  category TEXT DEFAULT 'general',
  "appliesTo" TEXT,
  "requiredFor" TEXT,
  "requiresExpiry" INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  guidance TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "riskStatus" TEXT DEFAULT 'pending',
  "legalName" TEXT,
  "identityType" TEXT,
  "identityNumberHash" TEXT,
  "identityNumberMasked" TEXT,
  phone TEXT,
  "businessName" TEXT,
  "businessCategory" TEXT,
  "businessAddress" TEXT,
  district TEXT,
  sector TEXT,
  cell TEXT,
  tin TEXT,
  "annualTurnoverRange" TEXT,
  "hasVatRegistration" INTEGER DEFAULT 0,
  "usesEbm" INTEGER DEFAULT 0,
  latitude REAL,
  longitude REAL,
  "autoScore" REAL DEFAULT 0,
  "autoDecision" TEXT,
  "submittedAt" TIMESTAMP,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP,
  "rejectionReason" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("accountId") REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_documents (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  type TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "licenseTypeId" TEXT,
  "fileHash" TEXT,
  "extractedText" TEXT,
  "extractedFields" TEXT,
  "autoScore" REAL DEFAULT 0,
  "autoDecision" TEXT,
  "autoReasons" TEXT,
  "expiryDate" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP,
  "rejectionReason" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("accountId") REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_identity_documents (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "verificationRequestId" TEXT,
  "identityType" TEXT NOT NULL,
  "identityNumberHash" TEXT,
  "identityNumberMasked" TEXT,
  "fileUrl" TEXT,
  "fileHash" TEXT,
  status TEXT DEFAULT 'pending',
  "autoScore" REAL DEFAULT 0,
  "autoDecision" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("verificationRequestId") REFERENCES verification_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS risk_flags (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "verificationRequestId" TEXT,
  severity TEXT DEFAULT 'medium',
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP,
  "resolvedBy" TEXT,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("verificationRequestId") REFERENCES verification_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  "verificationRequestId" TEXT,
  "actorId" TEXT,
  action TEXT NOT NULL,
  details TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY ("verificationRequestId") REFERENCES verification_requests(id) ON DELETE CASCADE,
  FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS identity_verifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT UNIQUE NOT NULL,
  "nationalIdNumberHash" TEXT,
  "fullName" TEXT,
  "dateOfBirth" TEXT,
  status TEXT DEFAULT 'pending',
  "phoneVerified" INTEGER DEFAULT 0,
  "emailVerified" INTEGER DEFAULT 0,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  discount REAL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available',
  image TEXT,
  images TEXT,
  code TEXT UNIQUE,
  rating REAL DEFAULT 0,
  "reviewCount" INTEGER DEFAULT 0,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marketplace_posts (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "productId" TEXT,
  "mediaType" TEXT NOT NULL DEFAULT 'image',
  "mediaUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  caption TEXT,
  price REAL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  category TEXT,
  "likeCount" INTEGER DEFAULT 0,
  "followCount" INTEGER DEFAULT 0,
  "viewCount" INTEGER DEFAULT 0,
  "commentCount" INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS post_likes (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("postId", "userId"),
  FOREIGN KEY ("postId") REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trader_follows (
  "followerId" TEXT NOT NULL,
  "traderId" TEXT NOT NULL,
  "sourcePostId" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("followerId", "traderId"),
  FOREIGN KEY ("followerId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_favorites (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("postId", "userId"),
  FOREIGN KEY ("postId") REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_reports (
  id TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "traderId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("postId") REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  FOREIGN KEY ("reporterId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "commenterId" TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("postId") REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  FOREIGN KEY ("commenterId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "traderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  "totalAmount" REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  "deliveryStatus" TEXT DEFAULT 'pending',
  "paymentStatus" TEXT DEFAULT 'unpaid',
  notes TEXT,
  "receiptGenerated" INTEGER DEFAULT 0,
  "receiptGeneratedAt" TIMESTAMP,
  "receiptId" TEXT,
  "receiptGenerationFailed" INTEGER DEFAULT 0,
  "receiptError" TEXT,
  "receiptErrorAt" TIMESTAMP,
  "feeAmount" REAL DEFAULT 0,
  "netAmount" REAL,
  vat REAL DEFAULT 0,
  "isDelivery" INTEGER DEFAULT 0,
  "deliveryAddress" TEXT,
  "paymentMethod" TEXT,
  "recordedBy" TEXT,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "discountAmount" REAL DEFAULT 0,
  "receiptSentAt" TIMESTAMP,
  "receiptSentVia" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("customerId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  "purchaseId" TEXT NOT NULL,
  "receiptData" TEXT,
  "pdfData" TEXT,
  status TEXT DEFAULT 'generated',
  "generatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("purchaseId") REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bulk_requests (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_orders (
  id TEXT PRIMARY KEY,
  "itemKey" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "totalQuantity" INTEGER DEFAULT 0,
  "participantCount" INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  "wholesaleNote" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_score_snapshots (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  "bankPayload" TEXT NOT NULL,
  factors TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "senderId" TEXT,
  "recipientId" TEXT,
  "customerId" TEXT,
  "traderId" TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  type TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  description TEXT,
  "transactionCode" TEXT UNIQUE,
  reference TEXT,
  metadata TEXT,
  "feeAmount" REAL DEFAULT 0,
  "feeType" TEXT,
  "netAmount" REAL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trader_stats (
  "traderId" TEXT PRIMARY KEY,
  "followerCount" INTEGER NOT NULL DEFAULT 0,
  "qualityScore" REAL NOT NULL DEFAULT 0,
  "totalSales" INTEGER NOT NULL DEFAULT 0,
  "rewardBalance" REAL NOT NULL DEFAULT 0,
  "lastRewardPayoutAt" TEXT,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL UNIQUE,
  "traderId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags TEXT,
  comment TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("transactionId") REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("buyerId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "sourcePostId" TEXT,
  "transactionId" TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("transactionId") REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("followerId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("sourcePostId") REFERENCES marketplace_posts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  description TEXT,
  status TEXT DEFAULT 'completed',
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  "subType" TEXT,
  read INTEGER DEFAULT 0,
  data TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_alerts (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "decisionAt" TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  location TEXT,
  role TEXT,
  "accountStatus" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  "createdBy" TEXT NOT NULL,
  "assignedTo" TEXT,
  category TEXT,
  tags TEXT,
  resolution TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "assignedAt" TIMESTAMP,
  "closedAt" TIMESTAMP,
  FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  title TEXT NOT NULL,
  "pinnedProductId" TEXT,
  status TEXT DEFAULT 'live',
  "viewerCount" INTEGER DEFAULT 0,
  "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_signals (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "targetId" TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sessionId") REFERENCES live_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_messages (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "senderName" TEXT,
  message TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sessionId") REFERENCES live_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_participants (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT,
  role TEXT DEFAULT 'viewer',
  "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("sessionId", "userId"),
  FOREIGN KEY ("sessionId") REFERENCES live_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  "maintenanceMode" INTEGER DEFAULT 0,
  "registrationOpen" INTEGER DEFAULT 1,
  "globalFeesFree" REAL DEFAULT 0.006,
  "globalFeesPremium" REAL DEFAULT 0.003,
  "systemHealthStatus" TEXT DEFAULT 'operational',
  "systemHealthLastCheck" TIMESTAMP,
  broadcast TEXT,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  source TEXT,
  "userId" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  error_message TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "usedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "verifiedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_verification_otps (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "verifiedAt" TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "revokedAt" TIMESTAMP,
  "replacedByTokenId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  key TEXT NOT NULL,
  route TEXT NOT NULL,
  response TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", key),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS linked_accounts (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "accountNumber" TEXT,
  "bankName" TEXT,
  "accountHolderName" TEXT,
  verified INTEGER DEFAULT 0,
  "isPrimary" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  "purchaseId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "traderId" TEXT NOT NULL,
  location TEXT,
  latitude REAL,
  longitude REAL,
  status TEXT DEFAULT 'pending',
  "estimatedDeliveryDate" TIMESTAMP,
  "actualDeliveryDate" TIMESTAMP,
  "trackingNumber" TEXT UNIQUE,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("purchaseId") REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  points REAL DEFAULT 0,
  "totalEarned" REAL DEFAULT 0,
  "totalRedeemed" REAL DEFAULT 0,
  "redemptionValue" REAL DEFAULT 0,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS smart_loans (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'pending',
  "approvalStatus" TEXT DEFAULT 'pending',
  "interestRate" REAL DEFAULT 0.08,
  "loanTerm" INTEGER DEFAULT 12,
  "monthlyPayment" REAL,
  "totalRepayment" REAL,
  "amountRepaid" REAL DEFAULT 0,
  "nextPaymentDue" TIMESTAMP,
  "approvedAt" TIMESTAMP,
  "approvedBy" TEXT,
  "disbursedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  notes TEXT,
  "approvalScore" REAL DEFAULT 0,
  "riskLevel" TEXT DEFAULT 'unscored',
  "policyVersion" INTEGER,
  "feePaymentMethod" TEXT DEFAULT 'wallet',
  "applicationFee" REAL DEFAULT 0,
  "processingFee" REAL DEFAULT 0,
  "disbursementTransactionId" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loan_installments (
  id TEXT PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "installmentNumber" INTEGER NOT NULL,
  "dueDate" TIMESTAMP NOT NULL,
  "principalDue" REAL NOT NULL DEFAULT 0,
  "interestDue" REAL NOT NULL DEFAULT 0,
  "feeDue" REAL NOT NULL DEFAULT 0,
  "totalDue" REAL NOT NULL DEFAULT 0,
  "amountPaid" REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  "paidAt" TIMESTAMP,
  "lastAttemptAt" TIMESTAMP,
  "retryCount" INTEGER DEFAULT 0,
  "reminderSentAt" TIMESTAMP,
  "overdueReminderSentAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("loanId") REFERENCES smart_loans(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loan_policy_versions (
  id TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  version INTEGER NOT NULL,
  "isActive" INTEGER DEFAULT 1,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_scoring_snapshots (
  id TEXT PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  score REAL NOT NULL,
  decision TEXT NOT NULL,
  factors TEXT,
  "policyVersion" INTEGER,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("loanId") REFERENCES smart_loans(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loyalty_policy_versions (
  id TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  version INTEGER NOT NULL,
  "isActive" INTEGER DEFAULT 1,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_liability_entries (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "pointsDelta" REAL NOT NULL,
  "valueDelta" REAL NOT NULL,
  "pointValueRwf" REAL NOT NULL,
  type TEXT NOT NULL,
  "relatedTransactionId" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  "referrerUserId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL UNIQUE,
  "referrerCode" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "referrerPoints" REAL DEFAULT 0,
  "referredPoints" REAL DEFAULT 0,
  "qualifiedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("referrerUserId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("referredUserId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS peer_transfers (
  id TEXT PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'completed',
  reference TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("recipientId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection_documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id)
);

CREATE TABLE IF NOT EXISTS fees_config (
  id TEXT PRIMARY KEY,
  "feeType" TEXT NOT NULL UNIQUE,
  "fixedFee" REAL DEFAULT 0,
  "percentageFee" REAL DEFAULT 0,
  "minFee" REAL DEFAULT 0,
  "maxFee" REAL DEFAULT 999999,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_fees (
  id TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feeType" TEXT NOT NULL,
  "feeAmount" REAL NOT NULL,
  "appliedRate" REAL,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'applied',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("transactionId") REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS revenue_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  currency TEXT DEFAULT 'RWF',
  balance REAL DEFAULT 0,
  description TEXT,
  "isActive" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: moved earlier than in the original SQLite file so voice_ledger_entries
-- (below) can reference it. Postgres validates FK targets at CREATE TABLE time;
-- SQLite does not, so the original ordering worked there but not here.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  "transactionId" TEXT,
  "accountType" TEXT NOT NULL,
  "accountId" TEXT,
  direction TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  description TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("transactionId") REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS voice_ledger_entries (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "ledgerEntryId" TEXT,
  "rawText" TEXT NOT NULL,
  language TEXT DEFAULT 'rw',
  "entryType" TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'posted',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("ledgerEntryId") REFERENCES ledger_entries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  purpose TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  provider TEXT,
  "providerReference" TEXT,
  status TEXT DEFAULT 'pending',
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agent_commissions (
  id TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "transactionId" TEXT,
  "serviceType" TEXT NOT NULL,
  "grossFee" REAL NOT NULL DEFAULT 0,
  "commissionAmount" REAL NOT NULL DEFAULT 0,
  "platformNet" REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'payable',
  "settlementId" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("agentId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("transactionId") REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agent_settlements (
  id TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  "periodStart" TIMESTAMP,
  "periodEnd" TIMESTAMP,
  "paidAt" TIMESTAMP,
  reference TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("agentId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  points REAL NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  "relatedTransactionId" TEXT,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  "adminId" TEXT NOT NULL,
  action TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  details TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("adminId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  message TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("ticketId") REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  "adminId" TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  "bodyText" TEXT,
  "bodyHtml" TEXT,
  status TEXT DEFAULT 'queued',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("adminId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id TEXT PRIMARY KEY,
  "flowId" TEXT,
  audience TEXT DEFAULT 'all',
  question TEXT NOT NULL,
  "questionType" TEXT NOT NULL DEFAULT 'text',
  options TEXT,
  required INTEGER DEFAULT 0,
  "orderIndex" INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  response TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("questionId") REFERENCES survey_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  features TEXT,
  limits TEXT,
  activation_key TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trader_subscriptions (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT false,
  payment_method TEXT,
  trial_started_at TIMESTAMP,
  trial_ends_at TIMESTAMP,
  trial_converted_at TIMESTAMP,
  grace_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trader_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE IF NOT EXISTS platform_wallet_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  "userId" TEXT,
  "relatedTransactionId" TEXT,
  description TEXT,
  metadata TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY ("relatedTransactionId") REFERENCES transactions(id) ON DELETE SET NULL,
  FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  "appNumber" TEXT,
  status TEXT DEFAULT 'active',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branch_accounts (
  id TEXT PRIMARY KEY,
  "branchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  permissions TEXT,
  active INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("branchId") REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "branchId" TEXT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  "invitedBy" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "inviteePhone" TEXT,
  "inviteeLocation" TEXT,
  "inviteeNationalId" TEXT,
  "consentAcceptedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP NOT NULL,
  "acceptedAt" TIMESTAMP,
  "deniedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("branchId") REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY ("invitedBy") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("acceptedByUserId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "branchId" TEXT,
  "invitationId" TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT,
  status TEXT DEFAULT 'active',
  performance REAL DEFAULT 0,
  "invitedBy" TEXT,
  "acceptedAt" TIMESTAMP,
  "lastLoginAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("traderId", "userId"),
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("branchId") REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY ("invitationId") REFERENCES team_invitations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_activity_logs (
  id TEXT PRIMARY KEY,
  "traderId" TEXT NOT NULL,
  "teamMemberId" TEXT,
  "userId" TEXT,
  "branchId" TEXT,
  "actionType" TEXT NOT NULL,
  details TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("traderId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("teamMemberId") REFERENCES team_members(id) ON DELETE SET NULL,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY ("branchId") REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS business_analysts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  specialization TEXT,
  experience_years INTEGER,
  certifications TEXT,
  rating REAL DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS analyst_assignments (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  analyst_id TEXT NOT NULL,
  status TEXT DEFAULT 'assigned',
  priority TEXT DEFAULT 'medium',
  requirements TEXT,
  deadline TIMESTAMP,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (trader_id) REFERENCES users(id),
  FOREIGN KEY (analyst_id) REFERENCES business_analysts(id)
);

CREATE TABLE IF NOT EXISTS dynamic_fees (
  id TEXT PRIMARY KEY,
  fee_type TEXT NOT NULL,
  percentage REAL,
  fixed_amount REAL,
  conditions TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMP,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS analyst_recommendations (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  estimated_impact REAL,
  implementation_status TEXT DEFAULT 'pending',
  trader_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES analyst_assignments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trader_analytics (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  period TEXT NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  value REAL NOT NULL,
  previous_value REAL,
  growth_rate REAL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  "accountNumberA" TEXT NOT NULL,
  "accountNumberB" TEXT NOT NULL,
  "mutedBy" TEXT,
  "blockedBy" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_conversation_participants (
  "conversationId" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("conversationId", "accountNumber"),
  FOREIGN KEY ("conversationId") REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderAccountNumber" TEXT NOT NULL,
  "recipientAccountNumber" TEXT NOT NULL,
  text TEXT,
  "attachmentType" TEXT,
  "attachmentName" TEXT,
  "attachmentMimeType" TEXT,
  "attachmentUrl" TEXT,
  "attachmentSize" INTEGER,
  "clientMessageId" TEXT,
  "replyToMessageId" TEXT,
  reactions TEXT,
  status TEXT DEFAULT 'sent',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id TEXT PRIMARY KEY,
  "conversationKey" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL,
  payload TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_updatedAt ON assistant_conversations("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS assistant_usage (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assistant_usage_user_createdAt ON assistant_usage("userId", "createdAt");

CREATE TABLE IF NOT EXISTS chat_presence (
  "accountNumber" TEXT PRIMARY KEY,
  "userId" TEXT,
  online INTEGER DEFAULT 0,
  "lastSeen" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS call_sessions (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "initiatorAccountNumber" TEXT NOT NULL,
  "recipientAccountNumber" TEXT NOT NULL,
  "callType" TEXT NOT NULL CHECK("callType" IN ('voice', 'video')),
  status TEXT DEFAULT 'ringing' CHECK(status IN ('ringing', 'active', 'completed', 'declined', 'missed')),
  duration INTEGER DEFAULT 0,
  "startedAt" TIMESTAMP,
  "endedAt" TIMESTAMP,
  "recordingUrl" TEXT,
  "recordingDuration" INTEGER,
  metadata TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_notes (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderAccountNumber" TEXT NOT NULL,
  "recipientAccountNumber" TEXT NOT NULL,
  "audioUrl" TEXT NOT NULL,
  duration INTEGER NOT NULL,
  "mimeType" TEXT DEFAULT 'audio/mp3',
  "fileSize" INTEGER,
  transcription TEXT,
  status TEXT DEFAULT 'sent',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_notes (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderAccountNumber" TEXT NOT NULL,
  "recipientAccountNumber" TEXT NOT NULL,
  "videoUrl" TEXT NOT NULL,
  duration INTEGER NOT NULL,
  "mimeType" TEXT DEFAULT 'video/mp4',
  "fileSize" INTEGER,
  "thumbnailUrl" TEXT,
  transcription TEXT,
  status TEXT DEFAULT 'sent',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES chat_conversations(id) ON DELETE CASCADE
);

-- Indexes (converted 1:1 from the SQLite versions)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_appNumber ON users("appNumber");
CREATE INDEX IF NOT EXISTS idx_user_accounts_userId ON user_accounts("userId");
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON user_accounts(role);
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_role ON user_accounts("userId", role);
CREATE INDEX IF NOT EXISTS idx_verification_documents_userId ON verification_documents("userId");
CREATE INDEX IF NOT EXISTS idx_verification_documents_accountId ON verification_documents("accountId");
CREATE INDEX IF NOT EXISTS idx_verification_documents_status ON verification_documents(status);
CREATE INDEX IF NOT EXISTS idx_verification_documents_fileHash ON verification_documents("fileHash");
CREATE INDEX IF NOT EXISTS idx_license_types_enabled ON license_types(enabled);
CREATE INDEX IF NOT EXISTS idx_verification_requests_userId ON verification_requests("userId");
CREATE INDEX IF NOT EXISTS idx_verification_requests_accountId ON verification_requests("accountId");
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_identity_documents_userId ON user_identity_documents("userId");
CREATE INDEX IF NOT EXISTS idx_user_identity_documents_hash ON user_identity_documents("identityNumberHash");
CREATE INDEX IF NOT EXISTS idx_risk_flags_userId ON risk_flags("userId");
CREATE INDEX IF NOT EXISTS idx_risk_flags_status ON risk_flags(status);
CREATE INDEX IF NOT EXISTS idx_verification_audit_logs_requestId ON verification_audit_logs("verificationRequestId");
CREATE INDEX IF NOT EXISTS idx_identity_verifications_userId ON identity_verifications("userId");
CREATE INDEX IF NOT EXISTS idx_products_traderId ON products("traderId");
CREATE INDEX IF NOT EXISTS idx_products_traderId_status ON products("traderId", status);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_purchases_customerId ON purchases("customerId");
CREATE INDEX IF NOT EXISTS idx_purchases_traderId ON purchases("traderId");
CREATE INDEX IF NOT EXISTS idx_purchases_traderId_createdAt ON purchases("traderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_customerId_createdAt ON purchases("customerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_traderId_status_createdAt ON purchases("traderId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_traderId_delivery_createdAt ON purchases("traderId", "isDelivery", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions("userId");
CREATE INDEX IF NOT EXISTS idx_transactions_createdAt ON transactions("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_traderId_createdAt ON transactions("traderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_customerId_createdAt ON transactions("customerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_userId_createdAt ON transactions("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_createdAt ON transactions(status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_senderId ON transactions("senderId");
CREATE INDEX IF NOT EXISTS idx_transactions_recipientId ON transactions("recipientId");
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_userId ON wallet_transactions("userId");
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_userId_createdAt ON wallet_transactions("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_group_orders_itemKey ON group_orders("itemKey");
CREATE INDEX IF NOT EXISTS idx_credit_score_snapshots_userId_createdAt ON credit_score_snapshots("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_voice_ledger_entries_traderId_createdAt ON voice_ledger_entries("traderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_traderId_status_createdAt ON deliveries("traderId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_customerId_createdAt ON deliveries("customerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status_updatedAt ON live_sessions(status, "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_live_signals_session_viewer_createdAt ON live_signals("sessionId", "viewerId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_live_messages_session_createdAt ON live_messages("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_live_participants_session_lastSeenAt ON live_participants("sessionId", "lastSeenAt" DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_userId_createdAt ON notifications("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_accountNumbers ON chat_conversations("accountNumberA", "accountNumberB");
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_createdAt ON chat_messages("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_clientMessageId ON chat_messages("clientMessageId");
CREATE INDEX IF NOT EXISTS idx_chat_presence_online ON chat_presence(online);
CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation_createdAt ON call_sessions("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_initiator ON call_sessions("initiatorAccountNumber");
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_notes_conversation_createdAt ON voice_notes("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_voice_notes_sender ON voice_notes("senderAccountNumber");
CREATE INDEX IF NOT EXISTS idx_video_notes_conversation_createdAt ON video_notes("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_video_notes_sender ON video_notes("senderAccountNumber");
CREATE INDEX IF NOT EXISTS idx_tickets_createdBy ON tickets("createdBy");
CREATE INDEX IF NOT EXISTS idx_tickets_assignedTo ON tickets("assignedTo");
CREATE INDEX IF NOT EXISTS idx_system_logs_createdAt ON system_logs("createdAt");
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tokenHash ON password_reset_tokens("tokenHash");
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_userId ON password_reset_tokens("userId");
CREATE INDEX IF NOT EXISTS idx_contact_verification_otps_userId ON contact_verification_otps("userId");
CREATE INDEX IF NOT EXISTS idx_contact_verification_otps_lookup ON contact_verification_otps("userId", channel, destination);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tokenHash ON refresh_tokens("tokenHash");
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens("userId");
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiresAt ON refresh_tokens("expiresAt");
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_userId ON idempotency_keys("userId");
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_createdAt ON idempotency_keys("createdAt");
CREATE INDEX IF NOT EXISTS idx_collection_documents_collection ON collection_documents(collection);
CREATE INDEX IF NOT EXISTS idx_transaction_fees_transactionId ON transaction_fees("transactionId");
CREATE INDEX IF NOT EXISTS idx_transaction_fees_userId ON transaction_fees("userId");
CREATE INDEX IF NOT EXISTS idx_transaction_fees_feeType ON transaction_fees("feeType");
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transactionId ON ledger_entries("transactionId");
CREATE INDEX IF NOT EXISTS idx_ledger_entries_accountType ON ledger_entries("accountType");
CREATE INDEX IF NOT EXISTS idx_ledger_entries_createdAt ON ledger_entries("createdAt");
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_userId ON payment_intents("userId");
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agentId ON agent_commissions("agentId");
CREATE INDEX IF NOT EXISTS idx_agent_commissions_status ON agent_commissions(status);
CREATE INDEX IF NOT EXISTS idx_agent_settlements_agentId ON agent_settlements("agentId");
CREATE INDEX IF NOT EXISTS idx_agent_settlements_status ON agent_settlements(status);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_userId ON loyalty_transactions("userId");
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_createdAt ON loyalty_transactions("createdAt");
CREATE INDEX IF NOT EXISTS idx_loan_installments_loanId ON loan_installments("loanId");
CREATE INDEX IF NOT EXISTS idx_loan_installments_userId_status ON loan_installments("userId", status);
CREATE INDEX IF NOT EXISTS idx_loan_installments_dueDate ON loan_installments("dueDate");
CREATE INDEX IF NOT EXISTS idx_loan_policy_versions_active ON loan_policy_versions("isActive", version);
CREATE INDEX IF NOT EXISTS idx_loan_scoring_snapshots_loanId ON loan_scoring_snapshots("loanId");
CREATE INDEX IF NOT EXISTS idx_loyalty_policy_versions_active ON loyalty_policy_versions("isActive", version);
CREATE INDEX IF NOT EXISTS idx_loyalty_liability_entries_userId ON loyalty_liability_entries("userId");
CREATE INDEX IF NOT EXISTS idx_referrals_referrerUserId ON referrals("referrerUserId");
CREATE INDEX IF NOT EXISTS idx_referrals_referredUserId ON referrals("referredUserId");
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_admin_actions_adminId ON admin_actions("adminId");
CREATE INDEX IF NOT EXISTS idx_admin_actions_createdAt ON admin_actions("createdAt");
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticketId ON ticket_messages("ticketId");
CREATE INDEX IF NOT EXISTS idx_email_logs_adminId ON email_logs("adminId");
CREATE INDEX IF NOT EXISTS idx_email_logs_createdAt ON email_logs("createdAt");
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_trader_subscriptions_trader_id ON trader_subscriptions(trader_id);
CREATE INDEX IF NOT EXISTS idx_trader_subscriptions_status ON trader_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_trader_subscriptions_trial_ends_at ON trader_subscriptions(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_createdAt ON platform_wallet_transactions("createdAt");
CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_type ON platform_wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_direction ON platform_wallet_transactions(direction);
CREATE INDEX IF NOT EXISTS idx_branches_traderId ON branches("traderId");
CREATE INDEX IF NOT EXISTS idx_branch_accounts_branchId ON branch_accounts("branchId");
CREATE INDEX IF NOT EXISTS idx_branch_accounts_userId ON branch_accounts("userId");
CREATE INDEX IF NOT EXISTS idx_team_invitations_traderId ON team_invitations("traderId");
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_members_traderId ON team_members("traderId");
CREATE INDEX IF NOT EXISTS idx_team_members_userId ON team_members("userId");
CREATE INDEX IF NOT EXISTS idx_team_members_branchId ON team_members("branchId");
CREATE INDEX IF NOT EXISTS idx_business_analysts_user_id ON business_analysts(user_id);
CREATE INDEX IF NOT EXISTS idx_business_analysts_specialization ON business_analysts(specialization);
CREATE INDEX IF NOT EXISTS idx_analyst_assignments_trader_id ON analyst_assignments(trader_id);
CREATE INDEX IF NOT EXISTS idx_analyst_assignments_analyst_id ON analyst_assignments(analyst_id);
CREATE INDEX IF NOT EXISTS idx_analyst_assignments_status ON analyst_assignments(status);
CREATE INDEX IF NOT EXISTS idx_dynamic_fees_fee_type ON dynamic_fees(fee_type);
CREATE INDEX IF NOT EXISTS idx_dynamic_fees_is_active ON dynamic_fees(is_active);
CREATE INDEX IF NOT EXISTS idx_analyst_recommendations_assignment_id ON analyst_recommendations(assignment_id);
CREATE INDEX IF NOT EXISTS idx_analyst_recommendations_category ON analyst_recommendations(category);
CREATE INDEX IF NOT EXISTS idx_trader_analytics_trader_id ON trader_analytics(trader_id);
CREATE INDEX IF NOT EXISTS idx_trader_analytics_metric_type ON trader_analytics(metric_type);
CREATE INDEX IF NOT EXISTS idx_trader_analytics_period ON trader_analytics(period);
CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs("createdAt");

-- ===================================================================
-- Triggers (rewritten as PL/pgSQL — SQLite trigger syntax is not valid
-- in Postgres). Same effects as the original, minus SQLite's changes().
-- ===================================================================

CREATE OR REPLACE FUNCTION fn_ratings_update_quality_score() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trader_stats ("traderId", "qualityScore", "totalSales")
  VALUES (NEW."traderId", NEW.stars, 0)
  ON CONFLICT ("traderId") DO UPDATE SET
    "qualityScore" = (SELECT AVG(stars) FROM ratings WHERE "traderId" = NEW."traderId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ratings_update_quality_score ON ratings;
CREATE TRIGGER trg_ratings_update_quality_score
AFTER INSERT ON ratings
FOR EACH ROW EXECUTE FUNCTION fn_ratings_update_quality_score();

CREATE OR REPLACE FUNCTION fn_completed_transaction_adds_sale() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trader_stats ("traderId", "totalSales")
  VALUES (NEW."traderId", 1)
  ON CONFLICT ("traderId") DO UPDATE SET
    "totalSales" = (SELECT COUNT(*) FROM transactions WHERE "traderId" = NEW."traderId" AND status = 'completed');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_completed_transaction_adds_sale ON transactions;
CREATE TRIGGER trg_completed_transaction_adds_sale
AFTER INSERT ON transactions
FOR EACH ROW WHEN (NEW.status = 'completed' AND NEW."traderId" IS NOT NULL)
EXECUTE FUNCTION fn_completed_transaction_adds_sale();

-- Combines the two SQLite "status update" triggers (current + previous trader) into one function
CREATE OR REPLACE FUNCTION fn_transaction_status_updates_sales() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."traderId" IS NOT NULL THEN
    INSERT INTO trader_stats ("traderId", "totalSales")
    SELECT NEW."traderId", COUNT(*) FROM transactions WHERE "traderId" = NEW."traderId" AND status = 'completed'
    ON CONFLICT ("traderId") DO UPDATE SET
      "totalSales" = (SELECT COUNT(*) FROM transactions WHERE "traderId" = NEW."traderId" AND status = 'completed');
  END IF;

  IF OLD."traderId" IS NOT NULL AND OLD."traderId" IS DISTINCT FROM NEW."traderId" THEN
    UPDATE trader_stats
    SET "totalSales" = (SELECT COUNT(*) FROM transactions WHERE "traderId" = OLD."traderId" AND status = 'completed')
    WHERE "traderId" = OLD."traderId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_status_updates_sales ON transactions;
CREATE TRIGGER trg_transaction_status_updates_sales
AFTER UPDATE OF status, "traderId" ON transactions
FOR EACH ROW WHEN (NEW."traderId" IS NOT NULL OR OLD."traderId" IS NOT NULL)
EXECUTE FUNCTION fn_transaction_status_updates_sales();

-- Follower reward: fires on insert of a completed transaction, or on an
-- update that transitions a transaction into 'completed'.
CREATE OR REPLACE FUNCTION fn_create_follower_reward() RETURNS TRIGGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF NEW."traderId" IS NOT NULL AND NEW."customerId" IS NOT NULL THEN
    INSERT INTO reward_ledger (id, "traderId", "followerId", "sourcePostId", "transactionId", amount)
    SELECT gen_random_uuid()::text, NEW."traderId", f."followerId", f."sourcePostId", NEW.id,
      GREATEST(100, ROUND((NEW.amount * 0.01)::numeric, 2))
    FROM trader_follows f
    WHERE f."followerId" = NEW."customerId" AND f."traderId" = NEW."traderId"
    ON CONFLICT ("transactionId") DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    IF inserted_count > 0 THEN
      INSERT INTO trader_stats ("traderId", "rewardBalance")
      SELECT NEW."traderId", amount FROM reward_ledger WHERE "transactionId" = NEW.id
      ON CONFLICT ("traderId") DO UPDATE SET "rewardBalance" = trader_stats."rewardBalance" + EXCLUDED."rewardBalance";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_completed_transaction_creates_follower_reward ON transactions;
CREATE TRIGGER trg_completed_transaction_creates_follower_reward
AFTER INSERT ON transactions
FOR EACH ROW WHEN (NEW.status = 'completed')
EXECUTE FUNCTION fn_create_follower_reward();

DROP TRIGGER IF EXISTS trg_transaction_completion_creates_follower_reward ON transactions;
CREATE TRIGGER trg_transaction_completion_creates_follower_reward
AFTER UPDATE OF status ON transactions
FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION fn_create_follower_reward();