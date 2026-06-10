import { Pool } from 'pg';

type SqliteDb = {
  prepare: (sql: string) => {
    get: (...params: any[]) => any;
    all: (...params: any[]) => any[];
    run: (...params: any[]) => any;
  };
  transaction: (fn: (...args: any[]) => any) => (...args: any[]) => any;
};

const env = process.env as unknown as Record<string, string | undefined>;
const databaseUrl = env.DATABASE_URL || env.POSTGRES_URL || '';
const usePostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);

let pool: Pool | null = null;
let initialized = false;

function getPool() {
  if (!usePostgres) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        env.PGSSLMODE === 'disable' || env.NODE_ENV !== 'production'
          ? undefined
          : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export function isPostgresAccountStoreEnabled() {
  return Boolean(getPool());
}

export async function initializePostgresAccountStore() {
  const client = getPool();
  if (!client || initialized) return false;

  await client.query(`
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
      "onboardingComplete" INTEGER DEFAULT 1,
      "loyaltyPoints" REAL DEFAULT 0,
      "transactionPin" TEXT,
      "biometricEnabled" INTEGER DEFAULT 0,
      "profilePhoto" TEXT,
      "vatRate" REAL DEFAULT 18,
      "lowStockThreshold" INTEGER DEFAULT 10,
      metadata TEXT,
      status TEXT DEFAULT 'active',
      "emailVerified" INTEGER DEFAULT 0,
      "termsAcceptedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      "verificationStatus" TEXT DEFAULT 'pending',
      "onboardingComplete" INTEGER DEFAULT 1,
      "walletBalance" REAL DEFAULT 0,
      tier TEXT DEFAULT 'free',
      "businessName" TEXT,
      "businessCategory" TEXT,
      "businessLocation" TEXT,
      tin TEXT,
      "rdbCertificateUrl" TEXT,
      category TEXT,
      metadata TEXT,
      "lastSelectedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("userId", role)
    );
  `);

  initialized = true;
  return true;
}

function value(row: any, key: string, fallback: any = null) {
  return row?.[key] === undefined ? fallback : row[key];
}

export async function mirrorUserToPostgres(user: any) {
  const client = getPool();
  if (!client || !user?.id) return;
  await initializePostgresAccountStore();

  await client.query(
    `
    INSERT INTO users (
      id, email, name, password, role, "verificationStatus", "walletBalance", "appNumber",
      tier, phone, "businessName", "businessCategory", location, tin, category,
      "onboardingComplete", "loyaltyPoints", "transactionPin", "biometricEnabled",
      "profilePhoto", "vatRate", "lowStockThreshold", metadata, status, "emailVerified",
      "termsAcceptedAt", "createdAt", "updatedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22, $23, $24, $25,
      $26, COALESCE($27::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      password = EXCLUDED.password,
      role = EXCLUDED.role,
      "verificationStatus" = EXCLUDED."verificationStatus",
      "walletBalance" = EXCLUDED."walletBalance",
      "appNumber" = EXCLUDED."appNumber",
      tier = EXCLUDED.tier,
      phone = EXCLUDED.phone,
      "businessName" = EXCLUDED."businessName",
      "businessCategory" = EXCLUDED."businessCategory",
      location = EXCLUDED.location,
      tin = EXCLUDED.tin,
      category = EXCLUDED.category,
      "onboardingComplete" = EXCLUDED."onboardingComplete",
      "loyaltyPoints" = EXCLUDED."loyaltyPoints",
      "transactionPin" = EXCLUDED."transactionPin",
      "biometricEnabled" = EXCLUDED."biometricEnabled",
      "profilePhoto" = EXCLUDED."profilePhoto",
      "vatRate" = EXCLUDED."vatRate",
      "lowStockThreshold" = EXCLUDED."lowStockThreshold",
      metadata = EXCLUDED.metadata,
      status = EXCLUDED.status,
      "emailVerified" = EXCLUDED."emailVerified",
      "termsAcceptedAt" = EXCLUDED."termsAcceptedAt",
      "updatedAt" = CURRENT_TIMESTAMP
  `,
    [
      user.id,
      user.email,
      user.name || user.email,
      user.password,
      user.role || 'customer',
      value(user, 'verificationStatus', 'pending'),
      Number(value(user, 'walletBalance', 0)),
      value(user, 'appNumber'),
      value(user, 'tier', 'free'),
      value(user, 'phone'),
      value(user, 'businessName'),
      value(user, 'businessCategory'),
      value(user, 'location'),
      value(user, 'tin'),
      value(user, 'category'),
      Number(Boolean(value(user, 'onboardingComplete', 1))),
      Number(value(user, 'loyaltyPoints', 0)),
      value(user, 'transactionPin'),
      Number(Boolean(value(user, 'biometricEnabled', 0))),
      value(user, 'profilePhoto'),
      Number(value(user, 'vatRate', 18)),
      Number(value(user, 'lowStockThreshold', 10)),
      value(user, 'metadata'),
      value(user, 'status', 'active'),
      Number(Boolean(value(user, 'emailVerified', 0))),
      value(user, 'termsAcceptedAt'),
      value(user, 'createdAt'),
    ]
  );
}

export async function mirrorAccountToPostgres(account: any) {
  const client = getPool();
  if (!client || !account?.id) return;
  await initializePostgresAccountStore();

  await client.query(
    `
    INSERT INTO user_accounts (
      id, "userId", role, status, "verificationStatus", "onboardingComplete",
      "walletBalance", tier, "businessName", "businessCategory", "businessLocation",
      tin, "rdbCertificateUrl", category, metadata, "lastSelectedAt", "createdAt", "updatedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, COALESCE($17::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      "verificationStatus" = EXCLUDED."verificationStatus",
      "onboardingComplete" = EXCLUDED."onboardingComplete",
      "walletBalance" = EXCLUDED."walletBalance",
      tier = EXCLUDED.tier,
      "businessName" = EXCLUDED."businessName",
      "businessCategory" = EXCLUDED."businessCategory",
      "businessLocation" = EXCLUDED."businessLocation",
      tin = EXCLUDED.tin,
      "rdbCertificateUrl" = EXCLUDED."rdbCertificateUrl",
      category = EXCLUDED.category,
      metadata = EXCLUDED.metadata,
      "lastSelectedAt" = EXCLUDED."lastSelectedAt",
      "updatedAt" = CURRENT_TIMESTAMP
  `,
    [
      account.id,
      account.userId,
      account.role || 'customer',
      value(account, 'status', 'active'),
      value(account, 'verificationStatus', 'pending'),
      Number(Boolean(value(account, 'onboardingComplete', 1))),
      Number(value(account, 'walletBalance', 0)),
      value(account, 'tier', 'free'),
      value(account, 'businessName'),
      value(account, 'businessCategory'),
      value(account, 'businessLocation'),
      value(account, 'tin'),
      value(account, 'rdbCertificateUrl'),
      value(account, 'category'),
      value(account, 'metadata'),
      value(account, 'lastSelectedAt'),
      value(account, 'createdAt'),
    ]
  );
}

export async function mirrorUserAccountsToPostgres(sqlite: SqliteDb, userId: string) {
  const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (user) await mirrorUserToPostgres(user);
  const accounts = sqlite.prepare('SELECT * FROM user_accounts WHERE userId = ?').all(userId);
  for (const account of accounts) {
    await mirrorAccountToPostgres(account);
  }
}

function insertSqliteUser(sqlite: SqliteDb, user: any) {
  sqlite
    .prepare(
      `
      INSERT OR IGNORE INTO users (
        id, email, name, password, role, verificationStatus, walletBalance, appNumber,
        tier, phone, businessName, businessCategory, location, tin, category,
        onboardingComplete, loyaltyPoints, transactionPin, biometricEnabled, profilePhoto,
        vatRate, lowStockThreshold, metadata, status, emailVerified, termsAcceptedAt,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
    `
    )
    .run(
      user.id,
      user.email,
      user.name || user.email,
      user.password,
      user.role || 'customer',
      value(user, 'verificationStatus', 'pending'),
      Number(value(user, 'walletBalance', 0)),
      value(user, 'appNumber'),
      value(user, 'tier', 'free'),
      value(user, 'phone'),
      value(user, 'businessName'),
      value(user, 'businessCategory'),
      value(user, 'location'),
      value(user, 'tin'),
      value(user, 'category'),
      Number(Boolean(value(user, 'onboardingComplete', 1))),
      Number(value(user, 'loyaltyPoints', 0)),
      value(user, 'transactionPin'),
      Number(Boolean(value(user, 'biometricEnabled', 0))),
      value(user, 'profilePhoto'),
      Number(value(user, 'vatRate', 18)),
      Number(value(user, 'lowStockThreshold', 10)),
      value(user, 'metadata'),
      value(user, 'status', 'active'),
      Number(Boolean(value(user, 'emailVerified', 0))),
      value(user, 'termsAcceptedAt'),
      value(user, 'createdAt'),
      value(user, 'updatedAt')
    );
}

function insertSqliteAccount(sqlite: SqliteDb, account: any) {
  sqlite
    .prepare(
      `
      INSERT OR IGNORE INTO user_accounts (
        id, userId, role, status, verificationStatus, onboardingComplete, walletBalance, tier,
        businessName, businessCategory, businessLocation, tin, rdbCertificateUrl, category,
        metadata, lastSelectedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
    `
    )
    .run(
      account.id,
      account.userId,
      account.role || 'customer',
      value(account, 'status', 'active'),
      value(account, 'verificationStatus', 'pending'),
      Number(Boolean(value(account, 'onboardingComplete', 1))),
      Number(value(account, 'walletBalance', 0)),
      value(account, 'tier', 'free'),
      value(account, 'businessName'),
      value(account, 'businessCategory'),
      value(account, 'businessLocation'),
      value(account, 'tin'),
      value(account, 'rdbCertificateUrl'),
      value(account, 'category'),
      value(account, 'metadata'),
      value(account, 'lastSelectedAt'),
      value(account, 'createdAt'),
      value(account, 'updatedAt')
    );
}

export async function hydrateSqliteUserFromPostgres(sqlite: SqliteDb, email: string) {
  const client = getPool();
  if (!client || !email) return null;
  await initializePostgresAccountStore();

  const userResult = await client.query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [
    email,
  ]);
  const user = userResult.rows[0];
  if (!user) return null;

  const accountsResult = await client.query('SELECT * FROM user_accounts WHERE "userId" = $1', [
    user.id,
  ]);

  sqlite.transaction(() => {
    insertSqliteUser(sqlite, user);
    for (const account of accountsResult.rows) insertSqliteAccount(sqlite, account);
    sqlite
      .prepare(
        'INSERT OR IGNORE INTO loyalty_points (id, userId, points, totalEarned, updatedAt) VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)'
      )
      .run(`pg-loyalty-${user.id}`, user.id);
  })();

  return sqlite.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
}

export async function bootstrapSqliteAccountsFromPostgres(sqlite: SqliteDb) {
  const client = getPool();
  if (!client) return { users: 0, accounts: 0 };
  await initializePostgresAccountStore();

  const [{ rows: users }, { rows: accounts }] = await Promise.all([
    client.query('SELECT * FROM users'),
    client.query('SELECT * FROM user_accounts'),
  ]);

  sqlite.transaction(() => {
    for (const user of users) {
      insertSqliteUser(sqlite, user);
      sqlite
        .prepare(
          'INSERT OR IGNORE INTO loyalty_points (id, userId, points, totalEarned, updatedAt) VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)'
        )
        .run(`pg-loyalty-${user.id}`, user.id);
    }
    for (const account of accounts) insertSqliteAccount(sqlite, account);
  })();

  return { users: users.length, accounts: accounts.length };
}

export async function closePostgresAccountStore() {
  if (!pool) return;
  await pool.end();
  pool = null;
  initialized = false;
}
