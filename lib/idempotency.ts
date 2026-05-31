import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Response } from 'express';

export interface IdempotencyStore {
  getResponse: (
    userId: string,
    key: string,
    route: string
  ) =>
    | { found: false }
    | {
        found: true;
        response: unknown;
        statusCode: number;
      };
  keyFromRequest: (req: any) => string;
  requireKey: (req: any, res: Response) => string | null;
  saveResponse: (userId: string, key: string, route: string, response: unknown) => void;
}

export function createIdempotencyStore(db: Database.Database, isProduction: boolean): IdempotencyStore {
  const keyFromRequest = (req: any) =>
    String(
      req.header('Idempotency-Key') || req.body?.idempotencyKey || req.body?.reference || ''
    ).trim();

  return {
    keyFromRequest,

    requireKey(req: any, res: Response) {
      const key = keyFromRequest(req);
      if (isProduction && !key) {
        res.status(400).json({
          error: 'Idempotency-Key header is required for this money-moving request',
        });
        return null;
      }
      return key;
    },

    getResponse(userId: string, key: string, route: string) {
      if (!key) return { found: false };
      const row = db
        .prepare('SELECT route, response FROM idempotency_keys WHERE userId = ? AND key = ?')
        .get(userId, key) as any;
      if (!row?.response) return { found: false };
      if (row.route !== route) {
        return {
          found: true,
          statusCode: 409,
          response: { error: 'Idempotency-Key was already used for a different route' },
        };
      }

      try {
        return { found: true, statusCode: 200, response: JSON.parse(row.response) };
      } catch {
        return { found: false };
      }
    },

    saveResponse(userId: string, key: string, route: string, response: unknown) {
      if (!key) return;
      db.prepare(
        `
        INSERT OR IGNORE INTO idempotency_keys (id, userId, key, route, response, createdAt)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
      ).run(uuidv4(), userId, key, route, JSON.stringify(response));
    },
  };
}
