/**
 * Database test helpers - setup and cleanup for test isolation
 */

import db from '../../db';

export async function setupTestDb(): Promise<void> {
  // No-op for now; server uses the same test database file.
  return;
}

export async function cleanupTestDb(): Promise<void> {
  try {
    db.pragma('foreign_keys = OFF');
    const userIds = db
      .prepare("SELECT id FROM users WHERE email LIKE '%@test.local'")
      .all() as Array<{ id: string }>;

    for (const { id } of userIds) {
      db.prepare('DELETE FROM refresh_tokens WHERE userId = ?').run(id);
      db.prepare('DELETE FROM admin_actions WHERE adminId = ?').run(id);
      db.prepare('DELETE FROM email_logs WHERE adminId = ?').run(id);
      db.prepare('DELETE FROM login_alerts WHERE userId = ?').run(id);
      db.prepare('DELETE FROM wallet_transactions WHERE userId = ?').run(id);
      db.prepare('DELETE FROM transactions WHERE userId = ? OR senderId = ? OR recipientId = ?').run(id, id, id);
      db.prepare('DELETE FROM team_members WHERE userId = ?').run(id);
      db.prepare('DELETE FROM verification_requests WHERE userId = ?').run(id);
      db.prepare('DELETE FROM verification_documents WHERE userId = ?').run(id);
      db.prepare('DELETE FROM user_accounts WHERE userId = ?').run(id);
    }

    db.prepare("DELETE FROM users WHERE email LIKE '%@test.local'").run();
  } catch (error) {
    console.error('Failed to clean up test database:', error);
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
