/**
 * Database Migrations Framework
 *
 * Ensures safe, repeatable schema changes across environments:
 * - Numbered migrations (001_, 002_, etc.) for ordering
 * - Idempotent operations (safe to re-run)
 * - Applied-state tracking in `migrations_applied` table
 * - Rollback safety (each migration has an undo script)
 * - CLI for running, rolling back, and checking status
 *
 * File Naming Convention:
 * migrations/001_initial_schema.ts
 * migrations/002_add_csrf_tokens_table.ts
 * migrations/003_add_audit_logs_table.ts
 *
 * Usage:
 * npm run migrate -- up      # Run pending migrations
 * npm run migrate -- down    # Rollback last migration
 * npm run migrate -- status  # Show migration status
 */

import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Migration interface
 * Each migration module exports `up` and `down` functions
 */
export interface Migration {
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

/**
 * Initialize migrations table if it doesn't exist
 */
export function initMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration_ms INTEGER,
      status TEXT DEFAULT 'applied'
    );
  `);
}

/**
 * Get list of migration files
 */
export function getMigrationFiles(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .sort(); // Numeric sorting (001_, 002_, etc.)
}

/**
 * Get applied migrations
 */
export function getAppliedMigrations(db: Database.Database): string[] {
  try {
    const rows = db
      .prepare('SELECT name FROM migrations_applied WHERE status = ? ORDER BY appliedAt')
      .all('applied') as any[];
    return rows.map((r) => r.name);
  } catch {
    return [];
  }
}

/**
 * Get pending migrations
 */
export function getPendingMigrations(
  db: Database.Database,
  migrationsDir: string
): string[] {
  const files = getMigrationFiles(migrationsDir);
  const applied = new Set(getAppliedMigrations(db));

  return files.filter((file) => !applied.has(file));
}

/**
 * Run a single migration
 */
export async function runMigration(
  db: Database.Database,
  migrationName: string,
  migrationsDir: string
): Promise<{ success: boolean; error?: string; durationMs?: number }> {
  try {
    const migrationPath = path.join(migrationsDir, migrationName);
    const migrationUrl = new URL(`file:///${migrationPath.replace(/\\/g, '/')}`).href;
    const startTime = Date.now();

    // Dynamically import migration module
    const migrationModule = await import(migrationUrl) as unknown as Migration;
    const { up } = migrationModule;

    if (typeof up !== 'function') {
      return {
        success: false,
        error: `Migration ${migrationName} does not export an 'up' function`,
      };
    }

    // Run migration in a transaction
    const transaction = db.transaction(() => {
      up(db);
    });

    transaction();

    const durationMs = Date.now() - startTime;

    // Record in migrations table
    db.prepare(
      `
      INSERT INTO migrations_applied (id, name, duration_ms, status)
      VALUES (?, ?, ?, ?)
    `
    ).run(uuidv4(), migrationName, durationMs, 'applied');

    return { success: true, durationMs };
  } catch (error) {
    return {
      success: false,
      error: `Migration ${migrationName} failed: ${String(error)}`,
    };
  }
}

/**
 * Run all pending migrations
 */
export async function runPendingMigrations(
  db: Database.Database,
  migrationsDir: string
): Promise<{ success: boolean; migrationCount: number; errors: string[] }> {
  initMigrationsTable(db);

  const pending = getPendingMigrations(db, migrationsDir);
  const errors: string[] = [];

  for (const migrationName of pending) {
    const result = await runMigration(db, migrationName, migrationsDir);
    if (!result.success) {
      errors.push(result.error || 'Unknown error');
      break; // Stop on first error to maintain consistency
    }
    console.log(`✓ Applied migration: ${migrationName} (${result.durationMs}ms)`);
  }

  return {
    success: errors.length === 0,
    migrationCount: pending.length - errors.length,
    errors,
  };
}

/**
 * Rollback last migration
 */
export async function rollbackMigration(
  db: Database.Database,
  migrationsDir: string
): Promise<{ success: boolean; error?: string; migrationName?: string }> {
  try {
    const applied = getAppliedMigrations(db);
    if (applied.length === 0) {
      return { success: false, error: 'No migrations to rollback' };
    }

    const lastMigration = applied[applied.length - 1];
    const migrationPath = path.join(migrationsDir, lastMigration);
    const migrationUrl = new URL(`file:///${migrationPath.replace(/\\/g, '/')}`).href;

    const migrationModule = await import(migrationUrl) as unknown as Migration;
    const { down } = migrationModule;

    if (typeof down !== 'function') {
      return {
        success: false,
        error: `Migration ${lastMigration} does not export a 'down' function`,
      };
    }

    // Run rollback in a transaction
    const transaction = db.transaction(() => {
      down(db);
    });

    transaction();

    // Update status in migrations table
    db.prepare(`UPDATE migrations_applied SET status = ? WHERE name = ?`).run('rolled_back', lastMigration);

    console.log(`✓ Rolled back migration: ${lastMigration}`);
    return { success: true, migrationName: lastMigration };
  } catch (error) {
    return {
      success: false,
      error: `Rollback failed: ${String(error)}`,
    };
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(
  db: Database.Database,
  migrationsDir: string
): {
  applied: string[];
  pending: string[];
  total: number;
} {
  initMigrationsTable(db);

  const all = getMigrationFiles(migrationsDir);
  const applied = getAppliedMigrations(db);
  const pending = all.filter((f) => !applied.includes(f));

  return {
    applied,
    pending,
    total: all.length,
  };
}

/**
 * CLI entry point for migration management
 * Usage: node ./scripts/migrate.ts up|down|status
 */
export async function runMigrationsCli(
  db: Database.Database,
  migrationsDir: string,
  command: 'up' | 'down' | 'status'
): Promise<void> {
  switch (command) {
    case 'up': {
      console.log('Running pending migrations...');
      const result = await runPendingMigrations(db, migrationsDir);
      if (result.success) {
        console.log(`✓ Successfully applied ${result.migrationCount} migration(s)`);
      } else {
        console.error(`✗ Migration failed:`, result.errors);
        process.exit(1);
      }
      break;
    }

    case 'down': {
      console.log('Rolling back last migration...');
      const result = await rollbackMigration(db, migrationsDir);
      if (!result.success) {
        console.error(`✗ ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      const status = getMigrationStatus(db, migrationsDir);
      console.log(`\nMigration Status:`);
      console.log(`Applied: ${status.applied.length}/${status.total}`);

      if (status.applied.length > 0) {
        console.log('\nApplied migrations:');
        status.applied.forEach((m) => console.log(`  ✓ ${m}`));
      }

      if (status.pending.length > 0) {
        console.log('\nPending migrations:');
        status.pending.forEach((m) => console.log(`  - ${m}`));
      } else if (status.applied.length > 0) {
        console.log('\n✓ All migrations applied!');
      }
      break;
    }
  }
}
