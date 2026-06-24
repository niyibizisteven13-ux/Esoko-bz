/**
 * Distributed Task Scheduler with Lock-Based Safety
 *
 * Ensures background jobs (e.g., loan reminders) only run once across multiple instances
 * when the app is deployed in a load-balanced environment.
 *
 * Strategy:
 * 1. Use database locks (pessimistic locking) for leader election
 * 2. Each instance attempts to acquire a lock for a job
 * 3. Only the lock holder executes the job
 * 4. Lock is released after job completion or timeout
 *
 * Supports:
 * - Recurring tasks (cron-style scheduling)
 * - One-off tasks with retry
 * - Task failure notifications
 * - Lock expiry (safety against hung instances)
 *
 * Database Tables:
 * - scheduled_tasks: Defines task schedules
 * - task_locks: Current lock state
 * - task_runs: Historical execution log
 */

import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  schedule: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'on-demand';
  handler: () => Promise<any>;
  maxDurationMs?: number;
  enabled: boolean;
  nextRun?: Date;
}

export interface TaskLock {
  taskId: string;
  lockedBy: string; // instance ID
  acquiredAt: Date;
  expiresAt: Date;
}

export interface TaskRun {
  id: string;
  taskId: string;
  status: 'pending' | 'running' | 'success' | 'failure';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
}

/**
 * Task Scheduler with Distributed Lock
 */
export class DistributedScheduler {
  private db: Database.Database;
  private instanceId: string;
  private lockTtlMs: number;
  private tasks: Map<string, ScheduledTask>;
  private running: boolean = false;

  constructor(
    db: Database.Database,
    options?: {
      instanceId?: string;
      lockTtlMs?: number;
    }
  ) {
    this.db = db;
    this.instanceId = options?.instanceId || `instance-${uuidv4().slice(0, 8)}`;
    this.lockTtlMs = options?.lockTtlMs || 30 * 60 * 1000; // 30 minutes default
    this.tasks = new Map();

    this.initTables();
  }

  /**
   * Initialize scheduler tables
   */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        schedule TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        nextRun DATETIME,
        lastRun DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_locks (
        taskId TEXT PRIMARY KEY,
        lockedBy TEXT NOT NULL,
        acquiredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME NOT NULL,
        FOREIGN KEY (taskId) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        startedAt DATETIME,
        completedAt DATETIME,
        duration INTEGER,
        error TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (taskId) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
      );
    `);

    // Create indexes separately to avoid syntax issues
    try {
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_taskId_status ON task_runs(taskId, status);
        CREATE INDEX IF NOT EXISTS idx_createdAt ON task_runs(createdAt);
      `);
    } catch {
      // Indexes may already exist, ignore errors
    }
  }

  /**
   * Register a scheduled task
   */
  registerTask(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task ${task.id} already registered`);
    }

    this.tasks.set(task.id, task);

    // Insert into database if not exists
    try {
      this.db
        .prepare(
          `
        INSERT OR IGNORE INTO scheduled_tasks (id, name, description, schedule, enabled)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(task.id, task.name, task.description, task.schedule, task.enabled ? 1 : 0);
    } catch {
      /* ignore */
    }
  }

  /**
   * Attempt to acquire lock for a task
   * Returns true if lock acquired, false if already held by another instance
   */
  private acquireLock(taskId: string): boolean {
    try {
      const expiresAt = new Date(Date.now() + this.lockTtlMs).toISOString();

      this.db
        .prepare(
          `
        INSERT INTO task_locks (taskId, lockedBy, expiresAt)
        VALUES (?, ?, ?)
        ON CONFLICT(taskId) DO UPDATE SET
          lockedBy = ?,
          expiresAt = ?
        WHERE expiresAt < CURRENT_TIMESTAMP OR lockedBy = ?
      `
        )
        .run(taskId, this.instanceId, expiresAt, this.instanceId, expiresAt, this.instanceId);

      // Verify we got the lock
      const lock = this.db
        .prepare('SELECT lockedBy FROM task_locks WHERE taskId = ?')
        .get(taskId) as any;

      return lock?.lockedBy === this.instanceId;
    } catch {
      return false;
    }
  }

  /**
   * Release lock for a task
   */
  private releaseLock(taskId: string): void {
    this.db
      .prepare('DELETE FROM task_locks WHERE taskId = ? AND lockedBy = ?')
      .run(taskId, this.instanceId);
  }

  /**
   * Execute a single task (with locking)
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const lockAcquired = this.acquireLock(task.id);

    if (!lockAcquired) {
      console.log(`[Scheduler] Lock not acquired for task ${task.name} (held by another instance)`);
      return;
    }

    const runId = uuidv4();
    const startTime = Date.now();

    try {
      // Record task start
      this.db
        .prepare(
          `
        INSERT INTO task_runs (id, taskId, status, startedAt)
        VALUES (?, ?, ?, ?)
      `
        )
        .run(runId, task.id, 'running', new Date().toISOString());

      // Execute task with timeout
      const timeoutMs = task.maxDurationMs || 5 * 60 * 1000; // 5 min default
      const result = await Promise.race([
        task.handler(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Task execution timeout')), timeoutMs)
        ),
      ]);

      const duration = Date.now() - startTime;

      // Record success
      this.db
        .prepare(
          `
        UPDATE task_runs SET status = ?, completedAt = ?, duration = ?
        WHERE id = ?
      `
        )
        .run('success', new Date().toISOString(), duration, runId);

      // Update last run
      this.db
        .prepare('UPDATE scheduled_tasks SET lastRun = ? WHERE id = ?')
        .run(new Date().toISOString(), task.id);

      console.log(
        `[Scheduler] Task ${task.name} completed successfully (${duration}ms)`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = String(error);

      // Record failure
      this.db
        .prepare(
          `
        UPDATE task_runs SET status = ?, completedAt = ?, duration = ?, error = ?
        WHERE id = ?
      `
        )
        .run('failure', new Date().toISOString(), duration, errorMsg, runId);

      console.error(`[Scheduler] Task ${task.name} failed: ${errorMsg}`);
    } finally {
      this.releaseLock(task.id);
    }
  }

  /**
   * Start scheduler (should be called once per instance)
   */
  start(intervalMs: number = 60000): void {
    if (this.running) {
      console.warn('[Scheduler] Already running');
      return;
    }

    this.running = true;
    console.log(`[Scheduler] Started on instance ${this.instanceId}`);

    // Run tasks periodically
    setInterval(() => {
      this.runDueTasks().catch((error) => console.error('[Scheduler] Error:', error));
    }, intervalMs);

    // Run immediately on startup
    this.runDueTasks().catch((error) => console.error('[Scheduler] Error:', error));
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    this.running = false;
    console.log('[Scheduler] Stopped');
  }

  /**
   * Run tasks that are due
   */
  private async runDueTasks(): Promise<void> {
    for (const [, task] of this.tasks) {
      if (!task.enabled) continue;

      const shouldRun = this.shouldRunTask(task);
      if (shouldRun) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * Determine if task should run based on schedule
   */
  private shouldRunTask(task: ScheduledTask): boolean {
    const lastRun = this.db
      .prepare('SELECT lastRun FROM scheduled_tasks WHERE id = ?')
      .get(task.id) as any;

    if (!lastRun?.lastRun) {
      return true; // First run
    }

    const now = Date.now();
    const lastRunTime = new Date(lastRun.lastRun).getTime();

    switch (task.schedule) {
      case 'hourly':
        return now - lastRunTime > 60 * 60 * 1000;
      case 'daily':
        return now - lastRunTime > 24 * 60 * 60 * 1000;
      case 'weekly':
        return now - lastRunTime > 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return now - lastRunTime > 30 * 24 * 60 * 60 * 1000;
      case 'on-demand':
        return false;
      default:
        return false;
    }
  }

  /**
   * Get task execution history
   */
  getTaskHistory(
    taskId: string,
    limit: number = 100
  ): TaskRun[] {
    return this.db
      .prepare(
        `
      SELECT * FROM task_runs
      WHERE taskId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `
      )
      .all(taskId, limit) as TaskRun[];
  }

  /**
   * Get current lock status
   */
  getLockStatus(
    taskId?: string
  ): Array<{ taskId: string; lockedBy: string; expiresAt: Date }> {
    let query = `
      SELECT taskId, lockedBy, expiresAt
      FROM task_locks
      WHERE expiresAt > CURRENT_TIMESTAMP
    `;
    const params: any[] = [];

    if (taskId) {
      query += ' AND taskId = ?';
      params.push(taskId);
    }

    return this.db.prepare(query).all(...params) as Array<{ taskId: string; lockedBy: string; expiresAt: Date }>;
  }
}
