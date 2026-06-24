/**
 * Migration 001: Add CSRF tokens table
 * Tracks issued CSRF tokens for session protection
 */

import type Database from 'better-sqlite3';

export function up(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS csrf_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_csrf_userId_expiresAt ON csrf_tokens(userId, expiresAt);
  `);

  console.log('✓ Created csrf_tokens table');
}

export function down(db: Database.Database) {
  db.exec(`
    DROP TABLE IF EXISTS csrf_tokens;
  `);

  console.log('✓ Dropped csrf_tokens table');
}
