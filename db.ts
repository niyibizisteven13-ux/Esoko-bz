import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const env = process.env as unknown as Record<string, string | undefined>;
const dataDir = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'esoko.db');

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function initializeDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      verificationStatus TEXT DEFAULT 'pending',
      walletBalance REAL DEFAULT 0,
      appNumber TEXT UNIQUE,
      tier TEXT DEFAULT 'free',
      phone TEXT,
      businessName TEXT,
      businessCategory TEXT,
      location TEXT,
      tin TEXT,
      category TEXT,
      onboardingComplete INTEGER DEFAULT 0,
      loyaltyPoints REAL DEFAULT 0,
      transactionPin TEXT,
      biometricEnabled INTEGER DEFAULT 0,
      profilePhoto TEXT,
      vatRate REAL DEFAULT 18,
      lowStockThreshold INTEGER DEFAULT 10,
      metadata TEXT,
      upgradedAt DATETIME,
      verifiedAt DATETIME,
      verifiedBy TEXT,
      emailVerified INTEGER DEFAULT 0,
      verificationEmailSentAt DATETIME,
      verificationReminderSentAt DATETIME,
      verificationEmailLastError TEXT,
      termsAcceptedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      verificationStatus TEXT DEFAULT 'pending',
      onboardingComplete INTEGER DEFAULT 0,
      walletBalance REAL DEFAULT 0,
      tier TEXT DEFAULT 'free',
      businessName TEXT,
      businessCategory TEXT,
      businessLocation TEXT,
      tin TEXT,
      rdbCertificateUrl TEXT,
      category TEXT,
      metadata TEXT,
      lastSelectedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, role)
    );

    CREATE TABLE IF NOT EXISTS verification_documents (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountId TEXT,
      type TEXT NOT NULL,
      fileUrl TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      licenseTypeId TEXT,
      fileHash TEXT,
      extractedText TEXT,
      extractedFields TEXT,
      autoScore REAL DEFAULT 0,
      autoDecision TEXT,
      autoReasons TEXT,
      expiryDate TEXT,
      reviewedBy TEXT,
      reviewedAt DATETIME,
      rejectionReason TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (accountId) REFERENCES user_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS license_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      authority TEXT,
      category TEXT DEFAULT 'general',
      appliesTo TEXT,
      requiredFor TEXT,
      requiresExpiry INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      guidance TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountId TEXT,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      riskStatus TEXT DEFAULT 'pending',
      legalName TEXT,
      identityType TEXT,
      identityNumberHash TEXT,
      identityNumberMasked TEXT,
      phone TEXT,
      businessName TEXT,
      businessCategory TEXT,
      businessAddress TEXT,
      district TEXT,
      sector TEXT,
      cell TEXT,
      tin TEXT,
      annualTurnoverRange TEXT,
      hasVatRegistration INTEGER DEFAULT 0,
      usesEbm INTEGER DEFAULT 0,
      latitude REAL,
      longitude REAL,
      autoScore REAL DEFAULT 0,
      autoDecision TEXT,
      submittedAt DATETIME,
      reviewedBy TEXT,
      reviewedAt DATETIME,
      rejectionReason TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (accountId) REFERENCES user_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_identity_documents (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      verificationRequestId TEXT,
      identityType TEXT NOT NULL,
      identityNumberHash TEXT,
      identityNumberMasked TEXT,
      fileUrl TEXT,
      fileHash TEXT,
      status TEXT DEFAULT 'pending',
      autoScore REAL DEFAULT 0,
      autoDecision TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verificationRequestId) REFERENCES verification_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS risk_flags (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      verificationRequestId TEXT,
      severity TEXT DEFAULT 'medium',
      code TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolvedAt DATETIME,
      resolvedBy TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verificationRequestId) REFERENCES verification_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification_audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      verificationRequestId TEXT,
      actorId TEXT,
      action TEXT NOT NULL,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (verificationRequestId) REFERENCES verification_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (actorId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS identity_verifications (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      nationalIdNumberHash TEXT,
      fullName TEXT,
      dateOfBirth TEXT,
      status TEXT DEFAULT 'pending',
      phoneVerified INTEGER DEFAULT 0,
      emailVerified INTEGER DEFAULT 0,
      reviewedBy TEXT,
      reviewedAt DATETIME,
      rejectionReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
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
      reviewCount INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      traderId TEXT NOT NULL,
      productId TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      totalAmount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      deliveryStatus TEXT DEFAULT 'pending',
      paymentStatus TEXT DEFAULT 'unpaid',
      notes TEXT,
      receiptGenerated INTEGER DEFAULT 0,
      receiptGeneratedAt DATETIME,
      receiptId TEXT,
      receiptGenerationFailed INTEGER DEFAULT 0,
      receiptError TEXT,
      receiptErrorAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      purchaseId TEXT NOT NULL,
      receiptData TEXT,
      pdfData TEXT,
      status TEXT DEFAULT 'generated',
      generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bulk_requests (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      itemName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      location TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_orders (
      id TEXT PRIMARY KEY,
      itemKey TEXT NOT NULL,
      itemName TEXT NOT NULL,
      totalQuantity INTEGER DEFAULT 0,
      participantCount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      wholesaleNote TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_score_snapshots (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      bankPayload TEXT NOT NULL,
      factors TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_ledger_entries (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      ledgerEntryId TEXT,
      rawText TEXT NOT NULL,
      language TEXT DEFAULT 'rw',
      entryType TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      confidence REAL DEFAULT 0,
      status TEXT DEFAULT 'posted',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (ledgerEntryId) REFERENCES ledger_entries(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      senderId TEXT,
      recipientId TEXT,
      customerId TEXT,
      traderId TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      type TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      description TEXT,
      transactionCode TEXT UNIQUE,
      reference TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      description TEXT,
      status TEXT DEFAULT 'completed',
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      subType TEXT,
      read INTEGER DEFAULT 0,
      data TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS login_alerts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      decisionAt DATETIME,
      ipAddress TEXT,
      userAgent TEXT,
      location TEXT,
      role TEXT,
      accountStatus TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'medium',
      createdBy TEXT NOT NULL,
      assignedTo TEXT,
      category TEXT,
      tags TEXT,
      resolution TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      assignedAt DATETIME,
      closedAt DATETIME,
      FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      title TEXT NOT NULL,
      pinnedProductId TEXT,
      status TEXT DEFAULT 'live',
      viewerCount INTEGER DEFAULT 0,
      startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      endedAt DATETIME,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_signals (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      viewerId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      targetId TEXT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sessionId) REFERENCES live_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      userId TEXT NOT NULL,
      senderName TEXT,
      message TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sessionId) REFERENCES live_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS live_participants (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      userId TEXT NOT NULL,
      displayName TEXT,
      role TEXT DEFAULT 'viewer',
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sessionId, userId),
      FOREIGN KEY (sessionId) REFERENCES live_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY DEFAULT 'global',
      maintenanceMode INTEGER DEFAULT 0,
      registrationOpen INTEGER DEFAULT 1,
      globalFeesFree REAL DEFAULT 0.006,
      globalFeesPremium REAL DEFAULT 0.003,
      systemHealthStatus TEXT DEFAULT 'operational',
      systemHealthLastCheck DATETIME,
      broadcast TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      source TEXT,
      userId TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      error_message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      usedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      verifiedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_verification_otps (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      channel TEXT NOT NULL,
      destination TEXT NOT NULL,
      otpHash TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      verifiedAt DATETIME,
      attempts INTEGER DEFAULT 0,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      revokedAt DATETIME,
      replacedByTokenId TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      key TEXT NOT NULL,
      route TEXT NOT NULL,
      response TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, key),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS linked_accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountType TEXT NOT NULL,
      accountNumber TEXT,
      bankName TEXT,
      accountHolderName TEXT,
      verified INTEGER DEFAULT 0,
      isPrimary INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      purchaseId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      traderId TEXT NOT NULL,
      location TEXT,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'pending',
      estimatedDeliveryDate DATETIME,
      actualDeliveryDate DATETIME,
      trackingNumber TEXT UNIQUE,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loyalty_points (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL UNIQUE,
      points REAL DEFAULT 0,
      totalEarned REAL DEFAULT 0,
      totalRedeemed REAL DEFAULT 0,
      redemptionValue REAL DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS smart_loans (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      status TEXT DEFAULT 'pending',
      approvalStatus TEXT DEFAULT 'pending',
      interestRate REAL DEFAULT 0.08,
      loanTerm INTEGER DEFAULT 12,
      monthlyPayment REAL,
      totalRepayment REAL,
      amountRepaid REAL DEFAULT 0,
      nextPaymentDue DATETIME,
      approvedAt DATETIME,
      approvedBy TEXT,
      disbursedAt DATETIME,
      completedAt DATETIME,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loan_installments (
      id TEXT PRIMARY KEY,
      loanId TEXT NOT NULL,
      userId TEXT NOT NULL,
      installmentNumber INTEGER NOT NULL,
      dueDate DATETIME NOT NULL,
      principalDue REAL NOT NULL DEFAULT 0,
      interestDue REAL NOT NULL DEFAULT 0,
      feeDue REAL NOT NULL DEFAULT 0,
      totalDue REAL NOT NULL DEFAULT 0,
      amountPaid REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      paidAt DATETIME,
      lastAttemptAt DATETIME,
      retryCount INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loanId) REFERENCES smart_loans(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loan_policy_versions (
      id TEXT PRIMARY KEY,
      config TEXT NOT NULL,
      version INTEGER NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loan_scoring_snapshots (
      id TEXT PRIMARY KEY,
      loanId TEXT NOT NULL,
      userId TEXT NOT NULL,
      score REAL NOT NULL,
      decision TEXT NOT NULL,
      factors TEXT,
      policyVersion INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loanId) REFERENCES smart_loans(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loyalty_policy_versions (
      id TEXT PRIMARY KEY,
      config TEXT NOT NULL,
      version INTEGER NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_liability_entries (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      pointsDelta REAL NOT NULL,
      valueDelta REAL NOT NULL,
      pointValueRwf REAL NOT NULL,
      type TEXT NOT NULL,
      relatedTransactionId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrerUserId TEXT NOT NULL,
      referredUserId TEXT NOT NULL UNIQUE,
      referrerCode TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      referrerPoints REAL DEFAULT 0,
      referredPoints REAL DEFAULT 0,
      qualifiedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrerUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (referredUserId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS peer_transfers (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      recipientId TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      status TEXT DEFAULT 'completed',
      reference TEXT,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipientId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collection_documents (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection, id)
    );

    CREATE TABLE IF NOT EXISTS fees_config (
      id TEXT PRIMARY KEY,
      feeType TEXT NOT NULL UNIQUE,
      fixedFee REAL DEFAULT 0,
      percentageFee REAL DEFAULT 0,
      minFee REAL DEFAULT 0,
      maxFee REAL DEFAULT 999999,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_fees (
      id TEXT PRIMARY KEY,
      transactionId TEXT NOT NULL,
      userId TEXT NOT NULL,
      feeType TEXT NOT NULL,
      feeAmount REAL NOT NULL,
      appliedRate REAL,
      currency TEXT DEFAULT 'RWF',
      status TEXT DEFAULT 'applied',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revenue_accounts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      accountType TEXT NOT NULL,
      currency TEXT DEFAULT 'RWF',
      balance REAL DEFAULT 0,
      description TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      transactionId TEXT,
      accountType TEXT NOT NULL,
      accountId TEXT,
      direction TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      description TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payment_intents (
      id TEXT PRIMARY KEY,
      userId TEXT,
      purpose TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      provider TEXT,
      providerReference TEXT,
      status TEXT DEFAULT 'pending',
      relatedEntityType TEXT,
      relatedEntityId TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmedAt DATETIME,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS agent_commissions (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      transactionId TEXT,
      serviceType TEXT NOT NULL,
      grossFee REAL NOT NULL DEFAULT 0,
      commissionAmount REAL NOT NULL DEFAULT 0,
      platformNet REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'payable',
      settlementId TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agentId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS agent_settlements (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      totalAmount REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      periodStart DATETIME,
      periodEnd DATETIME,
      paidAt DATETIME,
      reference TEXT,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agentId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      points REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      relatedTransactionId TEXT,
      expiresAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id TEXT PRIMARY KEY,
      adminId TEXT NOT NULL,
      action TEXT NOT NULL,
      targetType TEXT,
      targetId TEXT,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (adminId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id TEXT PRIMARY KEY,
      ticketId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      message TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      adminId TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      bodyText TEXT,
      bodyHtml TEXT,
      status TEXT DEFAULT 'queued',
      errorMessage TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (adminId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS survey_questions (
      id TEXT PRIMARY KEY,
      flowId TEXT,
      audience TEXT DEFAULT 'all',
      question TEXT NOT NULL,
      questionType TEXT NOT NULL DEFAULT 'text',
      options TEXT,
      required INTEGER DEFAULT 0,
      orderIndex INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      response TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (questionId) REFERENCES survey_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      features TEXT, -- JSON array of feature IDs
      limits TEXT, -- JSON object with limits
      activation_key TEXT UNIQUE,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trader_subscriptions (
      id TEXT PRIMARY KEY,
      trader_id TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      status TEXT DEFAULT 'active', -- 'trial', 'active', 'expired', 'cancelled', 'past_due'
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      auto_renew BOOLEAN DEFAULT 0,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trader_id) REFERENCES users(id),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    );

    CREATE TABLE IF NOT EXISTS platform_wallet_transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      direction TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RWF',
      userId TEXT,
      relatedTransactionId TEXT,
      description TEXT,
      metadata TEXT,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (relatedTransactionId) REFERENCES transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      appNumber TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS branch_accounts (
      id TEXT PRIMARY KEY,
      branchId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      permissions TEXT,
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_invitations (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      branchId TEXT,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT,
      tokenHash TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'pending',
      invitedBy TEXT NOT NULL,
      acceptedByUserId TEXT,
      inviteePhone TEXT,
      inviteeLocation TEXT,
      inviteeNationalId TEXT,
      consentAcceptedAt DATETIME,
      expiresAt DATETIME NOT NULL,
      acceptedAt DATETIME,
      deniedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL,
      FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (acceptedByUserId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      userId TEXT NOT NULL,
      branchId TEXT,
      invitationId TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT,
      status TEXT DEFAULT 'active',
      performance REAL DEFAULT 0,
      invitedBy TEXT,
      acceptedAt DATETIME,
      lastLoginAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(traderId, userId),
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL,
      FOREIGN KEY (invitationId) REFERENCES team_invitations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_activity_logs (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      teamMemberId TEXT,
      userId TEXT,
      branchId TEXT,
      actionType TEXT NOT NULL,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (teamMemberId) REFERENCES team_members(id) ON DELETE SET NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS business_analysts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      specialization TEXT, -- 'retail', 'wholesale', 'logistics', 'finance'
      experience_years INTEGER,
      certifications TEXT, -- JSON array
      rating REAL DEFAULT 5.0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS analyst_assignments (
      id TEXT PRIMARY KEY,
      trader_id TEXT NOT NULL,
      analyst_id TEXT NOT NULL,
      status TEXT DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed', 'cancelled'
      priority TEXT DEFAULT 'medium',
      requirements TEXT,
      deadline DATETIME,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (trader_id) REFERENCES users(id),
      FOREIGN KEY (analyst_id) REFERENCES business_analysts(id)
    );

    CREATE TABLE IF NOT EXISTS dynamic_fees (
      id TEXT PRIMARY KEY,
      fee_type TEXT NOT NULL, -- 'transaction', 'wallet_deposit', 'subscription'
      percentage REAL,
      fixed_amount REAL,
      conditions TEXT, -- JSON: min_amount, max_amount, user_tier, etc.
      is_active BOOLEAN DEFAULT 1,
      effective_from DATETIME DEFAULT CURRENT_TIMESTAMP,
      effective_to DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS analyst_recommendations (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT, -- 'operations', 'marketing', 'finance', 'inventory'
      priority TEXT DEFAULT 'medium',
      estimated_impact REAL, -- Expected revenue impact in RWF
      implementation_status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
      trader_feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES analyst_assignments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trader_analytics (
      id TEXT PRIMARY KEY,
      trader_id TEXT NOT NULL,
      metric_type TEXT NOT NULL, -- 'revenue', 'customers', 'transactions', 'growth'
      period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
      period_start DATETIME NOT NULL,
      period_end DATETIME NOT NULL,
      value REAL NOT NULL,
      previous_value REAL,
      growth_rate REAL,
      metadata TEXT, -- JSON with additional context
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trader_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      accountNumberA TEXT NOT NULL,
      accountNumberB TEXT NOT NULL,
      mutedBy TEXT,
      blockedBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_conversation_participants (
      conversationId TEXT NOT NULL,
      accountNumber TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversationId, accountNumber),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderAccountNumber TEXT NOT NULL,
      recipientAccountNumber TEXT NOT NULL,
      text TEXT,
      attachmentType TEXT,
      attachmentName TEXT,
      attachmentMimeType TEXT,
      attachmentUrl TEXT,
      attachmentSize INTEGER,
      clientMessageId TEXT,
      replyToMessageId TEXT,
      reactions TEXT,
      status TEXT DEFAULT 'sent',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_presence (
      accountNumber TEXT PRIMARY KEY,
      userId TEXT,
      online INTEGER DEFAULT 0,
      lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS call_sessions (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      initiatorAccountNumber TEXT NOT NULL,
      recipientAccountNumber TEXT NOT NULL,
      callType TEXT NOT NULL CHECK(callType IN ('voice', 'video')),
      status TEXT DEFAULT 'ringing' CHECK(status IN ('ringing', 'active', 'completed', 'declined', 'missed')),
      duration INTEGER DEFAULT 0,
      startedAt DATETIME,
      endedAt DATETIME,
      recordingUrl TEXT,
      recordingDuration INTEGER,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_notes (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderAccountNumber TEXT NOT NULL,
      recipientAccountNumber TEXT NOT NULL,
      audioUrl TEXT NOT NULL,
      duration INTEGER NOT NULL,
      mimeType TEXT DEFAULT 'audio/mp3',
      fileSize INTEGER,
      transcription TEXT,
      status TEXT DEFAULT 'sent',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_notes (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderAccountNumber TEXT NOT NULL,
      recipientAccountNumber TEXT NOT NULL,
      videoUrl TEXT NOT NULL,
      duration INTEGER NOT NULL,
      mimeType TEXT DEFAULT 'video/mp4',
      fileSize INTEGER,
      thumbnailUrl TEXT,
      transcription TEXT,
      status TEXT DEFAULT 'sent',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );
  `);

  [
    ['users', 'tin', 'TEXT'],
    ['users', 'category', 'TEXT'],
    ['users', 'onboardingComplete', 'INTEGER DEFAULT 0'],
    ['users', 'loyaltyPoints', 'REAL DEFAULT 0'],
    ['users', 'loyaltyBalance', 'REAL DEFAULT 0'],
    ['users', 'transactionPin', 'TEXT'],
    ['users', 'vatRate', 'REAL DEFAULT 18'],
    ['users', 'lowStockThreshold', 'INTEGER DEFAULT 10'],
    ['users', 'biometricEnabled', 'INTEGER DEFAULT 0'],
    ['users', 'businessCategory', 'TEXT'],
    ['users', 'metadata', 'TEXT'],
    ['users', 'status', "TEXT DEFAULT 'active'"],
    ['users', 'emailVerified', 'INTEGER DEFAULT 0'],
    ['users', 'verificationEmailSentAt', 'DATETIME'],
    ['users', 'verificationReminderSentAt', 'DATETIME'],
    ['users', 'verificationEmailLastError', 'TEXT'],
    ['users', 'termsAcceptedAt', 'DATETIME'],
    ['verification_documents', 'licenseTypeId', 'TEXT'],
    ['verification_documents', 'fileHash', 'TEXT'],
    ['verification_documents', 'extractedText', 'TEXT'],
    ['verification_documents', 'extractedFields', 'TEXT'],
    ['verification_documents', 'autoScore', 'REAL DEFAULT 0'],
    ['verification_documents', 'autoDecision', 'TEXT'],
    ['verification_documents', 'autoReasons', 'TEXT'],
    ['verification_documents', 'expiryDate', 'TEXT'],
    ['survey_questions', 'flowId', 'TEXT'],
    ['survey_questions', 'audience', "TEXT DEFAULT 'all'"],
    ['products', 'code', 'TEXT'],
    ['products', 'metadata', 'TEXT'],
    ['system_config', 'registrationOpen', 'INTEGER DEFAULT 1'],
    ['transactions', 'feeAmount', 'REAL DEFAULT 0'],
    ['transactions', 'feeType', 'TEXT'],
    ['transactions', 'netAmount', 'REAL'],
    ['purchases', 'feeAmount', 'REAL DEFAULT 0'],
    ['purchases', 'netAmount', 'REAL'],
    ['purchases', 'vat', 'REAL DEFAULT 0'],
    ['purchases', 'isDelivery', 'INTEGER DEFAULT 0'],
    ['purchases', 'deliveryAddress', 'TEXT'],
    ['purchases', 'paymentMethod', 'TEXT'],
    ['purchases', 'recordedBy', 'TEXT'],
    ['purchases', 'customerName', 'TEXT'],
    ['purchases', 'customerEmail', 'TEXT'],
    ['purchases', 'customerPhone', 'TEXT'],
    ['purchases', 'discountAmount', 'REAL DEFAULT 0'],
    ['purchases', 'receiptSentAt', 'DATETIME'],
    ['purchases', 'receiptSentVia', 'TEXT'],
    ['smart_loans', 'approvalScore', 'REAL DEFAULT 0'],
    ['smart_loans', 'riskLevel', "TEXT DEFAULT 'unscored'"],
    ['smart_loans', 'policyVersion', 'INTEGER'],
    ['smart_loans', 'feePaymentMethod', "TEXT DEFAULT 'wallet'"],
    ['smart_loans', 'applicationFee', 'REAL DEFAULT 0'],
    ['smart_loans', 'processingFee', 'REAL DEFAULT 0'],
    ['smart_loans', 'disbursementTransactionId', 'TEXT'],
    ['loan_installments', 'reminderSentAt', 'DATETIME'],
    ['loan_installments', 'overdueReminderSentAt', 'DATETIME'],
    ['trader_subscriptions', 'trial_started_at', 'DATETIME'],
    ['trader_subscriptions', 'trial_ends_at', 'DATETIME'],
    ['trader_subscriptions', 'trial_converted_at', 'DATETIME'],
    ['trader_subscriptions', 'grace_ends_at', 'DATETIME'],
    ['branches', 'appNumber', 'TEXT'],
    ['chat_conversations', 'mutedBy', 'TEXT'],
    ['chat_conversations', 'blockedBy', 'TEXT'],
    ['chat_messages', 'replyToMessageId', 'TEXT'],
    ['chat_messages', 'reactions', 'TEXT'],
  ].forEach(([table, column, definition]) => ensureColumn(db, table, column, definition));

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_appNumber ON users(appNumber);
    CREATE INDEX IF NOT EXISTS idx_user_accounts_userId ON user_accounts(userId);
    CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON user_accounts(role);
    CREATE INDEX IF NOT EXISTS idx_user_accounts_user_role ON user_accounts(userId, role);
    CREATE INDEX IF NOT EXISTS idx_verification_documents_userId ON verification_documents(userId);
    CREATE INDEX IF NOT EXISTS idx_verification_documents_accountId ON verification_documents(accountId);
    CREATE INDEX IF NOT EXISTS idx_verification_documents_status ON verification_documents(status);
    CREATE INDEX IF NOT EXISTS idx_verification_documents_fileHash ON verification_documents(fileHash);
    CREATE INDEX IF NOT EXISTS idx_license_types_enabled ON license_types(enabled);
    CREATE INDEX IF NOT EXISTS idx_verification_requests_userId ON verification_requests(userId);
    CREATE INDEX IF NOT EXISTS idx_verification_requests_accountId ON verification_requests(accountId);
    CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
    CREATE INDEX IF NOT EXISTS idx_user_identity_documents_userId ON user_identity_documents(userId);
    CREATE INDEX IF NOT EXISTS idx_user_identity_documents_hash ON user_identity_documents(identityNumberHash);
    CREATE INDEX IF NOT EXISTS idx_risk_flags_userId ON risk_flags(userId);
    CREATE INDEX IF NOT EXISTS idx_risk_flags_status ON risk_flags(status);
    CREATE INDEX IF NOT EXISTS idx_verification_audit_logs_requestId ON verification_audit_logs(verificationRequestId);
    CREATE INDEX IF NOT EXISTS idx_identity_verifications_userId ON identity_verifications(userId);
    CREATE INDEX IF NOT EXISTS idx_products_traderId ON products(traderId);
    CREATE INDEX IF NOT EXISTS idx_products_traderId_status ON products(traderId, status);
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_purchases_customerId ON purchases(customerId);
    CREATE INDEX IF NOT EXISTS idx_purchases_traderId ON purchases(traderId);
    CREATE INDEX IF NOT EXISTS idx_purchases_traderId_createdAt ON purchases(traderId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_purchases_customerId_createdAt ON purchases(customerId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_purchases_traderId_status_createdAt ON purchases(traderId, status, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_purchases_traderId_delivery_createdAt ON purchases(traderId, isDelivery, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);
    CREATE INDEX IF NOT EXISTS idx_transactions_createdAt ON transactions(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_traderId_createdAt ON transactions(traderId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_customerId_createdAt ON transactions(customerId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_userId_createdAt ON transactions(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_status_createdAt ON transactions(status, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_senderId ON transactions(senderId);
    CREATE INDEX IF NOT EXISTS idx_transactions_recipientId ON transactions(recipientId);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_userId ON wallet_transactions(userId);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_userId_createdAt ON wallet_transactions(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_group_orders_itemKey ON group_orders(itemKey);
    CREATE INDEX IF NOT EXISTS idx_credit_score_snapshots_userId_createdAt ON credit_score_snapshots(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_ledger_entries_traderId_createdAt ON voice_ledger_entries(traderId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_deliveries_traderId_status_createdAt ON deliveries(traderId, status, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_deliveries_customerId_createdAt ON deliveries(customerId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_live_sessions_status_updatedAt ON live_sessions(status, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_live_signals_session_viewer_createdAt ON live_signals(sessionId, viewerId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_live_messages_session_createdAt ON live_messages(sessionId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_live_participants_session_lastSeenAt ON live_participants(sessionId, lastSeenAt DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
    CREATE INDEX IF NOT EXISTS idx_notifications_userId_createdAt ON notifications(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_accountNumbers ON chat_conversations(accountNumberA, accountNumberB);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_createdAt ON chat_messages(conversationId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_clientMessageId ON chat_messages(clientMessageId);
    CREATE INDEX IF NOT EXISTS idx_chat_presence_online ON chat_presence(online);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation_createdAt ON call_sessions(conversationId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_initiator ON call_sessions(initiatorAccountNumber);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_voice_notes_conversation_createdAt ON voice_notes(conversationId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_notes_sender ON voice_notes(senderAccountNumber);
    CREATE INDEX IF NOT EXISTS idx_video_notes_conversation_createdAt ON video_notes(conversationId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_video_notes_sender ON video_notes(senderAccountNumber);
    CREATE INDEX IF NOT EXISTS idx_tickets_createdBy ON tickets(createdBy);
    CREATE INDEX IF NOT EXISTS idx_tickets_assignedTo ON tickets(assignedTo);
    CREATE INDEX IF NOT EXISTS idx_system_logs_createdAt ON system_logs(createdAt);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tokenHash ON password_reset_tokens(tokenHash);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_userId ON password_reset_tokens(userId);
    CREATE INDEX IF NOT EXISTS idx_contact_verification_otps_userId ON contact_verification_otps(userId);
    CREATE INDEX IF NOT EXISTS idx_contact_verification_otps_lookup ON contact_verification_otps(userId, channel, destination);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tokenHash ON refresh_tokens(tokenHash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens(userId);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiresAt ON refresh_tokens(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_idempotency_keys_userId ON idempotency_keys(userId);
    CREATE INDEX IF NOT EXISTS idx_idempotency_keys_createdAt ON idempotency_keys(createdAt);
    CREATE INDEX IF NOT EXISTS idx_collection_documents_collection ON collection_documents(collection);
    CREATE INDEX IF NOT EXISTS idx_transaction_fees_transactionId ON transaction_fees(transactionId);
    CREATE INDEX IF NOT EXISTS idx_transaction_fees_userId ON transaction_fees(userId);
    CREATE INDEX IF NOT EXISTS idx_transaction_fees_feeType ON transaction_fees(feeType);
    CREATE INDEX IF NOT EXISTS idx_ledger_entries_transactionId ON ledger_entries(transactionId);
    CREATE INDEX IF NOT EXISTS idx_ledger_entries_accountType ON ledger_entries(accountType);
    CREATE INDEX IF NOT EXISTS idx_ledger_entries_createdAt ON ledger_entries(createdAt);
    CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
    CREATE INDEX IF NOT EXISTS idx_payment_intents_userId ON payment_intents(userId);
    CREATE INDEX IF NOT EXISTS idx_agent_commissions_agentId ON agent_commissions(agentId);
    CREATE INDEX IF NOT EXISTS idx_agent_commissions_status ON agent_commissions(status);
    CREATE INDEX IF NOT EXISTS idx_agent_settlements_agentId ON agent_settlements(agentId);
    CREATE INDEX IF NOT EXISTS idx_agent_settlements_status ON agent_settlements(status);
    CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_userId ON loyalty_transactions(userId);
    CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_createdAt ON loyalty_transactions(createdAt);
    CREATE INDEX IF NOT EXISTS idx_loan_installments_loanId ON loan_installments(loanId);
    CREATE INDEX IF NOT EXISTS idx_loan_installments_userId_status ON loan_installments(userId, status);
    CREATE INDEX IF NOT EXISTS idx_loan_installments_dueDate ON loan_installments(dueDate);
    CREATE INDEX IF NOT EXISTS idx_loan_policy_versions_active ON loan_policy_versions(isActive, version);
    CREATE INDEX IF NOT EXISTS idx_loan_scoring_snapshots_loanId ON loan_scoring_snapshots(loanId);
    CREATE INDEX IF NOT EXISTS idx_loyalty_policy_versions_active ON loyalty_policy_versions(isActive, version);
    CREATE INDEX IF NOT EXISTS idx_loyalty_liability_entries_userId ON loyalty_liability_entries(userId);
    CREATE INDEX IF NOT EXISTS idx_referrals_referrerUserId ON referrals(referrerUserId);
    CREATE INDEX IF NOT EXISTS idx_referrals_referredUserId ON referrals(referredUserId);
    CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
    CREATE INDEX IF NOT EXISTS idx_admin_actions_adminId ON admin_actions(adminId);
    CREATE INDEX IF NOT EXISTS idx_admin_actions_createdAt ON admin_actions(createdAt);
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticketId ON ticket_messages(ticketId);
    CREATE INDEX IF NOT EXISTS idx_email_logs_adminId ON email_logs(adminId);
    CREATE INDEX IF NOT EXISTS idx_email_logs_createdAt ON email_logs(createdAt);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
    CREATE INDEX IF NOT EXISTS idx_trader_subscriptions_trader_id ON trader_subscriptions(trader_id);
    CREATE INDEX IF NOT EXISTS idx_trader_subscriptions_status ON trader_subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_trader_subscriptions_trial_ends_at ON trader_subscriptions(trial_ends_at);
    CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_createdAt ON platform_wallet_transactions(createdAt);
    CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_type ON platform_wallet_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_direction ON platform_wallet_transactions(direction);
    CREATE INDEX IF NOT EXISTS idx_branches_traderId ON branches(traderId);
    CREATE INDEX IF NOT EXISTS idx_branch_accounts_branchId ON branch_accounts(branchId);
    CREATE INDEX IF NOT EXISTS idx_branch_accounts_userId ON branch_accounts(userId);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_traderId ON team_invitations(traderId);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
    CREATE INDEX IF NOT EXISTS idx_team_members_traderId ON team_members(traderId);
    CREATE INDEX IF NOT EXISTS idx_team_members_userId ON team_members(userId);
    CREATE INDEX IF NOT EXISTS idx_team_members_branchId ON team_members(branchId);
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
    CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);
  `);

  db.prepare(
    `
    INSERT OR IGNORE INTO system_config (
      id, maintenanceMode, registrationOpen, globalFeesFree, globalFeesPremium, systemHealthStatus, systemHealthLastCheck
    ) VALUES ('global', 0, 1, 0.006, 0.003, 'operational', CURRENT_TIMESTAMP)
  `
  ).run();

  const defaultLicenseTypes = [
    {
      id: 'patente',
      name: 'Trading License Tax / Patente',
      authority: 'RRA / District',
      category: 'general',
      appliesTo: 'trader,organization',
      requiredFor: 'all_traders',
      requiresExpiry: 1,
      guidance: 'Annual commercial license for business activity in a district.',
    },
    {
      id: 'vat_registration',
      name: 'VAT Registration Certificate',
      authority: 'RRA',
      category: 'tax',
      appliesTo: 'trader,organization',
      requiredFor: 'turnover_over_threshold',
      requiresExpiry: 0,
      guidance: 'Required when turnover meets Rwanda VAT registration thresholds.',
    },
    {
      id: 'ebm_certificate',
      name: 'EBM Certificate',
      authority: 'RRA',
      category: 'tax',
      appliesTo: 'trader,organization',
      requiredFor: 'vat_registered',
      requiresExpiry: 0,
      guidance: 'Electronic Billing Machine evidence for VAT/income-tax registered taxpayers.',
    },
    {
      id: 'rdb_registration',
      name: 'RDB Business Registration',
      authority: 'RDB',
      category: 'general',
      appliesTo: 'trader,organization',
      requiredFor: 'registered_business',
      requiresExpiry: 0,
      guidance: 'Business registration certificate or company registration evidence.',
    },
    {
      id: 'rwanda_fda',
      name: 'Rwanda FDA License',
      authority: 'Rwanda FDA',
      category: 'sector',
      appliesTo: 'trader,organization',
      requiredFor: 'food_drugs_medical_products',
      requiresExpiry: 1,
      guidance: 'For food, drugs, medical products, cosmetics, or related regulated goods.',
    },
    {
      id: 'rica',
      name: 'RICA License',
      authority: 'RICA',
      category: 'sector',
      appliesTo: 'trader,organization',
      requiredFor: 'agriculture_food_processing',
      requiresExpiry: 1,
      guidance: 'For agriculture, livestock, food processing, and related regulated activities.',
    },
    {
      id: 'rura',
      name: 'RURA License',
      authority: 'RURA',
      category: 'sector',
      appliesTo: 'trader,organization',
      requiredFor: 'telecom_utilities_transport',
      requiresExpiry: 1,
      guidance: 'For utilities, telecom, transport, ICT, petroleum/gas, postal, and similar activities.',
    },
    {
      id: 'bnr',
      name: 'BNR License',
      authority: 'BNR',
      category: 'sector',
      appliesTo: 'trader,organization',
      requiredFor: 'finance_banking',
      requiresExpiry: 1,
      guidance: 'For banking, lending, payment services, and other regulated financial activities.',
    },
    {
      id: 'rmb',
      name: 'RMB Mining / Quarrying License',
      authority: 'RMB',
      category: 'sector',
      appliesTo: 'trader,organization',
      requiredFor: 'mining_quarrying',
      requiresExpiry: 1,
      guidance: 'For mining, quarrying, petroleum, gas, and mineral activities.',
    },
    {
      id: 'tourism_hospitality',
      name: 'Tourism / Hospitality License',
      authority: 'RDB / Tourism regulator',
      category: 'sector',
      appliesTo: 'trader,organization',
      requiredFor: 'tourism_hospitality',
      requiresExpiry: 1,
      guidance: 'For tourism operators, hotels, hospitality, tours, and related services.',
    },
    {
      id: 'eia',
      name: 'Environmental Impact Assessment',
      authority: 'RDB / Environment authority',
      category: 'special',
      appliesTo: 'trader,organization',
      requiredFor: 'environmental_impact',
      requiresExpiry: 0,
      guidance: 'For construction, manufacturing, or projects with environmental impact.',
    },
    {
      id: 'work_permit',
      name: 'Foreign Owner Work Permit',
      authority: 'Immigration / RDB',
      category: 'special',
      appliesTo: 'trader,organization',
      requiredFor: 'foreign_owner',
      requiresExpiry: 1,
      guidance: 'For foreign owners or investors operating in Rwanda.',
    },
    {
      id: 'professional_accreditation',
      name: 'Professional Accreditation',
      authority: 'Professional council',
      category: 'professional',
      appliesTo: 'trader,organization,customer',
      requiredFor: 'regulated_profession',
      requiresExpiry: 1,
      guidance: 'For legal, medical, engineering, customs clearing, and other regulated professions.',
    },
    {
      id: 'transport_license',
      name: 'Transport License',
      authority: 'RURA / relevant authority',
      category: 'sector',
      appliesTo: 'trader,customer,organization',
      requiredFor: 'transport_delivery',
      requiresExpiry: 1,
      guidance: 'For transport, delivery, driver, or logistics verification.',
    },
    {
      id: 'other',
      name: 'Other License',
      authority: 'Other',
      category: 'other',
      appliesTo: 'trader,customer,organization',
      requiredFor: 'other',
      requiresExpiry: 0,
      guidance: 'Use when the license type is not listed.',
    },
  ];

  const insertLicenseType = db.prepare(
    `
    INSERT OR IGNORE INTO license_types
      (id, name, authority, category, appliesTo, requiredFor, requiresExpiry, enabled, guidance, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  );
  defaultLicenseTypes.forEach((license) => {
    insertLicenseType.run(
      license.id,
      license.name,
      license.authority,
      license.category,
      license.appliesTo,
      license.requiredFor,
      license.requiresExpiry,
      license.guidance
    );
  });

  db.prepare(
    `
    INSERT OR IGNORE INTO loan_policy_versions (id, config, version, isActive, createdAt)
    VALUES ('loan_policy_v1', ?, 1, 1, CURRENT_TIMESTAMP)
  `
  ).run(
    JSON.stringify({
      minLoanAmount: 1000,
      maxLoanAmount: 500000,
      autoApprovalMaxAmount: 100000,
      baseApr: 0.18,
      premiumApr: 0.15,
      minTermMonths: 1,
      maxTermMonths: 12,
      autoApproveScore: 75,
      manualReviewScore: 55,
      repaymentFrequency: 'monthly',
      lateFeeFixed: 500,
      lateFeePercent: 0.01,
      graceDays: 3,
      autoDisbursementEnabled: true,
      dailyDisbursementLimit: 1000000,
      userExposureLimit: 500000,
      overdueLoanLockEnabled: true,
      processingFeePercent: 0.01,
      processingFeeMax: 50000,
      requireLicensingGate: true,
    })
  );

  db.prepare(
    `
    INSERT OR IGNORE INTO loyalty_policy_versions (id, config, version, isActive, createdAt)
    VALUES ('loyalty_policy_v1', ?, 1, 1, CURRENT_TIMESTAMP)
  `
  ).run(
    JSON.stringify({
      pointValueRwf: 0.2,
      purchaseEarnPerRwf: 0.001,
      premiumMultiplier: 2,
      referredUserBonus: 500,
      referrerQualifiedBonus: 1000,
      referralQualification: 'first_verified_transaction',
      onTimeLoanRepaymentMin: 50,
      onTimeLoanRepaymentMax: 200,
      minRedeemPoints: 100,
      allowFeePaymentWithPoints: true,
      allowPrincipalRepaymentWithPoints: false,
      allowInterestRepaymentWithPoints: false,
      expiryDays: 365,
    })
  );

  // Initialize default fee configurations
  const defaultFees = [
    {
      feeType: 'deposit',
      fixedFee: 0,
      percentageFee: 0,
      minFee: 0,
      maxFee: 0,
      description: 'Wallet deposits are free by default to drive adoption',
    },
    {
      feeType: 'withdrawal',
      fixedFee: 0,
      percentageFee: 0.005,
      minFee: 0,
      maxFee: 5000,
      description: 'Withdrawal fee excluding provider pass-through costs',
    },
    {
      feeType: 'transfer',
      fixedFee: 0,
      percentageFee: 0.003,
      minFee: 0,
      maxFee: 300,
      description: 'Competitive Esoko wallet-to-wallet transfer fee',
    },
    {
      feeType: 'purchase',
      fixedFee: 0,
      percentageFee: 0.015,
      minFee: 0,
      maxFee: 10000,
      description: 'Marketplace commission on wallet purchases',
    },
    {
      feeType: 'loan_application',
      fixedFee: 1000,
      percentageFee: 0,
      minFee: 0,
      maxFee: 1000,
      description: 'Loan application fee payable by wallet or loyalty points',
    },
    {
      feeType: 'loan_disbursement',
      fixedFee: 0,
      percentageFee: 0.01,
      minFee: 500,
      maxFee: 50000,
      description: 'Fee for loan disbursement',
    },
  ];

  defaultFees.forEach((fee) => {
    db.prepare(
      `
      INSERT OR IGNORE INTO fees_config (id, feeType, fixedFee, percentageFee, minFee, maxFee, description, enabled, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      `${fee.feeType}_${Date.now()}`,
      fee.feeType,
      fee.fixedFee,
      fee.percentageFee,
      fee.minFee,
      fee.maxFee,
      fee.description
    );
  });

  db.prepare(
    `
    UPDATE fees_config
    SET maxFee = fixedFee, updatedAt = CURRENT_TIMESTAMP
    WHERE feeType = 'loan_application'
      AND fixedFee > 0
      AND maxFee = 0
  `
  ).run();

  [
    ['deposit', 0, 0, 0, 0, 'Wallet deposits are free by default to drive adoption'],
    ['withdrawal', 0, 0.005, 0, 5000, 'Withdrawal fee excluding provider pass-through costs'],
    ['transfer', 0, 0.003, 0, 300, 'Competitive Esoko wallet-to-wallet transfer fee'],
    ['purchase', 0, 0.015, 0, 10000, 'Marketplace commission on wallet purchases'],
    ['loan_application', 1000, 0, 0, 1000, 'Loan application fee payable by wallet or loyalty points'],
    ['loan_disbursement', 0, 0.01, 500, 50000, 'Loan processing/disbursement facilitation fee'],
  ].forEach(([feeType, fixedFee, percentageFee, minFee, maxFee, description]) => {
    db.prepare(
      `
      UPDATE fees_config
      SET fixedFee = ?, percentageFee = ?, minFee = ?, maxFee = ?, description = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE feeType = ?
    `
    ).run(fixedFee, percentageFee, minFee, maxFee, description, feeType);
  });

  db.prepare(
    `
    INSERT OR IGNORE INTO user_accounts (
      id, userId, role, status, verificationStatus, onboardingComplete, walletBalance, tier,
      businessName, businessCategory, businessLocation, tin, category, createdAt, updatedAt
    )
    SELECT
      lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
      id,
      role,
      COALESCE(status, 'active'),
      COALESCE(verificationStatus, 'pending'),
      COALESCE(onboardingComplete, 0),
      COALESCE(walletBalance, 0),
      COALESCE(tier, 'free'),
      businessName,
      businessCategory,
      location,
      tin,
      category,
      COALESCE(createdAt, CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP
    FROM users
    WHERE role IS NOT NULL
  `
  ).run();

  db.prepare(
    `
    INSERT OR IGNORE INTO identity_verifications (
      id, userId, status, phoneVerified, emailVerified, createdAt, updatedAt
    )
    SELECT
      lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
      id,
      COALESCE(verificationStatus, 'pending'),
      CASE WHEN phone IS NOT NULL AND trim(phone) != '' THEN 1 ELSE 0 END,
      COALESCE(emailVerified, 0),
      COALESCE(createdAt, CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP
    FROM users
  `
  ).run();

  // Initialize default subscription tiers
  const defaultSubscriptions = [
    {
      id: 'trial_full_access',
      name: '15-Day Full Access Trial',
      description: 'Full platform access for the first 15 days',
      price: 0,
      features: JSON.stringify(['all_features', 'trial_full_access']),
      limits: JSON.stringify({
        transactionsPerMonth: -1,
        storageGB: 10,
        apiCallsPerDay: 10000,
        supportLevel: 'priority',
        trialDays: 15,
      }),
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'Basic features for new traders',
      price: 5000, // RWF
      features: JSON.stringify(['basic_inventory', 'wallet_transfers', 'customer_management']),
      limits: JSON.stringify({
        transactionsPerMonth: 100,
        storageGB: 1,
        apiCallsPerDay: 1000,
        supportLevel: 'basic',
      }),
    },
    {
      id: 'professional',
      name: 'Growth',
      description: 'Advanced features for growing businesses',
      price: 15000,
      features: JSON.stringify([
        'advanced_inventory',
        'analytics_dashboard',
        'priority_support',
        'bulk_operations',
      ]),
      limits: JSON.stringify({
        transactionsPerMonth: 1000,
        storageGB: 10,
        apiCallsPerDay: 10000,
        supportLevel: 'priority',
      }),
    },
    {
      id: 'enterprise',
      name: 'Pro',
      description: 'Full platform access with priority support',
      price: 35000,
      features: JSON.stringify([
        'all_features',
        'custom_integrations',
        'dedicated_analyst',
        'white_label',
      ]),
      limits: JSON.stringify({
        transactionsPerMonth: -1, // unlimited
        storageGB: 100,
        apiCallsPerDay: -1,
        supportLevel: 'dedicated',
      }),
    },
  ];

  defaultSubscriptions.forEach((sub) => {
    db.prepare(
      `
      INSERT OR IGNORE INTO subscriptions (id, name, description, price, features, limits, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(sub.id, sub.name, sub.description, sub.price, sub.features, sub.limits);
  });

  defaultSubscriptions.forEach((sub) => {
    db.prepare(
      `
      UPDATE subscriptions
      SET name = ?, description = ?, price = ?, features = ?, limits = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(sub.name, sub.description, sub.price, sub.features, sub.limits, sub.id);
  });

  db.prepare(
    `
    UPDATE subscriptions
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = 'trial_full_access'
  `
  ).run();

  // Initialize default dynamic fees
  const defaultDynamicFees = [
    {
      fee_type: 'transaction',
      percentage: 0.02,
      fixed_amount: 0,
      conditions: JSON.stringify({ min_amount: 1000, max_amount: 100000, user_tier: 'free' }),
    },
    {
      fee_type: 'wallet_deposit',
      percentage: 0.01,
      fixed_amount: 50,
      conditions: JSON.stringify({ min_amount: 5000, max_amount: 1000000 }),
    },
    {
      fee_type: 'subscription',
      percentage: 0,
      fixed_amount: 0,
      conditions: JSON.stringify({ subscription_tier: 'starter' }),
    },
  ];

  defaultDynamicFees.forEach((fee) => {
    db.prepare(
      `
      INSERT OR IGNORE INTO dynamic_fees (id, fee_type, percentage, fixed_amount, conditions, is_active, effective_from, created_at)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      `${fee.fee_type}_${Date.now()}`,
      fee.fee_type,
      fee.percentage,
      fee.fixed_amount,
      fee.conditions
    );
  });

  const defaultRevenueAccounts = [
    {
      code: 'platform_revenue',
      name: 'Platform Revenue',
      accountType: 'revenue',
      description: 'Earned fees, subscriptions, and service revenue',
    },
    {
      code: 'wallet_liability',
      name: 'Wallet Liability',
      accountType: 'liability',
      description: 'Total value owed to customer, trader, and agent wallets',
    },
    {
      code: 'pending_settlement',
      name: 'Pending Settlement',
      accountType: 'liability',
      description: 'Funds awaiting payout or provider reconciliation',
    },
    {
      code: 'agent_commissions_payable',
      name: 'Agent Commissions Payable',
      accountType: 'liability',
      description: 'Commission owed to agents',
    },
    {
      code: 'refund_reserve',
      name: 'Refund Reserve',
      accountType: 'liability',
      description: 'Reserve for recent or reversible transactions',
    },
  ];

  defaultRevenueAccounts.forEach((account) => {
    db.prepare(
      `
      INSERT OR IGNORE INTO revenue_accounts (id, code, name, accountType, currency, description, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'RWF', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      `account_${account.code}`,
      account.code,
      account.name,
      account.accountType,
      account.description
    );
  });

  return db;
}

const dbInstance = initializeDatabase();
export default dbInstance;
