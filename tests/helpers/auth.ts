/**
 * Auth test helpers - create test users and sessions
 */

import type { Application } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import db from '../../db';

export interface TestUser {
  id: string;
  email: string;
  role: string;
  token: string;
}

export async function createTestUser(
  app: Application,
  options?: { role?: string; email?: string }
): Promise<TestUser> {
  const email = options?.email || `test-user-${uuidv4()}@test.local`;
  const role = options?.role || 'customer';
  const password = 'Test1234!';
  const appNumber = `APP-${uuidv4().slice(0, 8)}`;

  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    db.prepare(
      `UPDATE users SET name = ?, password = ?, role = ?, status = 'active', verificationStatus = 'verified', walletBalance = 0, appNumber = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      `${role.charAt(0).toUpperCase() + role.slice(1)} Test`,
      password,
      role,
      appNumber,
      userId
    );
  } else {
    userId = uuidv4();
    db.prepare(
      `INSERT INTO users (id, email, name, password, role, status, verificationStatus, walletBalance, appNumber, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'active', 'verified', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(userId, email, `${role.charAt(0).toUpperCase() + role.slice(1)} Test`, password, role, appNumber);
  }

  const secret = process.env.JWT_SECRET || process.env.DEV_JWT_SECRET || 'test-secret';
  const token = jwt.sign({ userId, email, role }, secret, { expiresIn: '1h' });

  return {
    id: userId,
    email,
    role,
    token,
  };
}

export async function createTestSession(app: Application, user: TestUser): Promise<string> {
  return user.token;
}
