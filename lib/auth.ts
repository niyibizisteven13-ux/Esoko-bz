import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';

// Assuming db is imported from db.ts
import db from '../db.ts';
import { JWT_SECRET_KEY } from '../server.ts'; // Need to export from server.ts

// Cookie options
const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createToken(user: any) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET_KEY, {
    expiresIn: '15m',
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('nexus_auth_token', accessCookieOptions);
  res.clearCookie('nexus_refresh_token', refreshCookieOptions);
}

export function issueAuthCookies(req: Request, res: Response, user: any) {
  const accessToken = createToken(user);
  const refreshSession = createRefreshSession(user.id, req);
  res.cookie('nexus_auth_token', accessToken, accessCookieOptions);
  res.cookie('nexus_refresh_token', refreshSession.token, refreshCookieOptions);
  return { accessToken };
}

function createRefreshSession(userId: string, req: Request) {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `
    INSERT INTO refresh_tokens (id, userId, tokenHash, expiresAt, createdAt, userAgent, ipAddress)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
  `
  ).run(uuidv4(), userId, tokenHash, expiresAt, req.get('User-Agent') || '', req.ip || '');

  return { token };
}

export function consumeRefreshToken(refreshToken: string | undefined, req: Request, res: Response) {
  if (!refreshToken) return null;

  const tokenHash = hashToken(refreshToken);
  const row = db
    .prepare(
      `
    SELECT rt.*, u.*
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.userId
    WHERE rt.tokenHash = ? AND rt.revokedAt IS NULL AND rt.expiresAt > CURRENT_TIMESTAMP
  `
    )
    .get(tokenHash) as any;

  if (!row) return null;

  // Rotate refresh token
  db.prepare(
    `
    UPDATE refresh_tokens
    SET revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE tokenHash = ?
  `
  ).run(tokenHash);

  const newRefreshSession = createRefreshSession(row.userId, req);
  const accessToken = createToken(row);

  res.cookie('nexus_auth_token', accessToken, accessCookieOptions);
  res.cookie('nexus_refresh_token', newRefreshSession.token, refreshCookieOptions);

  return { user: row, accessToken };
}

export function publicUser(user: any) {
  const { password, metadata, ...safe } = user;
  return {
    ...safe,
    passwordSet: Boolean(password),
    passwordLastUpdated: user.updatedAt || null,
    lastLogin: metadata?.lastLogin || null,
  };
}

export function revokeUserRefreshSessions(userId: string) {
  db.prepare(
    `
    UPDATE refresh_tokens
    SET revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ? AND revokedAt IS NULL
  `
  ).run(userId);
}

// Other auth functions like createLoginAlertRecord, etc., would go here
