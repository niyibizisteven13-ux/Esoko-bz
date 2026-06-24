import type Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // Vouchers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      issuer TEXT NOT NULL DEFAULT 'platform',
      redeemable_by TEXT,
      expires_at DATETIME NOT NULL,
      used_by TEXT,
      used_at DATETIME,
      order_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
    CREATE INDEX IF NOT EXISTS idx_vouchers_used_by ON vouchers(used_by);
    CREATE INDEX IF NOT EXISTS idx_vouchers_expires ON vouchers(expires_at);
  `);

  // Finance transactions ledger (separate from main transactions table)
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY,
      from_user_id TEXT,
      to_user_id TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      ref_id TEXT,
      status TEXT DEFAULT 'completed',
      memo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_finance_transactions_from_user ON finance_transactions(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_transactions_to_user ON finance_transactions(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_transactions_ref_id ON finance_transactions(ref_id);
    CREATE INDEX IF NOT EXISTS idx_finance_transactions_created ON finance_transactions(created_at);
  `);

  // Trader accounts (balances)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trader_accounts (
      id TEXT PRIMARY KEY,
      trader_id TEXT NOT NULL UNIQUE,
      balance REAL DEFAULT 0,
      reserved_amount REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trader_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_trader_accounts_trader_id ON trader_accounts(trader_id);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS vouchers;
    DROP TABLE IF EXISTS finance_transactions;
    DROP TABLE IF EXISTS trader_accounts;
  `);
}
