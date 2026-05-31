import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../lib/middleware.ts';
import { LoginSchema, RegisterSchema } from '../src/lib/validation.ts';
import { authenticate } from '../lib/authMiddleware.ts';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  issueAuthCookies,
  clearAuthCookies,
  consumeRefreshToken,
  publicUser,
  revokeUserRefreshSessions,
  createLoginAlertRecord,
  sendLoginAlertEmail,
  processLoginAlertAction,
  appBaseUrl,
  sendEmailVerificationEmail,
  findVerificationToken,
  validateVerificationTokenRow,
  completeVerification,
  logSystem,
} from '../server.ts'; // Temporarily import from server.ts
import db from '../db.ts';
import type { Request, Response } from 'express';

const router = express.Router();

router.post('/register', validateRequest(RegisterSchema), async (req: any, res): Promise<any> => {
  try {
    const {
      email,
      name,
      password,
      role = 'customer',
      phone,
      businessName,
      businessCategory,
      location,
      tin,
    } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.toLowerCase();

    if (!['customer', 'trader', 'agent'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = hashPassword(password);
    const id = uuidv4();
    const appNumber = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const onboardingComplete = normalizedRole === 'agent' ? 1 : 0;
    const loyaltyPoints = 0;

    const insertUser = db.prepare(`
      INSERT INTO users (
        id, email, name, password, role, phone, businessName, businessCategory, location, tin,
        appNumber, onboardingComplete, loyaltyPoints, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    insertUser.run(
      id,
      normalizedEmail,
      name,
      hashedPassword,
      normalizedRole,
      phone || null,
      businessName || null,
      businessCategory || null,
      location || null,
      tin || null,
      appNumber,
      onboardingComplete,
      loyaltyPoints
    );

    // Additional setup like survey responses, loyalty points, notifications
    // Omitted for brevity

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const { accessToken } = issueAuthCookies(req, res, user);
    const publicUserData = publicUser(user);
    const redirectTo = onboardingComplete ? `/${normalizedRole}` : '/onboarding';

    logSystem(`New ${normalizedRole} registered: ${normalizedEmail}`, 'info', 'auth', id);

    // Send verification email asynchronously
    void (async () => {
      try {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(verificationToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const verificationUrl = `${appBaseUrl(req)}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(normalizedEmail)}`;

        db.prepare(
          `
          INSERT INTO email_verification_tokens (id, userId, tokenHash, expiresAt, createdAt)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `
        ).run(uuidv4(), id, tokenHash, expiresAt);

        await sendEmailVerificationEmail(req, user, verificationUrl);
        logSystem(`Registration verification email sent to ${normalizedEmail}`, 'info', 'auth', id);
      } catch (emailError) {
        console.error('Failed to send registration verification email:', emailError);
        logSystem(
          `Failed to send registration verification email to ${normalizedEmail}`,
          'warn',
          'email',
          id
        );
      }
    })();

    res.json({
      success: true,
      user: publicUserData,
      token: accessToken,
      role: normalizedRole,
      onboardingComplete: Boolean(onboardingComplete),
      redirectTo,
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email or app number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', validateRequest(LoginSchema), (req: any, res): any => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user || !verifyPassword(password, user.password)) {
      logSystem(`Failed login attempt for ${email}`, 'warn', 'auth');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      logSystem(`Suspended user login blocked for ${email}`, 'warn', 'auth', user.id);
      return res
        .status(403)
        .json({ error: 'Account suspended. Contact support to restore access.' });
    }

    if (!user.password.startsWith('scrypt:')) {
      db.prepare('UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
        hashPassword(password),
        user.id
      );
      revokeUserRefreshSessions(user.id);
    }

    const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
    const { accessToken } = issueAuthCookies(req, res, freshUser);
    const publicUserData = publicUser(freshUser);
    const redirectTo = freshUser.onboardingComplete ? `/${freshUser.role}` : '/onboarding';

    logSystem(`Successful login for ${email}`, 'info', 'auth', user.id);

    const { token: loginAlertToken } = createLoginAlertRecord(freshUser, req);
    void sendLoginAlertEmail(req, freshUser, loginAlertToken).catch((emailError) => {
      console.error('Login alert email failed:', emailError);
      logSystem(
        `Login alert email failed for ${freshUser.email}: ${String(emailError?.message || emailError)}`,
        'error',
        'email',
        freshUser.id
      );
    });

    res.json({
      success: true,
      user: publicUserData,
      token: accessToken,
      role: freshUser.role,
      onboardingComplete: Boolean(freshUser.onboardingComplete),
      redirectTo,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/login-alert/confirm', async (req: any, res): Promise<any> => {
  return processLoginAlertAction(req, res, 'confirm');
});

router.get('/login-alert/decline', async (req: any, res): Promise<any> => {
  return processLoginAlertAction(req, res, 'decline');
});

router.post('/refresh', (req: any, res): any => {
  const refreshed = consumeRefreshToken(req.cookies.nexus_refresh_token, req, res);
  if (!refreshed?.user) {
    return res.status(401).json({ error: 'Refresh session expired' });
  }

  res.json({ success: true, user: publicUser(refreshed.user), token: refreshed.accessToken });
});

router.post('/logout', (req: any, res) => {
  const refreshToken = req.cookies.nexus_refresh_token;
  if (refreshToken) {
    db.prepare(
      `
      UPDATE refresh_tokens
      SET revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
      WHERE tokenHash = ? AND revokedAt IS NULL
    `
    ).run(hashToken(refreshToken));
  }
  clearAuthCookies(res);
  res.json({ success: true });
});

router.get('/me', authenticate, (req: any, res): any => {
  res.json({ success: true, user: publicUser(req.user) });
});

// Add more auth routes like password reset, email verification

export default router;
