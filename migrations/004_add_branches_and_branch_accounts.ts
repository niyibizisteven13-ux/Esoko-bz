import type Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  db.exec(`
    -- Branches: represent physical or logical branches under a trader (headquarter owns branches)
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      traderId TEXT NOT NULL,
      name TEXT NOT NULL,
      appNumber TEXT UNIQUE,
      location TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (traderId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_branches_traderId ON branches(traderId);
    CREATE INDEX IF NOT EXISTS idx_branches_appNumber ON branches(appNumber);

    -- Branch accounts: map user accounts to branches and grant branch-level roles
    CREATE TABLE IF NOT EXISTS branch_accounts (
      id TEXT PRIMARY KEY,
      branchId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'staff', -- e.g., manager, staff
      permissions TEXT, -- optional JSON blob of granular permissions
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(branchId, userId)
    );
    CREATE INDEX IF NOT EXISTS idx_branch_accounts_branchId ON branch_accounts(branchId);
    CREATE INDEX IF NOT EXISTS idx_branch_accounts_userId ON branch_accounts(userId);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS branch_accounts;
    DROP TABLE IF EXISTS branches;
  `);
}
