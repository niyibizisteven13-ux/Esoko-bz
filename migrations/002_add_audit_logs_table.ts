/**
 * Migration 002: Add structured audit logs table
 * Tracks all auth, wallet, and admin actions for security audit trails
 */

import type Database from 'better-sqlite3';

export function up(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      status TEXT DEFAULT 'success',
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      error_message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_userId_action ON audit_logs(userId, action);
    CREATE INDEX IF NOT EXISTS idx_audit_action_createdAt ON audit_logs(action, createdAt);
    CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status);
  `);

  console.log('✓ Created audit_logs table');
}

export function down(db: Database.Database) {
  db.exec(`
    DROP TABLE IF EXISTS audit_logs;
  `);

  console.log('✓ Dropped audit_logs table');
}
