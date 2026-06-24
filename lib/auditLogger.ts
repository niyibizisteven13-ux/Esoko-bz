/**
 * Structured Audit Logging & Observability
 *
 * Records all critical actions in a structured format for:
 * - Security audit trails (who did what, when)
 * - Compliance (regulatory requirements)
 * - Debugging and troubleshooting
 * - Metrics and alerting (unusual patterns)
 *
 * Log structure:
 * {
 *   id: UUID,
 *   timestamp: ISO 8601,
 *   userId: string,
 *   action: string (e.g., 'wallet.deposit', 'admin.user_update', 'auth.login_failed'),
 *   resourceType: string,
 *   resourceId: string,
 *   status: 'success' | 'failure' | 'denied',
 *   ipAddress: string,
 *   userAgent: string,
 *   details: object,
 *   errorMessage?: string,
 * }
 *
 * Usage:
 * auditLog.record({
 *   userId,
 *   action: 'wallet.deposit',
 *   resourceType: 'wallet',
 *   resourceId: walletId,
 *   status: 'success',
 *   details: { amount, method, fee },
 *   ipAddress: req.ip,
 *   userAgent: req.get('User-Agent'),
 * });
 */

import type Database from 'better-sqlite3';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status: 'success' | 'failure' | 'denied';
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Audit Logger
 * Provides structured logging for all critical actions
 */
export class AuditLogger {
  private db: Database.Database;
  private environment: string;

  constructor(db: Database.Database, environment: string = 'development') {
    this.db = db;
    this.environment = environment;
  }

  /**
   * Record an audit log entry
   */
  record(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    try {
      const id = uuidv4();
      const timestamp = new Date();

      // Log to console in development
      if (this.environment === 'development') {
        console.log(`[AUDIT] ${entry.action}`, {
          userId: entry.userId,
          status: entry.status,
          resource: entry.resourceType ? `${entry.resourceType}/${entry.resourceId}` : undefined,
          details: entry.details,
        });
      }

      // Persist to database
      this.db
        .prepare(
          `
        INSERT INTO audit_logs (
          id, userId, action, resource_type, resource_id, status,
          ip_address, user_agent, details, error_message, createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          id,
          entry.userId || null,
          entry.action,
          entry.resourceType || null,
          entry.resourceId || null,
          entry.status,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.errorMessage || null,
          timestamp.toISOString()
        );
    } catch (error) {
      console.error('Failed to record audit log:', error);
    }
  }

  /**
   * Auth-related audit logs
   */
  recordAuthEvent(
    userId: string | undefined,
    action: 'login' | 'login_failed' | 'logout' | 'otp_requested' | 'otp_verified',
    status: 'success' | 'failure' | 'denied',
    req: Request,
    details?: any
  ): void {
    this.record({
      userId,
      action: `auth.${action}`,
      resourceType: 'auth',
      resourceId: userId,
      status,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
    });
  }

  /**
   * Wallet-related audit logs
   */
  recordWalletEvent(
    userId: string,
    action: 'deposit' | 'withdraw' | 'transfer' | 'balance_check',
    status: 'success' | 'failure' | 'denied',
    req: Request,
    details?: any
  ): void {
    this.record({
      userId,
      action: `wallet.${action}`,
      resourceType: 'wallet',
      resourceId: userId,
      status,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
    });
  }

  /**
   * Admin action audit logs
   */
  recordAdminEvent(
    adminId: string,
    action: 'user_update' | 'user_verify' | 'user_delete' | 'role_change' | 'wallet_adjustment',
    resourceType: string,
    resourceId: string,
    status: 'success' | 'failure' | 'denied',
    req: Request,
    details?: any
  ): void {
    this.record({
      userId: adminId,
      action: `admin.${action}`,
      resourceType,
      resourceId,
      status,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
    });
  }

  /**
   * Permission denied audit logs
   */
  recordPermissionDenied(
    userId: string | undefined,
    action: string,
    req: Request,
    reason?: string
  ): void {
    this.record({
      userId,
      action: `${action}.permission_denied`,
      status: 'denied',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { reason },
    });
  }

  /**
   * Suspicious activity audit logs
   */
  recordSuspiciousActivity(
    userId: string | undefined,
    activityType: 'excessive_failed_logins' | 'excessive_otp_attempts' | 'unusual_transfer' | 'rate_limit_exceeded',
    req: Request,
    details?: any
  ): void {
    this.record({
      userId,
      action: `security.${activityType}`,
      status: 'denied',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
    });
  }

  /**
   * Query audit logs
   */
  queryLogs(options: {
    userId?: string;
    action?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): AuditLogEntry[] {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (options.userId) {
      query += ' AND userId = ?';
      params.push(options.userId);
    }

    if (options.action) {
      query += ' AND action = ?';
      params.push(options.action);
    }

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY createdAt DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.db.prepare(query).all(...params) as AuditLogEntry[];
  }
}

/**
 * Metrics collector for alerting
 * Tracks anomalies and patterns for security alerts
 */
export class MetricsCollector {
  private db: Database.Database;
  private alertThresholds: {
    failedLoginAttemptsPerHour: number;
    otpAttemptsPerHour: number;
  };

  constructor(
    db: Database.Database,
    alertThresholds?: {
      failedLoginAttemptsPerHour?: number;
      otpAttemptsPerHour?: number;
    }
  ) {
    this.db = db;
    this.alertThresholds = {
      failedLoginAttemptsPerHour: alertThresholds?.failedLoginAttemptsPerHour || 5,
      otpAttemptsPerHour: alertThresholds?.otpAttemptsPerHour || 10,
    };
  }

  /**
   * Check for excessive failed login attempts
   */
  checkFailedLoginAttempts(userId: string): { exceed: boolean; count: number } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const result = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM audit_logs
      WHERE userId = ? AND action = 'auth.login_failed' AND createdAt > ?
    `
      )
      .get(userId, oneHourAgo) as any;

    const count = result?.count || 0;
    return {
      exceed: count >= this.alertThresholds.failedLoginAttemptsPerHour,
      count,
    };
  }

  /**
   * Check for excessive OTP attempts
   */
  checkOtpAttempts(userId: string): { exceed: boolean; count: number } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const result = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM audit_logs
      WHERE userId = ? AND action LIKE 'auth.otp%' AND createdAt > ?
    `
      )
      .get(userId, oneHourAgo) as any;

    const count = result?.count || 0;
    return {
      exceed: count >= this.alertThresholds.otpAttemptsPerHour,
      count,
    };
  }

  /**
   * Get audit summary for a user (for dashboard)
   */
  getUserAuditSummary(
    userId: string,
    hoursBack: number = 24
  ): {
    totalActions: number;
    failedLogins: number;
    walletOperations: number;
    adminActions: number;
    suspiciousActivities: number;
  } {
    const timeAgo = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const result = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN action = 'auth.login_failed' THEN 1 ELSE 0 END) as failed_logins,
        SUM(CASE WHEN action LIKE 'wallet.%' THEN 1 ELSE 0 END) as wallet_ops,
        SUM(CASE WHEN action LIKE 'admin.%' THEN 1 ELSE 0 END) as admin_ops,
        SUM(CASE WHEN action LIKE 'security.%' THEN 1 ELSE 0 END) as suspicious
      FROM audit_logs
      WHERE userId = ? AND createdAt > ?
    `
      )
      .get(userId, timeAgo) as any;

    return {
      totalActions: result?.total || 0,
      failedLogins: result?.failed_logins || 0,
      walletOperations: result?.wallet_ops || 0,
      adminActions: result?.admin_ops || 0,
      suspiciousActivities: result?.suspicious || 0,
    };
  }
}
