import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError } from '../src/lib/apiError';

/**
 * Base service class for common CRUD operations
 * Reduces code duplication across services
 */
export abstract class BaseService {
  constructor(protected db: Database.Database) {}

  /**
   * Find a record by ID
   */
  protected findById<T extends Record<string, any>>(table: string, id: string): T | null {
    const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
    return (stmt.get(id) as T | undefined) ?? null;
  }

  /**
   * Find multiple records with optional filters
   */
  protected findMany<T extends Record<string, any>>(
    table: string,
    where?: Record<string, any>,
    limit?: number,
    offset?: number
  ): T[] {
    let query = `SELECT * FROM ${table}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      query += ` WHERE ${conditions}`;
    }

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset) {
      query += ` OFFSET ?`;
      params.push(offset);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as T[];
  }

  /**
   * Find first record matching criteria
   */
  protected findOne<T extends Record<string, any>>(
    table: string,
    where: Record<string, any>
  ): T | null {
    const results = this.findMany<T>(table, where, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Create a new record
   */
  protected create<T extends Record<string, any>>(
    table: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): T {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const keys = Object.keys(record);
    const values = Object.values(record);
    const placeholders = keys.map(() => '?').join(',');

    const stmt = this.db.prepare(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`
    );
    stmt.run(...values);

    return record as T;
  }

  /**
   * Update a record
   */
  protected update<T extends Record<string, any>>(
    table: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt'>>
  ): T {
    const existing = this.findById(table, id);
    if (!existing) {
      throw new NotFoundError(`Record in ${table}`);
    }

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const keys = Object.keys(updateData);
    const setClause = keys.map((key) => `${key} = ?`).join(',');
    const values = Object.values(updateData);

    const stmt = this.db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);

    return { ...existing, ...updateData } as T;
  }

  /**
   * Delete a record
   */
  protected delete(table: string, id: string): boolean {
    const existing = this.findById(table, id);
    if (!existing) {
      throw new NotFoundError(`Record in ${table}`);
    }

    const stmt = this.db.prepare(`DELETE FROM ${table} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Count records
   */
  protected count(table: string, where?: Record<string, any>): number {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      query += ` WHERE ${conditions}`;
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Execute a raw query
   */
  protected raw<T extends Record<string, any>>(query: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute transaction
   */
  protected transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}
