import crypto from 'crypto';
import express from 'express';
import nodemailer from 'nodemailer';
import fs from 'fs';
import net from 'net';
import dns from 'dns';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import initializeDatabase from './db.ts';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import https from 'https';
import { loadAppConfig } from './lib/env.ts';
import { createIdempotencyStore } from './lib/idempotency.ts';
import { errorHandler, validateRequest } from './lib/middleware.ts';
import { createAuthMiddleware } from './lib/authMiddleware.ts';
import { createOriginGuard, isTrustedDynamicPublicOrigin } from './lib/originGuard.ts';
import { createRevenueService } from './lib/revenueService.ts';
import { normalizeRole } from './lib/roles.ts';
import { hashPassword, hashToken, verifyPassword } from './lib/security.ts';
import {
  bootstrapSqliteAccountsFromPostgres,
  deleteProductFromPostgres,
  hydrateSqliteUserFromPostgres,
  isPostgresAccountStoreEnabled,
  mirrorAccountToPostgres,
  mirrorProductToPostgres,
  mirrorUserAccountsToPostgres,
  mirrorUserToPostgres,
  mirrorVerificationDocumentToPostgres,
  mirrorVerificationRequestToPostgres,
} from './lib/postgresAccountStore.ts';
import { LoginSchema, RegisterSchema } from './src/lib/validation.ts';
import type { Request, Response, NextFunction, CookieOptions } from 'express';
import type { Server } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const env = process.env as unknown as Record<string, string | undefined>;
const config = loadAppConfig(__dirname);
const isProduction = config.isProduction;
const FRONTEND_URLS = config.frontendUrls;
const SMTP_USER = config.smtp.user;
const SMTP_PASS = config.smtp.pass;
const SMTP_HOST = config.smtp.host;
const configuredSmtpPort = config.smtp.port;
const SMTP_FROM = config.smtp.from;
const configuredSmtpSecure = config.smtp.secure;
const RESEND_API_KEY = env.RESEND_API_KEY || '';
const RESEND_FROM = env.RESEND_FROM || SMTP_FROM;
const shouldUseGmailStartTls =
  SMTP_HOST === 'smtp.gmail.com' && configuredSmtpPort === 465 && configuredSmtpSecure === false;
const SMTP_PORT = shouldUseGmailStartTls ? 587 : configuredSmtpPort;
const SMTP_SECURE = shouldUseGmailStartTls ? false : SMTP_PORT === 465 ? true : configuredSmtpSecure;
const JWT_SECRET = config.jwtSecret;

dns.setDefaultResultOrder('ipv4first');

const emailTransporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  family: Number(env.SMTP_FAMILY || 4),
  lookup: (hostname: string, options: any, callback: any) => {
    dns.lookup(hostname, { ...options, family: Number(env.SMTP_FAMILY || 4), all: false }, callback);
  },
  tls: {
    servername: SMTP_HOST,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
} as any);

async function sendAppEmail(mailOptions: {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  [key: string]: any;
}) {
  const sendViaSmtp = async () => {
    if (!SMTP_USER || !SMTP_PASS) {
      throw new Error('SMTP is not configured');
    }

    return emailTransporter.sendMail({
      ...mailOptions,
      from: SMTP_FROM || mailOptions.from,
    });
  };

  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM || mailOptions.from,
          to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message || payload?.error || `Resend API failed: ${response.status}`
        );
      }
      return payload;
    } catch (resendError: any) {
      if (!SMTP_USER || !SMTP_PASS) throw resendError;
      console.warn(
        `Resend email failed; falling back to SMTP: ${resendError.message || resendError}`
      );
      try {
        return await sendViaSmtp();
      } catch (smtpError: any) {
        throw new Error(
          `Resend failed: ${resendError.message || resendError}; SMTP failed: ${
            smtpError.message || smtpError
          }`
        );
      }
    }
  }

  return sendViaSmtp();
}

const db = initializeDatabase();
const accountStoreBackend = isPostgresAccountStoreEnabled() ? 'sqlite+postgres-accounts' : 'sqlite';

function mirrorAccountState(userId: string) {
  void mirrorUserAccountsToPostgres(db as any, userId).catch((error) => {
    console.error('Postgres account mirror failed:', error);
  });
}

void bootstrapSqliteAccountsFromPostgres(db as any)
  .then((result) => {
    if (result.users || result.accounts) {
      console.log(
        `Postgres bootstrap restored ${result.users} users, ${result.accounts} account modes, ${result.products || 0} products, ${result.verificationRequests || 0} verification requests, and ${result.verificationDocuments || 0} verification documents`
      );
    }
  })
  .catch((error) => {
    if (isPostgresAccountStoreEnabled()) {
      console.error('Postgres account bootstrap failed:', error);
    }
  });
const {
  adjustRevenueAccount,
  recordLedgerEntry,
  recordTransactionFee,
  recordWalletLiabilityChange,
} = createRevenueService(db);
const LOYALTY_POINT_RWF_VALUE = 0.2;
const idempotency = createIdempotencyStore(db, isProduction);
const app = express();
const port = config.port;
const LOAN_WHATSAPP_NUMBER = env.LOAN_WHATSAPP_NUMBER || '+250795806631';
const WHATSAPP_OTP_SENDER = env.WHATSAPP_OTP_SENDER || env.VITE_SUPPORT_WHATSAPP || '+250795806631';
const WHATSAPP_OTP_PROVIDER_URL = env.WHATSAPP_OTP_PROVIDER_URL || '';
const WHATSAPP_OTP_PROVIDER_TOKEN = env.WHATSAPP_OTP_PROVIDER_TOKEN || '';
let activeServer: Server | null = null;
let isShuttingDown = false;
let loanReminderInterval: NodeJS.Timeout | null = null;
const RAW_JWT_SECRET_KEY = JWT_SECRET || config.devJwtSecret;
if (!RAW_JWT_SECRET_KEY) {
  throw new Error('Missing JWT_SECRET. For local development only, set DEV_JWT_SECRET explicitly.');
}
const JWT_SECRET_KEY: string = RAW_JWT_SECRET_KEY;

const accessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: config.cookieSameSite,
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: config.cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const teamAccessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: config.cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const accountModeCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: config.cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const liveSyncClients = new Map<string, Response>();

function inferCollectionFromPath(pathname: string) {
  const match = pathname.match(/^\/api\/([^/?]+)/);
  return match?.[1] || 'api';
}

function publishLiveSync(payload: Record<string, any>) {
  const eventPayload = {
    id: uuidv4(),
    type: 'mutation',
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const data = `event: sync\ndata: ${JSON.stringify(eventPayload)}\n\n`;
  for (const [clientId, client] of liveSyncClients) {
    try {
      client.write(data);
    } catch {
      liveSyncClients.delete(clientId);
    }
  }
}

function createNotificationForUser(input: {
  userId: string;
  title?: string | null;
  message: string;
  type?: string;
  subType?: string;
  metadata?: Record<string, any> | null;
}) {
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO notifications (id, userId, title, message, type, subType, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    input.userId,
    input.title || null,
    input.message,
    input.type || 'info',
    input.subType || 'system',
    input.metadata ? JSON.stringify(input.metadata) : null
  );
  publishLiveSync({
    method: 'POST',
    path: '/api/notifications',
    collection: 'notifications',
    actorUserId: input.userId,
    notificationId: id,
  });
  return id;
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

const corsOptions = {
  origin: isProduction
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const appOrigin = config.appUrl ? new URL(config.appUrl).origin : '';
        if (
          !origin ||
          FRONTEND_URLS.includes(origin) ||
          origin === appOrigin ||
          isTrustedDynamicPublicOrigin(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Access-Token',
    'X-Auth-Token',
    'Idempotency-Key',
  ],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(
  '/api',
  createOriginGuard({
    isProduction,
    frontendUrls: FRONTEND_URLS,
    appUrl: config.appUrl,
    port,
  })
);

const uploadDir = path.resolve(env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${uuidv4()}${ext || ''}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxBytes },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/ogg',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

app.get('/uploads/:filename', (req, res): any => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!filename || !isPublicUpload(filename)) {
    return res.status(403).json({ error: 'This upload requires authenticated access' });
  }
  res.setHeader('Cache-Control', isProduction ? 'public, max-age=604800' : 'no-cache');
  sendUploadFile(res, filename);
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...(isProduction ? [] : ["'unsafe-inline'"])],
        styleSrc: ["'self'", ...(isProduction ? [] : ["'unsafe-inline'"])],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'https:',
          ...(isProduction ? [] : ['http://localhost:5173']),
        ],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/events') return;
    const duration = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';
    console[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Remove the duplicate declaration
const limiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs in production
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req: Request, res: Response, next: NextFunction) => next(); // No limit in development
app.use('/api/', limiter);

// Stricter limiter for auth endpoints (only in production)
const authLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 auth requests per windowMs
      message: 'Too many authentication attempts, please try again later.',
    })
  : (req: Request, res: Response, next: NextFunction) => next(); // No limit in development
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const adminOtpLimiter = isProduction
  ? rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 5,
      message: 'Too many verification attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req: Request, res: Response, next: NextFunction) => next();

function createToken(user: any) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      activeAccountId: user.activeAccountId || null,
      activeRole: user.activeRole || user.role,
    },
    JWT_SECRET_KEY,
    {
      expiresIn: '15m',
    }
  );
}

function createRefreshSession(user: any, req?: Request) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `
    INSERT INTO refresh_tokens (id, userId, tokenHash, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    tokenId,
    user.id,
    hashToken(rawToken),
    expiresAt,
    req?.ip || null,
    req?.headers['user-agent'] || null
  );

  return { token: rawToken, tokenId, expiresAt };
}

function clearAuthCookies(res: Response) {
  res.clearCookie('nexus_auth_token', accessCookieOptions);
  res.clearCookie('nexus_refresh_token', refreshCookieOptions);
  res.clearCookie('nexus_team_access', teamAccessCookieOptions);
  res.clearCookie('nexus_account_mode', accountModeCookieOptions);
}

function issueAuthCookies(req: Request, res: Response, user: any) {
  const accessToken = createToken(user);
  const refreshSession = createRefreshSession(user, req);
  res.cookie('nexus_auth_token', accessToken, accessCookieOptions);
  res.cookie('nexus_refresh_token', refreshSession.token, refreshCookieOptions);
  return { accessToken, refreshTokenId: refreshSession.tokenId };
}

function revokeUserRefreshSessions(userId: string) {
  db.prepare(
    `
    UPDATE refresh_tokens
    SET revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ? AND revokedAt IS NULL
  `
  ).run(userId);
}

function consumeRefreshToken(rawRefreshToken: string | undefined, req: Request, res: Response) {
  if (!rawRefreshToken) return null;

  const row = db
    .prepare(
      `
    SELECT rt.id as refreshTokenId, rt.userId as refreshUserId, rt.tokenHash, rt.expiresAt,
           rt.revokedAt, rt.replacedByTokenId, rt.ipAddress, rt.userAgent, rt.createdAt as refreshCreatedAt,
           u.*
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.userId
    WHERE rt.tokenHash = ?
  `
    )
    .get(hashToken(rawRefreshToken)) as any;

  if (!row || row.revokedAt || new Date(row.expiresAt).getTime() < Date.now()) {
    clearAuthCookies(res);
    return null;
  }

  if (row.status === 'suspended') {
    clearAuthCookies(res);
    return null;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.userId) as any;
  if (!user) {
    clearAuthCookies(res);
    return null;
  }

  const accessToken = createToken(user);
  const nextRefreshSession = createRefreshSession(user, req);
  db.prepare(
    `
    UPDATE refresh_tokens
    SET revokedAt = CURRENT_TIMESTAMP, replacedByTokenId = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(nextRefreshSession.tokenId, row.refreshTokenId);

  res.cookie('nexus_auth_token', accessToken, accessCookieOptions);
  res.cookie('nexus_refresh_token', nextRefreshSession.token, refreshCookieOptions);
  return { user, accessToken };
}

function publicUser(user: any) {
  if (!user) return null;
  const { password, metadata, ...safe } = user;
  let metadataFields: Record<string, any> = {};
  if (metadata) {
    try {
      metadataFields = JSON.parse(metadata);
    } catch {
      metadataFields = {};
    }
  }

  return {
    ...metadataFields,
    ...safe,
    uid: user.id,
    displayName: user.name,
    onboardingComplete: Boolean(user.onboardingComplete),
    biometricEnabled: Boolean(user.biometricEnabled ?? metadataFields.biometricEnabled),
    maintenanceMode: Boolean(user.maintenanceMode),
    emailVerified: Boolean(user.emailVerified),
    termsAcceptedAt: user.termsAcceptedAt || null,
  };
}

function publicDirectoryUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    uid: user.id,
    name: user.name,
    displayName: user.name,
    role: user.role,
    businessName: user.businessName || null,
    businessCategory: user.businessCategory || user.category || null,
    category: user.category || null,
    verificationStatus: user.verificationStatus || 'pending',
    tier: user.tier || 'free',
    profilePhoto: user.profilePhoto || null,
    location: user.location || null,
  };
}

function canManageUsers(user: any) {
  return ['admin', 'manager'].includes(user?.role);
}

function stableHash(value: string) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function maskSensitive(value: string) {
  const clean = value.trim();
  if (clean.length <= 4) return '*'.repeat(clean.length);
  return `${clean.slice(0, 2)}${'*'.repeat(Math.max(4, clean.length - 6))}${clean.slice(-4)}`;
}

function uploadFilenameFromUrl(fileUrl: string) {
  if (!fileUrl || (!fileUrl.startsWith('/uploads/') && !fileUrl.startsWith('/api/uploads/'))) {
    return null;
  }
  return path.basename(fileUrl);
}

function localUploadPath(fileUrl: string) {
  const filename = uploadFilenameFromUrl(fileUrl);
  if (!filename) return null;
  return path.join(uploadDir, filename);
}

function isPublicUpload(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg'].includes(ext);
}

function userCanAccessUpload(req: any, filename: string) {
  if (canManageUsers(req.user)) return true;
  const publicPath = `/uploads/${filename}`;
  const privatePath = `/api/uploads/${filename}`;
  const row = db
    .prepare(
      `
      SELECT id FROM verification_documents
      WHERE (fileUrl = ? OR fileUrl = ?) AND userId = ?
      LIMIT 1
    `
    )
    .get(publicPath, privatePath, req.user.id) as any;
  return Boolean(row);
}

function privateUploadUrl(filenameOrUrl: string) {
  const filename = uploadFilenameFromUrl(filenameOrUrl) || path.basename(filenameOrUrl);
  return `/api/uploads/${filename}`;
}

function publicUploadUrl(filename: string) {
  return `/uploads/${filename}`;
}

function sendUploadFile(res: Response, filename: string) {
  const filePath = path.join(uploadDir, path.basename(filename));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(filePath);
}

function normalizeVerificationFileUrl(fileUrl: string) {
  if (!fileUrl || (!fileUrl.startsWith('/uploads/') && !fileUrl.startsWith('/api/uploads/'))) {
    return null;
  }
  const filename = uploadFilenameFromUrl(fileUrl);
  if (!filename || !fs.existsSync(path.join(uploadDir, filename))) return null;
  return privateUploadUrl(filename);
}

function fileHashForUrl(fileUrl: string) {
  const filePath = localUploadPath(fileUrl);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseMetadata(value: any) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function recordVerificationAudit(
  userId: string | null,
  verificationRequestId: string | null,
  actorId: string | null,
  action: string,
  details?: any
) {
  db.prepare(
    `
    INSERT INTO verification_audit_logs (id, userId, verificationRequestId, actorId, action, details, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    userId,
    verificationRequestId,
    actorId,
    action,
    details === undefined ? null : JSON.stringify(details)
  );
}

const ACCOUNT_VERIFIED_STATUSES = new Set([
  'verified',
  'basic_verified',
  'business_verified',
  'sector_verified',
]);

function isAccountVerifiedStatus(status?: string | null) {
  return ACCOUNT_VERIFIED_STATUSES.has(String(status || '').toLowerCase());
}

function isSameUtcDay(a?: string | null, b: Date = new Date()) {
  if (!a) return false;
  const date = new Date(a);
  if (!Number.isFinite(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

async function sendAccountVerificationEmail(
  req: any,
  user: any,
  reason: 'initial' | 'reminder' = 'initial'
) {
  if (!user?.email || isAccountVerifiedStatus(user.verificationStatus)) return false;
  if (reason === 'initial' && user.verificationEmailSentAt) return false;
  if (reason === 'reminder' && isSameUtcDay(user.verificationReminderSentAt)) return false;

  const role = normalizeRole(user.role || 'customer');
  const isTrader = role === 'trader';
  const verificationUrl = `${appBaseUrl(req)}/verify-account?role=${encodeURIComponent(role)}#documents`;
  const subject =
    reason === 'initial'
      ? isTrader
        ? 'Complete your ESOKO trader verification'
        : 'Complete your ESOKO identity verification'
      : isTrader
        ? 'Reminder: verify your ESOKO trader account'
        : 'Reminder: verify your ESOKO account';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: auto; padding: 24px; color: #1f2937;">
      <h1 style="color:#ea580c;margin-bottom:8px;">${escapeHtml(subject)}</h1>
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>
        ${
          isTrader
            ? 'Your account can be used after email verification. When you want a verified trader badge and higher customer trust, complete trader verification with your National ID or passport, business information, location, and Rwanda business licenses such as Patente, VAT/EBM, or sector-specific permits where applicable.'
            : 'Your account can be used after email verification. When you want a verified badge or higher trust limits, complete identity verification using a National ID, passport, transport license, professional license, or another accepted official document.'
        }
      </p>
      <p style="margin: 28px 0;">
        <a href="${verificationUrl}" style="background:#ea580c;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:700;">
          ${isTrader ? 'Get Trader Verified' : 'Get Verified'}
        </a>
      </p>
      <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;color:#9a3412;">
        Document upload is optional for normal account creation. Only upload documents through official ESOKO links after signing in.
      </p>
      <p style="font-size:12px;color:#6b7280;word-break:break-all;">${escapeHtml(verificationUrl)}</p>
    </div>
  `;

  try {
    await sendAppEmail({
      from: SMTP_FROM,
      to: user.email,
      subject,
      html,
      text: `${subject}\n\nOpen: ${verificationUrl}\n\nDocument upload is optional for normal account creation and only needed for a verified badge or higher trust features.`,
    });
    db.prepare(
      `
      UPDATE users
      SET verificationEmailSentAt = COALESCE(verificationEmailSentAt, ?),
          verificationReminderSentAt = CASE WHEN ? = 'reminder' THEN ? ELSE verificationReminderSentAt END,
          verificationEmailLastError = NULL,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(new Date().toISOString(), reason, new Date().toISOString(), user.id);
    logSystem(`Account verification ${reason} email sent to ${user.email}`, 'info', 'email', user.id);
    return true;
  } catch (error: any) {
    db.prepare(
      `
      UPDATE users
      SET verificationEmailLastError = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(String(error?.message || error), user.id);
    logSystem(
      `Account verification email failed for ${user.email}: ${String(error?.message || error)}`,
      'error',
      'email',
      user.id
    );
    return false;
  }
}

function createVerificationReminderNotification(user: any) {
  const existing = db
    .prepare(
      `
      SELECT id FROM notifications
      WHERE userId = ?
        AND subType = 'verification_reminder'
        AND DATE(createdAt) = DATE('now')
      LIMIT 1
    `
    )
    .get(user.id) as any;
  if (existing) return false;

  db.prepare(
    `
    INSERT INTO notifications (id, userId, title, message, type, subType, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'warning', 'verification_reminder', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    user.id,
    'Complete verification',
    user.role === 'trader'
      ? 'Complete trader verification to earn a verified badge and unlock full shop trust.'
      : 'Complete identity verification to protect your wallet and earn a verified badge.',
    JSON.stringify({ href: `/verify-account?role=${user.role || 'customer'}` })
  );
  return true;
}

async function maybeSendVerificationReminder(req: any, user: any) {
  if (!user || isAccountVerifiedStatus(user.verificationStatus)) return;
  createVerificationReminderNotification(user);
  if (!isSameUtcDay(user.verificationReminderSentAt)) {
    await sendAccountVerificationEmail(req, user, 'reminder');
  }
}

function replaceRiskFlags(userId: string, verificationRequestId: string, flags: any[]) {
  db.prepare(
    "UPDATE risk_flags SET status = 'resolved', resolvedAt = CURRENT_TIMESTAMP WHERE verificationRequestId = ? AND status = 'open'"
  ).run(verificationRequestId);

  const insert = db.prepare(
    `
    INSERT INTO risk_flags (id, userId, verificationRequestId, severity, code, message, status, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, CURRENT_TIMESTAMP)
  `
  );
  for (const flag of flags) {
    insert.run(
      uuidv4(),
      userId,
      verificationRequestId,
      flag.severity || 'medium',
      flag.code,
      flag.message,
      flag.metadata ? JSON.stringify(flag.metadata) : null
    );
  }
}

function sectorLicenseFor(category: string) {
  const text = category.toLowerCase();
  if (/(food|drug|medicine|medical|pharma|cosmetic)/.test(text)) return 'rwanda_fda';
  if (/(agri|farm|livestock|processing)/.test(text)) return 'rica';
  if (/(telecom|utility|transport|delivery|logistics|petroleum|gas|postal)/.test(text)) return 'rura';
  if (/(finance|bank|loan|lending|payment|insurance)/.test(text)) return 'bnr';
  if (/(mine|mining|quarry|mineral)/.test(text)) return 'rmb';
  if (/(tour|hotel|hospitality|travel)/.test(text)) return 'tourism_hospitality';
  return null;
}

function requiredLicenseIdsForRequest(request: any) {
  const required = new Set<string>();
  if (request.role === 'trader' || request.role === 'organization') {
    required.add('patente');
    if (request.hasVatRegistration || request.usesEbm) {
      required.add('vat_registration');
      required.add('ebm_certificate');
    }
    const sectorLicense = sectorLicenseFor(
      `${request.businessCategory || ''} ${parseMetadata(request.metadata).businessActivity || ''}`
    );
    if (sectorLicense) required.add(sectorLicense);
  }
  return Array.from(required);
}

function autoCheckDocument(document: any, request: any) {
  const metadata = parseMetadata(document.metadata);
  const haystack = [
    document.type,
    document.licenseTypeId,
    document.extractedText,
    metadata.documentText,
    metadata.licenseNumber,
    metadata.authority,
    metadata.businessName,
    metadata.tin,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const reasons: string[] = [];
  let score = 25;

  if (document.fileHash) {
    score += 15;
    const duplicate = db
      .prepare('SELECT id, userId FROM verification_documents WHERE fileHash = ? AND id != ? LIMIT 1')
      .get(document.fileHash, document.id) as any;
    if (duplicate) {
      score -= 45;
      reasons.push('Same file has already been uploaded by another verification record.');
    } else {
      reasons.push('File fingerprint is unique.');
    }
  } else {
    reasons.push('File fingerprint could not be calculated.');
  }

  const license = document.licenseTypeId
    ? (db.prepare('SELECT * FROM license_types WHERE id = ?').get(document.licenseTypeId) as any)
    : null;
  if (license) {
    score += 15;
    const expectedWords = [license.name, license.authority, license.id]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3);
    if (!metadata.documentText && expectedWords.some((word) => haystack.includes(word))) {
      score += 10;
      reasons.push('Document text/metadata matches the selected license type.');
    }
  }

  if (metadata.licenseNumber || parseMetadata(document.extractedFields).licenseNumber) {
    score += 10;
    reasons.push('License or certificate number was provided.');
  }

  if (request?.tin && haystack.includes(String(request.tin).toLowerCase())) {
    score += 15;
    reasons.push('TIN appears to match the verification form.');
  }
  if (
    request?.businessName &&
    String(request.businessName)
      .toLowerCase()
      .split(/\s+/)
      .filter((word: string) => word.length >= 3)
      .some((word: string) => haystack.includes(word))
  ) {
    score += 10;
    reasons.push('Business name appears to match the verification form.');
  }

  const expiry = document.expiryDate || metadata.expiryDate;
  if (expiry) {
    const expiryTime = new Date(expiry).getTime();
    if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
      score -= 35;
      reasons.push('Document appears expired.');
    } else {
      score += 10;
      reasons.push('Expiry date is still valid.');
    }
  } else if (license?.requiresExpiry) {
    score -= 10;
    reasons.push('Expiry date is required for this license type.');
  }

  score = Math.max(0, Math.min(100, score));
  const autoDecision = score >= 80 ? 'auto_verified' : score >= 55 ? 'needs_review' : 'rejected';
  return { score, autoDecision, reasons };
}

function recomputeVerificationRequest(requestId: string) {
  const request = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(requestId) as any;
  if (!request) return null;
  const documents = db
    .prepare('SELECT * FROM verification_documents WHERE userId = ? AND (accountId = ? OR ? = \'\')')
    .all(request.userId, request.accountId || '', request.accountId || '') as any[];
  const identity = db
    .prepare('SELECT * FROM user_identity_documents WHERE verificationRequestId = ? ORDER BY createdAt DESC LIMIT 1')
    .get(requestId) as any;
  const flags: any[] = [];
  let score = 20;

  if (request.role === 'trader' || request.role === 'organization') {
    if (documents.length === 0) {
      flags.push({
        severity: 'high',
        code: 'missing_business_proof',
        message: 'Upload one business proof document such as RDB certificate, Patente, tax certificate, license, or other official business proof.',
      });
      score = 30;
    } else {
      const documentAverage = documents.reduce((sum, doc) => sum + Number(doc.autoScore || 0), 0) / documents.length;
      score = Math.max(60, Math.min(84, Math.round(55 + documentAverage * 0.35)));
      const duplicateDoc = documents.find((doc) =>
        parseMetadata(doc.autoReasons).some((reason: string) =>
          String(reason).toLowerCase().includes('same file has already been uploaded')
        )
      );
      if (duplicateDoc) {
        flags.push({
          severity: 'high',
          code: 'duplicate_business_proof',
          message: 'The uploaded business proof appears to match a file already submitted elsewhere.',
        });
        score = Math.min(score, 50);
      }
    }

    const autoDecision = flags.some((flag) => flag.severity === 'high')
      ? 'needs_review'
      : 'needs_review';
    const riskStatus = 'pending';
    replaceRiskFlags(request.userId, requestId, flags);
    db.prepare(
      `
      UPDATE verification_requests
      SET autoScore = ?, autoDecision = ?, riskStatus = ?, status = CASE
            WHEN status = 'approved' THEN status
            WHEN ? = 0 THEN 'submitted'
            ELSE 'needs_review'
          END,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(score, autoDecision, riskStatus, documents.length, requestId);

    recordVerificationAudit(request.userId, requestId, null, 'auto_scored', {
      score,
      autoDecision,
      riskStatus,
      flags: flags.map((flag) => flag.code),
      simplifiedTraderReview: true,
    });
    return db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(requestId);
  }

  if (request.identityNumberHash) {
    score += 15;
    const duplicateIdentity = db
      .prepare(
        'SELECT userId FROM user_identity_documents WHERE identityNumberHash = ? AND userId != ? LIMIT 1'
      )
      .get(request.identityNumberHash, request.userId) as any;
    if (duplicateIdentity) {
      score -= 45;
      flags.push({
        severity: 'high',
        code: 'duplicate_identity',
        message: 'The same identity number is already connected to another account.',
      });
    }
  } else {
    flags.push({
      severity: 'medium',
      code: 'missing_identity_number',
      message: 'Identity number was not provided.',
    });
  }

  if (identity?.fileHash) score += 10;
  else {
    flags.push({
      severity: 'medium',
      code: 'missing_identity_document',
      message: 'Identity document upload is missing.',
    });
  }

  if (request.role === 'trader') {
    for (const field of ['businessName', 'businessCategory', 'businessAddress', 'district']) {
      if (request[field]) score += 4;
      else {
        flags.push({
          severity: 'medium',
          code: `missing_${field}`,
          message: `Trader verification is missing ${field}.`,
        });
      }
    }
    if (request.latitude && request.longitude) score += 8;
    else {
      flags.push({
        severity: 'low',
        code: 'missing_business_location',
        message: 'Business map location has not been set.',
      });
    }
  }

  const requiredLicenses = requiredLicenseIdsForRequest(request);
  const approvedLicenseIds = new Set(
    documents
      .filter((doc) => ['auto_verified', 'approved'].includes(doc.status) || doc.autoDecision === 'auto_verified')
      .map((doc) => doc.licenseTypeId || doc.type)
  );
  for (const licenseId of requiredLicenses) {
    if (approvedLicenseIds.has(licenseId)) {
      score += 10;
    } else {
      flags.push({
        severity: licenseId === 'patente' ? 'high' : 'medium',
        code: `missing_license_${licenseId}`,
        message: `Required license is missing: ${licenseId.replace(/_/g, ' ')}.`,
      });
    }
  }

  const documentAverage = documents.length
    ? documents.reduce((sum, doc) => sum + Number(doc.autoScore || 0), 0) / documents.length
    : 0;
  score += Math.min(25, documentAverage * 0.25);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const highFlags = flags.filter((flag) => flag.severity === 'high').length;
  const autoDecision =
    score >= 85 && highFlags === 0 ? 'auto_verified' : score >= 55 ? 'needs_review' : 'rejected';
  const riskStatus =
    autoDecision === 'auto_verified'
      ? request.role === 'trader'
        ? 'business_verified'
        : 'basic_verified'
      : autoDecision === 'rejected'
        ? 'restricted'
        : 'pending';

  replaceRiskFlags(request.userId, requestId, flags);
  db.prepare(
    `
    UPDATE verification_requests
    SET autoScore = ?, autoDecision = ?, riskStatus = ?, status = CASE
          WHEN status = 'approved' THEN status
          WHEN ? = 'auto_verified' THEN 'auto_verified'
          WHEN ? = 'rejected' THEN 'rejected'
          ELSE 'needs_review'
        END,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(score, autoDecision, riskStatus, autoDecision, autoDecision, requestId);

  if (autoDecision === 'auto_verified') {
    db.prepare(
      `
      UPDATE users
      SET verificationStatus = ?, verifiedAt = COALESCE(verifiedAt, CURRENT_TIMESTAMP), updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(riskStatus, request.userId);
    if (request.accountId) {
      db.prepare(
        `
        UPDATE user_accounts
        SET verificationStatus = ?, status = 'active', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(riskStatus, request.accountId);
    }
  }

  recordVerificationAudit(request.userId, requestId, null, 'auto_scored', {
    score,
    autoDecision,
    riskStatus,
    flags: flags.map((flag) => flag.code),
  });
  return db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(requestId);
}

function parseJsonField(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTeamMember(row: any) {
  if (!row) return null;
  return {
    ...row,
    permissions: parseJsonField(row.permissions, []),
    branch: row.branchId
      ? {
          id: row.branchId,
          name: row.branchName || null,
          location: row.branchLocation || null,
        }
      : null,
    trader: {
      id: row.traderId,
      name: row.traderBusinessName || row.traderName || row.traderEmail || 'Trader',
      email: row.traderEmail || null,
      businessName: row.traderBusinessName || null,
    },
  };
}

function getTeamAccessOptions(userId: string) {
  const memberships = db
    .prepare(
      `
      SELECT tm.*, b.name as branchName, b.location as branchLocation,
             u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
      FROM team_members tm
      JOIN users u ON u.id = tm.traderId
      LEFT JOIN branches b ON b.id = tm.branchId
      WHERE tm.userId = ? AND tm.status = 'active'
      ORDER BY tm.createdAt DESC
    `
    )
    .all(userId) as any[];
  return memberships.map(normalizeTeamMember);
}

function getActiveTeamContext(req: any) {
  const membershipId = String(req.cookies?.nexus_team_access || '');
  if (!membershipId || !req.user?.id) return null;
  const row = db
    .prepare(
      `
      SELECT tm.*, b.name as branchName, b.location as branchLocation,
             u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
      FROM team_members tm
      JOIN users u ON u.id = tm.traderId
      LEFT JOIN branches b ON b.id = tm.branchId
      WHERE tm.id = ? AND tm.userId = ? AND tm.status = 'active'
    `
    )
    .get(membershipId, req.user.id) as any;
  return normalizeTeamMember(row);
}

function normalizeUserAccount(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    status: row.status || 'active',
    verificationStatus: row.verificationStatus || 'pending',
    onboardingComplete: Boolean(row.onboardingComplete),
    walletBalance: Number(row.walletBalance || 0),
    tier: row.tier || 'free',
    businessName: row.businessName || null,
    businessCategory: row.businessCategory || null,
    businessLocation: row.businessLocation || null,
    tin: row.tin || null,
    rdbCertificateUrl: row.rdbCertificateUrl || null,
    category: row.category || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSelectedAt: row.lastSelectedAt || null,
  };
}

function getAccountModes(userId: string) {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM user_accounts
      WHERE userId = ?
      ORDER BY
        CASE role
          WHEN 'customer' THEN 1
          WHEN 'trader' THEN 2
          WHEN 'agent' THEN 3
          WHEN 'manager' THEN 4
          WHEN 'admin' THEN 5
          ELSE 9
        END,
        createdAt ASC
    `
    )
    .all(userId) as any[];
  return rows.map(normalizeUserAccount);
}

function getActiveAccount(req: any, user: any) {
  const accountId = String(req.cookies?.nexus_account_mode || '');
  const byCookie = accountId
    ? (db
        .prepare('SELECT * FROM user_accounts WHERE id = ? AND userId = ?')
        .get(accountId, user.id) as any)
    : null;
  if (byCookie) return normalizeUserAccount(byCookie);

  const byRole = db
    .prepare('SELECT * FROM user_accounts WHERE userId = ? AND role = ?')
    .get(user.id, user.role || 'customer') as any;
  if (byRole) return normalizeUserAccount(byRole);

  return getAccountModes(user.id)[0] || null;
}

function applyAccountModeToUser(user: any, account: any) {
  if (!account) return user;
  return {
    ...user,
    role: account.role,
    activeRole: account.role,
    activeAccountId: account.id,
    verificationStatus: account.verificationStatus,
    onboardingComplete: Boolean(account.onboardingComplete),
    walletBalance: account.walletBalance,
    tier: account.tier,
    businessName: account.businessName ?? user.businessName,
    businessCategory: account.businessCategory ?? user.businessCategory,
    location: account.businessLocation ?? user.location,
    tin: account.tin ?? user.tin,
    category: account.category ?? user.category,
  };
}

function createAccountMode(userId: string, role: string, data: Record<string, any> = {}) {
  const normalizedRole = normalizeRole(role);
  const existing = db
    .prepare('SELECT * FROM user_accounts WHERE userId = ? AND role = ?')
    .get(userId, normalizedRole) as any;
  if (existing) return normalizeUserAccount(existing);

  const id = uuidv4();
  const verificationStatus = 'pending';
  const status = 'active';
  const onboardingComplete = 1;

  db.prepare(
    `
    INSERT INTO user_accounts (
      id, userId, role, status, verificationStatus, onboardingComplete, walletBalance, tier,
      businessName, businessCategory, businessLocation, tin, category, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'free', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    userId,
    normalizedRole,
    status,
    verificationStatus,
    onboardingComplete,
    normalizedRole === 'customer' ? 10000 : 0,
    data.businessName || null,
    data.businessCategory || null,
    data.businessLocation || data.location || null,
    data.tin || null,
    data.category || null
  );

  const account = normalizeUserAccount(db.prepare('SELECT * FROM user_accounts WHERE id = ?').get(id));
  void mirrorAccountToPostgres(account).catch((error) => {
    console.error('Postgres account-mode mirror failed:', error);
  });
  return account;
}

function selectAccountMode(req: any, res: Response, user: any, account: any) {
  const normalizedAccount = normalizeUserAccount(account);
  if (!normalizedAccount) return user;

  db.prepare(
    `
    UPDATE user_accounts
    SET lastSelectedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(normalizedAccount.id);

  db.prepare(
    `
    UPDATE users
    SET role = ?, verificationStatus = ?, onboardingComplete = ?, walletBalance = ?, tier = ?,
        businessName = COALESCE(?, businessName),
        businessCategory = COALESCE(?, businessCategory),
        location = COALESCE(?, location),
        tin = COALESCE(?, tin),
        category = COALESCE(?, category),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(
    normalizedAccount.role,
    normalizedAccount.verificationStatus,
    Number(Boolean(normalizedAccount.onboardingComplete)),
    normalizedAccount.walletBalance,
    normalizedAccount.tier,
    normalizedAccount.businessName,
    normalizedAccount.businessCategory,
    normalizedAccount.businessLocation,
    normalizedAccount.tin,
    normalizedAccount.category,
    user.id
  );

  res.cookie('nexus_account_mode', normalizedAccount.id, accountModeCookieOptions);
  res.clearCookie('nexus_team_access', teamAccessCookieOptions);
  const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
  mirrorAccountState(user.id);
  return applyAccountModeToUser(freshUser, normalizedAccount);
}

function publicUserWithAccess(req: any, user: any) {
  const accountModes = getAccountModes(user.id);
  const activeAccount = getActiveAccount(req, user);
  const accountUser = applyAccountModeToUser(user, activeAccount);
  const safeUser = publicUser(accountUser);
  if (!safeUser) return safeUser;
  const teamAccessOptions = getTeamAccessOptions(user.id);
  return {
    ...safeUser,
    accountModes,
    activeAccount,
    teamAccessOptions,
    activeTeamContext: getActiveTeamContext(req),
  };
}

function normalizePurchaseRow(row: any) {
  if (!row) return row;
  const totalAmount = Number(row.totalAmount ?? 0);
  const feeAmount = Number(row.feeAmount ?? 0);
  const netAmount = Number(row.netAmount ?? totalAmount - feeAmount);
  const discountAmount = Number(row.discountAmount ?? 0);
  const isDelivery = Boolean(
    row.isDelivery || (row.deliveryStatus && String(row.deliveryStatus).toLowerCase() !== 'n/a')
  );

  return {
    ...row,
    amount: totalAmount,
    totalAmount,
    platformFee: feeAmount,
    feeAmount,
    netAmount,
    discountAmount,
    vat: 0,
    isDelivery,
    deliveryAddress: row.deliveryAddress || row.location || '',
    timestamp: row.timestamp || row.createdAt,
    status: row.status || 'pending',
    paymentStatus: row.paymentStatus || 'unpaid',
    deliveryStatus: row.deliveryStatus || 'pending',
    traderTier: row.traderTier || 'free',
  };
}

function normalizeDeliveryRow(row: any) {
  if (!row) return row;
  const totalAmount = Number(row.totalAmount ?? 0);
  return {
    ...row,
    amount: totalAmount,
    totalAmount,
    address: row.location || row.deliveryAddress || '',
    note: row.notes || '',
    timestamp: row.createdAt || row.timestamp,
    items: row.productName ? [{ name: row.productName, quantity: row.quantity || 1 }] : [],
    status: row.status || 'pending',
  };
}

function normalizeTicketRow(row: any) {
  if (!row) return row;
  const title = String(row.title || row.subject || '').trim();
  const description = String(row.description || row.message || '').trim();
  return {
    ...row,
    title,
    description,
    subject: title,
    message: description,
  };
}

function normalizeSurveyQuestionRow(row: any) {
  if (!row) return row;
  let options: any[] = [];
  if (row.options) {
    try {
      const parsed = typeof row.options === 'string' ? JSON.parse(row.options) : row.options;
      options = Array.isArray(parsed) ? parsed : [];
    } catch {
      options = [];
    }
  }
  return {
    ...row,
    options,
    required: Boolean(Number(row.required || 0)),
    enabled: row.enabled === undefined ? true : Boolean(Number(row.enabled || 0)),
  };
}

function normalizeSurveyResponseRow(row: any) {
  if (!row) return row;
  let parsedResponse = row.response;
  try {
    parsedResponse =
      typeof row.response === 'string' && row.response !== ''
        ? JSON.parse(row.response)
        : row.response;
  } catch {
    parsedResponse = row.response;
  }
  return {
    ...row,
    response: parsedResponse,
    responseLabel: Array.isArray(parsedResponse)
      ? parsedResponse.join(', ')
      : typeof parsedResponse === 'object' && parsedResponse
        ? JSON.stringify(parsedResponse)
        : String(parsedResponse ?? ''),
  };
}

function generateAppNumber() {
  for (let i = 0; i < 20; i += 1) {
    const number = String(Math.floor(10000000 + Math.random() * 90000000));
    const exists = db.prepare('SELECT id FROM users WHERE appNumber = ?').get(number);
    if (!exists) return number;
  }
  return uuidv4().slice(0, 8);
}

function bootstrapInitialAdmin() {
  const email = String(env.BOOTSTRAP_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(env.BOOTSTRAP_ADMIN_PASSWORD || '');
  const name = String(env.BOOTSTRAP_ADMIN_NAME || 'ESOKO Admin').trim();

  if (!email && !password) return;
  if (!email || !email.includes('@')) {
    console.warn('BOOTSTRAP_ADMIN_EMAIL is set incorrectly; initial admin was not created.');
    return;
  }
  if (password.length < 8) {
    console.warn('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters; initial admin was not created.');
    return;
  }

  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  const id = existingUser?.id || uuidv4();

  db.transaction(() => {
    if (existingUser) {
      db.prepare(
        `
        UPDATE users
        SET name = ?, password = ?, role = 'admin', verificationStatus = 'verified',
            emailVerified = 1, verifiedAt = COALESCE(verifiedAt, CURRENT_TIMESTAMP),
            onboardingComplete = 1, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(name || existingUser.name, hashPassword(password), id);
    } else {
      db.prepare(
        `
        INSERT INTO users (
          id, email, name, password, role, verificationStatus, walletBalance, appNumber,
          tier, onboardingComplete, loyaltyPoints, emailVerified, verifiedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, 'admin', 'verified', 0, ?, 'free', 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(id, email, name, hashPassword(password), generateAppNumber());
    }

    createAccountMode(id, 'admin', {});
    db.prepare(
      `
      INSERT OR IGNORE INTO loyalty_points (id, userId, points, totalEarned, updatedAt)
      VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
    `
      ).run(uuidv4(), id);
  })();

  logSystem(`Bootstrap admin credentials applied for ${email}`, 'info', 'auth', id);
}

function txCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function asNumber(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_LOAN_POLICY = {
  minLoanAmount: 1000,
  maxLoanAmount: 500000,
  autoApprovalMaxAmount: 100000,
  baseApr: 0.18,
  premiumApr: 0.15,
  minTermMonths: 1,
  maxTermMonths: 12,
  autoApproveScore: 75,
  manualReviewScore: 55,
  repaymentFrequency: 'monthly',
  lateFeeFixed: 500,
  lateFeePercent: 0.01,
  graceDays: 3,
  autoDisbursementEnabled: true,
  dailyDisbursementLimit: 1000000,
  userExposureLimit: 500000,
  overdueLoanLockEnabled: true,
  processingFeePercent: 0.01,
  processingFeeMax: 50000,
  requireLicensingGate: true,
};

const DEFAULT_LOYALTY_POLICY = {
  pointValueRwf: LOYALTY_POINT_RWF_VALUE,
  purchaseEarnPerRwf: 0.001,
  premiumMultiplier: 2,
  referredUserBonus: 500,
  referrerQualifiedBonus: 1000,
  referralQualification: 'first_verified_transaction',
  onTimeLoanRepaymentMin: 50,
  onTimeLoanRepaymentMax: 200,
  minRedeemPoints: 100,
  allowFeePaymentWithPoints: true,
  allowPrincipalRepaymentWithPoints: false,
  allowInterestRepaymentWithPoints: false,
  expiryDays: 365,
};

function getActivePolicy(table: 'loan_policy_versions' | 'loyalty_policy_versions', fallback: any) {
  const row = db
    .prepare(`SELECT * FROM ${table} WHERE isActive = 1 ORDER BY version DESC LIMIT 1`)
    .get() as any;
  if (!row) return { id: null, version: 0, config: fallback };
  return {
    ...row,
    config: {
      ...fallback,
      ...parseJsonField(row.config, {}),
    },
  };
}

function getLoanPolicy() {
  return getActivePolicy('loan_policy_versions', DEFAULT_LOAN_POLICY);
}

function getLoyaltyPolicy() {
  return getActivePolicy('loyalty_policy_versions', DEFAULT_LOYALTY_POLICY);
}

function recordLoyaltyLiability(input: {
  userId: string;
  pointsDelta: number;
  type: string;
  relatedTransactionId?: string | null;
}) {
  const policy = getLoyaltyPolicy().config;
  const pointValueRwf = asNumber(policy.pointValueRwf, LOYALTY_POINT_RWF_VALUE);
  const valueDelta = Number((input.pointsDelta * pointValueRwf).toFixed(2));
  db.prepare(
    `
    INSERT INTO loyalty_liability_entries (id, userId, pointsDelta, valueDelta, pointValueRwf, type, relatedTransactionId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    input.userId,
    input.pointsDelta,
    valueDelta,
    pointValueRwf,
    input.type,
    input.relatedTransactionId || null
  );
}

function awardLoyaltyPoints(
  userId: string,
  points: number,
  type: string,
  description: string,
  relatedTransactionId?: string | null
) {
  const safePoints = Math.max(0, Math.floor(points));
  if (safePoints <= 0) return 0;
  db.prepare(
    'UPDATE users SET loyaltyPoints = loyaltyPoints + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(safePoints, userId);
  db.prepare(
    `
    INSERT INTO loyalty_transactions (id, userId, points, type, description, relatedTransactionId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(uuidv4(), userId, safePoints, type, description, relatedTransactionId || null);
  recordLoyaltyLiability({ userId, pointsDelta: safePoints, type, relatedTransactionId });
  return safePoints;
}

function deductLoyaltyPointsForFee(
  userId: string,
  feeAmount: number,
  type: string,
  relatedTransactionId?: string | null
) {
  const policy = getLoyaltyPolicy().config;
  if (!policy.allowFeePaymentWithPoints) {
    throw new Error('Loyalty points cannot currently pay service fees');
  }
  const pointValueRwf = asNumber(policy.pointValueRwf, LOYALTY_POINT_RWF_VALUE);
  const pointsNeeded = Math.ceil(feeAmount / pointValueRwf);
  const user = db.prepare('SELECT loyaltyPoints FROM users WHERE id = ?').get(userId) as any;
  if (!user || asNumber(user.loyaltyPoints) < pointsNeeded) {
    throw new Error('Insufficient loyalty points to pay this fee');
  }
  db.prepare(
    'UPDATE users SET loyaltyPoints = loyaltyPoints - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(pointsNeeded, userId);
  db.prepare(
    `
    INSERT INTO loyalty_transactions (id, userId, points, type, description, relatedTransactionId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    userId,
    -pointsNeeded,
    type,
    `Paid RWF ${feeAmount} fee with ${pointsNeeded} loyalty points`,
    relatedTransactionId || null
  );
  recordLoyaltyLiability({ userId, pointsDelta: -pointsNeeded, type, relatedTransactionId });
  return pointsNeeded;
}

function parseLimitOffset(query: any) {
  return {
    limit: Math.min(Math.max(parseInt(String(query.limit || 50), 10), 1), 250),
    offset: Math.max(parseInt(String(query.offset || 0), 10), 0),
  };
}

function calculateFeeAmount(feeType: string, amount: number, userTier: string = 'free') {
  const feeConfig = db
    .prepare('SELECT * FROM fees_config WHERE feeType = ? AND enabled = 1')
    .get(feeType) as any;
  if (!feeConfig) {
    return {
      feeType,
      amount,
      fixedFee: 0,
      percentageFee: 0,
      discount: 0,
      totalFee: 0,
      netAmount: amount,
    };
  }

  const fixedFee = feeConfig.fixedFee || 0;
  const percentageFee = amount * (feeConfig.percentageFee || 0) || 0;
  let totalFee = fixedFee + percentageFee;
  let discount = 0;

  if (userTier === 'premium') discount = totalFee * 0.1;
  else if (userTier === 'gold') discount = totalFee * 0.15;
  else if (userTier === 'platinum') discount = totalFee * 0.2;

  totalFee -= discount;
  const calculatedFee = Math.max(feeConfig.minFee, Math.min(totalFee, feeConfig.maxFee));
  return {
    feeType,
    amount,
    fixedFee,
    percentageFee,
    discount,
    totalFee: calculatedFee,
    netAmount: amount - calculatedFee,
  };
}

function inferFeeTypeFromTransaction(type: string) {
  if (type === 'purchase' || type === 'sale' || type === 'payment') return 'purchase';
  if (type === 'deposit') return 'deposit';
  if (type === 'withdrawal') return 'withdrawal';
  if (type === 'transfer') return 'transfer';
  if (type === 'subscription') return 'subscription';
  if (type === 'loan_application') return 'loan_application';
  return type || 'transaction';
}

function calculateLoanInterestRate(userTier: string = 'free', loyaltyPoints: number = 0) {
  const policy = getLoanPolicy().config;
  let baseRate = asNumber(policy.baseApr, 0.18);
  if (userTier === 'premium') baseRate = asNumber(policy.premiumApr, 0.15);
  else if (userTier === 'gold') baseRate = Math.max(0.01, baseRate - 0.02);
  else if (userTier === 'platinum') baseRate = Math.max(0.01, baseRate - 0.03);

  if (loyaltyPoints >= 1000) baseRate -= 0.005;
  if (loyaltyPoints >= 2000) baseRate -= 0.005;

  return Math.max(0.035, Number(baseRate.toFixed(4)));
}

function buildLoanSchedule(principal: number, monthlyRate: number, loanTerm: number) {
  const schedule: Array<{
    installment: number;
    payment: number;
    interest: number;
    principal: number;
    balance: number;
  }> = [];
  let balance = principal;

  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) /
    (Math.pow(1 + monthlyRate, loanTerm) - 1);

  for (let installment = 1; installment <= loanTerm; installment += 1) {
    const interest = balance * monthlyRate;
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({
      installment,
      payment: Number(payment.toFixed(2)),
      interest: Number(interest.toFixed(2)),
      principal: Number(principalPaid.toFixed(2)),
      balance: Number(balance.toFixed(2)),
    });
  }

  return schedule;
}

function scoreLoanApplication(user: any, amount: number, loanTerm: number) {
  const policyRow = getLoanPolicy();
  const policy = policyRow.config;
  const walletBalance = asNumber(user.walletBalance);
  const loyaltyPoints = asNumber(user.loyaltyPoints);
  const activeLoans = db
    .prepare(
      `
      SELECT COALESCE(SUM(totalRepayment - amountRepaid), 0) as exposure, COUNT(*) as count
      FROM smart_loans
      WHERE userId = ? AND status IN ('approved', 'disbursed', 'active', 'overdue')
    `
    )
    .get(user.id) as any;
  const paidTransactions = db
    .prepare(
      `
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE userId = ? AND status = 'completed'
    `
    )
    .get(user.id) as any;
  const traderSales =
    user.role === 'trader'
      ? (db
          .prepare(
            `
            SELECT COUNT(*) as count, COALESCE(SUM(totalAmount), 0) as total
            FROM purchases
            WHERE traderId = ? AND paymentStatus IN ('paid', 'completed')
          `
          )
          .get(user.id) as any)
      : { count: 0, total: 0 };
  const referrals = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM referrals
      WHERE referrerUserId = ? AND status = 'qualified'
    `
    )
    .get(user.id) as any;

  let score = 35;
  const factors: string[] = ['Base account score: 35'];

  if (isAccountVerifiedStatus(user.verificationStatus)) {
    score += 10;
    factors.push('Verified account: +10');
  }
  if (user.role === 'trader') {
    score += 8;
    factors.push('Trader role with business data: +8');
  }
  if (['premium', 'gold', 'platinum'].includes(String(user.tier))) {
    score += 8;
    factors.push('Paid or high-value tier: +8');
  }
  const walletScore = Math.min(12, Math.floor(walletBalance / Math.max(1, amount) * 12));
  score += walletScore;
  factors.push(`Wallet strength: +${walletScore}`);
  const transactionScore = Math.min(12, Math.floor(asNumber(paidTransactions.count) / 3));
  score += transactionScore;
  factors.push(`Completed transactions: +${transactionScore}`);
  const traderScore = Math.min(12, Math.floor(asNumber(traderSales.total) / 50000));
  score += traderScore;
  if (traderScore) factors.push(`Trader sales history: +${traderScore}`);
  const loyaltyScore = Math.min(8, Math.floor(loyaltyPoints / 500));
  score += loyaltyScore;
  factors.push(`Loyalty activity: +${loyaltyScore}`);
  const referralScore = Math.min(5, asNumber(referrals.count));
  score += referralScore;
  if (referralScore) factors.push(`Qualified referrals: +${referralScore}`);

  const exposure = asNumber(activeLoans?.exposure);
  if (exposure > 0) {
    const penalty = Math.min(20, Math.ceil((exposure / Math.max(1, policy.userExposureLimit)) * 20));
    score -= penalty;
    factors.push(`Existing loan exposure: -${penalty}`);
  }
  if (amount > asNumber(policy.autoApprovalMaxAmount)) {
    score -= 8;
    factors.push('Above auto-approval amount: -8');
  }
  if (loanTerm > 6) {
    score -= 4;
    factors.push('Longer repayment term: -4');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let decision: 'approved' | 'manual_review' | 'rejected' = 'rejected';
  if (score >= asNumber(policy.autoApproveScore, 75) && amount <= asNumber(policy.autoApprovalMaxAmount)) {
    decision = 'approved';
  } else if (score >= asNumber(policy.manualReviewScore, 55)) {
    decision = 'manual_review';
  }

  let riskLevel = 'high';
  if (score >= 75) riskLevel = 'low';
  else if (score >= 55) riskLevel = 'medium';

  return {
    score,
    decision,
    riskLevel,
    factors,
    policyVersion: policyRow.version,
    activeExposure: exposure,
  };
}

function createLoanInstallments(loan: any) {
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM loan_installments WHERE loanId = ?')
    .get(loan.id) as any;
  if (asNumber(existing?.count) > 0) return;
  const monthlyRate = asNumber(loan.interestRate) / 12;
  const schedule = buildLoanSchedule(asNumber(loan.amount), monthlyRate, Math.max(1, loan.loanTerm));
  const now = new Date();
  schedule.forEach((item) => {
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + item.installment);
    db.prepare(
      `
      INSERT INTO loan_installments (
        id, loanId, userId, installmentNumber, dueDate, principalDue, interestDue, totalDue, status, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      uuidv4(),
      loan.id,
      loan.userId,
      item.installment,
      dueDate.toISOString(),
      item.principal,
      item.interest,
      item.payment
    );
  });
}

function runLoanPaymentReminderJob() {
  const now = new Date();
  const reminderWindowDays = 3;

  const overdueInstallments = db
    .prepare(
      `
      SELECT DISTINCT loanId
      FROM loan_installments
      WHERE status IN ('pending', 'partial')
        AND julianday(dueDate) < julianday('now')
    `
    )
    .all() as any[];

  db.prepare(
    `
    UPDATE loan_installments
    SET status = 'overdue', updatedAt = CURRENT_TIMESTAMP
    WHERE status IN ('pending', 'partial')
      AND julianday(dueDate) < julianday('now')
  `
  ).run();

  overdueInstallments.forEach((row) => {
    db.prepare(
      `
      UPDATE smart_loans
      SET status = 'overdue', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'active'
    `
    ).run(row.loanId);
  });

  const dueRows = db
    .prepare(
      `
      SELECT li.*, l.monthlyPayment, l.totalRepayment, l.amountRepaid, u.name, u.businessName
      FROM loan_installments li
      JOIN smart_loans l ON l.id = li.loanId
      JOIN users u ON u.id = li.userId
      WHERE l.status IN ('active', 'overdue')
        AND li.status IN ('pending', 'partial', 'overdue')
        AND (
          (
            julianday(li.dueDate) >= julianday('now')
            AND julianday(li.dueDate) <= julianday('now', '+' || ? || ' days')
            AND li.reminderSentAt IS NULL
          )
          OR (
            julianday(li.dueDate) < julianday('now')
            AND li.overdueReminderSentAt IS NULL
          )
        )
      ORDER BY li.dueDate ASC
      LIMIT 250
    `
    )
    .all(reminderWindowDays) as any[];

  let dueSoonCount = 0;
  let overdueCount = 0;

  const insertNotification = db.prepare(
    `
    INSERT INTO notifications (id, userId, title, message, type, subType, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  );
  const markDueReminder = db.prepare(
    'UPDATE loan_installments SET reminderSentAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  );
  const markOverdueReminder = db.prepare(
    'UPDATE loan_installments SET overdueReminderSentAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  );

  dueRows.forEach((installment) => {
    const dueDate = new Date(installment.dueDate);
    const amountLeft = Math.max(
      0,
      asNumber(installment.totalDue) - asNumber(installment.amountPaid)
    );
    const isOverdue = dueDate.getTime() < now.getTime();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    const daysOverdue = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / 86400000));
    const formattedAmount = amountLeft.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const title = isOverdue ? 'Loan repayment overdue' : 'Loan repayment reminder';
    const message = isOverdue
      ? `Installment #${installment.installmentNumber} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue. Pay RWF ${formattedAmount} to keep your loan in good standing.`
      : `Installment #${installment.installmentNumber} is due in ${Math.max(0, daysUntilDue)} day${daysUntilDue === 1 ? '' : 's'}. Prepare RWF ${formattedAmount} in your wallet.`;

    insertNotification.run(
      uuidv4(),
      installment.userId,
      title,
      message,
      isOverdue ? 'warning' : 'info',
      isOverdue ? 'loan_payment_overdue' : 'loan_payment_reminder',
      JSON.stringify({
        loanId: installment.loanId,
        installmentId: installment.id,
        installmentNumber: installment.installmentNumber,
        dueDate: installment.dueDate,
        amountDue: amountLeft,
      })
    );

    if (isOverdue) {
      markOverdueReminder.run(installment.id);
      overdueCount += 1;
    } else {
      markDueReminder.run(installment.id);
      dueSoonCount += 1;
    }
  });

  return {
    success: true,
    checkedAt: now.toISOString(),
    markedOverdue: overdueInstallments.length,
    remindersCreated: dueSoonCount + overdueCount,
    dueSoonCount,
    overdueCount,
  };
}

function startLoanPaymentReminderScheduler() {
  if (loanReminderInterval) return;
  const runSafely = () => {
    try {
      const result = runLoanPaymentReminderJob();
      if (result.remindersCreated || result.markedOverdue) {
        console.log('Loan reminder job:', result);
      }
    } catch (error) {
      console.error('Loan reminder job failed:', error);
    }
  };

  setTimeout(runSafely, 30000).unref();
  loanReminderInterval = setInterval(runSafely, 6 * 60 * 60 * 1000);
  loanReminderInterval.unref();
}

function buildLoanWhatsAppHandoff(input: {
  loanId: string;
  user: any;
  amount: number;
  loanTerm: number;
  approvalStatus: string;
  approvalScore: number;
  riskLevel: string;
  monthlyPayment: number;
  totalRepayment: number;
}) {
  const phone = LOAN_WHATSAPP_NUMBER.replace(/[^\d]/g, '');
  const applicantName = input.user.businessName || input.user.name || input.user.email || input.user.id;
  const message = [
    'ESOKO loan request',
    `Loan ID: ${input.loanId}`,
    `Applicant: ${applicantName}`,
    `User ID: ${input.user.id}`,
    input.user.phone ? `Phone: ${input.user.phone}` : null,
    `Amount: RWF ${Number(input.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `Term: ${input.loanTerm} months`,
    `Monthly payment: RWF ${Number(input.monthlyPayment).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `Total repayment: RWF ${Number(input.totalRepayment).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `Decision: ${input.approvalStatus}`,
    `Score: ${input.approvalScore}/100`,
    `Risk: ${input.riskLevel}`,
    'Please review and confirm next steps.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    number: LOAN_WHATSAPP_NUMBER,
    message,
    url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
}

function disburseLoan(loanId: string, actorId: string, source: 'auto' | 'admin' = 'admin') {
  const loan = db.prepare('SELECT * FROM smart_loans WHERE id = ?').get(loanId) as any;
  if (!loan) throw new Error('Loan not found');
  if (!['approved', 'pending'].includes(String(loan.status))) {
    throw new Error('Only approved loans can be disbursed');
  }
  if (loan.approvalStatus !== 'approved') {
    throw new Error('Loan is not approved for disbursement');
  }

  const policy = getLoanPolicy().config;
  const todayDisbursed = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM smart_loans
      WHERE disbursedAt >= date('now') AND status IN ('disbursed', 'active', 'completed', 'overdue')
    `
    )
    .get() as any;
  if (asNumber(todayDisbursed?.total) + asNumber(loan.amount) > asNumber(policy.dailyDisbursementLimit)) {
    throw new Error('Daily loan disbursement limit reached');
  }

  const transactionId = uuidv4();
  db.prepare(
    'UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(loan.amount, loan.userId);
  db.prepare(
    `
    UPDATE smart_loans
    SET status = 'active', approvalStatus = 'approved', disbursedAt = CURRENT_TIMESTAMP,
        disbursementTransactionId = ?, nextPaymentDue = datetime('now', '+1 month'), updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(transactionId, loanId);
  db.prepare(
    `
    INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, metadata, createdAt, updatedAt, timestamp)
    VALUES (?, ?, ?, 'loan_disbursement', 'completed', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    transactionId,
    loan.userId,
    loan.amount,
    `Loan disbursed via ${source}`,
    loanId,
    txCode('LON'),
    loan.processingFee || 0,
    loan.amount,
    JSON.stringify({ actorId, source })
  );
  db.prepare(
    `
    INSERT INTO wallet_transactions (id, userId, type, amount, description, status, metadata, createdAt)
    VALUES (?, ?, 'loan_disbursement', ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    loan.userId,
    loan.amount,
    `Loan disbursement ${loanId}`,
    JSON.stringify({ loanId, actorId, source })
  );
  recordWalletLiabilityChange({
    transactionId,
    userId: loan.userId,
    amountDelta: loan.amount,
    description: 'Loan disbursement credited to wallet',
    metadata: { loanId, source },
  });
  if (asNumber(loan.processingFee) > 0) {
    recordTransactionFee(
      transactionId,
      loan.userId,
      'loan_disbursement',
      asNumber(loan.processingFee),
      asNumber(policy.processingFeePercent)
    );
    recordPlatformWalletTransaction({
      type: 'loan_processing_fee_collection',
      direction: 'in',
      amount: asNumber(loan.processingFee),
      userId: loan.userId,
      relatedTransactionId: transactionId,
      description: 'Loan processing fee collected',
      metadata: { loanId, source },
      createdBy: actorId,
    });
  }
  createLoanInstallments({ ...loan, status: 'active' });
  return transactionId;
}

function qualifyReferralIfReady(userId: string, relatedTransactionId?: string | null) {
  const referral = db
    .prepare(
      `
      SELECT r.*, u.id as referredId
      FROM referrals r
      JOIN users u ON u.id = r.referredUserId
      WHERE r.referredUserId = ? AND r.status = 'pending'
    `
    )
    .get(userId) as any;
  if (!referral) return null;
  const completedTransactions = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM transactions
      WHERE userId = ? AND status = 'completed'
    `
    )
    .get(userId) as any;
  const user = db
    .prepare('SELECT verificationStatus, emailVerified FROM users WHERE id = ?')
    .get(userId) as any;
  const isVerified = isAccountVerifiedStatus(user?.verificationStatus);
  if (!isVerified || asNumber(completedTransactions?.count) < 1) return null;

  const policy = getLoyaltyPolicy().config;
  const referrerPoints = asNumber(policy.referrerQualifiedBonus, 1000);
  const referredPoints = asNumber(policy.referredUserBonus, 500);
  awardLoyaltyPoints(
    referral.referrerUserId,
    referrerPoints,
    'referral_qualified',
    'Referral qualified after first verified transaction',
    relatedTransactionId
  );
  awardLoyaltyPoints(
    referral.referredUserId,
    referredPoints,
    'referral_signup',
    'Referral welcome bonus after first verified transaction',
    relatedTransactionId
  );
  db.prepare(
    `
    UPDATE referrals
    SET status = 'qualified', referrerPoints = ?, referredPoints = ?, qualifiedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(referrerPoints, referredPoints, referral.id);
  return referral.id;
}

function recordPlatformWalletTransaction(input: {
  type: string;
  direction: 'in' | 'out';
  amount: number;
  userId?: string | null;
  relatedTransactionId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}) {
  if (input.amount <= 0) return null;
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO platform_wallet_transactions (
      id, type, direction, amount, userId, relatedTransactionId, description, metadata, createdBy, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    input.type,
    input.direction,
    input.amount,
    input.userId || null,
    input.relatedTransactionId || null,
    input.description,
    JSON.stringify(input.metadata || {}),
    input.createdBy || null
  );
  return id;
}

function getPlatformWalletSummary() {
  const totals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) as totalOut,
        COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance,
        COUNT(*) as transactionCount
      FROM platform_wallet_transactions
    `
    )
    .get() as any;
  const revenueAccount = db
    .prepare("SELECT balance FROM revenue_accounts WHERE code = 'platform_revenue'")
    .get() as any;
  return {
    ...totals,
    platformRevenueAccountBalance: asNumber(revenueAccount?.balance),
  };
}

function ensureTraderTrial(traderId: string) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(traderId) as any;
  if (!user || user.role !== 'trader') return null;
  const active = db
    .prepare(
      `
      SELECT ts.*, s.name, s.price, s.features, s.limits
      FROM trader_subscriptions ts
      JOIN subscriptions s ON s.id = ts.subscription_id
      WHERE ts.trader_id = ?
        AND ts.status IN ('trial', 'active', 'past_due')
        AND (ts.expires_at IS NULL OR ts.expires_at > CURRENT_TIMESTAMP OR ts.trial_ends_at > CURRENT_TIMESTAMP)
      ORDER BY ts.created_at DESC
      LIMIT 1
    `
    )
    .get(traderId) as any;
  if (active) return active;

  const everSubscribed = db
    .prepare('SELECT COUNT(*) as count FROM trader_subscriptions WHERE trader_id = ?')
    .get(traderId) as any;
  if (asNumber(everSubscribed?.count) > 0) return null;

  const trialPlan = db
    .prepare("SELECT * FROM subscriptions WHERE id = 'trial_full_access' AND is_active = 1")
    .get() as any;
  if (!trialPlan) return null;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO trader_subscriptions (
      id, trader_id, subscription_id, status, activated_at, expires_at, trial_started_at, trial_ends_at, auto_renew, payment_method, created_at, updated_at
    )
    VALUES (?, ?, 'trial_full_access', 'trial', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?, 0, 'trial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(id, traderId, trialEndsAt.toISOString(), trialEndsAt.toISOString());
  return {
    id,
    trader_id: traderId,
    subscription_id: 'trial_full_access',
    status: 'trial',
    activated_at: new Date().toISOString(),
    expires_at: trialEndsAt.toISOString(),
    trial_started_at: new Date().toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    payment_method: 'trial',
    name: trialPlan.name,
    price: trialPlan.price,
    features: trialPlan.features,
    limits: trialPlan.limits,
  };
}

function normalizeSubscriptionRow(row: any) {
  if (!row) return null;
  const features = parseJsonField(row.features, []);
  const limits = parseJsonField(row.limits, {});
  const trialEndsAt = row.trial_ends_at || row.trialEndsAt || null;
  const expiresAt = row.expires_at || row.expiresAt || null;
  const now = Date.now();
  const effectiveEnd = trialEndsAt || expiresAt;
  const daysRemaining = effectiveEnd
    ? Math.max(0, Math.ceil((new Date(effectiveEnd).getTime() - now) / 86400000))
    : null;
  const trialExpired = row.status === 'trial' && trialEndsAt && new Date(trialEndsAt).getTime() <= now;
  return {
    ...row,
    features,
    limits,
    trialEndsAt,
    expiresAt,
    daysRemaining,
    trialExpired,
    fullAccess: row.status === 'trial' && !trialExpired,
    requiresUpgrade: row.status === 'trial' && trialExpired,
  };
}

const { authenticate, requireRole } = createAuthMiddleware({
  db,
  jwtSecret: JWT_SECRET_KEY,
  consumeRefreshToken,
  clearAuthCookies,
});

app.use('/api', (req: any, res, next) => {
  if (req.path === '/events' || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    publishLiveSync({
      method: req.method,
      path: req.originalUrl,
      collection: inferCollectionFromPath(req.originalUrl),
      actorUserId: req.user?.id || null,
    });
  });

  next();
});

app.get('/api/events', authenticate, (req: any, res): any => {
  const clientId = uuidv4();

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  liveSyncClients.set(clientId, res);
  res.write(
    `event: sync\ndata: ${JSON.stringify({
      id: uuidv4(),
      type: 'connected',
      actorUserId: req.user.id,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    liveSyncClients.delete(clientId);
  });
});

function normalizeLiveSession(row: any) {
  if (!row) return row;
  let metadata = {};
  try {
    metadata = row.metadata ? JSON.parse(row.metadata) : {};
  } catch {
    metadata = {};
  }
  return {
    ...row,
    metadata,
    viewerCount: Number(row.viewerCount || 0),
  };
}

app.get('/api/live/sessions', authenticate, (_req: any, res): any => {
  const sessions = db
    .prepare(
      `
      SELECT
        ls.*,
        u.name AS traderName,
        u.email AS traderEmail,
        u.businessName,
        u.phone AS traderPhone,
        u.location AS traderAddress,
        p.name AS pinnedProductName,
        p.price AS pinnedProductPrice,
        p.image AS pinnedProductImage,
        p.stock AS pinnedProductStock,
        COALESCE(participants.participantCount, 0) AS participantCount
      FROM live_sessions ls
      JOIN users u ON u.id = ls.traderId
      LEFT JOIN products p ON p.id = ls.pinnedProductId
      LEFT JOIN (
        SELECT sessionId, COUNT(*) as participantCount
        FROM live_participants
        WHERE lastSeenAt > datetime('now', '-2 minutes')
        GROUP BY sessionId
      ) participants ON participants.sessionId = ls.id
      WHERE ls.status = 'live'
      ORDER BY ls.updatedAt DESC
      LIMIT 50
    `
    )
    .all()
    .map(normalizeLiveSession);
  res.json({ success: true, sessions });
});

app.post('/api/live/sessions', requireRole(['trader', 'admin']), (req: any, res): any => {
  const traderId = req.effectiveTraderId || req.user.id;
  const traderUser = (db.prepare('SELECT * FROM users WHERE id = ?').get(traderId) as any) || req.user;
  const title = String(
    req.body.title || `${traderUser.businessName || traderUser.name} live market`
  ).trim();
  const pinnedProductId = req.body.pinnedProductId ? String(req.body.pinnedProductId) : null;
  if (!title) return res.status(400).json({ error: 'Live title is required' });

  if (pinnedProductId) {
    const product = db
      .prepare('SELECT id FROM products WHERE id = ? AND traderId = ?')
      .get(pinnedProductId, traderId);
    if (!product) return res.status(404).json({ error: 'Pinned product not found' });
  }

  const existing = db
    .prepare(
      "SELECT * FROM live_sessions WHERE traderId = ? AND status = 'live' ORDER BY startedAt DESC LIMIT 1"
    )
    .get(traderId) as any;
  const sessionId = existing?.id || uuidv4();
  const metadata = JSON.stringify({
    traderName: traderUser.name,
    traderEmail: traderUser.email,
    businessName: traderUser.businessName,
    traderPhone: traderUser.phone,
    traderAddress: traderUser.location,
    operatedByUserId: req.user.id,
  });

  if (existing) {
    db.prepare(
      `
      UPDATE live_sessions
      SET title = ?, pinnedProductId = ?, updatedAt = CURRENT_TIMESTAMP, metadata = ?
      WHERE id = ?
    `
    ).run(title, pinnedProductId, metadata, sessionId);
  } else {
    db.prepare(
      `
      INSERT INTO live_sessions (id, traderId, title, pinnedProductId, status, viewerCount, startedAt, updatedAt, metadata)
      VALUES (?, ?, ?, ?, 'live', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `
    ).run(sessionId, traderId, title, pinnedProductId, metadata);
  }
  db.prepare(
    `
    INSERT INTO live_participants (id, sessionId, userId, displayName, role, joinedAt, lastSeenAt)
    VALUES (?, ?, ?, ?, 'trader', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(sessionId, userId)
    DO UPDATE SET displayName = excluded.displayName, role = 'trader', lastSeenAt = CURRENT_TIMESTAMP
  `
  ).run(
    uuidv4(),
    sessionId,
    req.user.id,
    req.user.id === traderId
      ? traderUser.businessName || traderUser.name || traderUser.email
      : `${req.user.name || req.user.email} for ${traderUser.businessName || traderUser.name}`
  );

  publishLiveSync({
    method: 'POST',
    path: '/api/live/sessions',
    collection: 'live_sessions',
    actorUserId: traderId,
  });
  const session = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(sessionId);
  res.json({ success: true, session: normalizeLiveSession(session) });
});

app.get('/api/live/sessions/:id/participants', authenticate, (req: any, res): any => {
  const participants = db
    .prepare(
      `
      SELECT *
      FROM live_participants
      WHERE sessionId = ? AND lastSeenAt > datetime('now', '-2 minutes')
      ORDER BY role DESC, joinedAt ASC
    `
    )
    .all(req.params.id);
  res.json({ success: true, participants });
});

app.post('/api/live/sessions/:id/participants', authenticate, (req: any, res): any => {
  const session = db
    .prepare('SELECT * FROM live_sessions WHERE id = ? AND status = ?')
    .get(req.params.id, 'live') as any;
  if (!session) return res.status(404).json({ error: 'Live session not found' });
  const role = req.user.id === session.traderId ? 'trader' : 'viewer';
  const displayName = req.user.businessName || req.user.name || req.user.email || 'Guest';
  const existingParticipant = db
    .prepare('SELECT id FROM live_participants WHERE sessionId = ? AND userId = ?')
    .get(req.params.id, req.user.id);
  db.prepare(
    `
    INSERT INTO live_participants (id, sessionId, userId, displayName, role, joinedAt, lastSeenAt)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(sessionId, userId)
    DO UPDATE SET displayName = excluded.displayName, role = excluded.role, lastSeenAt = CURRENT_TIMESTAMP
  `
  ).run(uuidv4(), req.params.id, req.user.id, displayName, role);
  const participantCount = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM live_participants WHERE sessionId = ? AND lastSeenAt > datetime('now', '-2 minutes')"
      )
      .get(req.params.id) as any
  )?.count;
  db.prepare(
    'UPDATE live_sessions SET viewerCount = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(participantCount || 0, req.params.id);
  publishLiveSync({
    method: 'POST',
    path: `/api/live/sessions/${req.params.id}/participants`,
    collection: 'live_participants',
    actorUserId: req.user.id,
  });
  if (role === 'viewer' && !existingParticipant) {
    createNotificationForUser({
      userId: session.traderId,
      title: 'New live customer',
      message: `${displayName} joined your live market room.`,
      type: 'info',
      subType: 'live',
      metadata: {
        sessionId: req.params.id,
        viewerId: req.user.id,
        href: `/trader?tab=chat&liveSession=${req.params.id}`,
      },
    });
  }
  res.json({
    success: true,
    participant: { sessionId: req.params.id, userId: req.user.id, displayName, role },
  });
});

app.delete('/api/live/sessions/:id/participants/me', authenticate, (req: any, res): any => {
  db.prepare('DELETE FROM live_participants WHERE sessionId = ? AND userId = ?').run(
    req.params.id,
    req.user.id
  );
  const participantCount = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM live_participants WHERE sessionId = ? AND lastSeenAt > datetime('now', '-2 minutes')"
      )
      .get(req.params.id) as any
  )?.count;
  db.prepare(
    'UPDATE live_sessions SET viewerCount = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(participantCount || 0, req.params.id);
  res.json({ success: true });
});

app.put('/api/live/sessions/:id/end', authenticate, (req: any, res): any => {
  const session = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(req.params.id) as any;
  if (!session) return res.status(404).json({ error: 'Live session not found' });
  if (req.user.role !== 'admin' && session.traderId !== req.user.id) {
    return res.status(403).json({ error: 'Only the live trader can end this stream' });
  }
  db.prepare(
    "UPDATE live_sessions SET status = 'ended', endedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(req.params.id);
  db.prepare('DELETE FROM live_signals WHERE sessionId = ?').run(req.params.id);
  publishLiveSync({
    method: 'PUT',
    path: `/api/live/sessions/${req.params.id}/end`,
    collection: 'live_sessions',
    actorUserId: req.user.id,
  });
  res.json({ success: true });
});

app.get('/api/live/sessions/:id/messages', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const messages = db
    .prepare(
      'SELECT * FROM live_messages WHERE sessionId = ? ORDER BY createdAt ASC LIMIT ? OFFSET ?'
    )
    .all(req.params.id, limit, offset);
  res.json({ success: true, messages });
});

app.post('/api/live/sessions/:id/messages', authenticate, (req: any, res): any => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const session = db
    .prepare('SELECT * FROM live_sessions WHERE id = ? AND status = ?')
    .get(req.params.id, 'live');
  if (!session) return res.status(404).json({ error: 'Live session not found' });
  const id = uuidv4();
  db.prepare(
    'INSERT INTO live_messages (id, sessionId, userId, senderName, message, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(
    id,
    req.params.id,
    req.user.id,
    req.user.businessName || req.user.name || req.user.email,
    message.slice(0, 1000)
  );
  publishLiveSync({
    method: 'POST',
    path: `/api/live/sessions/${req.params.id}/messages`,
    collection: 'live_messages',
    actorUserId: req.user.id,
  });
  if (req.user.id !== (session as any).traderId) {
    const senderName = req.user.businessName || req.user.name || req.user.email || 'Customer';
    createNotificationForUser({
      userId: (session as any).traderId,
      title: 'Live message',
      message: `${senderName}: ${message.slice(0, 120)}`,
      type: 'info',
      subType: 'live',
      metadata: {
        sessionId: req.params.id,
        senderId: req.user.id,
        href: `/trader?tab=chat&liveSession=${req.params.id}`,
      },
    });
  }
  res.json({
    success: true,
    message: {
      id,
      sessionId: req.params.id,
      userId: req.user.id,
      senderName: req.user.name,
      message,
    },
  });
});

app.get('/api/live/sessions/:id/signals', authenticate, (req: any, res): any => {
  const viewerId = String(req.query.viewerId || req.user.id).trim();
  const after = String(req.query.after || '').trim();
  const session = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(req.params.id) as any;
  if (!session) return res.status(404).json({ error: 'Live session not found' });
  const params: any[] = [req.params.id];
  const conditions = ['sessionId = ?'];
  if (req.user.id === session.traderId) {
    conditions.push('senderId != ?');
    params.push(req.user.id);
  } else {
    conditions.push('viewerId = ? AND senderId != ?');
    params.push(viewerId, req.user.id);
  }
  if (after) {
    conditions.push('createdAt > ?');
    params.push(after);
  }
  const signals = db
    .prepare(
      `SELECT * FROM live_signals WHERE ${conditions.join(' AND ')} ORDER BY createdAt ASC LIMIT 100`
    )
    .all(...params)
    .map((signal: any) => ({ ...signal, payload: JSON.parse(signal.payload) }));
  res.json({ success: true, signals });
});

app.post('/api/live/sessions/:id/signals', authenticate, (req: any, res): any => {
  const session = db
    .prepare('SELECT * FROM live_sessions WHERE id = ? AND status = ?')
    .get(req.params.id, 'live') as any;
  if (!session) return res.status(404).json({ error: 'Live session not found' });
  const type = String(req.body.type || '').trim();
  const viewerId = String(req.body.viewerId || req.user.id).trim();
  if (!['offer', 'answer', 'candidate', 'leave'].includes(type)) {
    return res.status(400).json({ error: 'Unsupported signal type' });
  }
  const id = uuidv4();
  db.prepare(
    'INSERT INTO live_signals (id, sessionId, viewerId, senderId, targetId, type, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(
    id,
    req.params.id,
    viewerId,
    req.user.id,
    req.body.targetId || null,
    type,
    JSON.stringify(req.body.payload || {})
  );
  if (type === 'offer') {
    db.prepare(
      'UPDATE live_sessions SET viewerCount = viewerCount + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(req.params.id);
  }
  publishLiveSync({
    method: 'POST',
    path: `/api/live/sessions/${req.params.id}/signals`,
    collection: 'live_signals',
    actorUserId: req.user.id,
  });
  res.json({ success: true, id });
});

app.use('/api', (req: any, res, next) => {
  if (req.method === 'GET' || req.path === '/events') {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      publishLiveSync({
        method: req.method,
        path: req.originalUrl,
        collection: inferCollectionFromPath(req.originalUrl),
        actorUserId: req.user?.id,
      });
    }
  });

  next();
});

function getConfig() {
  const config = db.prepare('SELECT * FROM system_config WHERE id = ?').get('global') as any;
  return {
    ...config,
    maintenanceMode: Boolean(config?.maintenanceMode),
    registrationOpen: Boolean(config?.registrationOpen),
    globalFees: {
      free: config?.globalFeesFree ?? 0.006,
      premium: config?.globalFeesPremium ?? 0.003,
    },
    systemHealth: {
      status: config?.systemHealthStatus || 'operational',
      lastCheck: config?.systemHealthLastCheck || new Date().toISOString(),
    },
  };
}

function logSystem(message: string, level = 'info', source = 'api', userId?: string) {
  db.prepare(
    `
    INSERT INTO system_logs (id, message, level, source, userId, createdAt)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(uuidv4(), message, level, source, userId || null);
}

function recordAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any
) {
  db.prepare(
    `
    INSERT INTO admin_actions (id, adminId, action, targetType, targetId, details, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    adminId,
    action,
    targetType || null,
    targetId || null,
    JSON.stringify(details || {})
  );
  logSystem(`Admin action recorded: ${action}`, 'info', 'admin-action', adminId);
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appBaseUrl(req: any) {
  const configured = String(process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const headerValue = (value: any) =>
    String(Array.isArray(value) ? value[0] : value || '')
      .split(',')[0]
      .trim();
  const protocol = headerValue(req.headers['x-forwarded-proto']) || req.protocol || 'http';
  const host = headerValue(req.headers['x-forwarded-host']) || req.headers.host || `localhost:${port}`;
  const requestBaseUrl = `${protocol}://${host}`.replace(/\/+$/, '');
  const originBaseUrl = headerValue(req.headers.origin).replace(/\/+$/, '');

  const isLocalHost = (value: string) => {
    try {
      const url = new URL(value);
      return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    } catch {
      return false;
    }
  };

  const isPublicRequestHost =
    requestBaseUrl.startsWith('https://') &&
    !isLocalHost(requestBaseUrl) &&
    !requestBaseUrl.includes('undefined');

  if (isPublicRequestHost) return requestBaseUrl;

  if (originBaseUrl && originBaseUrl.startsWith('https://') && !isLocalHost(originBaseUrl)) {
    return originBaseUrl;
  }

  if (configured) return configured;
  return requestBaseUrl;
}

function userHasDeniedLoginHold(userId: string) {
  return Boolean(
    db
      .prepare(
        `
    SELECT 1 FROM login_alerts
    WHERE userId = ? AND status = 'denied'
    LIMIT 1
  `
      )
      .get(userId)
  );
}

function userHasPendingLoginHold(userId: string) {
  return Boolean(
    db
      .prepare(
        `
    SELECT 1 FROM login_alerts
    WHERE userId = ? AND status = 'pending' AND expiresAt > CURRENT_TIMESTAMP
    LIMIT 1
  `
      )
      .get(userId)
  );
}

function ensureWalletActionAllowed(userId: string) {
  return Boolean(userId) && !userHasDeniedLoginHold(userId) && !userHasPendingLoginHold(userId);
}

function createLoginAlertRecord(user: any, req: any) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const alertId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const ipAddress = String(
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP'
  );
  const userAgent = String(req.headers['user-agent'] || 'Unknown device');
  const location = String(req.headers['x-app-location'] || 'Unknown location');

  db.prepare(
    `
    INSERT INTO login_alerts (
      id, userId, status, tokenHash, expiresAt, ipAddress, userAgent, location, role, accountStatus, createdAt, updatedAt
    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    alertId,
    user.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
    location,
    user.role || 'customer',
    user.status || 'active'
  );

  return { token, expiresAt };
}

function findLoginAlertByToken(token: string) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  return db.prepare('SELECT * FROM login_alerts WHERE tokenHash = ?').get(tokenHash) as any;
}

function renderLoginAlertResponse(message: string, success = true) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>ESOKO Nexus Login Alert</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f7; color: #111827; margin: 0; padding: 0; }
          .container { max-width: 620px; margin: 40px auto; background: #fff; border-radius: 24px; padding: 32px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08); }
          .title { color: ${success ? '#0f766e' : '#b91c1c'}; margin-bottom: 16px; }
          .message { font-size: 15px; line-height: 1.75; color: #374151; }
          .footer { margin-top: 24px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="title">ESOKO Nexus Login Alert</h1>
          <p class="message">${escapeHtml(message)}</p>
          <div class="footer">If you did not initiate this action, please contact support@nexus.rw immediately.</div>
        </div>
      </body>
    </html>
  `;
}

async function sendLoginAlertEmail(req: any, user: any, token: string) {
  if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error('SMTP is not configured for login alert emails');
  }

  const time = new Date().toLocaleString();
  const userAgent = String(req.headers['user-agent'] || 'Unknown device');
  const ipAddress = String(
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP'
  );
  const location = String(
    req.headers['x-app-location'] || req.headers['x-app-location'] || 'Unknown location'
  );
  const baseUrl = appBaseUrl(req);
  const confirmUrl = `${baseUrl}/api/auth/login-alert/confirm?token=${encodeURIComponent(token)}`;
  const declineUrl = `${baseUrl}/api/auth/login-alert/decline?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: auto; padding: 24px; color: #1f2937;">
      <h1 style="color: #ea580c; margin-bottom: 16px;">Security Alert: New Login Detected</h1>
      <p>Hello ${escapeHtml(user.name || 'User')},</p>
      <p>We detected a successful login to your ESOKO Nexus account with these details:</p>
      <div style="background: #f8fafc; padding: 18px; border-radius: 16px; margin: 24px 0; font-size: 14px; color: #111827;">
        <p style="margin: 8px 0;"><strong>Time:</strong> ${escapeHtml(time)}</p>
        <p style="margin: 8px 0;"><strong>Device:</strong> ${escapeHtml(userAgent)}</p>
        <p style="margin: 8px 0;"><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</p>
        <p style="margin: 8px 0;"><strong>Location:</strong> ${escapeHtml(location)}</p>
        <p style="margin: 8px 0;"><strong>Role:</strong> ${escapeHtml(user.role || 'customer')}</p>
      </div>
      <p>Please confirm whether this login was authorized:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0;">
        <a href="${confirmUrl}" style="display: inline-block; background: #0f766e; color: #fff; padding: 14px 22px; border-radius: 12px; text-decoration: none; font-weight: 700;">Yes, this was me</a>
        <a href="${declineUrl}" style="display: inline-block; background: #b91c1c; color: #fff; padding: 14px 22px; border-radius: 12px; text-decoration: none; font-weight: 700;">No, block access</a>
      </div>
      <p>If you click <strong>No, block access</strong>, wallet operations will be restricted while our security team reviews the event.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">If you have any concerns, contact support at <a href="mailto:support@nexus.rw">support@nexus.rw</a>.</p>
    </div>
  `;

  await sendAppEmail({
    from: SMTP_FROM,
    to: user.email,
    subject: '🔐 ESOKO Nexus Login Alert – Confirm or block this login',
    html,
    text: `A login to your account was detected at ${time}. Confirm: ${confirmUrl}  Deny: ${declineUrl}`,
  });
}

async function createLoginAlertNotification(user: any, message: string, type = 'error') {
  db.prepare(
    `
    INSERT INTO notifications (id, userId, title, message, type, subType, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'security', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(uuidv4(), user.id, 'Login security alert', message, type);
}

async function processLoginAlertAction(req: any, res: any, action: 'confirm' | 'decline') {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).send(renderLoginAlertResponse('Missing or invalid token.', false));
  }

  const alert = findLoginAlertByToken(token);
  if (!alert) {
    return res
      .status(404)
      .send(renderLoginAlertResponse('Login alert not found or already processed.', false));
  }

  if (alert.status !== 'pending') {
    return res
      .status(400)
      .send(renderLoginAlertResponse('This login alert has already been processed.', false));
  }

  if (new Date(alert.expiresAt).getTime() < Date.now()) {
    db.prepare(
      'UPDATE login_alerts SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('expired', alert.id);
    return res
      .status(400)
      .send(
        renderLoginAlertResponse(
          'This login alert has expired. Please log in again to receive a fresh alert.',
          false
        )
      );
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(alert.userId) as any;
  if (!user) {
    return res.status(404).send(renderLoginAlertResponse('User not found for this alert.', false));
  }

  if (action === 'confirm') {
    db.prepare(
      'UPDATE login_alerts SET status = ?, decisionAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('confirmed', alert.id);
    await createLoginAlertNotification(
      user,
      'You confirmed the recent login. Wallet operations remain enabled.',
      'success'
    );
    logSystem(`Login alert confirmed for user ${user.email}`, 'info', 'security', user.id);
    return res.send(
      renderLoginAlertResponse(
        'Thank you. The login has been confirmed and your account remains active.'
      )
    );
  }

  db.prepare(
    'UPDATE login_alerts SET status = ?, decisionAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('denied', alert.id);
  await createLoginAlertNotification(
    user,
    'You denied the recent login. Wallet operations are now blocked pending review.',
    'error'
  );
  logSystem(`Login alert denied for user ${user.email}`, 'warn', 'security', user.id);
  return res.send(
    renderLoginAlertResponse(
      'Login denied. Wallet actions are now blocked until the event is reviewed.'
    )
  );
}

async function sendPasswordResetEmail(req: any, user: any, resetUrl: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937;">
      <h1 style="color: #ea580c; margin-bottom: 8px;">Reset your ESOKO Nexus password</h1>
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>We received a request to reset the password for your self-contained ESOKO Nexus account.</p>
      <p style="margin: 28px 0;">
        <a href="${resetUrl}" style="background: #ea580c; color: #ffffff; padding: 14px 22px; border-radius: 12px; text-decoration: none; font-weight: 700;">
          Reset Password
        </a>
      </p>
      <p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>
      <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${escapeHtml(resetUrl)}</p>
    </div>
  `;

  await sendAppEmail({
    from: SMTP_FROM,
    to: user.email,
    subject: 'Reset your ESOKO Nexus password',
    html,
    text: `Reset your ESOKO Nexus password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

async function sendEmailVerificationEmail(req: any, user: any, verificationUrl: string) {
  const isTrader = user.role === 'trader';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937;">
      <h1 style="color: #ea580c; margin-bottom: 8px;">Verify your ESOKO Nexus email</h1>
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>Welcome to ESOKO Nexus! Please verify your email address to complete your registration.</p>
      <p style="margin: 28px 0;">
        <a href="${verificationUrl}" style="background: #ea580c; color: #ffffff; padding: 14px 22px; border-radius: 12px; text-decoration: none; font-weight: 700;">
          Verify Email
        </a>
      </p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px;margin:20px 0;">
        <h2 style="font-size:16px;margin:0 0 8px;color:#9a3412;">Optional verification badge</h2>
        <p style="margin:0 0 12px;">
          ${
            isTrader
              ? 'After your email is verified, you can use your account. Later, you can upload business documents if you want a verified trader badge and stronger shop trust.'
              : 'After your email is verified, you can use your account. Later, you can upload an identity document if you want a verified badge or higher trust features.'
          }
        </p>
        <p style="font-size:12px;color:#9a3412;margin:0;">Document upload is not required to create your account.</p>
      </div>
      <p>This link expires in 24 hours. If you did not sign up for this account, you can ignore this email.</p>
      <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${escapeHtml(verificationUrl)}</p>
    </div>
  `;

  await sendAppEmail({
    from: SMTP_FROM,
    to: user.email,
    subject: 'Verify your ESOKO Nexus email address',
    html,
    text: `Verify your email: ${verificationUrl}\n\nDocument upload is optional and can be done later if you want a verified badge.\n\nThis link expires in 24 hours.`,
  });
}

function createEmailVerificationToken(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    db.prepare(
      `
      UPDATE email_verification_tokens
      SET verifiedAt = CURRENT_TIMESTAMP
      WHERE userId = ? AND verifiedAt IS NULL
    `
    ).run(userId);

    db.prepare(
      `
      INSERT INTO email_verification_tokens (id, userId, tokenHash, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), userId, tokenHash, expiresAt);
  })();

  return { token, expiresAt };
}

function buildEmailVerificationUrl(req: any, token: string, email: string) {
  return `${appBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

function createContactOtp(userId: string, channel: 'email' | 'whatsapp', destination: string) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(
    `
    UPDATE contact_verification_otps
    SET verifiedAt = COALESCE(verifiedAt, CURRENT_TIMESTAMP), updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ? AND channel = ? AND destination = ? AND verifiedAt IS NULL
  `
  ).run(userId, channel, destination);
  db.prepare(
    `
    INSERT INTO contact_verification_otps
      (id, userId, channel, destination, otpHash, expiresAt, metadata, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    uuidv4(),
    userId,
    channel,
    destination,
    hashToken(otp),
    expiresAt,
    JSON.stringify({ sender: channel === 'whatsapp' ? WHATSAPP_OTP_SENDER : SMTP_FROM })
  );
  return { otp, expiresAt };
}

async function sendContactEmailOtp(user: any, otp: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; color: #1f2937;">
      <h1 style="color:#ea580c;margin:0 0 12px;">Your ESOKO verification code</h1>
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>Enter this code in your ESOKO profile to verify your email for your badge.</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:0.18em;color:#111827;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:18px;text-align:center;margin:20px 0;">${otp}</div>
      <p>This code expires in 10 minutes. If you did not request it, ignore this message.</p>
    </div>
  `;
  await sendAppEmail({
    from: SMTP_FROM,
    to: user.email,
    subject: 'Your ESOKO verification code',
    html,
    text: `Your ESOKO verification code is ${otp}. It expires in 10 minutes.`,
  });
}

async function sendWhatsAppOtp(destination: string, otp: string, user: any) {
  const message = `Your ESOKO verification OTP is ${otp}. It expires in 10 minutes.`;
  const to = destination.replace(/[^\d+]/g, '');
  const sender = WHATSAPP_OTP_SENDER.replace(/[^\d+]/g, '');

  if (WHATSAPP_OTP_PROVIDER_URL) {
    const response = await fetch(WHATSAPP_OTP_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WHATSAPP_OTP_PROVIDER_TOKEN
          ? { Authorization: `Bearer ${WHATSAPP_OTP_PROVIDER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        from: sender,
        to,
        message,
        otp,
        userId: user.id,
        template: 'esoko_verification_otp',
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `WhatsApp provider failed: ${response.status}`);
    }
    return { autoSent: true, sender, providerResponse: payload };
  }

  const support = sender.replace(/[^\d]/g, '');
  const handoffText = [
    'ESOKO OTP send request',
    `User: ${user.name || user.email}`,
    `User phone: ${destination}`,
    'Please send this verification OTP to the user:',
    otp,
  ].join('\n');
  return {
    autoSent: false,
    sender,
    whatsappUrl: support
      ? `https://wa.me/${support}?text=${encodeURIComponent(handoffText)}`
      : null,
    setupRequired: true,
  };
}

function syncAuthenticatedVerification(userId: string) {
  const identity = db
    .prepare('SELECT phoneVerified, emailVerified FROM identity_verifications WHERE userId = ?')
    .get(userId) as any;
  if (!identity?.phoneVerified || !identity?.emailVerified) {
    return { verified: false, identity };
  }

  db.prepare(
    `
    UPDATE users
    SET verificationStatus = 'verified',
        verifiedAt = COALESCE(verifiedAt, CURRENT_TIMESTAMP),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(userId);
  db.prepare(
    `
    UPDATE user_accounts
    SET verificationStatus = 'verified',
        status = 'active',
        updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ?
  `
  ).run(userId);
  mirrorAccountState(userId);
  return {
    verified: true,
    user: db.prepare('SELECT * FROM users WHERE id = ?').get(userId),
  };
}

async function sendLoginNotificationEmail(req: any, user: any) {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP is not configured for login notifications');
  }

  const time = new Date().toLocaleString();
  const userAgent = String(req.headers['user-agent'] || 'Unknown device');
  const ipAddress = String(
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP'
  );
  const location = String(req.headers['x-app-location'] || 'Unknown location');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937;">
      <h1 style="color: #ea580c; margin-bottom: 12px;">Security Alert: New Login Detected</h1>
      <p>Hello ${escapeHtml(user.name || 'User')},</p>
      <p>We noticed a successful login to your ESOKO Nexus account from the following device:</p>
      <div style="background: #f9fafb; padding: 16px; border-radius: 12px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; color: #374151; font-size: 14px;">
          <tr><td style="padding: 8px 0; font-weight: 700;">Time:</td><td style="text-align: right;">${escapeHtml(time)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 700;">Device:</td><td style="text-align: right;">${escapeHtml(userAgent)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 700;">IP Address:</td><td style="text-align: right;">${escapeHtml(ipAddress)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 700;">Location:</td><td style="text-align: right;">${escapeHtml(location)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 700;">Role:</td><td style="text-align: right;">${escapeHtml(user.role || 'customer')}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 700;">Status:</td><td style="text-align: right;">${escapeHtml(user.status || 'active')}</td></tr>
        </table>
      </div>
      <p>If you did not log in from this device, please change your password immediately and contact support at <a href="mailto:support@nexus.rw">support@nexus.rw</a>.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">This is an automated security notification from ESOKO Nexus.</p>
    </div>
  `;

  await sendAppEmail({
    from: SMTP_FROM,
    to: user.email,
    subject: '🔐 Security Alert: New Login to Your ESOKO Nexus Account',
    html,
    text: `Hello ${user.name || 'User'},\n\nA successful login to your ESOKO Nexus account was detected on ${time}.\n\nDevice: ${userAgent}\nIP Address: ${ipAddress}\nLocation: ${location}\nRole: ${user.role || 'customer'}\nStatus: ${user.status || 'active'}\n\nIf this wasn't you, change your password immediately and contact support@nexus.rw.`,
  });
}

async function handlePasswordResetRequest(req: any, res: any) {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    return res.status(404).json({
      error: 'No account exists with that email address.',
    });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    return res
      .status(503)
      .json({ error: 'SMTP is not configured. Set SMTP_USER and SMTP_PASS to send reset emails.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const resetUrl = `${appBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  db.prepare(
    `
    INSERT INTO password_reset_tokens (id, userId, tokenHash, expiresAt, createdAt)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(uuidv4(), user.id, tokenHash, expiresAt);

  await sendPasswordResetEmail(req, user, resetUrl);
  logSystem(`Password reset email sent for ${email}`, 'info', 'auth', user.id);
  res.json({ success: true, message: 'Password reset email sent.' });
}

function parseJsonObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function dropUndefined(input: Record<string, any>) {
  return Object.fromEntries(Object.entries(input || {}).filter(([, value]) => value !== undefined));
}

function applyFieldTransforms(base: Record<string, any>, updates: Record<string, any>) {
  const next = { ...base };
  for (const [key, value] of Object.entries(updates || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && '__increment' in value) {
      next[key] = asNumber(next[key]) + asNumber((value as any).__increment);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function getCollectionDocument(collectionName: string, id: string) {
  const row = db
    .prepare(
      `
    SELECT * FROM collection_documents WHERE collection = ? AND id = ?
  `
    )
    .get(collectionName, id) as any;
  if (!row) return null;

  const data = parseJsonObject(row.data);
  return {
    ...data,
    id: row.id,
    createdAt: data.createdAt ?? row.createdAt,
    updatedAt: data.updatedAt ?? row.updatedAt,
  };
}

function saveCollectionDocument(collectionName: string, id: string, data: Record<string, any>) {
  const existing = getCollectionDocument(collectionName, id);
  const now = new Date().toISOString();
  const document = {
    ...(existing || {}),
    ...dropUndefined(data),
    id,
    createdAt: data.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };

  db.prepare(
    `
    INSERT INTO collection_documents (collection, id, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET
      data = excluded.data,
      updatedAt = excluded.updatedAt
  `
  ).run(collectionName, id, JSON.stringify(document), document.createdAt, document.updatedAt);

  return document;
}

const restrictedGenericCollections = new Set([
  'platform_revenue',
  'platform_settings',
  'trader_financials',
]);

const genericOwnerFields = [
  'userId',
  'ownerId',
  'createdBy',
  'createdById',
  'customerId',
  'traderId',
  'agentId',
  'managerId',
  'senderId',
  'recipientId',
  'employeeId',
  'memberId',
];

const genericParticipantFields = [
  'participants',
  'participantIds',
  'members',
  'memberIds',
  'userIds',
  'assignedTo',
];

function isElevatedRole(role: string | undefined) {
  return role === 'admin' || role === 'manager';
}

function fieldContainsUser(value: any, userId: string) {
  if (value === userId) return true;
  if (Array.isArray(value)) {
    return value.some((item) => item === userId || item?.id === userId || item?.userId === userId);
  }
  if (value && typeof value === 'object') {
    return value.id === userId || value.userId === userId || Boolean(value[userId]);
  }
  return false;
}

function canAccessGenericDocument(
  req: any,
  collectionName: string,
  document: Record<string, any> | null | undefined
) {
  if (!document || !req.user?.id) return false;
  if (isElevatedRole(req.user.role)) return true;
  if (restrictedGenericCollections.has(collectionName)) return false;

  const teamMembershipId = String(req.cookies?.nexus_team_access || '');
  if (teamMembershipId && document.traderId) {
    const membership = db
      .prepare('SELECT traderId FROM team_members WHERE id = ? AND userId = ? AND status = ?')
      .get(teamMembershipId, req.user.id, 'active') as any;
    if (membership?.traderId && document.traderId === membership.traderId) return true;
  }

  return [...genericOwnerFields, ...genericParticipantFields].some((field) =>
    fieldContainsUser(document[field], req.user.id)
  );
}

function prepareGenericDocumentForWrite(
  req: any,
  collectionName: string,
  body: Record<string, any>
) {
  if (isElevatedRole(req.user?.role)) return body;
  if (restrictedGenericCollections.has(collectionName)) return null;

  const next = { ...body };
  const hasOwner = [...genericOwnerFields, ...genericParticipantFields].some(
    (field) => next[field] !== undefined
  );
  if (!hasOwner) {
    const teamMembershipId = String(req.cookies?.nexus_team_access || '');
    const membership = teamMembershipId
      ? (db
          .prepare('SELECT traderId FROM team_members WHERE id = ? AND userId = ? AND status = ?')
          .get(teamMembershipId, req.user.id, 'active') as any)
      : null;
    if (membership?.traderId) {
      next.traderId = membership.traderId;
      next.createdBy = req.user.id;
    } else {
      next.userId = req.user.id;
      next.createdBy = req.user.id;
    }
  }

  return canAccessGenericDocument(req, collectionName, next) ? next : null;
}

function normalizeComparable(value: any) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return Number(value);
  if (typeof value === 'number') return value;
  const numeric = Number(value);
  if (value !== '' && Number.isFinite(numeric)) return numeric;
  const time = Date.parse(String(value));
  if (!Number.isNaN(time) && /[-T:]/.test(String(value))) return time;
  return String(value).toLowerCase();
}

function valuesMatch(actual: any, expected: any, operator: string) {
  const left = normalizeComparable(actual);
  const right = normalizeComparable(expected);
  switch (operator) {
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    default:
      return left === right;
  }
}

function filterCollectionDocuments(documents: any[], query: any) {
  const ignored = new Set(['limit', 'offset', 'orderBy', 'order', 'sortBy', 'sortOrder']);
  return documents.filter((document) => {
    for (const [rawKey, rawValue] of Object.entries(query || {})) {
      if (ignored.has(rawKey)) continue;
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      let field = rawKey;
      let operator = '==';
      if (rawKey.endsWith('__ne')) {
        field = rawKey.slice(0, -4);
        operator = '!=';
      } else if (rawKey.endsWith('__lt')) {
        field = rawKey.slice(0, -4);
        operator = '<';
      } else if (rawKey.endsWith('__lte')) {
        field = rawKey.slice(0, -5);
        operator = '<=';
      } else if (rawKey.endsWith('__gt')) {
        field = rawKey.slice(0, -4);
        operator = '>';
      } else if (rawKey.endsWith('__gte')) {
        field = rawKey.slice(0, -5);
        operator = '>=';
      }

      if (!valuesMatch(document[field], value, operator)) return false;
    }
    return true;
  });
}

const firestoreDocumentCollections = new Set([
  'linked_accounts',
  'loans',
  'payroll',
  'employees',
  'team_members',
  'messages',
  'tasks',
  'incentive_programs',
  'platform_revenue',
  'platform_settings',
  'referrals',
  'chats',
  'suppliers',
  'orders',
  'wallets',
  'loyalty_points',
  'incentives',
  'trader_financials',
]);

app.get('/api/health', (_req, res) => {
  let database = 'error';
  try {
    database = db.prepare('SELECT 1 as ok').get() ? 'connected' : 'error';
  } catch {
    database = 'error';
  }

  res.json({
    status: database === 'connected' ? 'ok' : 'degraded',
    app: 'Esoko Nexus',
    database,
    accountStore: accountStoreBackend,
    storage: {
      dataDir: path.resolve(env.DATA_DIR || path.join(process.cwd(), 'data')),
      uploadDir,
    },
    backend: 'express',
    firebase: false,
    email: {
      configured: Boolean(SMTP_USER && SMTP_PASS && SMTP_FROM),
      provider: RESEND_API_KEY ? 'resend-with-smtp-fallback' : 'smtp',
      resendConfigured: Boolean(RESEND_API_KEY),
      smtpConfigured: Boolean(SMTP_USER && SMTP_PASS),
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      family: Number(env.SMTP_FAMILY || 4),
      correctedMisconfiguredGmailPort: shouldUseGmailStartTls,
      forcedIpv4Lookup: true,
      from: SMTP_FROM ? 'configured' : 'missing',
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/register', validateRequest(RegisterSchema), (req: any, res): any => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim();
    const requestedRole = normalizeRole(req.body.role);
    const adminCount = (
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any
    ).count;
    const role = requestedRole === 'admin' && adminCount > 0 ? 'customer' : requestedRole;

    if (!email || !email.includes('@'))
      return res.status(400).json({ error: 'Valid email is required' });
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered. Please log in to add another account mode.',
        code: 'EMAIL_EXISTS_LOGIN_REQUIRED',
        loginRequired: true,
      });
    }

    const id = uuidv4();
    const appNumber = generateAppNumber();
    const verificationStatus = 'pending';
    const onboardingComplete = 1;

    const surveyResponses = Array.isArray(req.body.surveyResponses) ? req.body.surveyResponses : [];

    db.prepare(
      `
      INSERT INTO users (
        id, email, name, password, role, verificationStatus, walletBalance, appNumber,
        tier, phone, businessName, businessCategory, location, tin, category,
        onboardingComplete, loyaltyPoints, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'free', ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      id,
      email,
      name,
      hashPassword(password),
      role,
      verificationStatus,
      role === 'customer' ? 10000 : 0,
      appNumber,
      req.body.phone || null,
      req.body.businessName || null,
      req.body.businessCategory || null,
      req.body.location || null,
      req.body.tin || null,
      req.body.category || null,
      onboardingComplete
    );

    const insertSurveyResponseStmt = db.prepare(
      'INSERT INTO survey_responses (id, userId, questionId, response, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );
    const surveyQuestionExistsStmt = db.prepare('SELECT id FROM survey_questions WHERE id = ?');
    const insertSurveyResponses = db.transaction((responses: any[]) => {
      for (const response of responses) {
        const questionId = String(response.questionId || '').trim();
        const answer = response.response;
        if (!questionId || answer === undefined) continue;
        if (!surveyQuestionExistsStmt.get(questionId)) continue;
        insertSurveyResponseStmt.run(uuidv4(), id, questionId, JSON.stringify(answer));
      }
    });

    if (surveyResponses.length > 0) {
      insertSurveyResponses(surveyResponses);
    }

    createAccountMode(id, role, {
      phone: req.body.phone || null,
      businessName: req.body.businessName || null,
      businessCategory: req.body.businessCategory || null,
      businessLocation: req.body.location || null,
      tin: req.body.tin || null,
      category: req.body.category || null,
    });

    db.prepare(
      `
      INSERT OR IGNORE INTO loyalty_points (id, userId, points, totalEarned, updatedAt)
      VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), id);

    db.prepare(
      `
      INSERT INTO notifications (id, userId, title, message, type, subType, createdAt, updatedAt)
      VALUES (?, ?, 'Welcome', ?, 'success', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), id, `Welcome to Esoko Nexus, ${name}. Your local account is ready.`);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const activeAccount = getAccountModes(id).find((account: any) => account.role === role);
    mirrorAccountState(id);
    const selectedUser = selectAccountMode(req, res, user, activeAccount);
    const { accessToken } = issueAuthCookies(req, res, selectedUser);
    const publicUserData = publicUserWithAccess(req, selectedUser);
    const redirectTo = onboardingComplete ? `/${role}` : '/onboarding';

    logSystem(`New ${role} registered: ${email}`, 'info', 'auth', id);

    // Send verification email asynchronously (don't block registration)
    void (async () => {
      try {
        if (SMTP_USER && SMTP_PASS) {
          const { token: verificationToken } = createEmailVerificationToken(id);
          const verificationUrl = buildEmailVerificationUrl(req, verificationToken, email);
          await sendEmailVerificationEmail(req, user, verificationUrl);
          logSystem(`Registration verification email sent to ${email}`, 'info', 'auth', id);
        }
      } catch (emailError) {
        console.error('Failed to send registration verification email:', emailError);
        logSystem(
          `Failed to send registration verification email to ${email}`,
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
      role,
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

app.post('/api/auth/login', validateRequest(LoginSchema), async (req: any, res): Promise<any> => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || '');
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) {
      user = await hydrateSqliteUserFromPostgres(db as any, email);
    }

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
      mirrorAccountState(user.id);
    }

    let freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
    let accountModes = getAccountModes(freshUser.id);
    if (accountModes.length === 0) {
      createAccountMode(freshUser.id, freshUser.role || 'customer', freshUser);
      accountModes = getAccountModes(freshUser.id);
    }

    const teamOptions = getTeamAccessOptions(freshUser.id);
    const needsAccessChoice = accountModes.length > 1 || teamOptions.length > 0;
    if (accountModes.length === 1 && teamOptions.length === 0) {
      freshUser = selectAccountMode(req, res, freshUser, accountModes[0]);
    } else {
      res.clearCookie('nexus_account_mode', accountModeCookieOptions);
      res.clearCookie('nexus_team_access', teamAccessCookieOptions);
    }

    const { accessToken } = issueAuthCookies(req, res, freshUser);
    const publicUserData = publicUserWithAccess(req, freshUser);
    const redirectTo = needsAccessChoice
      ? '/access-choice'
      : freshUser.onboardingComplete
        ? `/${freshUser.role}`
        : '/onboarding';

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
    void maybeSendVerificationReminder(req, freshUser).catch((emailError) => {
      console.error('Verification reminder failed:', emailError);
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

app.get('/api/auth/login-alert/confirm', async (req: any, res): Promise<any> => {
  return processLoginAlertAction(req, res, 'confirm');
});

app.get('/api/auth/login-alert/decline', async (req: any, res): Promise<any> => {
  return processLoginAlertAction(req, res, 'decline');
});

app.post('/api/auth/refresh', (req: any, res): any => {
  const refreshed = consumeRefreshToken(req.cookies.nexus_refresh_token, req, res);
  if (!refreshed?.user) {
    return res.status(401).json({ error: 'Refresh session expired' });
  }

  res.json({ success: true, user: publicUserWithAccess(req, refreshed.user), token: refreshed.accessToken });
});

app.post('/api/auth/logout', (req: any, res) => {
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

app.get('/api/me', authenticate, (req: any, res): any => {
  void maybeSendVerificationReminder(req, req.user).catch((emailError) => {
    console.error('Verification reminder failed:', emailError);
  });
  res.json({ success: true, user: publicUserWithAccess(req, req.user) });
});

function teamInviteSelect(filterByTrader = false) {
  return `
    SELECT ti.*, b.name as branchName, b.location as branchLocation,
           u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
    FROM team_invitations ti
    JOIN users u ON u.id = ti.traderId
    LEFT JOIN branches b ON b.id = ti.branchId
    ${filterByTrader ? 'WHERE ti.traderId = ?' : ''}
    ORDER BY ti.createdAt DESC
  `;
}

function normalizeTeamInvitation(row: any, includeToken = false, token?: string) {
  if (!row) return null;
  const invitation = {
    ...row,
    permissions: parseJsonField(row.permissions, []),
    branch: row.branchId
      ? { id: row.branchId, name: row.branchName || null, location: row.branchLocation || null }
      : null,
    trader: {
      id: row.traderId,
      name: row.traderBusinessName || row.traderName || row.traderEmail || 'Trader',
      email: row.traderEmail || null,
      businessName: row.traderBusinessName || null,
    },
  };
  delete (invitation as any).tokenHash;
  if (includeToken && token) (invitation as any).token = token;
  return invitation;
}

function createTeamInvitationEmail(req: any, invitation: any, token: string) {
  const acceptUrl = `${appBaseUrl(req)}/team-invite?token=${encodeURIComponent(token)}`;
  const denyUrl = `${appBaseUrl(req)}/team-invite?token=${encodeURIComponent(token)}&decision=deny`;
  const shopName = invitation.traderBusinessName || invitation.traderName || 'a trader shop';
  const branchText = invitation.branchName ? `${invitation.branchName}${invitation.branchLocation ? ` - ${invitation.branchLocation}` : ''}` : 'Main shop';
  return {
    acceptUrl,
    denyUrl,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; color: #1f2937;">
        <h1 style="color: #ea580c; margin-bottom: 8px;">Trader team invitation</h1>
        <p>Hello ${invitation.name},</p>
        <p><strong>${shopName}</strong> invited you to help operate their ESOKO Nexus shop dashboard.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; margin: 18px 0;">
          <p><strong>Role:</strong> ${invitation.role}</p>
          <p><strong>Branch:</strong> ${branchText}</p>
          <p><strong>Permissions:</strong> ${(parseJsonField(invitation.permissions, []) || []).join(', ') || 'General shop access'}</p>
        </div>
        <p>This access needs your consent. You can accept and fill your information, or deny the invitation.</p>
        <p style="margin: 24px 0;">
          <a href="${acceptUrl}" style="background: #ea580c; color: white; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 700;">Review invitation</a>
        </p>
        <p><a href="${denyUrl}" style="color: #dc2626;">Deny this invitation</a></p>
        <p style="font-size: 12px; color: #6b7280;">This link expires in 7 days. If you were not expecting this invitation, you can deny it or ignore this email.</p>
      </div>
    `,
    text: `${shopName} invited you to join their ESOKO Nexus trader team as ${invitation.role}. Review: ${acceptUrl} Deny: ${denyUrl}`,
  };
}

async function sendTeamInvitationEmail(req: any, invitation: any, token: string) {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP is not configured for team invitation emails');
  }
  const email = createTeamInvitationEmail(req, invitation, token);
  await sendAppEmail({
    from: SMTP_FROM,
    to: invitation.email,
    subject: 'ESOKO Nexus trader team invitation',
    html: email.html,
    text: email.text,
  });
}

app.get('/api/auth/access-options', authenticate, (req: any, res): any => {
  res.json({
    success: true,
    ownAccount: publicUser(req.user),
    activeAccount: getActiveAccount(req, req.user),
    accountModes: getAccountModes(req.user.id),
    activeTeamContext: getActiveTeamContext(req),
    teamAccessOptions: getTeamAccessOptions(req.user.id),
  });
});

app.post('/api/auth/select-access', authenticate, (req: any, res): any => {
  const mode = String(req.body.mode || 'own');
  if (mode === 'own' || mode === 'account') {
    const accountId = String(req.body.accountId || '');
    const requestedRole = req.body.role ? normalizeRole(req.body.role) : null;
    const account =
      (accountId
        ? (db
            .prepare('SELECT * FROM user_accounts WHERE id = ? AND userId = ?')
            .get(accountId, req.user.id) as any)
        : null) ||
      (requestedRole
        ? (db
            .prepare('SELECT * FROM user_accounts WHERE userId = ? AND role = ?')
            .get(req.user.id, requestedRole) as any)
        : null) ||
      getActiveAccount(req, req.user);

    if (!account) return res.status(404).json({ error: 'Account mode was not found' });
    const selectedUser = selectAccountMode(req, res, req.user, account);
    res.clearCookie('nexus_team_access', teamAccessCookieOptions);
    return res.json({
      success: true,
      user: publicUserWithAccess(req, selectedUser),
      redirectTo: selectedUser.onboardingComplete ? `/${selectedUser.role}` : '/onboarding',
    });
  }

  const membershipId = String(req.body.membershipId || '');
  const membership = db
    .prepare('SELECT * FROM team_members WHERE id = ? AND userId = ? AND status = ?')
    .get(membershipId, req.user.id, 'active') as any;
  if (!membership) return res.status(404).json({ error: 'Team access was not found or is inactive' });

  db.prepare('UPDATE team_members SET lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(membershipId);
  res.cookie('nexus_team_access', membershipId, teamAccessCookieOptions);
  const activeContext = getTeamAccessOptions(req.user.id).find((item: any) => item.id === membershipId) || null;
  res.json({
    success: true,
    user: { ...publicUser(req.user), teamAccessOptions: getTeamAccessOptions(req.user.id), activeTeamContext: activeContext },
    redirectTo: '/trader',
  });
});

app.get('/api/accounts', authenticate, (req: any, res): any => {
  res.json({
    success: true,
    activeAccount: getActiveAccount(req, req.user),
    accounts: getAccountModes(req.user.id),
  });
});

app.post('/api/accounts/create-role', authenticate, (req: any, res): any => {
  const role = normalizeRole(req.body.role);
  if (!['customer', 'trader', 'agent'].includes(role)) {
    return res.status(400).json({ error: 'Only customer, trader, and agent account modes can be self-created.' });
  }

  const existing = db
    .prepare('SELECT * FROM user_accounts WHERE userId = ? AND role = ?')
    .get(req.user.id, role) as any;
  if (existing) {
    return res.status(409).json({
      error: `You already have a ${role} account mode.`,
      account: normalizeUserAccount(existing),
    });
  }

  const account = createAccountMode(req.user.id, role, req.body);
  const selectedUser = selectAccountMode(req, res, req.user, account);
  logSystem(`Account mode created: ${role}`, 'info', 'auth', req.user.id);

  res.json({
    success: true,
    account,
    user: publicUserWithAccess(req, selectedUser),
    redirectTo: selectedUser.onboardingComplete ? `/${selectedUser.role}` : '/onboarding',
  });
});

app.get('/api/verification/contact-status', authenticate, (req: any, res): any => {
  const identity = db
    .prepare('SELECT * FROM identity_verifications WHERE userId = ?')
    .get(req.user.id) as any;
  res.json({
    success: true,
    email: req.user.email || identity?.email || null,
    emailVerified: Boolean(req.user.emailVerified || identity?.emailVerified),
    whatsappVerified: Boolean(identity?.phoneVerified),
    verificationStatus: req.user.verificationStatus || 'pending',
  });
});

app.post('/api/verification/email-otp/request', authenticate, async (req: any, res): Promise<any> => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user?.email) return res.status(400).json({ error: 'Your account has no email address' });
    const { otp, expiresAt } = createContactOtp(user.id, 'email', user.email);
    await sendContactEmailOtp(user, otp);
    res.json({ success: true, message: 'Email OTP sent', destination: user.email, expiresAt });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send email OTP', details: error.message });
  }
});

app.post('/api/verification/whatsapp-otp/request', authenticate, async (req: any, res): Promise<any> => {
  const phone = String(req.body.phone || req.user.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'WhatsApp number is required' });
  try {
    db.prepare('UPDATE users SET phone = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
      phone,
      req.user.id
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    const { otp, expiresAt } = createContactOtp(user.id, 'whatsapp', phone);
    const delivery = await sendWhatsAppOtp(phone, otp, user);
    res.json({
      success: true,
      message: delivery.autoSent
        ? 'WhatsApp OTP sent'
        : 'WhatsApp OTP created. Configure a WhatsApp provider for automatic sending.',
      destination: phone,
      expiresAt,
      sender: delivery.sender,
      autoSent: delivery.autoSent,
      whatsappUrl: delivery.whatsappUrl,
      setupRequired: delivery.setupRequired,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send WhatsApp OTP', details: error.message });
  }
});

app.post('/api/verification/otp/verify', authenticate, (req: any, res): any => {
  const channel = String(req.body.channel || '').trim().toLowerCase();
  const destination = String(req.body.destination || '').trim();
  const otp = String(req.body.otp || '').trim();
  if (!['email', 'whatsapp'].includes(channel)) {
    return res.status(400).json({ error: 'Verification channel must be email or whatsapp' });
  }
  if (!destination || !otp) return res.status(400).json({ error: 'Destination and OTP are required' });

  const record = db
    .prepare(
      `
      SELECT * FROM contact_verification_otps
      WHERE userId = ? AND channel = ? AND destination = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `
    )
    .get(req.user.id, channel, destination) as any;
  if (!record) return res.status(400).json({ error: 'No active OTP found. Request a new code.' });
  if (record.verifiedAt) return res.json({ success: true, message: 'Already verified' });
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'OTP expired. Request a new code.' });
  }
  if (Number(record.attempts || 0) >= 5) {
    return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  }
  if (record.otpHash !== hashToken(otp)) {
    db.prepare(
      'UPDATE contact_verification_otps SET attempts = attempts + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(record.id);
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  db.transaction(() => {
    db.prepare(
      'UPDATE contact_verification_otps SET verifiedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(record.id);
    db.prepare(
      `
      INSERT INTO identity_verifications
        (id, userId, status, phoneVerified, emailVerified, createdAt, updatedAt)
      VALUES (?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(userId) DO UPDATE SET
        phoneVerified = CASE WHEN ? = 'whatsapp' THEN 1 ELSE phoneVerified END,
        emailVerified = CASE WHEN ? = 'email' THEN 1 ELSE emailVerified END,
        updatedAt = CURRENT_TIMESTAMP
    `
    ).run(
      uuidv4(),
      req.user.id,
      channel === 'whatsapp' ? 1 : 0,
      channel === 'email' ? 1 : 0,
      channel,
      channel
    );
    if (channel === 'email') {
      db.prepare(
        'UPDATE users SET emailVerified = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(req.user.id);
    }
  })();

  const result = syncAuthenticatedVerification(req.user.id);
  const user = (result.user || db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) as any;
  res.json({
    success: true,
    channel,
    verified: result.verified,
    user: publicUserWithAccess(req, user),
  });
});

app.get('/api/verification/license-types', authenticate, (req: any, res): any => {
  const role = String(req.query.role || req.user.role || 'customer').toLowerCase();
  const rows = db
    .prepare(
      `
      SELECT * FROM license_types
      WHERE enabled = 1 AND (appliesTo LIKE ? OR appliesTo = 'all')
      ORDER BY category ASC, name ASC
    `
    )
    .all(`%${role}%`) as any[];
  res.json({ success: true, licenseTypes: rows });
});

app.get('/api/verification/my-request', authenticate, (req: any, res): any => {
  const role = String(req.query.role || req.user.role || 'customer').toLowerCase();
  const account = getActiveAccount(req, req.user);
  let request = db
    .prepare(
      `
      SELECT * FROM verification_requests
      WHERE userId = ? AND role = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `
    )
    .get(req.user.id, role) as any;

  if (!request) {
    const id = uuidv4();
    db.prepare(
      `
      INSERT INTO verification_requests
        (id, userId, accountId, role, status, riskStatus, legalName, phone, businessName, businessCategory, businessAddress, tin, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      id,
      req.user.id,
      account?.id || null,
      role,
      req.user.name || null,
      req.user.phone || null,
      req.user.businessName || null,
      req.user.businessCategory || null,
      req.user.location || null,
      req.user.tin || null
    );
    request = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(id);
  }

  const documents = db
    .prepare('SELECT * FROM verification_documents WHERE userId = ? ORDER BY createdAt DESC')
    .all(req.user.id);
  const identityDocuments = db
    .prepare('SELECT * FROM user_identity_documents WHERE userId = ? ORDER BY createdAt DESC')
    .all(req.user.id);
  const riskFlags = db
    .prepare(
      "SELECT * FROM risk_flags WHERE verificationRequestId = ? AND status = 'open' ORDER BY createdAt DESC"
    )
    .all(request.id);

  res.json({
    success: true,
    request: {
      ...request,
      metadata: parseMetadata(request.metadata),
    },
    documents: documents.map((doc: any) => ({
      ...doc,
      metadata: parseMetadata(doc.metadata),
      extractedFields: parseMetadata(doc.extractedFields),
      autoReasons: parseMetadata(doc.autoReasons),
    })),
    identityDocuments: identityDocuments.map((doc: any) => ({
      ...doc,
      metadata: parseMetadata(doc.metadata),
    })),
    riskFlags,
    requiredLicenseIds: requiredLicenseIdsForRequest(request),
  });
});

app.post('/api/verification/request', authenticate, (req: any, res): any => {
  const role = normalizeRole(req.body.role || req.user.role || 'customer');
  const account =
    getActiveAccount(req, req.user) ||
    (role !== req.user.role
      ? (db
          .prepare('SELECT * FROM user_accounts WHERE userId = ? AND role = ?')
          .get(req.user.id, role) as any)
      : null);
  const identityNumber = String(req.body.identityNumber || '').trim();
  const identityNumberHash = identityNumber ? stableHash(identityNumber) : null;
  const identityNumberMasked = identityNumber ? maskSensitive(identityNumber) : null;
  const existing = db
    .prepare(
      `
      SELECT * FROM verification_requests
      WHERE userId = ? AND role = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `
    )
    .get(req.user.id, role) as any;
  const metadata = {
    businessActivity: req.body.businessActivity || null,
    expectedMonthlySales: req.body.expectedMonthlySales || null,
    paymentMethods: req.body.paymentMethods || [],
    deliveryNeeds: req.body.deliveryNeeds || null,
    referralSource: req.body.referralSource || null,
    licenseStatus: req.body.licenseStatus || null,
    whatsappNumber: req.body.whatsappNumber || req.body.phone || req.user.phone || null,
    whatsappCheckCode: req.body.whatsappCheckCode || null,
    contactVerification: req.body.contactVerification || null,
  };

  const values = [
    account?.id || existing?.accountId || null,
    role,
    'submitted',
    'pending',
    req.body.legalName || req.user.name || null,
    req.body.identityType || null,
    identityNumberHash,
    identityNumberMasked,
    req.body.phone || req.user.phone || null,
    req.body.businessName || req.user.businessName || null,
    req.body.businessCategory || req.user.businessCategory || null,
    req.body.businessAddress || req.user.location || null,
    req.body.district || null,
    req.body.sector || null,
    req.body.cell || null,
    req.body.tin || req.user.tin || null,
    req.body.annualTurnoverRange || null,
    req.body.hasVatRegistration ? 1 : 0,
    req.body.usesEbm ? 1 : 0,
    req.body.latitude === undefined ? null : Number(req.body.latitude),
    req.body.longitude === undefined ? null : Number(req.body.longitude),
    JSON.stringify(metadata),
  ];

  let requestId = existing?.id || uuidv4();
  if (existing) {
    db.prepare(
      `
      UPDATE verification_requests
      SET accountId = ?, role = ?, status = ?, riskStatus = ?, legalName = ?, identityType = ?,
          identityNumberHash = COALESCE(?, identityNumberHash),
          identityNumberMasked = COALESCE(?, identityNumberMasked),
          phone = ?, businessName = ?, businessCategory = ?, businessAddress = ?,
          district = ?, sector = ?, cell = ?, tin = ?, annualTurnoverRange = ?,
          hasVatRegistration = ?, usesEbm = ?, latitude = ?, longitude = ?,
          metadata = ?, submittedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(...values, requestId);
  } else {
    db.prepare(
      `
      INSERT INTO verification_requests
        (id, accountId, role, status, riskStatus, legalName, identityType, identityNumberHash,
         identityNumberMasked, phone, businessName, businessCategory, businessAddress,
         district, sector, cell, tin, annualTurnoverRange, hasVatRegistration, usesEbm,
         latitude, longitude, metadata, submittedAt, userId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(requestId, ...values, req.user.id);
  }

  if (identityNumberHash) {
    const identityDocId = uuidv4();
    db.prepare(
      `
      INSERT INTO user_identity_documents
        (id, userId, verificationRequestId, identityType, identityNumberHash, identityNumberMasked, status, metadata, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      identityDocId,
      req.user.id,
      requestId,
      req.body.identityType || 'national_id',
      identityNumberHash,
      identityNumberMasked,
      JSON.stringify({ source: 'verification_form' })
    );
  }

  recordVerificationAudit(req.user.id, requestId, req.user.id, 'submitted_verification_request', {
    role,
  });
  const request = recomputeVerificationRequest(requestId);
  if (request) {
    void mirrorVerificationRequestToPostgres(request).catch((error) => {
      console.error('Postgres verification request mirror failed:', error);
    });
  }
  res.json({ success: true, request });
});

app.post('/api/verification/documents', authenticate, (req: any, res): any => {
  const accountId = String(req.body.accountId || getActiveAccount(req, req.user)?.id || '');
  const requestId = String(req.body.verificationRequestId || '').trim();
  const type = String(req.body.type || '').trim();
  const licenseTypeId = String(req.body.licenseTypeId || req.body.licenseType || type || '').trim();
  const rawFileUrl = String(req.body.fileUrl || req.body.url || '').trim();
  const fileUrl = normalizeVerificationFileUrl(rawFileUrl);
  if (!type) return res.status(400).json({ error: 'Document type is required' });
  if (!fileUrl) return res.status(400).json({ error: 'Document file URL is required' });

  const account = accountId
    ? (db
        .prepare('SELECT * FROM user_accounts WHERE id = ? AND userId = ?')
        .get(accountId, req.user.id) as any)
    : null;
  if (accountId && !account) return res.status(404).json({ error: 'Account mode was not found' });
  const request = requestId
    ? (db
        .prepare('SELECT * FROM verification_requests WHERE id = ? AND userId = ?')
        .get(requestId, req.user.id) as any)
    : (db
        .prepare('SELECT * FROM verification_requests WHERE userId = ? ORDER BY createdAt DESC LIMIT 1')
        .get(req.user.id) as any);
  const fileHash = fileHashForUrl(fileUrl);
  const metadata = req.body.metadata || {};
  const extractedFields = {
    licenseNumber: metadata.licenseNumber || req.body.licenseNumber || null,
    authority: metadata.authority || req.body.authority || null,
    tin: metadata.tin || req.body.tin || null,
    businessName: metadata.businessName || req.body.businessName || null,
  };

  const id = uuidv4();
  const draftDoc = {
    id,
    userId: req.user.id,
    accountId: account?.id || request?.accountId || null,
    type,
    fileUrl,
    licenseTypeId,
    fileHash,
    extractedText: metadata.documentText || req.body.extractedText || null,
    extractedFields: JSON.stringify(extractedFields),
    expiryDate: req.body.expiryDate || metadata.expiryDate || null,
    metadata: JSON.stringify(metadata),
  };
  const autoCheck = autoCheckDocument(draftDoc, request);
  db.prepare(
    `
    INSERT INTO verification_documents (
      id, userId, accountId, type, fileUrl, status, licenseTypeId, fileHash, extractedText,
      extractedFields, autoScore, autoDecision, autoReasons, expiryDate, metadata, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    req.user.id,
    account?.id || request?.accountId || null,
    type,
    fileUrl,
    autoCheck.autoDecision === 'auto_verified' ? 'auto_verified' : 'pending',
    licenseTypeId || null,
    fileHash,
    draftDoc.extractedText,
    JSON.stringify(extractedFields),
    autoCheck.score,
    autoCheck.autoDecision,
    JSON.stringify(autoCheck.reasons),
    draftDoc.expiryDate,
    JSON.stringify(metadata)
  );

  if (account?.role === 'trader') {
    db.prepare(
      `
      UPDATE user_accounts
      SET status = 'pending_review', verificationStatus = 'pending', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(accountId);
  }

  if (request?.id) {
    recordVerificationAudit(req.user.id, request.id, req.user.id, 'uploaded_verification_document', {
      type,
      licenseTypeId,
      autoDecision: autoCheck.autoDecision,
      autoScore: autoCheck.score,
    });
    recomputeVerificationRequest(request.id);
    const updatedRequest = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(request.id);
    void mirrorVerificationRequestToPostgres(updatedRequest).catch((error) => {
      console.error('Postgres verification request mirror failed:', error);
    });
  }

  const savedDocument = db.prepare('SELECT * FROM verification_documents WHERE id = ?').get(id);
  void mirrorVerificationDocumentToPostgres(savedDocument).catch((error) => {
    console.error('Postgres verification document mirror failed:', error);
  });

  res.json({
    success: true,
    document: savedDocument,
  });
});

app.get('/api/admin/verification-queue', requireRole(['admin', 'manager']), (_req: any, res): any => {
  const rows = db
    .prepare(
      `
      SELECT ua.*, u.email, u.name, u.phone,
             COUNT(vd.id) as documentCount,
             GROUP_CONCAT(vd.type) as documentTypes
      FROM user_accounts ua
      JOIN users u ON u.id = ua.userId
      LEFT JOIN verification_documents vd ON vd.accountId = ua.id
      WHERE ua.verificationStatus != 'verified'
         OR ua.status IN ('pending_documents', 'pending_review', 'rejected')
      GROUP BY ua.id
      ORDER BY ua.updatedAt DESC
    `
    )
    .all() as any[];
  res.json({ success: true, items: rows.map(normalizeUserAccount) });
});

app.get('/api/admin/verification-requests', requireRole(['admin', 'manager']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const status = String(req.query.status || '').trim();
  const conditions = status ? 'WHERE vr.status = ?' : '';
  const params = status ? [status, limit, offset] : [limit, offset];
  const rows = db
    .prepare(
      `
      SELECT vr.*, u.email, u.name, u.role as userRole,
             COUNT(DISTINCT vd.id) as documentCount,
             COUNT(DISTINCT rf.id) as openRiskFlags
      FROM verification_requests vr
      JOIN users u ON u.id = vr.userId
      LEFT JOIN verification_documents vd ON vd.userId = vr.userId
      LEFT JOIN risk_flags rf ON rf.verificationRequestId = vr.id AND rf.status = 'open'
      ${conditions}
      GROUP BY vr.id
      ORDER BY vr.updatedAt DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(...params) as any[];
  res.json({
    success: true,
    requests: rows.map((row) => ({
      ...row,
      metadata: parseMetadata(row.metadata),
    })),
  });
});

app.get('/api/admin/verification-requests/:id', requireRole(['admin', 'manager']), (req: any, res): any => {
  const request = db
    .prepare(
      `
      SELECT vr.*, u.email, u.name, u.phone as accountPhone
      FROM verification_requests vr
      JOIN users u ON u.id = vr.userId
      WHERE vr.id = ?
    `
    )
    .get(req.params.id) as any;
  if (!request) return res.status(404).json({ error: 'Verification request not found' });
  const documents = db
    .prepare('SELECT * FROM verification_documents WHERE userId = ? ORDER BY createdAt DESC')
    .all(request.userId);
  const riskFlags = db
    .prepare('SELECT * FROM risk_flags WHERE verificationRequestId = ? ORDER BY createdAt DESC')
    .all(request.id);
  const auditLogs = db
    .prepare('SELECT * FROM verification_audit_logs WHERE verificationRequestId = ? ORDER BY createdAt DESC')
    .all(request.id);
  res.json({
    success: true,
    request: { ...request, metadata: parseMetadata(request.metadata) },
    documents: documents.map((doc: any) => ({
      ...doc,
      metadata: parseMetadata(doc.metadata),
      extractedFields: parseMetadata(doc.extractedFields),
      autoReasons: parseMetadata(doc.autoReasons),
    })),
    riskFlags,
    auditLogs: auditLogs.map((log: any) => ({ ...log, details: parseMetadata(log.details) })),
    requiredLicenseIds: requiredLicenseIdsForRequest(request),
  });
});

app.post('/api/admin/verification-requests/:id/approve', requireRole(['admin', 'manager']), (req: any, res): any => {
  const request = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(req.params.id) as any;
  if (!request) return res.status(404).json({ error: 'Verification request not found' });
  const nextStatus =
    request.role === 'trader' || request.role === 'organization'
      ? 'business_verified'
      : 'basic_verified';
  db.prepare(
    `
    UPDATE verification_requests
    SET status = 'approved', riskStatus = ?, reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(nextStatus, req.user.id, request.id);
  db.prepare(
    `
    UPDATE users
    SET verificationStatus = ?, verifiedAt = CURRENT_TIMESTAMP, verifiedBy = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(nextStatus, req.user.id, request.userId);
  if (request.accountId) {
    db.prepare(
      `
      UPDATE user_accounts
      SET status = 'active', verificationStatus = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(nextStatus, request.accountId);
  }
  db.prepare(
    `
    UPDATE verification_documents
    SET status = CASE WHEN status IN ('pending', 'auto_verified') THEN 'approved' ELSE status END,
        reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE userId = ?
  `
  ).run(req.user.id, request.userId);
  recordVerificationAudit(request.userId, request.id, req.user.id, 'admin_approved', {
    nextStatus,
    note: req.body.note || null,
  });
  mirrorAccountState(request.userId);
  const updatedRequest = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(request.id);
  const updatedDocuments = db.prepare('SELECT * FROM verification_documents WHERE userId = ?').all(request.userId);
  void mirrorVerificationRequestToPostgres(updatedRequest).catch((error) => {
    console.error('Postgres verification request mirror failed:', error);
  });
  for (const document of updatedDocuments) {
    void mirrorVerificationDocumentToPostgres(document).catch((error) => {
      console.error('Postgres verification document mirror failed:', error);
    });
  }
  res.json({ success: true, request: updatedRequest });
});

app.post('/api/admin/verification-requests/:id/reject', requireRole(['admin', 'manager']), (req: any, res): any => {
  const request = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(req.params.id) as any;
  if (!request) return res.status(404).json({ error: 'Verification request not found' });
  const reason = String(req.body.reason || 'Verification rejected').trim();
  db.prepare(
    `
    UPDATE verification_requests
    SET status = 'rejected', riskStatus = 'restricted', rejectionReason = ?, reviewedBy = ?,
        reviewedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(reason, req.user.id, request.id);
  db.prepare(
    'UPDATE users SET verificationStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('restricted', request.userId);
  if (request.accountId) {
    db.prepare(
      "UPDATE user_accounts SET status = 'rejected', verificationStatus = 'rejected', updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(request.accountId);
  }
  recordVerificationAudit(request.userId, request.id, req.user.id, 'admin_rejected', { reason });
  mirrorAccountState(request.userId);
  const updatedRequest = db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(request.id);
  void mirrorVerificationRequestToPostgres(updatedRequest).catch((error) => {
    console.error('Postgres verification request mirror failed:', error);
  });
  res.json({ success: true, request: updatedRequest });
});

app.get('/api/admin/license-types', requireRole(['admin', 'manager']), (_req: any, res): any => {
  const licenseTypes = db.prepare('SELECT * FROM license_types ORDER BY category, name').all();
  res.json({ success: true, licenseTypes });
});

app.post('/api/admin/verification/:accountId/approve', requireRole(['admin', 'manager']), (req: any, res): any => {
  const accountId = String(req.params.accountId || '');
  const account = db.prepare('SELECT * FROM user_accounts WHERE id = ?').get(accountId) as any;
  if (!account) return res.status(404).json({ error: 'Account mode was not found' });

  db.prepare(
    `
    UPDATE user_accounts
    SET status = 'active', verificationStatus = 'verified', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(accountId);
  db.prepare(
    `
    UPDATE verification_documents
    SET status = 'approved', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE accountId = ? AND status = 'pending'
  `
  ).run(req.user.id, accountId);

  if (account.role === 'trader') {
    db.prepare(
      `
      UPDATE users
      SET verificationStatus = 'verified', verifiedAt = CURRENT_TIMESTAMP, verifiedBy = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND role = 'trader'
    `
    ).run(req.user.id, account.userId);
  }

  recordAdminAction(req.user.id, 'approve_account_verification', 'user_account', accountId, {
    role: account.role,
    userId: account.userId,
  });
  res.json({ success: true, account: normalizeUserAccount(db.prepare('SELECT * FROM user_accounts WHERE id = ?').get(accountId)) });
});

app.post('/api/admin/verification/:accountId/reject', requireRole(['admin', 'manager']), (req: any, res): any => {
  const accountId = String(req.params.accountId || '');
  const reason = String(req.body.reason || req.body.rejectionReason || '').trim();
  const account = db.prepare('SELECT * FROM user_accounts WHERE id = ?').get(accountId) as any;
  if (!account) return res.status(404).json({ error: 'Account mode was not found' });

  db.prepare(
    `
    UPDATE user_accounts
    SET status = 'rejected', verificationStatus = 'rejected', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(accountId);
  db.prepare(
    `
    UPDATE verification_documents
    SET status = 'rejected', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP,
        rejectionReason = COALESCE(?, rejectionReason), updatedAt = CURRENT_TIMESTAMP
    WHERE accountId = ? AND status = 'pending'
  `
  ).run(req.user.id, reason || null, accountId);

  recordAdminAction(req.user.id, 'reject_account_verification', 'user_account', accountId, {
    role: account.role,
    userId: account.userId,
    reason,
  });
  res.json({ success: true, account: normalizeUserAccount(db.prepare('SELECT * FROM user_accounts WHERE id = ?').get(accountId)) });
});

app.get('/api/team/invitations/:token', (req: any, res): any => {
  const token = String(req.params.token || '');
  const row = db
    .prepare(
      `
      SELECT ti.*, b.name as branchName, b.location as branchLocation,
             u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
      FROM team_invitations ti
      JOIN users u ON u.id = ti.traderId
      LEFT JOIN branches b ON b.id = ti.branchId
      WHERE ti.tokenHash = ?
    `
    )
    .get(hashToken(token)) as any;
  if (!row) return res.status(404).json({ error: 'Invitation not found' });
  res.json({ success: true, invitation: normalizeTeamInvitation(row) });
});

app.post('/api/team/invitations/:token/deny', (req: any, res): any => {
  const token = String(req.params.token || '');
  const row = db.prepare('SELECT * FROM team_invitations WHERE tokenHash = ?').get(hashToken(token)) as any;
  if (!row) return res.status(404).json({ error: 'Invitation not found' });
  if (row.status !== 'pending') return res.json({ success: true, status: row.status });
  db.prepare("UPDATE team_invitations SET status = 'denied', deniedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  publishLiveSync({ collection: 'team_invitations', action: 'updated', id: row.id });
  res.json({ success: true, status: 'denied' });
});

app.post('/api/team/invitations/:token/accept', (req: any, res): any => {
  const token = String(req.params.token || '');
  const row = db
    .prepare(
      `
      SELECT ti.*, b.name as branchName, b.location as branchLocation,
             u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
      FROM team_invitations ti
      JOIN users u ON u.id = ti.traderId
      LEFT JOIN branches b ON b.id = ti.branchId
      WHERE ti.tokenHash = ?
    `
    )
    .get(hashToken(token)) as any;
  if (!row) return res.status(404).json({ error: 'Invitation not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: `Invitation is already ${row.status}` });
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    db.prepare("UPDATE team_invitations SET status = 'expired', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
    return res.status(400).json({ error: 'Invitation has expired' });
  }
  if (!req.body.consentAccepted) return res.status(400).json({ error: 'Consent is required to join this trader team' });

  const email = String(row.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  let createdNewAccount = false;

  const acceptTx = db.transaction(() => {
    if (!user) {
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      const userId = uuidv4();
      db.prepare(
        `
        INSERT INTO users (
          id, email, name, password, role, verificationStatus, walletBalance, appNumber,
          tier, phone, location, onboardingComplete, loyaltyPoints, emailVerified, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, 'customer', 'verified', 0, ?, 'free', ?, ?, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        userId,
        email,
        row.name,
        hashPassword(password),
        generateAppNumber(),
        req.body.phone || null,
        req.body.location || null
      );
      db.prepare('INSERT OR IGNORE INTO loyalty_points (id, userId, points, totalEarned, updatedAt) VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)').run(uuidv4(), userId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      createdNewAccount = true;
    }

    const memberId = uuidv4();
    db.prepare(
      `
      INSERT OR REPLACE INTO team_members (
        id, traderId, userId, branchId, invitationId, name, email, role, permissions, status,
        performance, invitedBy, acceptedAt, createdAt, updatedAt
      ) VALUES (
        COALESCE((SELECT id FROM team_members WHERE traderId = ? AND userId = ?), ?),
        ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `
    ).run(
      row.traderId,
      user.id,
      memberId,
      row.traderId,
      user.id,
      row.branchId || null,
      row.id,
      row.name,
      email,
      row.role,
      row.permissions || '[]',
      row.invitedBy
    );

    db.prepare(
      `
      UPDATE team_invitations
      SET status = 'accepted', acceptedByUserId = ?, inviteePhone = ?, inviteeLocation = ?,
          inviteeNationalId = ?, consentAcceptedAt = CURRENT_TIMESTAMP, acceptedAt = CURRENT_TIMESTAMP,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(user.id, req.body.phone || null, req.body.location || null, req.body.nationalId || null, row.id);

    db.prepare(
      `
      INSERT INTO team_activity_logs (id, traderId, userId, branchId, actionType, details, createdAt)
      VALUES (?, ?, ?, ?, 'team_invitation_accepted', ?, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), row.traderId, user.id, row.branchId || null, JSON.stringify({ invitationId: row.id, email }));
  });

  try {
    acceptTx();
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }

  publishLiveSync({ collection: 'team_members', action: 'created', traderId: row.traderId });
  res.json({
    success: true,
    createdNewAccount,
    existingAccount: !createdNewAccount,
    message: createdNewAccount
      ? 'Invitation accepted. You can log in with the password you created.'
      : 'Invitation accepted. Log in with your existing ESOKO account, then choose the trader team access.',
    redirectTo: '/login',
  });
});

app.get('/api/traders/team/members', authenticate, (req: any, res): any => {
  const traderId = String(req.query.traderId || req.user.id);
  const activeTeam = getActiveTeamContext(req);
  if (req.user.role !== 'admin' && req.user.id !== traderId && activeTeam?.traderId !== traderId) {
    return res.status(403).json({ error: 'You are not authorized to view this trader team' });
  }
  const members = db
    .prepare(
      `
      SELECT tm.*, b.name as branchName, b.location as branchLocation,
             u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
      FROM team_members tm
      LEFT JOIN branches b ON b.id = tm.branchId
      JOIN users u ON u.id = tm.traderId
      WHERE tm.traderId = ?
      ORDER BY tm.createdAt DESC
    `
    )
    .all(traderId) as any[];
  const invitations = db.prepare(teamInviteSelect(true)).all(traderId) as any[];
  res.json({
    success: true,
    members: members.map(normalizeTeamMember),
    invitations: invitations.map((row) => normalizeTeamInvitation(row)),
  });
});

app.post('/api/traders/team/invitations', authenticate, async (req: any, res): Promise<any> => {
  try {
    const traderId = String(req.body.traderId || req.user.id);
    const activeTeam = getActiveTeamContext(req);
    const canInviteFromTeam =
      activeTeam?.traderId === traderId &&
      Array.isArray(activeTeam.permissions) &&
      activeTeam.permissions.includes('team');
    if (req.user.role !== 'admin' && req.user.id !== traderId && !canInviteFromTeam) {
      return res.status(403).json({ error: 'You are not authorized to invite team members for this shop' });
    }

    const trader = db.prepare('SELECT * FROM users WHERE id = ?').get(traderId) as any;
    if (!trader) return res.status(404).json({ error: 'Trader shop was not found' });

    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const role = String(req.body.role || 'Shopkeeper').trim();
    const branchName = String(req.body.branchName || '').trim();
    const branchLocation = String(req.body.branchLocation || '').trim();
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : ['sales', 'inventory', 'messages'];

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
    if (!name) return res.status(400).json({ error: 'Full name is required' });

    let branchId = String(req.body.branchId || '').trim() || null;
    if (!branchId && branchName) {
      const existingBranch = db
        .prepare('SELECT * FROM branches WHERE traderId = ? AND lower(name) = lower(?)')
        .get(traderId, branchName) as any;
      if (existingBranch) {
        branchId = existingBranch.id;
      } else {
        branchId = uuidv4();
        db.prepare(
          'INSERT INTO branches (id, traderId, name, location, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
        ).run(branchId, traderId, branchName, branchLocation || null, 'active');
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const invitationId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `
      INSERT INTO team_invitations (
        id, traderId, branchId, email, name, role, permissions, tokenHash, status,
        invitedBy, expiresAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      invitationId,
      traderId,
      branchId,
      email,
      name,
      role,
      JSON.stringify(permissions),
      hashToken(token),
      req.user.id,
      expiresAt
    );

    const invitation = db
      .prepare(
        `
        SELECT ti.*, b.name as branchName, b.location as branchLocation,
               u.name as traderName, u.email as traderEmail, u.businessName as traderBusinessName
        FROM team_invitations ti
        JOIN users u ON u.id = ti.traderId
        LEFT JOIN branches b ON b.id = ti.branchId
        WHERE ti.id = ?
      `
      )
      .get(invitationId) as any;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendTeamInvitationEmail(req, invitation, token);
      emailSent = true;
      logSystem(`Team invitation sent to ${email}`, 'info', 'email', req.user.id);
    } catch (error: any) {
      emailError = error.message || 'Email failed';
      logSystem(`Team invitation email failed for ${email}: ${emailError}`, 'warn', 'email', req.user.id);
    }

    publishLiveSync({ collection: 'team_invitations', action: 'created', traderId, id: invitationId });
    res.json({
      success: true,
      invitation: normalizeTeamInvitation(invitation),
      emailSent,
      emailError,
      invitationUrl: `${appBaseUrl(req)}/team-invite?token=${encodeURIComponent(token)}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traders/team/members/:id/revoke', authenticate, (req: any, res): any => {
  const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id) as any;
  if (!member) return res.status(404).json({ error: 'Team member not found' });
  if (req.user.role !== 'admin' && req.user.id !== member.traderId) {
    return res.status(403).json({ error: 'Only the shop owner can revoke this access' });
  }
  db.prepare("UPDATE team_members SET status = 'revoked', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(member.id);
  publishLiveSync({ collection: 'team_members', action: 'updated', traderId: member.traderId, id: member.id });
  res.json({ success: true });
});

app.post('/api/auth/send-verification-email', authenticate, async (req: any, res): Promise<any> => {
  try {
    const user = req.user;

    if (user.emailVerified) {
      const accountVerificationSent = await sendAccountVerificationEmail(req, user, 'initial');
      return res.json({
        success: true,
        message: accountVerificationSent
          ? 'Account verification email sent'
          : 'Email already verified',
        accountVerificationSent,
      });
    }

    if (!SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({ error: 'Email service is not configured' });
    }

    const { token } = createEmailVerificationToken(user.id);
    const verificationUrl = buildEmailVerificationUrl(req, token, user.email);
    await sendEmailVerificationEmail(req, user, verificationUrl);
    logSystem(`Email verification sent to ${user.email}`, 'info', 'auth', user.id);
    res.json({
      success: true,
      message: 'Email verification sent',
      accountVerificationSent: false,
    });
  } catch (error: any) {
    console.error('Verification email failed:', error);
    res.status(500).json({ error: 'Failed to send verification email', details: error.message });
  }
});

async function findVerificationToken(token: string, email?: string) {
  if (!token) return null;
  let query = `
    SELECT evt.*, u.email, u.name, u.emailVerified
    FROM email_verification_tokens evt
    JOIN users u ON u.id = evt.userId
    WHERE evt.tokenHash = ?
  `;
  const params: any[] = [hashToken(token)];
  if (email) {
    query += ' AND u.email = ?';
    params.push(email);
  }
  return db.prepare(query).get(...params) as any;
}

function validateVerificationTokenRow(row: any) {
  if (!row) return { valid: false, error: 'Invalid verification token' };
  if (row.verifiedAt && row.emailVerified) return { valid: true, alreadyVerified: true };
  if (row.verifiedAt)
    return { valid: false, error: 'This verification token has already been used' };
  if (new Date(row.expiresAt).getTime() < Date.now())
    return { valid: false, error: 'This verification token has expired' };
  return { valid: true };
}

async function completeVerification(row: any): Promise<any> {
  db.transaction(() => {
    db.prepare(
      'UPDATE users SET emailVerified = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(row.userId);
    db.prepare(
      'UPDATE email_verification_tokens SET verifiedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(row.id);
  })();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.userId) as any;
  return user;
}

async function handleVerifyEmailRequest(req: any, res: any) {
  const token = String(req.body.token || req.query.token || '').trim();
  const email = String(req.body.email || req.query.email || '').trim();

  if (!token) return res.status(400).json({ error: 'Verification token is required' });

  const row = await findVerificationToken(token, email);
  const validation = validateVerificationTokenRow(row);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const user = validation.alreadyVerified
    ? (db.prepare('SELECT * FROM users WHERE id = ?').get(row.userId) as any)
    : await completeVerification(row);
  const { accessToken } = issueAuthCookies(req, res, user);

  logSystem(
    validation.alreadyVerified
      ? `Email verification link reused for already verified user ${row.email}`
      : `Email verified and auto-login for ${row.email}`,
    'info',
    'auth',
    row.userId
  );
  res.json({
    success: true,
    message: validation.alreadyVerified
      ? 'Email is already verified'
      : 'Email verified successfully',
    user: publicUser(user),
    token: accessToken,
    redirectTo: user.onboardingComplete ? `/${user.role}` : '/onboarding',
  });
}

app.post('/api/auth/verify-email', async (req: any, res): Promise<any> => {
  try {
    await handleVerifyEmailRequest(req, res);
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email', details: error.message });
  }
});

app.get('/api/auth/verify-email', async (req: any, res): Promise<any> => {
  try {
    await handleVerifyEmailRequest(req, res);
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email', details: error.message });
  }
});

app.post('/api/auth/password-reset', async (req: any, res): Promise<any> => {
  try {
    await handlePasswordResetRequest(req, res);
  } catch (error: any) {
    console.error('Password reset email failed:', error);
    res.status(500).json({ error: 'Failed to send password reset email', details: error.message });
  }
});

app.post('/api/auth/request-password-reset', async (req: any, res): Promise<any> => {
  try {
    await handlePasswordResetRequest(req, res);
  } catch (error: any) {
    console.error('Password reset email failed:', error);
    res.status(500).json({ error: 'Failed to send password reset email', details: error.message });
  }
});

app.post('/api/auth/verify-reset-token', (req: any, res): any => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || req.body.newPassword || '');
  if (!token) return res.status(400).json({ error: 'Reset token is required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const row = db
    .prepare(
      `
    SELECT prt.*, u.email, u.name
    FROM password_reset_tokens prt
    JOIN users u ON u.id = prt.userId
    WHERE prt.tokenHash = ?
  `
    )
    .get(hashToken(token)) as any;

  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  db.transaction(() => {
    db.prepare('UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
      hashPassword(password),
      row.userId
    );
    db.prepare('UPDATE password_reset_tokens SET usedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
      row.id
    );
    db.prepare(
      `
      UPDATE refresh_tokens
      SET revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
      WHERE userId = ? AND revokedAt IS NULL
    `
    ).run(row.userId);
  })();

  logSystem(`Password reset completed for ${row.email}`, 'info', 'auth', row.userId);
  res.json({ success: true, message: 'Password updated successfully' });
});

app.post('/api/auth/update-password', authenticate, (req: any, res): any => {
  const password = String(req.body.newPassword || '');
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  db.transaction(() => {
    db.prepare('UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
      hashPassword(password),
      req.user.id
    );
    db.prepare(
      `
      UPDATE refresh_tokens
      SET revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
      WHERE userId = ? AND revokedAt IS NULL
    `
    ).run(req.user.id);
  })();
  clearAuthCookies(res);
  res.json({ success: true });
});

app.post('/api/transaction-email', authenticate, async (req: any, res): Promise<any> => {
  try {
    const { email, amount, type, recipientName, status, reference } = req.body;

    if (!email || !amount || !type) {
      return res.status(400).json({ error: 'email, amount, and type are required' });
    }

    const requestedEmail = String(email).trim().toLowerCase();
    const currentEmail = String(req.user?.email || '')
      .trim()
      .toLowerCase();
    if (!isElevatedRole(req.user?.role) && requestedEmail !== currentEmail) {
      return res
        .status(403)
        .json({ error: 'You can only send transaction emails to your own account email' });
    }

    if (!SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({ error: 'Email service is not configured' });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937;">
        <h1 style="color: #ea580c; margin-bottom: 8px;">Transaction Confirmation</h1>
        <p>Hello,</p>
        <p>Your ${type} transaction has been ${status || 'processed'}.</p>
        <table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700;">Transaction Type</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">${escapeHtml(type)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700;">Amount</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">${escapeHtml(String(amount))}</td>
          </tr>
          ${
            recipientName
              ? `
          <tr style="background: #f3f4f6;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700;">Recipient</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">${escapeHtml(recipientName)}</td>
          </tr>
          `
              : ''
          }
          ${
            reference
              ? `
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700;">Reference</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">${escapeHtml(reference)}</td>
          </tr>
          `
              : ''
          }
        </table>
        <p style="color: #6b7280; font-size: 12px;">If you did not authorize this transaction, please contact support immediately.</p>
      </div>
    `;

    await sendAppEmail({
      from: SMTP_FROM,
      to: requestedEmail,
      subject: `Transaction Confirmation - ${escapeHtml(type)}`,
      html,
      text: `Transaction Confirmation\nType: ${type}\nAmount: ${amount}\nStatus: ${status || 'completed'}\nReference: ${reference || 'N/A'}`,
    });

    res.json({ success: true, message: 'Transaction email sent' });
  } catch (error: any) {
    console.error('Transaction email failed:', error);
    res.status(500).json({ error: 'Failed to send transaction email', details: error.message });
  }
});

app.get('/api/users', authenticate, (req: any, res): any => {
  if (!canManageUsers(req.user)) {
    return res.status(403).json({ error: 'User listing requires admin or manager access' });
  }

  const { limit, offset } = parseLimitOffset(req.query);
  const role = req.query.role ? normalizeRole(req.query.role) : null;
  const status =
    req.query.status || req.query.verificationStatus
      ? String(req.query.status || req.query.verificationStatus)
      : null;
  const tier = req.query.tier ? String(req.query.tier) : null;
  const search = String(req.query.search || req.query.query || '').trim();

  const conditions: string[] = [];
  const params: any[] = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (status) {
    conditions.push('verificationStatus = ?');
    params.push(status);
  }
  if (tier) {
    conditions.push('tier = ?');
    params.push(tier);
  }
  if (req.query.role__ne) {
    conditions.push('role != ?');
    params.push(String(req.query.role__ne));
  }
  for (const field of ['id', 'email', 'phone', 'appNumber', 'tin', 'businessName']) {
    if (req.query[field]) {
      conditions.push(`${field} = ?`);
      params.push(String(req.query[field]));
    }
  }
  if (search) {
    conditions.push(
      '(name LIKE ? OR email LIKE ? OR phone LIKE ? OR appNumber LIKE ? OR businessName LIKE ?)'
    );
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const users = db
    .prepare(
      `
    SELECT * FROM users ${where}
    ORDER BY createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset)
    .map(publicUser);

  res.json({ success: true, users });
});

app.get('/api/users/search', authenticate, (req: any, res): any => {
  const term = String(req.query.query || req.query.q || '').trim();
  if (!term) return res.json({ success: true, users: [] });
  const like = `%${term}%`;
  const isPrivileged = canManageUsers(req.user);
  const users = db
    .prepare(
      `
    SELECT * FROM users
    WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ? OR appNumber LIKE ?)
      ${isPrivileged ? '' : "AND role = 'trader'"}
    ORDER BY name ASC
    LIMIT 20
  `
    )
    .all(like, like, like, like)
    .map(isPrivileged ? publicUser : publicDirectoryUser);
  res.json({ success: true, users });
});

app.get('/api/users/:id', authenticate, async (req: any, res): Promise<any> => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const isSelf = req.user.id === req.params.id;
  const isPrivileged = canManageUsers(req.user) || req.user.role === 'agent';
  if (!isSelf && !isPrivileged) {
    const publicProfile = publicDirectoryUser(user);
    if (publicProfile?.role === 'trader') {
      return res.json({ success: true, user: publicProfile });
    }
    return res.status(403).json({ error: 'You can only view your own account' });
  }
  if (isSelf) {
    void maybeSendVerificationReminder(req, user).catch((emailError) => {
      console.error('Verification reminder failed:', emailError);
    });
  }
  res.json({ success: true, user: publicUserWithAccess(req, user) });
});

app.post('/api/upload', authenticate, (req: any, res): any => {
  upload.single('file')(req, res, (error: any) => {
    if (error) {
      const isTooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      res.status(isTooLarge ? 413 : 400).json({
        error: isTooLarge
          ? `File is too large. Maximum upload size is ${Math.round(config.uploadMaxBytes / 1024 / 1024)}MB.`
          : error.message || 'Upload failed',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const purpose = String(req.body.purpose || req.query.purpose || '').toLowerCase();
    const isVerificationUpload =
      purpose.includes('verification') || req.file.mimetype === 'application/pdf';
    const fileUrl = isVerificationUpload
      ? privateUploadUrl(req.file.filename)
      : publicUploadUrl(req.file.filename);
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      maxSizeMb: Math.round(config.uploadMaxBytes / 1024 / 1024),
    });
    return;
  });
});

app.get('/api/uploads/:filename', authenticate, (req: any, res): any => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!filename) return res.status(400).json({ error: 'File name is required' });
  if (!userCanAccessUpload(req, filename)) {
    return res.status(403).json({ error: 'You are not authorized to access this upload' });
  }
  sendUploadFile(res, filename);
});

app.put('/api/users/:id', authenticate, (req: any, res): any => {
  if (req.user.id !== req.params.id && !['admin', 'manager', 'agent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only update your own account' });
  }

  const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!existingUser) return res.status(404).json({ error: 'User not found' });

  const rawBody = req.body.data || req.body || {};
  const isPrivilegedUpdate = canManageUsers(req.user);
  const requestedRole = String(rawBody.role || '').trim();
  const canSelfChooseRole =
    req.user.id === req.params.id &&
    ['unregistered', ''].includes(String(existingUser.role || '').trim()) &&
    ['customer', 'trader'].includes(requestedRole);
  const protectedFields = new Set([
    'tier',
    'role',
    'verificationStatus',
    'walletBalance',
    'loyaltyPoints',
    'status',
    'maintenanceMode',
    'emailVerified',
  ]);
  if (canSelfChooseRole) protectedFields.delete('role');
  const sanitizedBody = isPrivilegedUpdate
    ? rawBody
    : Object.fromEntries(Object.entries(rawBody).filter(([key]) => !protectedFields.has(key)));
  const body = applyFieldTransforms(publicUser(existingUser) || {}, sanitizedBody);
  const knownFields = new Set([
    'name',
    'phone',
    'businessName',
    'businessCategory',
    'location',
    'tin',
    'category',
    'tier',
    'role',
    'verificationStatus',
    'walletBalance',
    'loyaltyPoints',
    'onboardingComplete',
    'transactionPin',
    'biometricEnabled',
    'profilePhoto',
  ]);
  const metadataUpdates = Object.fromEntries(
    Object.entries(rawBody).filter(
      ([key]) => !knownFields.has(key) && key !== 'uid' && key !== 'id' && !protectedFields.has(key)
    )
  );
  const nextMetadata = {
    ...parseJsonObject(existingUser.metadata),
    ...metadataUpdates,
  };
  const metadataValue = Object.keys(metadataUpdates).length ? JSON.stringify(nextMetadata) : null;

  db.prepare(
    `
    UPDATE users
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        businessName = COALESCE(?, businessName),
        businessCategory = COALESCE(?, businessCategory),
        location = COALESCE(?, location),
        tin = COALESCE(?, tin),
        category = COALESCE(?, category),
        tier = COALESCE(?, tier),
        role = COALESCE(?, role),
        verificationStatus = COALESCE(?, verificationStatus),
        walletBalance = COALESCE(?, walletBalance),
        loyaltyPoints = COALESCE(?, loyaltyPoints),
        onboardingComplete = COALESCE(?, onboardingComplete),
        transactionPin = COALESCE(?, transactionPin),
        biometricEnabled = COALESCE(?, biometricEnabled),
        profilePhoto = COALESCE(?, profilePhoto),
        metadata = COALESCE(?, metadata),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(
    body.name ?? null,
    body.phone ?? null,
    body.businessName ?? null,
    body.businessCategory ?? null,
    body.location ?? null,
    body.tin ?? null,
    body.category ?? null,
    isPrivilegedUpdate ? (body.tier ?? null) : null,
    isPrivilegedUpdate || canSelfChooseRole ? (body.role ?? null) : null,
    isPrivilegedUpdate ? (body.verificationStatus ?? null) : null,
    isPrivilegedUpdate ? (body.walletBalance ?? null) : null,
    isPrivilegedUpdate ? (body.loyaltyPoints ?? null) : null,
    body.onboardingComplete === undefined ? null : Number(Boolean(body.onboardingComplete)),
    body.transactionPin ?? null,
    body.biometricEnabled === undefined ? null : Number(Boolean(body.biometricEnabled)),
    body.profilePhoto ?? null,
    metadataValue,
    req.params.id
  );

  if (req.user.id === req.params.id) {
    const targetRole = (isPrivilegedUpdate || canSelfChooseRole) && body.role ? normalizeRole(body.role) : null;
    let account =
      (targetRole
        ? (db
            .prepare('SELECT * FROM user_accounts WHERE userId = ? AND role = ?')
            .get(req.params.id, targetRole) as any)
        : null) || getActiveAccount(req, { ...existingUser, id: req.params.id });

    if (!account && targetRole) {
      account = createAccountMode(req.params.id, targetRole, body);
    }

    if (account) {
      db.prepare(
        `
        UPDATE user_accounts
        SET role = COALESCE(?, role),
            verificationStatus = COALESCE(?, verificationStatus),
            onboardingComplete = COALESCE(?, onboardingComplete),
            walletBalance = COALESCE(?, walletBalance),
            tier = COALESCE(?, tier),
            businessName = COALESCE(?, businessName),
            businessCategory = COALESCE(?, businessCategory),
            businessLocation = COALESCE(?, businessLocation),
            tin = COALESCE(?, tin),
            category = COALESCE(?, category),
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(
        targetRole,
        body.verificationStatus ?? null,
        body.onboardingComplete === undefined ? null : Number(Boolean(body.onboardingComplete)),
        body.walletBalance ?? null,
        body.tier ?? null,
        body.businessName ?? null,
        body.businessCategory ?? null,
        body.location ?? null,
        body.tin ?? null,
        body.category ?? null,
        account.id
      );
    }
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  mirrorAccountState(req.params.id);
  res.json({ success: true, user: publicUserWithAccess(req, user) });
});

function transformProduct(product: any) {
  const metadata = parseJsonObject(product.metadata);
  return {
    ...metadata,
    ...product,
    imageUrl: product.image,
    variants: Array.isArray(metadata.variants) ? metadata.variants : [],
    qrCode: metadata.qrCode || product.qrCode || null,
    mediaItems: product.images
      ? (() => {
          try {
            return JSON.parse(product.images);
          } catch {
            return [];
          }
        })()
      : [],
  };
}

app.get('/api/products', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const conditions: string[] = [];
  const params: any[] = [];
  const activeTeam = getActiveTeamContext(req);
  const requestedTraderId = req.query.traderId ? String(req.query.traderId) : '';

  if (
    activeTeam?.traderId &&
    requestedTraderId &&
    requestedTraderId !== activeTeam.traderId &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ error: 'You can only view products for the invited shop' });
  }

  if (activeTeam?.traderId && !requestedTraderId) {
    conditions.push('p.traderId = ?');
    params.push(activeTeam.traderId);
  } else if (req.query.traderId) {
    conditions.push('p.traderId = ?');
    params.push(req.query.traderId);
  }
  if (req.query.traderId__ne) {
    conditions.push('p.traderId != ?');
    params.push(req.query.traderId__ne);
  }
  if (req.query.category) {
    conditions.push('p.category = ?');
    params.push(req.query.category);
  }
  if (req.query.status) {
    conditions.push('p.status = ?');
    params.push(req.query.status);
  }
  if (req.query.code) {
    conditions.push('p.code = ?');
    params.push(req.query.code);
  }
  if (req.query.search) {
    conditions.push('(p.name LIKE ? OR p.description LIKE ? OR u.businessName LIKE ?)');
    const term = `%${req.query.search}%`;
    params.push(term, term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const products = db
    .prepare(
      `
    SELECT p.*, u.name as traderName, u.businessName as traderBusinessName, u.location as traderLocation
    FROM products p
    JOIN users u ON u.id = p.traderId
    ${where}
    ORDER BY p.createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset) as any[];

  const transformedProducts = products.map(transformProduct);

  res.json({ success: true, products: transformedProducts });
});

app.get('/api/products/:id', authenticate, (req: any, res): any => {
  const product = db
    .prepare(
      `
    SELECT p.*, u.name as traderName, u.businessName as traderBusinessName
    FROM products p
    JOIN users u ON u.id = p.traderId
    WHERE p.id = ?
  `
    )
    .get(req.params.id) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });

  res.json({ success: true, product: transformProduct(product) });
});

interface ProductPayload {
  traderId?: string;
  name?: string;
  description?: string;
  category?: string;
  price?: any;
  stock?: any;
  status?: string;
  image?: string;
  imageUrl?: string;
  images?: string;
  mediaItems?: any[];
  code?: string;
  qrCode?: string;
  variants?: any[];
  metadata?: any;
}

app.post(
  '/api/products',
  requireRole(['trader', 'admin']),
  upload.single('image'),
  (req: any, res): any => {
    const body = req.body as ProductPayload;
    const traderId =
      req.user.role === 'admin' && body.traderId
        ? body.traderId
        : req.effectiveTraderId || req.user.id;
    const name = String(body.name || '').trim();
    const category = String(body.category || 'General').trim();
    const price = asNumber(body.price);
    const stock = Math.max(0, Math.floor(asNumber(body.stock)));
    if (!name) return res.status(400).json({ error: 'Product name is required' });
    if (price <= 0) return res.status(400).json({ error: 'Price must be positive' });

    const id = uuidv4();
    const code = body.code || `PRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const mediaItemsJson =
      body.mediaItems && Array.isArray(body.mediaItems) ? JSON.stringify(body.mediaItems) : null;
    const metadataJson = JSON.stringify({
      ...parseJsonObject(body.metadata),
      qrCode: body.qrCode || `esoko-product-${code}`,
      variants: Array.isArray(body.variants) ? body.variants : [],
    });
    const imageValue = req.file
      ? `/uploads/${req.file.filename}`
      : body.imageUrl || body.image || null;
    const trader = db.prepare('SELECT verificationStatus FROM users WHERE id = ?').get(traderId) as any;
    const productStatus =
      req.user.role !== 'admin' &&
      !['verified', 'basic_verified', 'business_verified', 'sector_verified'].includes(
        trader?.verificationStatus
      )
        ? 'pending_verification'
        : body.status || 'available';

    db.prepare(
      `
    INSERT INTO products (id, traderId, name, description, category, price, stock, status, image, images, code, metadata, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
    ).run(
      id,
      traderId,
      name,
      body.description || null,
      category,
      price,
      stock,
      productStatus,
      imageValue,
      mediaItemsJson,
      code,
      metadataJson
    );

    const savedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    void mirrorProductToPostgres(savedProduct).catch((error) => {
      console.error('Postgres product mirror failed:', error);
    });
    res.json({ success: true, id, product: transformProduct(savedProduct) });
  }
);

app.put(
  '/api/products/:id',
  requireRole(['trader', 'admin']),
  upload.single('image'),
  (req: any, res): any => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const editableTraderId = req.effectiveTraderId || req.user.id;
    if (req.user.role !== 'admin' && product.traderId !== editableTraderId) {
      return res.status(403).json({ error: 'You can only edit your own products' });
    }

    const body = req.body as ProductPayload;
    const mediaItemsJson =
      body.mediaItems !== undefined
        ? Array.isArray(body.mediaItems)
          ? JSON.stringify(body.mediaItems)
          : null
        : undefined;
    const currentMetadata = parseJsonObject(product.metadata);
    const metadataJson =
      body.metadata !== undefined || body.qrCode !== undefined || body.variants !== undefined
        ? JSON.stringify({
            ...currentMetadata,
            ...parseJsonObject(body.metadata),
            ...(body.qrCode !== undefined ? { qrCode: body.qrCode } : {}),
            ...(body.variants !== undefined
              ? { variants: Array.isArray(body.variants) ? body.variants : [] }
              : {}),
          })
        : undefined;
    const imageValue = req.file
      ? `/uploads/${req.file.filename}`
      : (body.imageUrl ?? body.image ?? null);
    db.prepare(
      `
    UPDATE products
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        stock = COALESCE(?, stock),
        status = COALESCE(?, status),
        image = COALESCE(?, image),
        images = COALESCE(?, images),
        metadata = COALESCE(?, metadata),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
    ).run(
      body.name ?? null,
      body.description ?? null,
      body.category ?? null,
      body.price ?? null,
      body.stock ?? null,
      body.status ?? null,
      imageValue,
      mediaItemsJson,
      metadataJson,
      req.params.id
    );

    const savedProduct = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(req.params.id) as any;
    void mirrorProductToPostgres(savedProduct).catch((error) => {
      console.error('Postgres product mirror failed:', error);
    });
    res.json({ success: true, product: transformProduct(savedProduct) });
  }
);

app.delete('/api/products/:id', requireRole(['trader', 'admin']), (req: any, res): any => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const editableTraderId = req.effectiveTraderId || req.user.id;
  if (req.user.role !== 'admin' && product.traderId !== editableTraderId) {
    return res.status(403).json({ error: 'You can only delete your own products' });
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  void deleteProductFromPostgres(req.params.id).catch((error) => {
    console.error('Postgres product delete mirror failed:', error);
  });
  res.json({ success: true });
});

app.get('/api/purchases', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const conditions: string[] = [];
  const params: any[] = [];
  if (req.query.customerId) {
    conditions.push('p.customerId = ?');
    params.push(req.query.customerId);
  }
  if (req.query.traderId) {
    conditions.push('p.traderId = ?');
    params.push(req.query.traderId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const purchases = db
    .prepare(
      `
    SELECT p.*, pr.name as productName, COALESCE(p.customerName, c.name) as customerName, t.name as traderName, t.businessName as traderBusinessName, t.tier as traderTier
    FROM purchases p
    JOIN products pr ON pr.id = p.productId
    JOIN users c ON c.id = p.customerId
    JOIN users t ON t.id = p.traderId
    ${where}
    ORDER BY p.createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset);
  res.json({ success: true, purchases: purchases.map(normalizePurchaseRow) });
});

app.post('/api/purchases', authenticate, (req: any, res): any => {
  try {
    const productId = req.body.productId;
    const quantity = Math.max(1, Math.floor(asNumber(req.body.quantity, 1)));
    const customerId = req.body.customerId || req.user.id;
    const activeTeam = getActiveTeamContext(req);
    const isTraderRecordedSale =
      (req.user.role === 'trader' || Boolean(activeTeam?.traderId)) &&
      req.body.recordedBy === 'trader';
    const wantsDelivery = Boolean(req.body.isDelivery);
    const idemKey = idempotency.requireKey(req, res);
    if (idemKey === null) return;
    const existingResponse = idempotency.getResponse(customerId, idemKey, req.originalUrl);
    if (existingResponse.found) {
      return res.status(existingResponse.statusCode).json(existingResponse.response);
    }

    if (!isTraderRecordedSale && req.user.role !== 'admin' && req.user.id !== customerId) {
      return res.status(403).json({ error: 'You can only buy with your own wallet' });
    }

    const result = db.transaction(() => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
      if (!product) throw new Error('Product not found');
      if (product.status !== 'available') throw new Error('Product is not available');
      if (product.stock < quantity) throw new Error('Not enough stock available');

      const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(customerId) as any;
      const trader = db.prepare('SELECT * FROM users WHERE id = ?').get(product.traderId) as any;
      if (!customer || !trader) throw new Error('Customer or trader not found');
      const saleTraderId = activeTeam?.traderId || req.user.id;
      if (isTraderRecordedSale && product.traderId !== saleTraderId) {
        throw new Error('You can only record sales for your own products');
      }

      const total =
        isTraderRecordedSale && req.body.totalAmount !== undefined
          ? asNumber(req.body.totalAmount, product.price * quantity)
          : product.price * quantity;
      if (!isTraderRecordedSale && customer.walletBalance < total)
        throw new Error('Insufficient wallet balance');

      const feeCalc = isTraderRecordedSale
        ? { totalFee: 0, percentageFee: 0 }
        : calculateFeeAmount('purchase', total, trader.tier || 'free');
      const sellerNet = total - feeCalc.totalFee;
      if (sellerNet < 0) throw new Error('Fee configuration makes sale impossible');

      const purchaseId = uuidv4();
      const transactionId = uuidv4();
      const code = txCode('PAY');

      const stockUpdate = db
        .prepare(
          'UPDATE products SET stock = stock - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?'
        )
        .run(quantity, product.id, quantity);
      if (stockUpdate.changes !== 1) throw new Error('Not enough stock available');

      if (!isTraderRecordedSale) {
        const customerUpdate = db
          .prepare(
            'UPDATE users SET walletBalance = walletBalance - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND walletBalance >= ?'
          )
          .run(total, customer.id, total);
        if (customerUpdate.changes !== 1) throw new Error('Insufficient wallet balance');
      }

      const traderUpdate = db
        .prepare(
          'UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
        )
        .run(sellerNet, trader.id);
      if (traderUpdate.changes !== 1) throw new Error('Trader wallet could not be credited');

      db.prepare(
        `
        INSERT INTO purchases (
          id, customerId, traderId, productId, quantity, totalAmount, status, deliveryStatus,
          paymentStatus, notes, feeAmount, netAmount, vat, isDelivery, deliveryAddress,
          paymentMethod, recordedBy, customerName, customerEmail, customerPhone, discountAmount,
          createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, 'paid', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        purchaseId,
        customer.id,
        trader.id,
        product.id,
        quantity,
        total,
        wantsDelivery ? 'pending' : 'N/A',
        req.body.notes || null,
        feeCalc.totalFee,
        sellerNet,
        asNumber(req.body.vat, 0),
        wantsDelivery ? 1 : 0,
        req.body.deliveryAddress || req.body.address || null,
        req.body.paymentMethod || (isTraderRecordedSale ? 'cash' : 'wallet'),
        req.body.recordedBy || 'customer',
        req.body.customerName || customer.name,
        req.body.customerEmail || null,
        req.body.customerPhone || null,
        Math.max(0, asNumber(req.body.discountAmount, 0))
      );

      if (wantsDelivery) {
        db.prepare(
          `
          INSERT INTO deliveries (id, purchaseId, customerId, traderId, location, status, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
        ).run(
          uuidv4(),
          purchaseId,
          customer.id,
          trader.id,
          req.body.deliveryAddress || req.body.address || null,
          req.body.notes || null
        );
      }

      db.prepare(
        `
        INSERT INTO transactions (id, userId, senderId, recipientId, customerId, traderId, amount, type, status, description, transactionCode, reference, feeAmount, netAmount, createdAt, updatedAt, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        transactionId,
        isTraderRecordedSale ? trader.id : customer.id,
        isTraderRecordedSale ? null : customer.id,
        trader.id,
        customer.id,
        trader.id,
        total,
        isTraderRecordedSale ? 'sale' : 'purchase',
        `Purchase of ${quantity} x ${product.name}`,
        code,
        purchaseId,
        feeCalc.totalFee,
        sellerNet
      );

      if (!isTraderRecordedSale) {
        db.prepare(
          `
          INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
          VALUES (?, ?, 'payment_out', ?, ?, 'completed', CURRENT_TIMESTAMP),
                 (?, ?, 'payment_in', ?, ?, 'completed', CURRENT_TIMESTAMP)
        `
        ).run(
          uuidv4(),
          customer.id,
          total,
          `Paid ${trader.businessName || trader.name} for ${product.name}`,
          uuidv4(),
          trader.id,
          sellerNet,
          `Sale to ${customer.name}: ${product.name}`
        );
      } else {
        db.prepare(
          `
          INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
          VALUES (?, ?, 'payment_in', ?, ?, 'completed', CURRENT_TIMESTAMP)
        `
        ).run(uuidv4(), trader.id, sellerNet, `Recorded sale: ${product.name}`);
      }

      recordTransactionFee(
        transactionId,
        trader.id,
        'purchase',
        feeCalc.totalFee,
        feeCalc.percentageFee
      );
      if (feeCalc.totalFee > 0) {
        recordPlatformWalletTransaction({
          type: 'marketplace_fee_collection',
          direction: 'in',
          amount: feeCalc.totalFee,
          userId: trader.id,
          relatedTransactionId: transactionId,
          description: `Marketplace fee collected from ${trader.businessName || trader.name}`,
          metadata: { purchaseId, customerId: customer.id, grossAmount: total },
        });
      }
      if (!isTraderRecordedSale) {
        recordWalletLiabilityChange({
          transactionId,
          userId: customer.id,
          amountDelta: -total,
          description: `Purchase paid to ${trader.businessName || trader.name}`,
          metadata: { purchaseId, traderId: trader.id, feeAmount: feeCalc.totalFee },
        });
      }
      recordWalletLiabilityChange({
        transactionId,
        userId: trader.id,
        amountDelta: sellerNet,
        description: `Sale settlement from ${customer.name}`,
        metadata: {
          purchaseId,
          customerId: customer.id,
          grossAmount: total,
          feeAmount: feeCalc.totalFee,
        },
      });

      if (!isTraderRecordedSale) {
        const loyaltyPolicy = getLoyaltyPolicy().config;
        const multiplier =
          customer.tier === 'premium' ? asNumber(loyaltyPolicy.premiumMultiplier, 2) : 1;
        const pointsEarned = Math.floor(total * asNumber(loyaltyPolicy.purchaseEarnPerRwf, 0.001) * multiplier);
        awardLoyaltyPoints(
          customer.id,
          pointsEarned,
          'purchase',
          `Purchase reward for ${product.name}`,
          transactionId
        );
        qualifyReferralIfReady(customer.id, transactionId);
      }

      db.prepare(
        `
        INSERT INTO notifications (id, userId, title, message, type, subType, createdAt, updatedAt)
        VALUES (?, ?, 'Purchase completed', ?, 'success', 'transaction', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
               (?, ?, 'New sale', ?, 'success', 'transaction', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        uuidv4(),
        customer.id,
        `You bought ${product.name} for RWF ${total.toLocaleString()}.`,
        uuidv4(),
        trader.id,
        `${customer.name} bought ${quantity} x ${product.name}.`
      );

      return {
        success: true,
        purchaseId,
        transactionId,
        total,
        code,
        fee: feeCalc.totalFee,
        sellerNet,
      };
    })();

    idempotency.saveResponse(customerId, idemKey, req.originalUrl, result);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/purchases/:id', authenticate, (req: any, res): any => {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id) as any;
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'manager' &&
    req.user.id !== purchase.traderId
  ) {
    return res.status(403).json({ error: 'Only the trader or admin can update this purchase' });
  }

  db.prepare(
    `
    UPDATE purchases
    SET status = COALESCE(?, status),
        deliveryStatus = COALESCE(?, deliveryStatus),
        paymentStatus = COALESCE(?, paymentStatus),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(
    req.body.status ?? null,
    req.body.deliveryStatus ?? null,
    req.body.paymentStatus ?? null,
    req.params.id
  );
  res.json({ success: true });
});

app.get('/api/deliveries', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const conditions: string[] = [];
  const params: any[] = [];
  if (req.query.traderId) {
    conditions.push('d.traderId = ?');
    params.push(req.query.traderId);
  }
  if (req.query.customerId) {
    conditions.push('d.customerId = ?');
    params.push(req.query.customerId);
  }
  if (req.query.status) {
    conditions.push('d.status = ?');
    params.push(req.query.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const deliveries = db
    .prepare(
      `
    SELECT d.*, p.totalAmount, p.quantity, pr.name as productName, c.name as customerName, c.phone as customerPhone
    FROM deliveries d
    JOIN purchases p ON p.id = d.purchaseId
    JOIN products pr ON pr.id = p.productId
    JOIN users c ON c.id = d.customerId
    ${where}
    ORDER BY d.createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset);
  res.json({ success: true, deliveries: deliveries.map(normalizeDeliveryRow) });
});

app.post('/api/deliveries', requireRole(['trader', 'admin']), (req: any, res): any => {
  const purchaseId = req.body.purchaseId;
  if (!purchaseId) return res.status(400).json({ error: 'Purchase ID is required' });

  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any;
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  if (req.user.role !== 'admin' && req.user.id !== purchase.traderId) {
    return res
      .status(403)
      .json({ error: 'Only the trader can create deliveries for their purchases' });
  }

  const deliveryId = uuidv4();
  db.prepare(
    `
    INSERT INTO deliveries (id, purchaseId, customerId, traderId, location, latitude, longitude, status, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    deliveryId,
    purchaseId,
    purchase.customerId,
    purchase.traderId,
    req.body.location || null,
    req.body.latitude || null,
    req.body.longitude || null,
    req.body.status || 'pending',
    req.body.notes || null
  );
  res.json({ success: true, id: deliveryId });
});

app.put('/api/deliveries/:id', authenticate, (req: any, res): any => {
  const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as any;
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (req.user.role !== 'admin' && req.user.id !== delivery.traderId) {
    return res.status(403).json({ error: 'Only the trader can update this delivery' });
  }

  db.prepare(
    `
    UPDATE deliveries
    SET status = COALESCE(?, status),
        trackingNumber = COALESCE(?, trackingNumber),
        estimatedDeliveryDate = COALESCE(?, estimatedDeliveryDate),
        actualDeliveryDate = COALESCE(?, actualDeliveryDate),
        notes = COALESCE(?, notes),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(
    req.body.status ?? null,
    req.body.trackingNumber ?? null,
    req.body.estimatedDeliveryDate ?? null,
    req.body.actualDeliveryDate ?? null,
    req.body.notes ?? null,
    req.params.id
  );
  res.json({ success: true });
});

app.get('/api/transactions', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const allowedSort = ['createdAt', 'timestamp', 'amount', 'type', 'status'];
  const requestedSort = String(req.query.sortBy || req.query.orderBy || '');
  const sortBy = allowedSort.includes(requestedSort) ? requestedSort : 'createdAt';
  const sortOrder =
    String(req.query.sortOrder || req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const conditions: string[] = [];
  const params: any[] = [];
  const isPrivileged = canManageUsers(req.user);
  const requestedUserId = req.query.userId ? String(req.query.userId) : req.user.id;

  if (!isPrivileged && requestedUserId !== req.user.id) {
    return res.status(403).json({ error: 'You can only view your own transactions' });
  }

  if (!isPrivileged || req.query.userId) {
    conditions.push(
      '(userId = ? OR senderId = ? OR recipientId = ? OR customerId = ? OR traderId = ?)'
    );
    params.push(requestedUserId, requestedUserId, requestedUserId, requestedUserId, requestedUserId);
  }
  if (req.query.type) {
    conditions.push('type = ?');
    params.push(req.query.type);
  }
  if (req.query.status) {
    conditions.push('status = ?');
    params.push(req.query.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const transactions = db
    .prepare(
      `
    SELECT * FROM transactions ${where}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset);
  res.json({ success: true, transactions });
});

app.post('/api/transactions', authenticate, (req: any, res): any => {
  const senderId = req.body.senderId || req.user.id;
  if (!ensureWalletActionAllowed(senderId)) {
    return res.status(423).json({
      error:
        'Wallet operations are blocked due to an unresolved login alert. Confirm the recent login before retrying.',
    });
  }

  const id = uuidv4();
  const senderIdFinal = senderId;
  const status = String(req.body.status || '')
    .trim()
    .toLowerCase();
  const requestedType = String(req.body.type || 'manual')
    .trim()
    .toLowerCase();

  // Only admins can create pre-completed transactions
  if (status === 'completed' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create completed transactions' });
  }

  // Only admins can create transactions for other users
  if (senderId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only create transactions for yourself' });
  }

  // Validate transaction type
  const validTypes = [
    'manual',
    'purchase',
    'deposit',
    'withdrawal',
    'transfer',
    'loan_application',
    'payment',
  ];
  const finalType = validTypes.includes(requestedType) ? requestedType : 'manual';

  db.prepare(
    `
    INSERT INTO transactions (id, userId, senderId, recipientId, amount, type, status, description, reference, transactionCode, createdAt, updatedAt, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    senderId,
    senderId,
    req.body.recipientId || null,
    asNumber(req.body.amount),
    finalType,
    status || 'pending',
    req.body.description || null,
    req.body.reference || null,
    txCode('TX')
  );
  res.json({ success: true, id });
});

app.put('/api/transactions/:id', authenticate, (req: any, res): any => {
  const transaction = db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(req.params.id) as any;
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  const canUpdate =
    ['admin', 'manager'].includes(req.user.role) ||
    [
      transaction.userId,
      transaction.senderId,
      transaction.recipientId,
      transaction.customerId,
      transaction.traderId,
    ].includes(req.user.id);
  if (!canUpdate)
    return res.status(403).json({ error: 'You can only update your own transactions' });
  db.prepare(
    'UPDATE transactions SET status = COALESCE(?, status), updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(req.body.status ?? null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/transactions/:id', requireRole(['admin']), (req: any, res): any => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/wallet/:userId', authenticate, (req: any, res): any => {
  if (req.user.id !== req.params.userId && !['admin', 'manager', 'agent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own wallet' });
  }
  const user = db
    .prepare('SELECT walletBalance, loyaltyPoints FROM users WHERE id = ?')
    .get(req.params.userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  const transactions = db
    .prepare(
      `
    SELECT * FROM wallet_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50
  `
    )
    .all(req.params.userId);
  res.json({
    success: true,
    wallet: {
      userId: req.params.userId,
      balance: user.walletBalance || 0,
      currency: 'RWF',
      loyaltyPoints: user.loyaltyPoints || 0,
      totalEarned: user.loyaltyPoints || 0,
      transactions,
      lastUpdated: new Date().toISOString(),
    },
  });
});

app.post('/api/wallet/deposit', authenticate, (req: any, res): any => {
  const userId = req.body.userId || req.user.id;
  const idemKey = idempotency.requireKey(req, res);
  if (idemKey === null) return;
  const existingResponse = idempotency.getResponse(userId, idemKey, req.originalUrl);
  if (existingResponse.found) {
    return res.status(existingResponse.statusCode).json(existingResponse.response);
  }

  if (!ensureWalletActionAllowed(userId)) {
    return res.status(423).json({
      error:
        'Wallet operations are blocked due to an unresolved login alert. Confirm the recent login before retrying.',
    });
  }
  if (req.user.id !== userId && !['admin', 'agent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only agents or admins can deposit for another user' });
  }
  const amount = asNumber(req.body.amount);
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  const userTier = user?.tier || 'free';
  const feeCalc = calculateFeeAmount('deposit', amount, userTier);
  if (feeCalc.netAmount < 0)
    return res.status(400).json({ error: 'Deposit amount is too small after fees' });

  const walletTransactionId = uuidv4();
  const transactionRecordId = uuidv4();
  const canCreditImmediately = ['admin', 'agent'].includes(req.user.role);
  if (!canCreditImmediately) {
    const result = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
        VALUES (?, ?, 'deposit', ?, ?, 'pending', CURRENT_TIMESTAMP)
      `
      ).run(
        walletTransactionId,
        userId,
        amount,
        `Pending deposit via ${req.body.method || 'external'}`
      );
      db.prepare(
        `
        INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, createdAt, updatedAt, timestamp)
        VALUES (?, ?, ?, 'deposit', 'pending', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        transactionRecordId,
        userId,
        amount,
        `Pending deposit via ${req.body.method || 'external'}`,
        req.body.reference || walletTransactionId,
        txCode('DEP'),
        feeCalc.totalFee,
        feeCalc.netAmount
      );
      return {
        success: true,
        pending: true,
        transactionId: transactionRecordId,
        grossAmount: amount,
        fee: feeCalc.totalFee,
        netAmount: feeCalc.netAmount,
        message: 'Deposit recorded as pending. Funds will be credited after confirmation.',
      };
    })();

    idempotency.saveResponse(userId, idemKey, req.originalUrl, result);
    return res.status(202).json(result);
  }

  const result = db.transaction(() => {
    const balanceUpdate = db
      .prepare(
        'UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .run(feeCalc.netAmount, userId);
    if (balanceUpdate.changes !== 1) throw new Error('User wallet could not be credited');
    db.prepare(
      `
      INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
      VALUES (?, ?, 'deposit', ?, ?, 'completed', CURRENT_TIMESTAMP)
    `
    ).run(
      walletTransactionId,
      userId,
      feeCalc.netAmount,
      `Deposit via ${req.body.method || 'cash'}`
    );
    db.prepare(
      `
      INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, createdAt, updatedAt, timestamp)
      VALUES (?, ?, ?, 'deposit', 'completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      transactionRecordId,
      userId,
      amount,
      `Deposit via ${req.body.method || 'cash'}`,
      req.body.reference || walletTransactionId,
      txCode('DEP'),
      feeCalc.totalFee,
      feeCalc.netAmount
    );
    recordWalletLiabilityChange({
      transactionId: transactionRecordId,
      userId,
      amountDelta: feeCalc.netAmount,
      description: `Wallet deposit credited: ${req.body.method || 'cash'}`,
      metadata: {
        grossAmount: amount,
        feeAmount: feeCalc.totalFee,
        method: req.body.method || 'cash',
      },
    });
    recordTransactionFee(
      transactionRecordId,
      userId,
      'deposit',
      feeCalc.totalFee,
      feeCalc.percentageFee
    );
    if (feeCalc.totalFee > 0) {
      recordPlatformWalletTransaction({
        type: 'deposit_fee_collection',
        direction: 'in',
        amount: feeCalc.totalFee,
        userId,
        relatedTransactionId: transactionRecordId,
        description: 'Wallet deposit fee collected',
        metadata: { grossAmount: amount, method: req.body.method || 'cash' },
      });
    }
    qualifyReferralIfReady(userId, transactionRecordId);
    return {
      success: true,
      transactionId: transactionRecordId,
      grossAmount: amount,
      fee: feeCalc.totalFee,
      netAmount: feeCalc.netAmount,
      message: 'Deposit successful',
    };
  })();

  idempotency.saveResponse(userId, idemKey, req.originalUrl, result);
  res.json(result);
});

app.post('/api/wallet/withdraw', authenticate, (req: any, res): any => {
  const userId = req.body.userId || req.user.id;
  const idemKey = idempotency.requireKey(req, res);
  if (idemKey === null) return;
  const existingResponse = idempotency.getResponse(userId, idemKey, req.originalUrl);
  if (existingResponse.found) {
    return res.status(existingResponse.statusCode).json(existingResponse.response);
  }

  if (!ensureWalletActionAllowed(userId)) {
    return res.status(423).json({
      error:
        'Wallet operations are blocked due to an unresolved login alert. Confirm the recent login before retrying.',
    });
  }
  if (req.user.id !== userId && !['admin', 'agent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only agents or admins can withdraw for another user' });
  }
  const amount = asNumber(req.body.amount);
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const user = db.prepare('SELECT walletBalance, tier FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const feeCalc = calculateFeeAmount('withdrawal', amount, user.tier || 'free');
  const totalDeduction = amount + feeCalc.totalFee;
  if (user.walletBalance < totalDeduction)
    return res.status(400).json({ error: 'Insufficient funds for withdrawal plus fee' });

  const walletTransactionId = uuidv4();
  const transactionRecordId = uuidv4();
  const result = db.transaction(() => {
    const balanceUpdate = db
      .prepare(
        'UPDATE users SET walletBalance = walletBalance - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND walletBalance >= ?'
      )
      .run(totalDeduction, userId, totalDeduction);
    if (balanceUpdate.changes !== 1) throw new Error('Insufficient funds for withdrawal plus fee');
    db.prepare(
      `
      INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
      VALUES (?, ?, 'withdrawal', ?, ?, 'completed', CURRENT_TIMESTAMP)
    `
    ).run(walletTransactionId, userId, amount, `Withdrawal via ${req.body.method || 'cash'}`);
    db.prepare(
      `
      INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, createdAt, updatedAt, timestamp)
      VALUES (?, ?, ?, 'withdrawal', 'completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      transactionRecordId,
      userId,
      amount,
      `Withdrawal via ${req.body.method || 'cash'}`,
      req.body.reference || walletTransactionId,
      txCode('WDR'),
      feeCalc.totalFee,
      amount
    );
    recordWalletLiabilityChange({
      transactionId: transactionRecordId,
      userId,
      amountDelta: -totalDeduction,
      description: `Wallet withdrawal debited: ${req.body.method || 'cash'}`,
      metadata: {
        grossAmount: amount,
        feeAmount: feeCalc.totalFee,
        method: req.body.method || 'cash',
      },
    });
    recordTransactionFee(
      transactionRecordId,
      userId,
      'withdrawal',
      feeCalc.totalFee,
      feeCalc.percentageFee
    );
    if (feeCalc.totalFee > 0) {
      recordPlatformWalletTransaction({
        type: 'withdrawal_fee_collection',
        direction: 'in',
        amount: feeCalc.totalFee,
        userId,
        relatedTransactionId: transactionRecordId,
        description: 'Wallet withdrawal fee collected',
        metadata: { grossAmount: amount, method: req.body.method || 'cash' },
      });
    }
    return {
      success: true,
      transactionId: walletTransactionId,
      grossAmount: amount,
      fee: feeCalc.totalFee,
      totalDeducted: totalDeduction,
      message: 'Withdrawal successful',
    };
  })();

  idempotency.saveResponse(userId, idemKey, req.originalUrl, result);
  res.json(result);
});

app.post('/api/wallet/transfer', authenticate, (req: any, res): any => {
  try {
    const senderId = req.body.senderId || req.user.id;
    const recipientId = req.body.recipientId;
    const idemKey = idempotency.requireKey(req, res);
    if (idemKey === null) return;
    const existingResponse = idempotency.getResponse(senderId, idemKey, req.originalUrl);
    if (existingResponse.found) {
      return res.status(existingResponse.statusCode).json(existingResponse.response);
    }

    if (!ensureWalletActionAllowed(senderId) || !ensureWalletActionAllowed(recipientId)) {
      return res.status(423).json({
        error:
          'Wallet operations are blocked due to an unresolved login alert for one of the users involved. Confirm the recent login before retrying.',
      });
    }
    const amount = asNumber(req.body.amount);
    if (req.user.id !== senderId && !['admin', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only transfer from your own wallet' });
    }
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    if (!recipientId || senderId === recipientId)
      return res.status(400).json({ error: 'Valid recipient is required' });

    const result = db.transaction(() => {
      const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(senderId) as any;
      const recipient = db.prepare('SELECT * FROM users WHERE id = ?').get(recipientId) as any;
      if (!sender || !recipient) throw new Error('Sender or recipient not found');

      const feeCalc = calculateFeeAmount('transfer', amount, sender.tier || 'free');
      const totalDebit = amount + feeCalc.totalFee;
      if (sender.walletBalance < totalDebit)
        throw new Error('Insufficient funds for transfer plus fee');

      const transferId = uuidv4();
      const transactionRecordId = uuidv4();
      const code = txCode('TRF');

      const debitUpdate = db
        .prepare(
          'UPDATE users SET walletBalance = walletBalance - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND walletBalance >= ?'
        )
        .run(totalDebit, senderId, totalDebit);
      if (debitUpdate.changes !== 1) throw new Error('Insufficient funds for transfer plus fee');

      const creditUpdate = db
        .prepare(
          'UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
        )
        .run(amount, recipientId);
      if (creditUpdate.changes !== 1) throw new Error('Recipient wallet could not be credited');
      db.prepare(
        `
        INSERT INTO peer_transfers (id, senderId, recipientId, amount, status, reference, createdAt)
        VALUES (?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
      `
      ).run(transferId, senderId, recipientId, amount, req.body.reference || code);
      db.prepare(
        `
        INSERT INTO transactions (id, userId, senderId, recipientId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, createdAt, updatedAt, timestamp)
        VALUES (?, ?, ?, ?, ?, 'transfer', 'completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        transactionRecordId,
        senderId,
        senderId,
        recipientId,
        amount,
        `Transfer to ${recipient.name}`,
        transferId,
        code,
        feeCalc.totalFee,
        amount
      );
      db.prepare(
        `
        INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
        VALUES (?, ?, 'transfer_out', ?, ?, 'completed', CURRENT_TIMESTAMP),
               (?, ?, 'transfer_in', ?, ?, 'completed', CURRENT_TIMESTAMP),
               (?, ?, 'transfer_fee', ?, ?, 'completed', CURRENT_TIMESTAMP)
      `
      ).run(
        uuidv4(),
        senderId,
        amount,
        `Transfer to ${recipient.name}`,
        uuidv4(),
        recipientId,
        amount,
        `Transfer from ${sender.name}`,
        uuidv4(),
        senderId,
        feeCalc.totalFee,
        `Transfer fee for ${recipient.name}`
      );
      recordTransactionFee(
        transactionRecordId,
        senderId,
        'transfer',
        feeCalc.totalFee,
        feeCalc.percentageFee
      );
      if (feeCalc.totalFee > 0) {
        recordPlatformWalletTransaction({
          type: 'transfer_fee_collection',
          direction: 'in',
          amount: feeCalc.totalFee,
          userId: senderId,
          relatedTransactionId: transactionRecordId,
          description: 'Wallet transfer fee collected',
          metadata: { recipientId, grossAmount: amount },
        });
      }
      recordWalletLiabilityChange({
        transactionId: transactionRecordId,
        userId: senderId,
        amountDelta: -totalDebit,
        description: `Transfer debited to ${recipient.name}`,
        metadata: { recipientId, amount, feeAmount: feeCalc.totalFee },
      });
      recordWalletLiabilityChange({
        transactionId: transactionRecordId,
        userId: recipientId,
        amountDelta: amount,
        description: `Transfer credited from ${sender.name}`,
        metadata: { senderId, amount },
      });
      qualifyReferralIfReady(senderId, transactionRecordId);
      qualifyReferralIfReady(recipientId, transactionRecordId);
      return {
        success: true,
        transactionId: transferId,
        fee: feeCalc.totalFee,
        totalDebited: totalDebit,
        message: 'Transfer successful',
      };
    })();
    idempotency.saveResponse(senderId, idemKey, req.originalUrl, result);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/wallet/loyalty/redeem', authenticate, (req: any, res): any => {
  const userId = req.body.userId || req.user.id;
  if (req.user.id !== userId)
    return res.status(403).json({ error: 'You can only redeem your own points' });
  const points = asNumber(req.body.points);
  if (points <= 0) return res.status(400).json({ error: 'Points must be positive' });
  const policy = getLoyaltyPolicy().config;
  if (points < asNumber(policy.minRedeemPoints, 100)) {
    return res.status(400).json({ error: `Minimum ${policy.minRedeemPoints} points required` });
  }
  if (req.body.purpose && req.body.purpose !== 'service_fee') {
    return res.status(400).json({ error: 'Loyalty points can only be redeemed for service fees' });
  }
  const user = db.prepare('SELECT loyaltyPoints FROM users WHERE id = ?').get(userId) as any;
  if (!user || user.loyaltyPoints < points)
    return res.status(400).json({ error: 'Insufficient loyalty points' });
  const pointValueRwf = asNumber(policy.pointValueRwf, LOYALTY_POINT_RWF_VALUE);
  const value = Number((points * pointValueRwf).toFixed(2));
  const id = uuidv4();
  db.transaction(() => {
    db.prepare(
      'UPDATE users SET loyaltyPoints = loyaltyPoints - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(points, userId);
    db.prepare(
      `
      INSERT INTO loyalty_transactions (id, userId, points, type, description, relatedTransactionId, createdAt)
      VALUES (?, ?, ?, 'redeem', ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(
      uuidv4(),
      userId,
      -points,
      `Redeemed ${points} loyalty points toward service fees at ${pointValueRwf} RWF per point`,
      id
    );
    recordLoyaltyLiability({ userId, pointsDelta: -points, type: 'redeem', relatedTransactionId: id });
  })();
  res.json({
    success: true,
    transactionId: id,
    redemptionValue: value,
    pointsRedeemed: points,
    pointValueRwf,
    message: 'Points reserved for service fees',
  });
});

app.get('/api/wallet/loans/:userId', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  if (req.user.id !== req.params.userId && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own loans' });
  }
  const status = String(req.query.status || '').trim();
  const loans = db
    .prepare(
      `
    SELECT
      l.*,
      (SELECT COUNT(*) FROM loan_installments li WHERE li.loanId = l.id AND li.status = 'pending') as pendingInstallments,
      (SELECT MIN(dueDate) FROM loan_installments li WHERE li.loanId = l.id AND li.status = 'pending') as nextInstallmentDue
    FROM smart_loans l
    WHERE l.userId = ? AND (? = '' OR l.status = ?)
    ORDER BY l.createdAt DESC LIMIT ? OFFSET ?
  `
    )
    .all(req.params.userId, status, status, limit, offset);
  res.json({ success: true, loans });
});

app.post('/api/wallet/loans/apply', authenticate, (req: any, res): any => {
  const userId = req.body.userId || req.user.id;
  const amount = asNumber(req.body.amount);
  if (req.user.id !== userId && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only apply for your own loan' });
  }
  const policy = getLoanPolicy().config;
  const loanTerm = Math.min(
    asNumber(policy.maxTermMonths, 12),
    Math.max(asNumber(policy.minTermMonths, 1), Math.floor(asNumber(req.body.loanTerm, 12)))
  );
  if (amount <= 0) return res.status(400).json({ error: 'Loan amount must be positive' });
  if (amount < asNumber(policy.minLoanAmount) || amount > asNumber(policy.maxLoanAmount)) {
    return res.status(400).json({
      error: `Loan amount must be between RWF ${policy.minLoanAmount} and RWF ${policy.maxLoanAmount}`,
    });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const feeCalc = calculateFeeAmount('loan_application', amount, user.tier || 'free');
  const feePaymentMethod = req.body.feePaymentMethod === 'points' ? 'points' : 'wallet';
  if (feePaymentMethod === 'wallet' && user.walletBalance < feeCalc.totalFee)
    return res.status(400).json({ error: 'Insufficient funds to pay loan application fee' });

  const interestRate = calculateLoanInterestRate(user.tier || 'free', user.loyaltyPoints || 0);
  const monthlyRate = interestRate / 12;
  const monthlyPayment =
    (amount * monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) /
    (Math.pow(1 + monthlyRate, loanTerm) - 1);
  const totalRepayment = Number((monthlyPayment * loanTerm).toFixed(2));
  const processingFee = Math.min(
    asNumber(policy.processingFeeMax, 50000),
    Number((amount * asNumber(policy.processingFeePercent, 0.01)).toFixed(2))
  );
  const scoring = scoreLoanApplication(user, amount, loanTerm);
  const loanId = uuidv4();
  const transactionId = uuidv4();

  let disbursementTransactionId: string | null = null;
  db.transaction(() => {
    if (feePaymentMethod === 'points') {
      deductLoyaltyPointsForFee(userId, feeCalc.totalFee, 'loan_application_fee', transactionId);
    } else {
      db.prepare(
        'UPDATE users SET walletBalance = walletBalance - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(feeCalc.totalFee, userId);
    }
    const loanStatus =
      scoring.decision === 'approved'
        ? 'approved'
        : scoring.decision === 'manual_review'
          ? 'submitted'
          : 'rejected';
    db.prepare(
      `
      INSERT INTO smart_loans (
        id, userId, amount, status, approvalStatus, interestRate, loanTerm, monthlyPayment,
        totalRepayment, amountRepaid, nextPaymentDue, approvalScore, riskLevel, policyVersion,
        feePaymentMethod, applicationFee, processingFee, notes, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      loanId,
      userId,
      amount,
      loanStatus,
      scoring.decision,
      interestRate,
      loanTerm,
      monthlyPayment,
      totalRepayment,
      scoring.score,
      scoring.riskLevel,
      scoring.policyVersion,
      feePaymentMethod,
      feeCalc.totalFee,
      processingFee,
      scoring.factors.join('; ')
    );
    db.prepare(
      `
      INSERT INTO loan_scoring_snapshots (id, loanId, userId, score, decision, factors, policyVersion, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(
      uuidv4(),
      loanId,
      userId,
      scoring.score,
      scoring.decision,
      JSON.stringify(scoring.factors),
      scoring.policyVersion
    );
    db.prepare(
      `
      INSERT INTO transactions (id, userId, amount, type, status, description, transactionCode, reference, feeAmount, netAmount, createdAt, updatedAt, timestamp)
      VALUES (?, ?, 0, 'loan_application', 'completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      transactionId,
      userId,
      `Loan application fee for RWF ${amount}`,
      txCode('LOA'),
      loanId,
      feeCalc.totalFee,
      0
    );
    if (feePaymentMethod === 'wallet') {
      db.prepare(
        `
        INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
        VALUES (?, ?, 'loan_application_fee', ?, ?, 'completed', CURRENT_TIMESTAMP)
      `
      ).run(uuidv4(), userId, feeCalc.totalFee, `Loan application fee for RWF ${amount}`);
      recordWalletLiabilityChange({
        transactionId,
        userId,
        amountDelta: -feeCalc.totalFee,
        description: 'Loan application fee debited from wallet',
        metadata: { loanId, feeAmount: feeCalc.totalFee },
      });
    }
    recordTransactionFee(
      transactionId,
      userId,
      'loan_application',
      feeCalc.totalFee,
      feeCalc.percentageFee
    );
    if (feeCalc.totalFee > 0) {
      recordPlatformWalletTransaction({
        type: 'loan_application_fee_collection',
        direction: 'in',
        amount: feeCalc.totalFee,
        userId,
        relatedTransactionId: transactionId,
        description: 'Loan application fee collected',
        metadata: { loanId, feePaymentMethod },
      });
    }
    if (
      scoring.decision === 'approved' &&
      Boolean(policy.autoDisbursementEnabled) &&
      amount <= asNumber(policy.autoApprovalMaxAmount)
    ) {
      disbursementTransactionId = disburseLoan(loanId, req.user.id, 'auto');
    }
  })();

  const whatsapp = buildLoanWhatsAppHandoff({
    loanId,
    user,
    amount,
    loanTerm,
    approvalStatus: scoring.decision,
    approvalScore: scoring.score,
    riskLevel: scoring.riskLevel,
    monthlyPayment,
    totalRepayment,
  });

  try {
    const admins = db
      .prepare("SELECT id FROM users WHERE role IN ('admin', 'manager') AND COALESCE(status, 'active') != 'deleted'")
      .all() as any[];
    const notifyAdmin = db.prepare(
      `
      INSERT INTO notifications (id, userId, title, message, type, subType, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'info', 'loan_whatsapp_request', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    );
    admins.forEach((admin) => {
      notifyAdmin.run(
        uuidv4(),
        admin.id,
        'Loan request needs WhatsApp follow-up',
        `${user.businessName || user.name || user.email || userId} requested RWF ${amount.toLocaleString()} loan support.`,
        JSON.stringify({ loanId, applicantId: userId, whatsapp })
      );
    });
  } catch (notificationError) {
    console.error('Failed to create loan WhatsApp admin notification:', notificationError);
  }

  res.json({
    success: true,
    loanId,
    status: disbursementTransactionId ? 'active' : scoring.decision,
    approvalStatus: scoring.decision,
    approvalScore: scoring.score,
    riskLevel: scoring.riskLevel,
    interestRate,
    monthlyPayment,
    totalRepayment,
    totalInterest: Number((totalRepayment - amount).toFixed(2)),
    applicationFee: feeCalc.totalFee,
    feePaymentMethod,
    processingFee,
    disbursementTransactionId,
    whatsapp,
    message: 'Loan application submitted',
  });
});

app.post('/api/wallet/loans/preview', authenticate, (req: any, res): any => {
  const userId = req.body.userId || req.user.id;
  const amount = asNumber(req.body.amount);
  const policy = getLoanPolicy().config;
  const loanTerm = Math.min(
    asNumber(policy.maxTermMonths, 12),
    Math.max(asNumber(policy.minTermMonths, 1), Math.floor(asNumber(req.body.loanTerm, 12)))
  );
  if (amount <= 0) return res.status(400).json({ error: 'Loan amount must be positive' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const interestRate = calculateLoanInterestRate(user.tier || 'free', user.loyaltyPoints || 0);
  const monthlyRate = interestRate / 12;
  const monthlyPayment =
    (amount * monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) /
    (Math.pow(1 + monthlyRate, loanTerm) - 1);
  const totalRepayment = Number((monthlyPayment * loanTerm).toFixed(2));
  const totalInterest = Number((totalRepayment - amount).toFixed(2));
  const schedule = buildLoanSchedule(amount, monthlyRate, loanTerm);
  const feeCalc = calculateFeeAmount('loan_application', amount, user.tier || 'free');
  const processingFee = Math.min(
    asNumber(policy.processingFeeMax, 50000),
    Number((amount * asNumber(policy.processingFeePercent, 0.01)).toFixed(2))
  );
  const scoring = scoreLoanApplication(user, amount, loanTerm);

  res.json({
    success: true,
    amount,
    loanTerm,
    interestRate,
    monthlyPayment,
    totalRepayment,
    totalInterest,
    applicationFee: feeCalc.totalFee,
    processingFee,
    approvalScore: scoring.score,
    approvalStatus: scoring.decision,
    riskLevel: scoring.riskLevel,
    schedule,
  });
});

app.post('/api/wallet/loans/:loanId/disburse', requireRole(['admin']), (req: any, res): any => {
  try {
    const transactionId = db.transaction(() =>
      disburseLoan(req.params.loanId, req.user.id, 'admin')
    )();
    recordAdminAction(req.user.id, 'disburse_loan', 'loan', req.params.loanId, { transactionId });
    res.json({ success: true, transactionId, message: 'Loan disbursed' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/wallet/loans/:loanId/repay', authenticate, (req: any, res): any => {
  try {
    const loan = db.prepare('SELECT * FROM smart_loans WHERE id = ?').get(req.params.loanId) as any;
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (req.user.id !== loan.userId && !['admin', 'manager', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only repay your own loan' });
    }
    if (req.body.paymentMethod === 'points') {
      return res.status(400).json({ error: 'Loyalty points cannot repay loan principal or interest' });
    }
    const amount = asNumber(req.body.amount);
    if (amount <= 0) return res.status(400).json({ error: 'Repayment amount must be positive' });
    const user = db.prepare('SELECT walletBalance FROM users WHERE id = ?').get(loan.userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (asNumber(user.walletBalance) < amount) {
      db.prepare(
        `
        UPDATE loan_installments
        SET lastAttemptAt = CURRENT_TIMESTAMP, retryCount = retryCount + 1, updatedAt = CURRENT_TIMESTAMP
        WHERE loanId = ? AND status = 'pending'
      `
      ).run(loan.id);
      return res.status(400).json({ error: 'Insufficient wallet balance for loan repayment' });
    }

    const transactionId = uuidv4();
    const result = db.transaction(() => {
      db.prepare(
        'UPDATE users SET walletBalance = walletBalance - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND walletBalance >= ?'
      ).run(amount, loan.userId, amount);
      db.prepare(
        `
        INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, metadata, createdAt, updatedAt, timestamp)
        VALUES (?, ?, ?, 'loan_repayment', 'completed', ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        transactionId,
        loan.userId,
        amount,
        `Loan repayment for ${loan.id}`,
        loan.id,
        txCode('LRP'),
        amount,
        JSON.stringify({ loanId: loan.id })
      );
      db.prepare(
        `
        INSERT INTO wallet_transactions (id, userId, type, amount, description, status, metadata, createdAt)
        VALUES (?, ?, 'loan_repayment', ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
      `
      ).run(
        uuidv4(),
        loan.userId,
        amount,
        `Loan repayment for ${loan.id}`,
        JSON.stringify({ loanId: loan.id, transactionId })
      );
      recordWalletLiabilityChange({
        transactionId,
        userId: loan.userId,
        amountDelta: -amount,
        description: 'Loan repayment debited from wallet',
        metadata: { loanId: loan.id },
      });

      let remaining = amount;
      let interestPaid = 0;
      const installments = db
        .prepare(
          `
          SELECT * FROM loan_installments
          WHERE loanId = ? AND status IN ('pending', 'partial', 'overdue')
          ORDER BY dueDate ASC
        `
        )
        .all(loan.id) as any[];
      installments.forEach((installment) => {
        if (remaining <= 0) return;
        const dueLeft = Math.max(0, asNumber(installment.totalDue) - asNumber(installment.amountPaid));
        const applied = Math.min(remaining, dueLeft);
        if (applied <= 0) return;
        const newPaid = asNumber(installment.amountPaid) + applied;
        const newStatus = newPaid >= asNumber(installment.totalDue) ? 'paid' : 'partial';
        const interestShare =
          dueLeft > 0 ? Math.min(asNumber(installment.interestDue), applied * (asNumber(installment.interestDue) / dueLeft)) : 0;
        interestPaid += interestShare;
        db.prepare(
          `
          UPDATE loan_installments
          SET amountPaid = ?, status = ?, paidAt = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paidAt END, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        ).run(newPaid, newStatus, newStatus, installment.id);
        remaining -= applied;
      });

      const newAmountRepaid = asNumber(loan.amountRepaid) + amount;
      const status = newAmountRepaid >= asNumber(loan.totalRepayment) ? 'completed' : 'active';
      const nextInstallment = db
        .prepare(
          `
          SELECT dueDate FROM loan_installments
          WHERE loanId = ? AND status IN ('pending', 'partial', 'overdue')
          ORDER BY dueDate ASC LIMIT 1
        `
        )
        .get(loan.id) as any;
      db.prepare(
        `
        UPDATE smart_loans
        SET amountRepaid = ?, status = ?, completedAt = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completedAt END,
            nextPaymentDue = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(newAmountRepaid, status, status, nextInstallment?.dueDate || null, loan.id);
      if (interestPaid > 0) {
        recordLedgerEntry({
          transactionId,
          accountType: 'revenue',
          accountId: 'platform_revenue',
          direction: 'credit',
          amount: Number(interestPaid.toFixed(2)),
          description: 'Loan interest income collected',
          metadata: { loanId: loan.id },
        });
        adjustRevenueAccount('platform_revenue', Number(interestPaid.toFixed(2)));
      }
      if (status === 'completed') {
        const policy = getLoyaltyPolicy().config;
        awardLoyaltyPoints(
          loan.userId,
          asNumber(policy.onTimeLoanRepaymentMax, 200),
          'loan_repayment_bonus',
          'Loan completed repayment bonus',
          transactionId
        );
      }
      return {
        success: true,
        transactionId,
        amountPaid: amount,
        amountRepaid: newAmountRepaid,
        status,
        interestIncome: Number(interestPaid.toFixed(2)),
        message: 'Loan repayment completed',
      };
    })();
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/loans/reminders/run', requireRole(['admin', 'manager']), (_req: any, res): any => {
  try {
    res.json(runLoanPaymentReminderJob());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/loan-policy', requireRole(['admin']), (_req: any, res): any => {
  const policy = getLoanPolicy();
  res.json({ success: true, policy: { ...policy.config, version: policy.version, id: policy.id } });
});

app.put('/api/admin/loan-policy', requireRole(['admin']), (req: any, res): any => {
  const current = getLoanPolicy();
  const nextConfig = {
    ...current.config,
    ...req.body,
    minLoanAmount: Math.max(0, asNumber(req.body.minLoanAmount, current.config.minLoanAmount)),
    maxLoanAmount: Math.max(0, asNumber(req.body.maxLoanAmount, current.config.maxLoanAmount)),
    autoApprovalMaxAmount: Math.max(
      0,
      asNumber(req.body.autoApprovalMaxAmount, current.config.autoApprovalMaxAmount)
    ),
    baseApr: Math.max(0, asNumber(req.body.baseApr, current.config.baseApr)),
    premiumApr: Math.max(0, asNumber(req.body.premiumApr, current.config.premiumApr)),
    autoApproveScore: Math.min(100, Math.max(0, asNumber(req.body.autoApproveScore, current.config.autoApproveScore))),
    manualReviewScore: Math.min(100, Math.max(0, asNumber(req.body.manualReviewScore, current.config.manualReviewScore))),
    graceDays: Math.max(0, Math.floor(asNumber(req.body.graceDays, current.config.graceDays))),
    autoDisbursementEnabled: Boolean(req.body.autoDisbursementEnabled),
    overdueLoanLockEnabled: Boolean(req.body.overdueLoanLockEnabled),
    requireLicensingGate: Boolean(req.body.requireLicensingGate),
  };
  if (nextConfig.minLoanAmount > nextConfig.maxLoanAmount) {
    return res.status(400).json({ error: 'Minimum loan cannot exceed maximum loan' });
  }
  const version = asNumber(current.version) + 1;
  db.transaction(() => {
    db.prepare('UPDATE loan_policy_versions SET isActive = 0 WHERE isActive = 1').run();
    db.prepare(
      `
      INSERT INTO loan_policy_versions (id, config, version, isActive, createdBy, createdAt)
      VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), JSON.stringify(nextConfig), version, req.user.id);
    recordAdminAction(req.user.id, 'update_loan_policy', 'loan_policy', String(version), nextConfig);
  })();
  res.json({ success: true, policy: { ...nextConfig, version } });
});

app.get('/api/admin/loyalty-policy', requireRole(['admin']), (_req: any, res): any => {
  const policy = getLoyaltyPolicy();
  res.json({ success: true, policy: { ...policy.config, version: policy.version, id: policy.id } });
});

app.put('/api/admin/loyalty-policy', requireRole(['admin']), (req: any, res): any => {
  const current = getLoyaltyPolicy();
  const nextConfig = {
    ...current.config,
    ...req.body,
    pointValueRwf: Math.max(0.01, asNumber(req.body.pointValueRwf, current.config.pointValueRwf)),
    purchaseEarnPerRwf: Math.max(0, asNumber(req.body.purchaseEarnPerRwf, current.config.purchaseEarnPerRwf)),
    premiumMultiplier: Math.max(1, asNumber(req.body.premiumMultiplier, current.config.premiumMultiplier)),
    referredUserBonus: Math.max(0, asNumber(req.body.referredUserBonus, current.config.referredUserBonus)),
    referrerQualifiedBonus: Math.max(
      0,
      asNumber(req.body.referrerQualifiedBonus, current.config.referrerQualifiedBonus)
    ),
    minRedeemPoints: Math.max(0, asNumber(req.body.minRedeemPoints, current.config.minRedeemPoints)),
    allowFeePaymentWithPoints: Boolean(req.body.allowFeePaymentWithPoints),
    allowPrincipalRepaymentWithPoints: false,
    allowInterestRepaymentWithPoints: false,
    expiryDays: Math.max(0, Math.floor(asNumber(req.body.expiryDays, current.config.expiryDays))),
  };
  const version = asNumber(current.version) + 1;
  db.transaction(() => {
    db.prepare('UPDATE loyalty_policy_versions SET isActive = 0 WHERE isActive = 1').run();
    db.prepare(
      `
      INSERT INTO loyalty_policy_versions (id, config, version, isActive, createdBy, createdAt)
      VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), JSON.stringify(nextConfig), version, req.user.id);
    recordAdminAction(req.user.id, 'update_loyalty_policy', 'loyalty_policy', String(version), nextConfig);
  })();
  res.json({ success: true, policy: { ...nextConfig, version } });
});

app.post('/api/referrals', authenticate, (req: any, res): any => {
  const referrerCode = String(req.body.referrerCode || '').trim();
  const referredUserId = String(req.body.newUserId || req.body.referredUserId || req.user.id).trim();
  if (!referrerCode || !referredUserId) {
    return res.status(400).json({ error: 'Referral code and referred user are required' });
  }
  if (req.user.id !== referredUserId && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only register your own referral' });
  }
  const referrer = db
    .prepare('SELECT id, appNumber FROM users WHERE appNumber = ? OR id = ?')
    .get(referrerCode, referrerCode) as any;
  if (!referrer) return res.status(404).json({ error: 'Referral code not found' });
  if (referrer.id === referredUserId) {
    return res.status(400).json({ error: 'You cannot refer yourself' });
  }
  const referred = db.prepare('SELECT id FROM users WHERE id = ?').get(referredUserId) as any;
  if (!referred) return res.status(404).json({ error: 'Referred user not found' });
  const existing = db
    .prepare('SELECT * FROM referrals WHERE referredUserId = ?')
    .get(referredUserId) as any;
  if (existing) return res.json({ success: true, referral: existing, message: 'Referral already exists' });

  const referralId = uuidv4();
  db.prepare(
    `
    INSERT INTO referrals (id, referrerUserId, referredUserId, referrerCode, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(referralId, referrer.id, referredUserId, referrerCode);
  res.json({
    success: true,
    referral: {
      id: referralId,
      referrerUserId: referrer.id,
      referredUserId,
      status: 'pending',
    },
    message: 'Referral registered and will qualify after verification and first transaction',
  });
});

app.get('/api/users/:id/loyalty-ledger', authenticate, (req: any, res): any => {
  if (req.user.id !== req.params.id && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own loyalty ledger' });
  }
  const { limit, offset } = parseLimitOffset(req.query);
  const transactions = db
    .prepare(
      `
      SELECT * FROM loyalty_transactions
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(req.params.id, limit, offset);
  const liability = db
    .prepare(
      `
      SELECT COALESCE(SUM(pointsDelta), 0) as points, COALESCE(SUM(valueDelta), 0) as value
      FROM loyalty_liability_entries
      WHERE userId = ?
    `
    )
    .get(req.params.id);
  res.json({ success: true, transactions, liability });
});

// Fee Management Endpoints
app.get('/api/fees/config', authenticate, (_req: any, res) => {
  const fees = db
    .prepare(
      `
    SELECT id, feeType, fixedFee, percentageFee, minFee, maxFee, description, enabled
    FROM fees_config WHERE enabled = 1 ORDER BY feeType
  `
    )
    .all();
  res.json({ success: true, fees });
});

app.get('/api/fees/config/:feeType', authenticate, (req: any, res): any => {
  const feeType = String(req.params.feeType).trim();
  const fee = db
    .prepare(
      `
    SELECT * FROM fees_config WHERE feeType = ?
  `
    )
    .get(feeType);
  if (!fee) return res.status(404).json({ error: 'Fee configuration not found' });
  res.json({ success: true, fee });
});

app.post('/api/fees/calculate', authenticate, (req: any, res): any => {
  const feeType = String(req.body.feeType || '').trim();
  const amount = asNumber(req.body.amount);
  const userId = req.body.userId || req.user.id;

  if (!feeType) return res.status(400).json({ error: 'Fee type is required' });
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const fee = db
    .prepare(
      `
    SELECT * FROM fees_config WHERE feeType = ? AND enabled = 1
  `
    )
    .get(feeType) as any;

  if (!fee) {
    return res.json({
      success: true,
      calculation: {
        feeType,
        amount,
        calculatedFee: 0,
        netAmount: amount,
        breakdown: { fixedFee: 0, percentageFee: 0, totalFee: 0 },
      },
    });
  }

  const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(userId) as any;
  const userTier = user?.tier || 'free';

  // Calculate fee: fixed + percentage
  let fixedFee = fee.fixedFee || 0;
  let percentageFeeAmount = amount * (fee.percentageFee || 0) || 0;
  let totalFee = fixedFee + percentageFeeAmount;

  // Apply tier-based discount
  let discount = 0;
  if (userTier === 'premium') discount = totalFee * 0.1;
  else if (userTier === 'gold') discount = totalFee * 0.15;
  else if (userTier === 'platinum') discount = totalFee * 0.2;
  totalFee -= discount;

  // Apply min/max constraints
  const calculatedFee = Math.max(fee.minFee, Math.min(totalFee, fee.maxFee));

  res.json({
    success: true,
    calculation: {
      feeType,
      amount,
      calculatedFee,
      netAmount: amount - calculatedFee,
      breakdown: {
        fixedFee,
        percentageFee: percentageFeeAmount,
        discount,
        totalFee: calculatedFee,
      },
    },
  });
});

app.post('/api/fees/transaction', authenticate, (req: any, res): any => {
  const transactionId = String(req.body.transactionId || '').trim();
  const userId = req.body.userId || req.user.id;
  const feeType = String(req.body.feeType || '').trim();
  const feeAmount = asNumber(req.body.feeAmount);
  const appliedRate = req.body.appliedRate ? asNumber(req.body.appliedRate) : null;

  if (!transactionId) return res.status(400).json({ error: 'Transaction ID is required' });
  if (!feeType) return res.status(400).json({ error: 'Fee type is required' });
  if (feeAmount < 0) return res.status(400).json({ error: 'Fee amount cannot be negative' });

  const feeId = uuidv4();
  db.prepare(
    `
    INSERT INTO transaction_fees (id, transactionId, userId, feeType, feeAmount, appliedRate, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 'applied', CURRENT_TIMESTAMP)
  `
  ).run(feeId, transactionId, userId, feeType, feeAmount, appliedRate);

  const feeRecord = db.prepare('SELECT * FROM transaction_fees WHERE id = ?').get(feeId);
  res.json({ success: true, fee: feeRecord, message: 'Fee recorded' });
});

app.get('/api/fees/user/:userId', authenticate, (req: any, res): any => {
  const userId = String(req.params.userId).trim();
  if (req.user.id !== userId) return res.status(403).json({ error: 'Cannot view other user fees' });

  const { limit, offset } = parseLimitOffset(req.query);
  const fees = db
    .prepare(
      `
    SELECT * FROM transaction_fees WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?
  `
    )
    .all(userId, limit, offset);

  const total =
    (
      db
        .prepare('SELECT COUNT(*) as count FROM transaction_fees WHERE userId = ?')
        .get(userId) as any
    )?.count || 0;

  res.json({ success: true, fees, pagination: { limit, offset, total } });
});

app.get('/api/fees/stats', requireRole(['admin']), (_req: any, res) => {
  const totalFees =
    (db.prepare('SELECT COALESCE(SUM(feeAmount), 0) as total FROM transaction_fees').get() as any)
      ?.total || 0;
  const feesByType = db
    .prepare(
      `
    SELECT feeType, COUNT(*) as count, COALESCE(SUM(feeAmount), 0) as total
    FROM transaction_fees
    GROUP BY feeType
    ORDER BY total DESC
  `
    )
    .all();

  const topFeeUsers = db
    .prepare(
      `
    SELECT userId, COUNT(*) as feeCount, COALESCE(SUM(feeAmount), 0) as totalFees
    FROM transaction_fees
    GROUP BY userId
    ORDER BY totalFees DESC
    LIMIT 10
  `
    )
    .all();

  res.json({ success: true, totalFees, feesByType, topFeeUsers });
});

app.put('/api/fees/config/:feeType', requireRole(['admin']), (req: any, res): any => {
  const feeType = String(req.params.feeType).trim();
  const { fixedFee, percentageFee, minFee, maxFee, enabled, description } = req.body;

  const fee = db.prepare('SELECT * FROM fees_config WHERE feeType = ?').get(feeType);
  if (!fee) return res.status(404).json({ error: 'Fee configuration not found' });

  db.prepare(
    `
    UPDATE fees_config
    SET fixedFee = COALESCE(?, fixedFee),
        percentageFee = COALESCE(?, percentageFee),
        minFee = COALESCE(?, minFee),
        maxFee = COALESCE(?, maxFee),
        enabled = COALESCE(?, enabled),
        description = COALESCE(?, description),
        updatedAt = CURRENT_TIMESTAMP
    WHERE feeType = ?
  `
  ).run(fixedFee, percentageFee, minFee, maxFee, enabled, description, feeType);

  const updated = db.prepare('SELECT * FROM fees_config WHERE feeType = ?').get(feeType);
  res.json({ success: true, fee: updated, message: 'Fee configuration updated' });
});

app.get('/api/notifications', authenticate, (req: any, res): any => {
  const notifications = db
    .prepare(
      `
    SELECT *, read as isRead FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 100
  `
    )
    .all(req.user.id)
    .map((item: any) => ({ ...item, read: Boolean(item.read), timestamp: item.createdAt }));
  res.json({ success: true, notifications });
});

app.post('/api/notifications', authenticate, (req: any, res): any => {
  const id = createNotificationForUser({
    userId: req.body.userId || req.user.id,
    title: req.body.title || null,
    message: req.body.message,
    type: req.body.type || 'info',
    subType: req.body.subType || 'system',
    metadata: req.body.metadata || null,
  });
  res.json({ success: true, id });
});

app.put('/api/notifications/:id/read', authenticate, (req: any, res): any => {
  db.prepare(
    'UPDATE notifications SET read = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?'
  ).run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.post('/api/notifications/mark-all-read', authenticate, (req: any, res): any => {
  db.prepare(
    'UPDATE notifications SET read = 1, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?'
  ).run(req.user.id);
  res.json({ success: true });
});

app.delete('/api/notifications', authenticate, (req: any, res): any => {
  db.prepare('DELETE FROM notifications WHERE userId = ?').run(req.user.id);
  res.json({ success: true });
});

app.delete('/api/notifications/:id', authenticate, (req: any, res): any => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND userId = ?').run(
    req.params.id,
    req.user.id
  );
  res.json({ success: true });
});

app.get('/api/tickets', authenticate, (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const conditions: string[] = [];
  const params: any[] = [];
  if (req.query.status) {
    conditions.push('t.status = ?');
    params.push(req.query.status);
  }
  if (req.query.assignedTo) {
    conditions.push('t.assignedTo = ?');
    params.push(req.query.assignedTo);
  }
  if (!['admin', 'manager', 'agent'].includes(req.user.role)) {
    conditions.push('t.createdBy = ?');
    params.push(req.user.id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const tickets = db
    .prepare(
      `
    SELECT t.*, u.name as createdByName
    FROM tickets t
    JOIN users u ON u.id = t.createdBy
    ${where}
    ORDER BY t.createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset);
  res.json({ success: true, tickets: tickets.map(normalizeTicketRow) });
});

app.post('/api/tickets', authenticate, (req: any, res): any => {
  const title = String(req.body.title || req.body.subject || '').trim();
  const description = String(req.body.description || req.body.message || '').trim();
  if (!title || !description)
    return res.status(400).json({ error: 'Title and description are required' });
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO tickets (id, title, description, status, priority, createdBy, category, createdAt, updatedAt)
    VALUES (?, ?, ?, 'open', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    title,
    description,
    req.body.priority || 'medium',
    req.body.createdBy || req.user.id,
    req.body.category || null
  );
  res.json({ success: true, id });
});

app.put('/api/tickets/:id', authenticate, (req: any, res): any => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as any;
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.createdBy !== req.user.id && !['admin', 'manager', 'agent'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You cannot update this ticket' });
  }
  db.prepare(
    `
    UPDATE tickets
    SET status = COALESCE(?, status),
        assignedTo = COALESCE(?, assignedTo),
        resolution = COALESCE(?, resolution),
        updatedAt = CURRENT_TIMESTAMP,
        closedAt = CASE WHEN ? IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE closedAt END
    WHERE id = ?
  `
  ).run(
    req.body.status ?? null,
    req.body.assignedTo ?? null,
    req.body.resolution ?? null,
    req.body.status ?? null,
    req.params.id
  );
  res.json({ success: true });
});

app.get('/api/platform/config', authenticate, (_req, res) => {
  res.json({ success: true, config: getConfig() });
});

app.put('/api/platform/config', requireRole(['admin', 'manager']), (req: any, res): any => {
  const body = req.body.config || req.body;
  db.prepare(
    `
    UPDATE system_config
    SET maintenanceMode = COALESCE(?, maintenanceMode),
        registrationOpen = COALESCE(?, registrationOpen),
        globalFeesFree = COALESCE(?, globalFeesFree),
        globalFeesPremium = COALESCE(?, globalFeesPremium),
        broadcast = COALESCE(?, broadcast),
        updatedAt = CURRENT_TIMESTAMP,
        updatedBy = ?
    WHERE id = 'global'
  `
  ).run(
    body.maintenanceMode === undefined ? null : Number(Boolean(body.maintenanceMode)),
    body.registrationOpen === undefined ? null : Number(Boolean(body.registrationOpen)),
    body.globalFeesFree ?? body.globalFees?.free ?? null,
    body.globalFeesPremium ?? body.globalFees?.premium ?? null,
    body.broadcast ?? null,
    req.user.id
  );
  res.json({ success: true, config: getConfig() });
});

app.put('/api/admin/config', requireRole(['admin']), (req: any, res): any => {
  const body = req.body.config || req.body;
  db.prepare(
    `
    UPDATE system_config
    SET maintenanceMode = COALESCE(?, maintenanceMode),
        registrationOpen = COALESCE(?, registrationOpen),
        globalFeesFree = COALESCE(?, globalFeesFree),
        globalFeesPremium = COALESCE(?, globalFeesPremium),
        broadcast = COALESCE(?, broadcast),
        updatedAt = CURRENT_TIMESTAMP,
        updatedBy = ?
    WHERE id = 'global'
  `
  ).run(
    body.maintenanceMode === undefined ? null : Number(Boolean(body.maintenanceMode)),
    body.registrationOpen === undefined ? null : Number(Boolean(body.registrationOpen)),
    body.globalFeesFree ?? body.globalFees?.free ?? null,
    body.globalFeesPremium ?? body.globalFees?.premium ?? null,
    body.broadcast ?? null,
    req.user.id
  );
  recordAdminAction(req.user.id, 'update_config', 'system', 'global', body);
  res.json({ success: true, config: getConfig() });
});

app.get('/api/system-logs', requireRole(['admin', 'manager']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const logs = db
    .prepare('SELECT * FROM system_logs ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  res.json({ success: true, logs });
});

app.post('/api/system-logs', requireRole(['admin', 'manager']), (req: any, res): any => {
  logSystem(
    req.body.message || 'Manual log',
    req.body.level || 'info',
    req.body.source || 'client',
    req.body.userId
  );
  res.json({ success: true });
});

app.get('/api/admin/dashboard', requireRole(['admin']), (_req, res) => {
  const scalar = (sql: string, ...params: any[]) =>
    (db.prepare(sql).get(...params) as any)?.value || 0;
  const dashboard = {
    totalUsers: scalar('SELECT COUNT(*) as value FROM users'),
    totalAdmins: scalar("SELECT COUNT(*) as value FROM users WHERE role = 'admin'"),
    totalAgents: scalar("SELECT COUNT(*) as value FROM users WHERE role = 'agent'"),
    totalTraders: scalar("SELECT COUNT(*) as value FROM users WHERE role = 'trader'"),
    totalCustomers: scalar("SELECT COUNT(*) as value FROM users WHERE role = 'customer'"),
    totalWalletBalance: scalar('SELECT COALESCE(SUM(walletBalance), 0) as value FROM users'),
    totalTransactions: scalar('SELECT COUNT(*) as value FROM transactions'),
    totalTransactionValue: scalar(
      "SELECT COALESCE(SUM(amount), 0) as value FROM transactions WHERE status = 'completed'"
    ),
    totalProducts: scalar('SELECT COUNT(*) as value FROM products'),
    completedPurchases: scalar("SELECT COUNT(*) as value FROM purchases WHERE status = 'approved'"),
    openTickets: scalar("SELECT COUNT(*) as value FROM tickets WHERE status = 'open'"),
  };
  res.json({ success: true, dashboard });
});

app.get('/api/admin/users/:id', requireRole(['admin']), (req: any, res): any => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password, metadata, ...safe } = user;
  let metadataFields: Record<string, any> = {};
  if (metadata) {
    try {
      metadataFields = JSON.parse(metadata);
    } catch {
      metadataFields = {};
    }
  }

  const safeUser = {
    ...metadataFields,
    ...safe,
    uid: user.id,
    displayName: user.name,
    onboardingComplete: Boolean(user.onboardingComplete),
    biometricEnabled: Boolean(user.biometricEnabled ?? metadataFields.biometricEnabled),
    maintenanceMode: Boolean(user.maintenanceMode),
    emailVerified: Boolean(user.emailVerified),
    termsAcceptedAt: user.termsAcceptedAt || null,
    passwordSet: Boolean(password),
    passwordLastUpdated: user.updatedAt || null,
    rawMetadata: metadataFields,
  };

  res.json({ success: true, user: safeUser });
});

const sanitizedCollections = new Set([
  'users',
  'transactions',
  'products',
  'notifications',
  'purchases',
  'tickets',
  'system_logs',
  'platform_revenue',
  'incentive_programs',
  'deliveries',
  'payroll',
  'employees',
  'messages',
  'referrals',
  'loan_installments',
  'loan_policy_versions',
  'loan_scoring_snapshots',
  'loyalty_policy_versions',
  'loyalty_liability_entries',
  'platform_settings',
  'linked_accounts',
  'loans',
  'team_members',
  'tasks',
  'system_config',
  'transaction_fees',
  'revenue_accounts',
  'ledger_entries',
  'payment_intents',
  'agent_commissions',
  'agent_settlements',
  'loan_installments',
  'loan_policy_versions',
  'loan_scoring_snapshots',
  'loyalty_policy_versions',
  'loyalty_liability_entries',
  'referrals',
  'subscriptions',
  'trader_subscriptions',
]);

const tableBackedCollections = new Set([
  'users',
  'transactions',
  'products',
  'notifications',
  'purchases',
  'tickets',
  'system_logs',
  'deliveries',
  'system_config',
  'transaction_fees',
  'revenue_accounts',
  'ledger_entries',
  'payment_intents',
  'agent_commissions',
  'agent_settlements',
  'subscriptions',
  'trader_subscriptions',
]);

app.post('/api/admin/collection-stats', requireRole(['admin']), (req: any, res): any => {
  const names = Array.isArray(req.body.names) ? req.body.names : [];
  const stats = names
    .filter((name: any) => sanitizedCollections.has(name))
    .map((name: string) => {
      let count = 0;

      try {
        if (tableBackedCollections.has(name)) {
          // Use a safe mapping approach instead of string interpolation
          const tableCounts: Record<string, () => number> = {
            users: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM users`).get() as any)?.count || 0,
            transactions: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM transactions`).get() as any)?.count || 0,
            products: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM products`).get() as any)?.count || 0,
            notifications: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM notifications`).get() as any)?.count || 0,
            purchases: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM purchases`).get() as any)?.count || 0,
            tickets: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM tickets`).get() as any)?.count || 0,
            system_logs: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM system_logs`).get() as any)?.count || 0,
            deliveries: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM deliveries`).get() as any)?.count || 0,
            system_config: () =>
              (db.prepare(`SELECT COUNT(*) as count FROM system_config`).get() as any)?.count || 0,
          };

          count = tableCounts[name] ? tableCounts[name]() : 0;
        } else {
          // For collection_documents, use parameterized query
          count =
            (
              db
                .prepare('SELECT COUNT(*) as count FROM collection_documents WHERE collection = ?')
                .get(name) as any
            )?.count || 0;
        }
      } catch (error) {
        console.error(`Error getting count for ${name}:`, error);
        count = 0;
      }

      return { name, count };
    });
  res.json({ success: true, stats });
});

app.get('/api/admin/collection-docs', requireRole(['admin']), (req: any, res): any => {
  const name = String(req.query.name || '').trim();
  const { limit, offset } = parseLimitOffset(req.query);
  if (!sanitizedCollections.has(name)) {
    return res.status(400).json({ error: 'Unsupported collection name' });
  }

  const snakeCreatedAtTables = new Set(['subscriptions', 'trader_subscriptions']);
  const documents =
    name === 'system_config'
      ? [getConfig()]
      : tableBackedCollections.has(name)
        ? db
            .prepare(
              `SELECT * FROM ${name} ORDER BY ${snakeCreatedAtTables.has(name) ? 'created_at' : 'createdAt'} DESC LIMIT ? OFFSET ?`
            )
            .all(limit, offset)
        : (
            db
              .prepare(
                `
        SELECT * FROM collection_documents WHERE collection = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?
      `
              )
              .all(name, limit, offset) as any[]
          ).map((row) => ({
            ...parseJsonObject(row.data),
            id: row.id,
            createdAt: parseJsonObject(row.data).createdAt ?? row.createdAt,
            updatedAt: parseJsonObject(row.data).updatedAt ?? row.updatedAt,
          }));
  res.json({ success: true, documents });
});

app.get('/api/admin/database/documents', requireRole(['admin']), (req: any, res): any => {
  const name = String(req.query.name || '').trim();
  const { limit, offset } = parseLimitOffset(req.query);
  if (!sanitizedCollections.has(name)) {
    return res.status(400).json({ error: 'Unsupported collection name' });
  }

  const documents =
    name === 'system_config'
      ? [getConfig()]
      : tableBackedCollections.has(name)
        ? db
            .prepare(`SELECT * FROM ${name} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
            .all(limit, offset)
        : (
            db
              .prepare(
                `
        SELECT * FROM collection_documents WHERE collection = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?
      `
              )
              .all(name, limit, offset) as any[]
          ).map((row) => ({
            ...parseJsonObject(row.data),
            id: row.id,
            createdAt: parseJsonObject(row.data).createdAt ?? row.createdAt,
            updatedAt: parseJsonObject(row.data).updatedAt ?? row.updatedAt,
          }));
  res.json({ success: true, documents });
});

app.get('/api/admin/users', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const search = String(req.query.search || '').trim();
  const role = req.query.role ? String(req.query.role).trim() : null;
  const status = req.query.status ? String(req.query.status).trim() : null;
  const from = req.query.from ? String(req.query.from).trim() : null;
  const to = req.query.to ? String(req.query.to).trim() : null;

  const conditions: string[] = [];
  const params: any[] = [];
  if (role && role !== 'all') {
    conditions.push('role = ?');
    params.push(normalizeRole(role));
  }
  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    const term = `%${search}%`;
    conditions.push('(name LIKE ? OR email LIKE ? OR appNumber LIKE ? OR businessName LIKE ?)');
    params.push(term, term, term, term);
  }
  if (from) {
    conditions.push('DATE(createdAt) >= DATE(?)');
    params.push(from);
  }
  if (to) {
    conditions.push('DATE(createdAt) <= DATE(?)');
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const users = db
    .prepare(`SELECT * FROM users ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map(publicUser);
  const total = db.prepare(`SELECT COUNT(*) as total FROM users ${where}`).get(...params) as any;
  res.json({ success: true, users, total: total?.total || 0 });
});

app.put('/api/admin/users/:id', requireRole(['admin']), async (req: any, res): Promise<any> => {
  const userId = req.params.id;
  const userBefore = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!userBefore) return res.status(404).json({ error: 'User not found' });

  db.prepare(
    `
    UPDATE users
    SET role = COALESCE(?, role),
        verificationStatus = COALESCE(?, verificationStatus),
        tier = COALESCE(?, tier),
        walletBalance = COALESCE(?, walletBalance),
        businessName = COALESCE(?, businessName),
        phone = COALESCE(?, phone),
        location = COALESCE(?, location),
        status = COALESCE(?, status),
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(
    req.body.role ?? null,
    req.body.verificationStatus ?? null,
    req.body.tier ?? null,
    req.body.walletBalance ?? null,
    req.body.businessName ?? null,
    req.body.phone ?? null,
    req.body.location ?? null,
    req.body.status ?? null,
    userId
  );
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!updatedUser) return res.status(404).json({ error: 'User not found' });

  // Send suspension email if status changed to suspended
  if (req.body.status === 'suspended' && userBefore.status !== 'suspended') {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937; background: #f9fafb;">
          <div style="background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 64px; height: 64px; background: #fee2e2; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
              </div>
              <h1 style="color: #dc2626; margin: 0; font-size: 24px; font-weight: 700;">Account Suspended</h1>
            </div>

            <p style="margin: 16px 0; font-size: 16px; line-height: 1.6;">Hello ${escapeHtml(updatedUser.name || 'User')},</p>

            <p style="margin: 16px 0; font-size: 16px; line-height: 1.6;">Your ESOKO Nexus account has been suspended by an administrator.</p>

            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h3 style="color: #dc2626; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">What this means:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #374151;">
                <li>You cannot log in to your account</li>
                <li>All transactions are temporarily blocked</li>
                <li>Your wallet balance is frozen</li>
              </ul>
            </div>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h3 style="color: #0284c7; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">To restore your account:</h3>
              <ol style="margin: 0; padding-left: 20px; color: #374151;">
                <li>Contact our support team</li>
                <li>Provide your account details for verification</li>
                <li>Complete any required compliance checks</li>
                <li>Wait for administrator approval</li>
              </ol>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="mailto:support@esoko.com" style="background: #ea580c; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
                Contact Support
              </a>
            </div>

            <p style="margin: 16px 0; font-size: 14px; color: #6b7280; text-align: center;">
              If you believe this suspension was made in error, please contact us immediately.<br>
              <strong>Support Email:</strong> support@esoko.com<br>
              <strong>Phone:</strong> +250 788 123 456
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

            <p style="margin: 16px 0; font-size: 12px; color: #9ca3af; text-align: center;">
              This is an automated message from ESOKO Nexus.<br>
              Account ID: ${updatedUser.id}
            </p>
          </div>
        </div>
      `;

      await sendAppEmail({
        from: SMTP_FROM,
        to: updatedUser.email,
        subject: 'Your ESOKO Nexus Account Has Been Suspended',
        html,
        text: `Your ESOKO Nexus account has been suspended. Please contact support@esoko.com to restore access. Account ID: ${updatedUser.id}`,
      });

      logSystem(`Suspension email sent to ${updatedUser.email}`, 'info', 'email', req.user.id);
    } catch (emailError: any) {
      console.error('Failed to send suspension email:', emailError);
      logSystem(
        `Failed to send suspension email to ${updatedUser.email}: ${emailError.message}`,
        'error',
        'email',
        req.user.id
      );
      // Don't fail the request if email fails
    }
  }

  // Send reactivation email if status changed from suspended to active
  if (req.body.status === 'active' && userBefore.status === 'suspended') {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937; background: #f9fafb;">
          <div style="background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 64px; height: 64px; background: #d1fae5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h1 style="color: #16a34a; margin: 0; font-size: 24px; font-weight: 700;">Account Reactivated</h1>
            </div>

            <p style="margin: 16px 0; font-size: 16px; line-height: 1.6;">Hello ${escapeHtml(updatedUser.name || 'User')},</p>

            <p style="margin: 16px 0; font-size: 16px; line-height: 1.6;">Great news! Your ESOKO Nexus account has been reactivated and you can now access all features.</p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">Your account is now:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #374151;">
                <li>✅ Fully accessible for login</li>
                <li>✅ Transactions enabled</li>
                <li>✅ Wallet balance available</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://esoko-nexus.com'}/login" style="background: #ea580c; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
                Login to Your Account
              </a>
            </div>

            <p style="margin: 16px 0; font-size: 14px; color: #6b7280; text-align: center;">
              Welcome back to ESOKO Nexus! If you have any questions, our support team is here to help.<br>
              <strong>Support Email:</strong> support@esoko.com<br>
              <strong>Phone:</strong> +250 788 123 456
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

            <p style="margin: 16px 0; font-size: 12px; color: #9ca3af; text-align: center;">
              This is an automated message from ESOKO Nexus.<br>
              Account ID: ${updatedUser.id}
            </p>
          </div>
        </div>
      `;

      await sendAppEmail({
        from: SMTP_FROM,
        to: updatedUser.email,
        subject: 'Your ESOKO Nexus Account Has Been Reactivated',
        html,
        text: `Your ESOKO Nexus account has been reactivated. You can now login and access all features. Account ID: ${updatedUser.id}`,
      });

      logSystem(`Reactivation email sent to ${updatedUser.email}`, 'info', 'email', req.user.id);
    } catch (emailError: any) {
      console.error('Failed to send reactivation email:', emailError);
      logSystem(
        `Failed to send reactivation email to ${updatedUser.email}: ${emailError.message}`,
        'error',
        'email',
        req.user.id
      );
      // Don't fail the request if email fails
    }
  }

  recordAdminAction(req.user.id, 'update_user', 'user', userId, { updates: req.body });
  res.json({ success: true, user: publicUser(updatedUser) });
});

app.post('/api/admin/users/batch-status', requireRole(['admin']), (req: any, res): any => {
  const userIds = Array.isArray(req.body.userIds)
    ? req.body.userIds.map((id: any) => String(id).trim()).filter(Boolean)
    : [];
  const status = String(req.body.status || '').trim();

  if (!userIds.length) {
    return res.status(400).json({ error: 'At least one user ID is required' });
  }
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or suspended' });
  }

  const updateMany = db.transaction((ids: string[]) => {
    const stmt = db.prepare(`
      UPDATE users
      SET status = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND role != 'admin'
    `);
    let updated = 0;
    for (const id of ids) {
      updated += stmt.run(status, id).changes;
    }
    return updated;
  });

  const updated = updateMany(userIds);
  recordAdminAction(req.user.id, 'batch_update_user_status', 'user', undefined, {
    userIds,
    status,
    updated,
  });
  res.json({ success: true, updated });
});

app.post('/api/admin/users/:id/wallet-adjust', requireRole(['admin']), (req: any, res): any => {
  const userId = String(req.params.id).trim();
  const amount = Number(req.body.amount);
  const type = String(req.body.type || 'adjustment').trim();
  const description = String(req.body.description || 'Manual wallet adjustment').trim();

  if (!userId || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'User ID and valid amount are required' });
  }

  // Prevent zero adjustments
  if (amount === 0) {
    return res.status(400).json({ error: 'Adjustment amount cannot be zero' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
    | { walletBalance: number; id: string }
    | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if adjustment would result in negative balance
  const newBalance = user.walletBalance + amount;
  if (newBalance < 0) {
    return res.status(400).json({
      error: 'Adjustment would result in negative balance',
      currentBalance: user.walletBalance,
      proposedAdjustment: amount,
      resultingBalance: newBalance,
    });
  }

  const transactionId = uuidv4();
  db.transaction(() => {
    db.prepare(
      `
      UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `
    ).run(amount, userId);
    db.prepare(
      `
      INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, metadata, createdAt, updatedAt, timestamp)
      VALUES (?, ?, ?, 'admin_adjustment', 'completed', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      transactionId,
      userId,
      amount,
      description,
      `admin:${req.user.id}`,
      txCode('ADJ'),
      JSON.stringify({ adminId: req.user.id, adjustmentType: type })
    );
    db.prepare(
      `
      INSERT INTO wallet_transactions (id, userId, type, amount, currency, description, status, metadata, createdAt)
      VALUES (?, ?, ?, ?, 'RWF', ?, 'completed', ?, CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), userId, type, amount, description, JSON.stringify({ adminId: req.user.id }));
    recordWalletLiabilityChange({
      transactionId,
      userId,
      amountDelta: amount,
      description: `Admin wallet adjustment: ${description}`,
      metadata: { adminId: req.user.id, adjustmentType: type },
    });
  })();

  recordAdminAction(req.user.id, 'wallet_adjust', 'user', userId, {
    amount,
    type,
    description,
    transactionId,
  });
  res.json({
    success: true,
    transactionId,
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)),
  });
});

app.post('/api/admin/users/:id/change-role', requireRole(['admin']), (req: any, res): any => {
  const userId = String(req.params.id).trim();
  const role = normalizeRole(req.body.role);
  const tier = String(req.body.tier || '').trim() || undefined;
  if (!userId || !role)
    return res.status(400).json({ error: 'User ID and valid role are required' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(
    `
    UPDATE users SET role = ?, tier = COALESCE(?, tier), updatedAt = CURRENT_TIMESTAMP WHERE id = ?
  `
  ).run(role, tier || null, userId);
  recordAdminAction(req.user.id, 'change_role', 'user', userId, { role, tier });
  res.json({
    success: true,
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)),
  });
});

app.get('/api/admin/transactions/:id', requireRole(['admin']), (req: any, res): any => {
  const transaction = db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(req.params.id) as any;
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ success: true, transaction });
});

app.post('/api/admin/transactions/:id/correct', requireRole(['admin']), (req: any, res): any => {
  const id = req.params.id;
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

  const amount = req.body.amount !== undefined ? Number(req.body.amount) : transaction.amount;
  const status = String(req.body.status || transaction.status).trim();
  const description = String(req.body.description || transaction.description || '').trim();

  db.prepare(
    `
    UPDATE transactions
    SET amount = ?, status = ?, description = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(amount, status, description, id);

  recordAdminAction(req.user.id, 'correct_transaction', 'transaction', id, {
    amount,
    status,
    description,
  });
  res.json({
    success: true,
    transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(id),
  });
});

app.delete('/api/admin/users/:id', requireRole(['admin']), (req: any, res): any => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  db.transaction(() => {
    db.prepare('DELETE FROM password_reset_tokens WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM linked_accounts WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM loyalty_points WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM wallet_transactions WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM notifications WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM smart_loans WHERE userId = ?').run(req.params.id);
    db.prepare('UPDATE system_logs SET userId = NULL WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

app.post('/api/admin/verify-user', requireRole(['admin']), (req: any, res): any => {
  const userId = String(req.body.userId || '').trim();

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare(
    `
    UPDATE users
    SET verificationStatus = 'verified', verifiedAt = CURRENT_TIMESTAMP, verifiedBy = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(req.user.id, userId);

  recordAdminAction(req.user.id, 'verify_user', 'user', userId, { status: 'verified' });
  res.json({ success: true, message: 'User verified successfully' });
});

// Get user's fee information
app.get('/api/admin/users/:id/fees', requireRole(['admin']), (req: any, res): any => {
  const userId = req.params.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Get transaction fees for this user
  const fees = db
    .prepare(
      `
    SELECT 
      feeType,
      SUM(feeAmount) as totalFeeAmount,
      COUNT(*) as transactionCount,
      AVG(feeAmount) as avgFeeAmount,
      MAX(createdAt) as lastFeeDate
    FROM transaction_fees
    WHERE userId = ?
    GROUP BY feeType
    ORDER BY totalFeeAmount DESC
  `
    )
    .all(userId) as any[];

  // Get total fees summary
  const feesSummary = db
    .prepare(
      `
    SELECT 
      SUM(feeAmount) as totalFeesCollected,
      COUNT(*) as totalFeeTransactions,
      COUNT(DISTINCT feeType) as feeTypesCount
    FROM transaction_fees
    WHERE userId = ?
  `
    )
    .get(userId) as any;

  // Get user's transactions to see how much they've spent/earned
  const userTransactions = db
    .prepare(
      `
    SELECT 
      COUNT(*) as totalTransactions,
      SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as totalPayments,
      SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as totalDeposits,
      SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END) as totalTransfers
    FROM transactions
    WHERE userId = ?
  `
    )
    .get(userId) as any;

  res.json({
    success: true,
    fees: {
      byType: fees,
      summary: {
        totalFeesCollected: feesSummary?.totalFeesCollected || 0,
        totalFeeTransactions: feesSummary?.totalFeeTransactions || 0,
        averageFeePerTransaction:
          feesSummary?.totalFeeTransactions > 0
            ? (feesSummary.totalFeesCollected / feesSummary.totalFeeTransactions).toFixed(2)
            : 0,
        feeTypesCount: feesSummary?.feeTypesCount || 0,
      },
      userActivity: userTransactions,
    },
  });
});

// Get detailed account information for admin
app.get('/api/admin/users/:id/account-details', requireRole(['admin']), (req: any, res): any => {
  const userId = req.params.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const metadata = (() => {
    try {
      return user.metadata ? JSON.parse(user.metadata) : {};
    } catch {
      return {};
    }
  })();

  // Get verification details
  const verificationDetails = {
    status: user.verificationStatus,
    verifiedAt: user.verifiedAt || null,
    verifiedBy: user.verifiedBy || null,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: metadata.phoneVerified || false,
    kycStatus: metadata.kycStatus || 'not_started',
    kycVerifiedAt: metadata.kycVerifiedAt || null,
    idDocumentVerified: metadata.idDocumentVerified || false,
    businessVerified: metadata.businessVerified || false,
  };

  // Get recent transactions
  const recentTransactions = db
    .prepare(
      `
    SELECT id, type, amount, description, status, createdAt
    FROM transactions
    WHERE userId = ?
    ORDER BY createdAt DESC
    LIMIT 10
  `
    )
    .all(userId) as any[];

  // Get account activity summary
  const activitySummary = db
    .prepare(
      `
    SELECT 
      DATE(createdAt) as date,
      COUNT(*) as transactionCount,
      SUM(amount) as totalAmount
    FROM transactions
    WHERE userId = ?
    GROUP BY DATE(createdAt)
    ORDER BY DATE(createdAt) DESC
    LIMIT 30
  `
    )
    .all(userId) as any[];

  // Get linked accounts if any
  const linkedAccounts = db
    .prepare(
      `
    SELECT id, accountType, accountNumber, status, createdAt
    FROM linked_accounts
    WHERE userId = ?
  `
    )
    .all(userId) as any[];

  res.json({
    success: true,
    accountDetails: {
      user: publicUser(user),
      verification: verificationDetails,
      recentTransactions,
      activitySummary,
      linkedAccounts,
      metadata: {
        onboardingComplete: Boolean(user.onboardingComplete),
        biometricEnabled: Boolean(user.biometricEnabled),
        tier: user.tier || 'free',
        businessName: user.businessName || null,
        businessType: metadata.businessType || null,
        location: user.location || null,
        phone: user.phone || null,
        termsAcceptedAt: user.termsAcceptedAt || null,
        lastLogin: metadata.lastLogin || null,
      },
    },
  });
});

// Get platform-wide fee statistics
app.get('/api/admin/fees/stats', requireRole(['admin']), (req: any, res): any => {
  // Total fees collected
  const totalFees = db
    .prepare(
      `
    SELECT 
      SUM(feeAmount) as totalAmount,
      COUNT(*) as totalTransactions,
      COUNT(DISTINCT userId) as uniqueUsers
    FROM transaction_fees
  `
    )
    .get() as any;

  // Fees by type
  const feesByType = db
    .prepare(
      `
    SELECT 
      feeType,
      SUM(feeAmount) as totalAmount,
      COUNT(*) as transactionCount,
      AVG(feeAmount) as avgFee,
      MIN(feeAmount) as minFee,
      MAX(feeAmount) as maxFee
    FROM transaction_fees
    GROUP BY feeType
    ORDER BY totalAmount DESC
  `
    )
    .all() as any[];

  // Fees by user tier
  const feesByUserTier = db
    .prepare(
      `
    SELECT 
      u.tier,
      SUM(tf.feeAmount) as totalAmount,
      COUNT(tf.id) as transactionCount,
      COUNT(DISTINCT tf.userId) as userCount
    FROM transaction_fees tf
    JOIN users u ON tf.userId = u.id
    GROUP BY u.tier
    ORDER BY totalAmount DESC
  `
    )
    .all() as any[];

  // Daily fee trend
  const dailyFeesTrend = db
    .prepare(
      `
    SELECT 
      DATE(createdAt) as date,
      SUM(feeAmount) as totalAmount,
      COUNT(*) as transactionCount
    FROM transaction_fees
    GROUP BY DATE(createdAt)
    ORDER BY DATE(createdAt) DESC
    LIMIT 30
  `
    )
    .all() as any[];

  res.json({
    success: true,
    feeStats: {
      total: totalFees,
      byType: feesByType,
      byUserTier: feesByUserTier,
      dailyTrend: dailyFeesTrend,
      averageFeePerTransaction:
        totalFees?.totalTransactions > 0
          ? (totalFees.totalAmount / totalFees.totalTransactions).toFixed(2)
          : 0,
    },
  });
});

// Get traders with detailed information and fees
app.get('/api/admin/traders', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const statusFilter = req.query.status ? String(req.query.status) : null; // Allow filtering by status

  let query = "SELECT * FROM users WHERE role = 'trader'";
  const params: any[] = [];

  if (statusFilter) {
    query += ' AND status = ?';
    params.push(statusFilter);
  }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const traders = db.prepare(query).all(...params) as any[];

  const tradersWithDetails = traders.map((trader: any) => {
    const metadata = (() => {
      try {
        return trader.metadata ? JSON.parse(trader.metadata) : {};
      } catch {
        return {};
      }
    })();

    // Get trader's transaction stats
    const stats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalTransactions,
        SUM(amount) as totalVolume,
        COUNT(DISTINCT customerId) as totalCustomers
      FROM transactions
      WHERE traderId = ? OR userId = ?
    `
      )
      .get(trader.id, trader.id) as any;

    // Get trader's recent fees
    const recentFees = db
      .prepare(
        `
      SELECT 
        SUM(feeAmount) as totalFees,
        COUNT(*) as feeTransactions
      FROM transaction_fees
      WHERE userId = ?
    `
      )
      .get(trader.id) as any;

    return {
      ...publicUser(trader),
      status: trader.status || 'active', // Include account status
      verification: {
        status: trader.verificationStatus,
        verifiedAt: trader.verifiedAt || null,
        kycStatus: metadata.kycStatus || 'not_started',
        businessVerified: metadata.businessVerified || false,
      },
      stats: {
        totalTransactions: stats?.totalTransactions || 0,
        totalVolume: stats?.totalVolume || 0,
        totalCustomers: stats?.totalCustomers || 0,
      },
      fees: {
        totalCollected: recentFees?.totalFees || 0,
        transactionCount: recentFees?.feeTransactions || 0,
      },
    };
  });

  const countQuery = statusFilter
    ? "SELECT COUNT(*) as count FROM users WHERE role = 'trader' AND status = ?"
    : "SELECT COUNT(*) as count FROM users WHERE role = 'trader'";
  const countParams = statusFilter ? [statusFilter] : [];
  const totalCount = db.prepare(countQuery).get(...countParams) as any;

  res.json({
    success: true,
    traders: tradersWithDetails,
    total: totalCount?.count || 0,
    limit,
    offset,
  });
});

app.get('/api/admin/transactions', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const transactions = db
    .prepare('SELECT * FROM transactions ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  res.json({ success: true, transactions });
});

app.post('/api/admin/system/maintenance', requireRole(['admin']), (req: any, res): any => {
  db.prepare(
    `
    UPDATE system_config SET maintenanceMode = ?, broadcast = ?, updatedAt = CURRENT_TIMESTAMP, updatedBy = ? WHERE id = 'global'
  `
  ).run(Number(Boolean(req.body.enabled)), req.body.broadcast || null, req.user.id);
  res.json({ success: true, config: getConfig() });
});

app.get('/api/admin/audit-logs', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const logs = db
    .prepare(
      `
    SELECT a.*, u.name AS adminName
    FROM admin_actions a
    LEFT JOIN users u ON u.id = a.adminId
    ORDER BY a.createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(limit, offset);
  res.json({ success: true, logs });
});

app.get('/api/admin/system-logs', requireRole(['admin', 'manager']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const level = String(req.query.level || '').trim();
  const source = String(req.query.source || '').trim();
  const conditions: string[] = [];
  const params: any[] = [];

  if (level && level !== 'all') {
    conditions.push('level = ?');
    params.push(level);
  }

  if (source && source !== 'all') {
    conditions.push('source = ?');
    params.push(source);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const logs = db
    .prepare(`SELECT * FROM system_logs ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  res.json({ success: true, logs });
});

app.get('/api/admin/debug-auth', authenticate, (req: any, res: any): any => {
  res.json({ success: true, user: publicUser(req.user) });
});

app.post('/api/admin/upgrade-user', requireRole(['admin']), (req: any, res: any): any => {
  const userId = String(req.body.userId || '').trim();
  const tier = String(req.body.tier || '').trim() || 'free';
  if (!userId) return res.status(400).json({ error: 'User ID is required' });
  db.prepare('UPDATE users SET tier = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
    tier,
    userId
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  recordAdminAction(req.user.id, 'upgrade_user', 'user', userId, { tier });
  res.json({ success: true, user: publicUser(user) });
});

app.post('/api/admin/send-email', requireRole(['admin']), async (req: any, res): Promise<any> => {
  const to = String(req.body.to || '').trim();
  const subject = String(req.body.subject || '').trim();
  const html = String(req.body.html || '').trim();
  const text = req.body.text ? String(req.body.text).trim() : undefined;
  const broadcast = Boolean(req.body.broadcast);

  if (!subject || !html) {
    return res.status(400).json({ error: 'Subject and HTML content are required' });
  }

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const recipients = broadcast
    ? db
        .prepare('SELECT email FROM users WHERE email IS NOT NULL')
        .all()
        .map((user: any) => user.email)
        .filter(Boolean)
        .filter((email: string) => emailRegex.test(email))
    : [to];

  if (!broadcast && !to) {
    return res.status(400).json({ error: 'Recipient email is required for direct sends' });
  }

  if (!broadcast && !emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid email format for recipient' });
  }

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No valid recipients found' });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: 'SMTP configuration missing' });
  }

  try {
    const mailOptions = {
      from: SMTP_FROM,
      to: broadcast ? recipients.join(',') : to,
      subject,
      html,
      ...(text ? { text } : {}),
    };

    const info = await sendAppEmail(mailOptions);
    db.prepare(
      `
      INSERT INTO email_logs (id, adminId, recipient, subject, bodyText, bodyHtml, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP)
    `
    ).run(uuidv4(), req.user.id, broadcast ? 'all' : to, subject, text || null, html);
    recordAdminAction(
      req.user.id,
      broadcast ? 'broadcast_email' : 'send_email',
      'email',
      undefined,
      { to: broadcast ? 'all' : to, subject }
    );
    res.json({ success: true, message: 'Email sent successfully', info });
  } catch (error: any) {
    console.error('Failed to send admin email:', error);
    db.prepare(
      `
      INSERT INTO email_logs (id, adminId, recipient, subject, bodyText, bodyHtml, status, errorMessage, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)
    `
    ).run(
      uuidv4(),
      req.user.id,
      broadcast ? 'all' : to,
      subject,
      text || null,
      html,
      String(error.message || error)
    );
    recordAdminAction(req.user.id, 'send_email_failed', 'email', undefined, {
      to: broadcast ? 'all' : to,
      subject,
      error: String(error.message || error),
    });
    res.status(500).json({ error: 'Failed to send email', details: error.message || error });
  }
});

app.post('/api/emails', authenticate, async (req: any, res): Promise<any> => {
  const to = String(req.body.to || '').trim();
  const subject = String(req.body.message?.subject || '').trim();
  const html = String(req.body.message?.html || '').trim();
  const text = req.body.message?.text ? String(req.body.message.text).trim() : undefined;
  const rawAttachments = Array.isArray(req.body.message?.attachments)
    ? req.body.message.attachments
    : [];

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Email to, subject, and html content are required' });
  }

  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid email format for recipient' });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    console.error(
      'SMTP is not configured. Please set SMTP_USER and SMTP_PASS in .env or .env.example.'
    );
    return res.status(500).json({ error: 'SMTP configuration missing' });
  }

  try {
    const attachments = rawAttachments.slice(0, 3).map((attachment: any) => {
      const filename = path.basename(String(attachment.filename || 'attachment.pdf'));
      const contentBase64 = String(attachment.contentBase64 || attachment.content || '').trim();
      const contentType = String(attachment.contentType || 'application/octet-stream');
      const content = Buffer.from(contentBase64, 'base64');
      if (!content.length || content.length > 5 * 1024 * 1024) {
        throw new Error('Each email attachment must be between 1 byte and 5MB.');
      }
      return {
        filename,
        content,
        contentType,
      };
    });
    const mailOptions = {
      from: SMTP_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(attachments.length ? { attachments } : {}),
    };

    const info = await sendAppEmail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${subject}`);
    console.log(`   Message ID: ${info.messageId}`);
    logSystem(`Email sent to ${to}: ${subject}`, 'info', 'email', req.user.id);
    res.json({ success: true, message: 'Email sent successfully', info });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    logSystem(
      `Email failed to ${to}: ${subject} - ${error.message || error}`,
      'error',
      'email',
      req.user.id
    );
    res.status(500).json({ error: 'Failed to send email', details: error.message || error });
  }
});

app.post('/api/welcome-email', authenticate, async (req: any, res): Promise<any> => {
  const email = String(req.body.email || req.user.email || '')
    .trim()
    .toLowerCase();
  const name = String(req.body.name || req.user.name || 'there').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    logSystem(`Welcome email skipped for ${email}: SMTP not configured`, 'warn', 'email', req.user.id);
    return res.status(503).json({ error: 'SMTP configuration missing' });
  }

  try {
    await sendAppEmail({
      from: SMTP_FROM,
      to: email,
      subject: 'Welcome to ESOKO Nexus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937;">
          <h1 style="color: #ea580c; margin-bottom: 8px;">Welcome to ESOKO Nexus, ${escapeHtml(name)}!</h1>
          <p>Your account has been created. Please verify your email from the verification message we sent so you can use your account confidently.</p>
          <p>Document upload is optional and can be completed later if you want a verified badge.</p>
          <p style="font-size: 13px; color: #6b7280;">Thank you for joining ESOKO Nexus.</p>
        </div>
      `,
      text: `Welcome to ESOKO Nexus, ${name}! Please verify your email. Document upload is optional and can be completed later if you want a verified badge.`,
    });

    logSystem(`Welcome email sent to ${email}`, 'info', 'email', req.user.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to send welcome email:', error);
    logSystem(`Welcome email failed to ${email}: ${error.message || error}`, 'error', 'email', req.user.id);
    res.status(500).json({ error: 'Failed to send welcome email', details: error.message || error });
  }
});

app.get('/api/admin/email-logs', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const logs = db
    .prepare(
      'SELECT el.*, u.name AS adminName FROM email_logs el LEFT JOIN users u ON u.id = el.adminId ORDER BY el.createdAt DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset);
  res.json({ success: true, logs });
});

app.get('/api/admin/export-db', requireRole(['admin']), (req: any, res): any => {
  const filePath = path.join(process.cwd(), 'data', 'esoko.db');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Database file not found' });
  }
  res.download(filePath, 'esoko-backup.db');
});

app.post('/api/admin/restore-db', requireRole(['admin']), (req: any, res): any => {
  const backupBase64 = String(req.body.backupBase64 || '').trim();
  if (!backupBase64) {
    return res.status(400).json({ error: 'Backup file content is required' });
  }

  const data = Buffer.from(backupBase64, 'base64');
  const targetPath = path.join(process.cwd(), 'data', 'esoko.db');
  fs.writeFileSync(targetPath, data);
  recordAdminAction(req.user.id, 'restore_database', 'system', 'esoko.db', { size: data.length });
  res.json({ success: true, message: 'Database restored from backup. Restart server if needed.' });
});

app.post('/api/admin/restore-upload', requireRole(['admin']), (req: any, res): any => {
  const fileName = path.basename(String(req.body.fileName || '').trim());
  const contentBase64 = String(req.body.contentBase64 || '').trim();

  if (!fileName || !contentBase64) {
    return res.status(400).json({ error: 'fileName and contentBase64 are required' });
  }

  const data = Buffer.from(contentBase64, 'base64');
  if (data.length > 75 * 1024 * 1024) {
    return res.status(413).json({ error: 'Upload restore file is too large' });
  }

  fs.mkdirSync(uploadDir, { recursive: true });
  const targetPath = path.join(uploadDir, fileName);
  fs.writeFileSync(targetPath, data);
  recordAdminAction(req.user.id, 'restore_upload', 'file', fileName, { size: data.length });
  res.json({ success: true, fileName, url: `/uploads/${fileName}`, size: data.length });
});

app.get('/api/admin/tickets', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const tickets = db
    .prepare(
      `
    SELECT t.*, u.name AS createdByName, um.name AS assignedToName
    FROM tickets t
    LEFT JOIN users u ON u.id = t.createdBy
    LEFT JOIN users um ON um.id = t.assignedTo
    ORDER BY t.createdAt DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(limit, offset);
  res.json({ success: true, tickets: tickets.map(normalizeTicketRow) });
});

app.get('/api/admin/tickets/:id', requireRole(['admin']), (req: any, res): any => {
  const ticket = db
    .prepare(
      `
    SELECT t.*, u.name AS createdByName, um.name AS assignedToName
    FROM tickets t
    LEFT JOIN users u ON u.id = t.createdBy
    LEFT JOIN users um ON um.id = t.assignedTo
    WHERE t.id = ?
  `
    )
    .get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const messages = db
    .prepare(
      'SELECT tm.*, u.name AS senderName FROM ticket_messages tm LEFT JOIN users u ON u.id = tm.senderId WHERE ticketId = ? ORDER BY createdAt ASC'
    )
    .all(req.params.id);
  res.json({ success: true, ticket: normalizeTicketRow(ticket), messages });
});

app.post('/api/admin/tickets/:id/reply', requireRole(['admin']), (req: any, res): any => {
  const ticketId = req.params.id;
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  db.prepare(
    'INSERT INTO ticket_messages (id, ticketId, senderId, message, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(uuidv4(), ticketId, req.user.id, message);
  db.prepare(
    `
    UPDATE tickets SET status = COALESCE(?, status), updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(req.body.status || ticket.status, ticketId);
  recordAdminAction(req.user.id, 'reply_ticket', 'ticket', ticketId, {
    message: message.slice(0, 200),
    status: req.body.status || ticket.status,
  });
  res.json({ success: true });
});

app.get('/api/admin/server-health', requireRole(['admin']), (_req: any, res) => {
  res.json({
    success: true,
    status: 'operational',
    uptimeSeconds: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/admin/system/maintenance', requireRole(['admin']), (req: any, res): any => {
  db.prepare(
    `
    UPDATE system_config SET maintenanceMode = ?, broadcast = ?, updatedAt = CURRENT_TIMESTAMP, updatedBy = ? WHERE id = 'global'
  `
  ).run(Number(Boolean(req.body.enabled)), req.body.broadcast || null, req.user.id);
  recordAdminAction(req.user.id, 'toggle_maintenance', 'system', 'global', {
    enabled: Boolean(req.body.enabled),
    broadcast: req.body.broadcast || null,
  });
  res.json({ success: true, config: getConfig() });
});

app.get('/api/admin/platform-wallet', requireRole(['admin']), (req: any, res): any => {
  const { limit, offset } = parseLimitOffset(req.query);
  const history = db
    .prepare(
      `
      SELECT pwt.*, u.name as userName, u.email as userEmail
      FROM platform_wallet_transactions pwt
      LEFT JOIN users u ON u.id = pwt.userId
      ORDER BY pwt.createdAt DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset)
    .map((row: any) => ({
      ...row,
      metadata: parseJsonField(row.metadata, {}),
    }));
  res.json({
    success: true,
    wallet: getPlatformWalletSummary(),
    history,
  });
});

app.post('/api/admin/platform-wallet/send', requireRole(['admin']), (req: any, res): any => {
  const recipientId = String(req.body.recipientId || '').trim();
  const amount = asNumber(req.body.amount);
  const description = String(req.body.description || 'Platform wallet payout').trim();
  if (!recipientId || amount <= 0) {
    return res.status(400).json({ error: 'Recipient and positive amount are required' });
  }
  const recipient = db.prepare('SELECT * FROM users WHERE id = ?').get(recipientId) as any;
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  const platformWallet = getPlatformWalletSummary();
  if (asNumber(platformWallet.balance) < amount) {
    return res.status(400).json({ error: 'Insufficient platform wallet balance' });
  }

  const transactionId = uuidv4();
  db.transaction(() => {
    db.prepare(
      'UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(amount, recipientId);
    db.prepare(
      `
      INSERT INTO transactions (id, userId, recipientId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, metadata, createdAt, updatedAt, timestamp)
      VALUES (?, ?, ?, ?, 'platform_wallet_send', 'completed', ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      transactionId,
      req.user.id,
      recipientId,
      amount,
      description,
      recipientId,
      txCode('PWS'),
      amount,
      JSON.stringify({ recipientId, createdBy: req.user.id })
    );
    db.prepare(
      `
      INSERT INTO wallet_transactions (id, userId, type, amount, description, status, metadata, createdAt)
      VALUES (?, ?, 'platform_wallet_credit', ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
    `
    ).run(
      uuidv4(),
      recipientId,
      amount,
      description,
      JSON.stringify({ transactionId, createdBy: req.user.id })
    );
    recordWalletLiabilityChange({
      transactionId,
      userId: recipientId,
      amountDelta: amount,
      description,
      metadata: { source: 'platform_wallet', createdBy: req.user.id },
    });
    recordPlatformWalletTransaction({
      type: 'admin_platform_send',
      direction: 'out',
      amount,
      userId: recipientId,
      relatedTransactionId: transactionId,
      description,
      metadata: { recipientName: recipient.name, recipientEmail: recipient.email },
      createdBy: req.user.id,
    });
    recordLedgerEntry({
      transactionId,
      accountType: 'revenue',
      accountId: 'platform_revenue',
      direction: 'debit',
      amount,
      description: 'Platform wallet payout',
      metadata: { recipientId, createdBy: req.user.id },
    });
    adjustRevenueAccount('platform_revenue', -amount);
    recordAdminAction(req.user.id, 'platform_wallet_send', 'platform_wallet', transactionId, {
      recipientId,
      amount,
      description,
    });
  })();

  res.json({
    success: true,
    transactionId,
    wallet: getPlatformWalletSummary(),
    message: 'Platform wallet money sent',
  });
});

app.get('/api/system_config', authenticate, (_req: any, res) => {
  const config = getConfig();
  res.json({ success: true, system_config: [config], data: [config] });
});

app.get('/api/system_config/:id', authenticate, (req: any, res): any => {
  if (!['global', 'config'].includes(req.params.id)) {
    return res.status(404).json({ error: 'System config not found' });
  }
  res.json({ success: true, config: getConfig(), document: getConfig() });
});

app.put('/api/system_config/:id', requireRole(['admin', 'manager']), (req: any, res): any => {
  if (!['global', 'config'].includes(req.params.id)) {
    return res.status(404).json({ error: 'System config not found' });
  }

  const body = req.body.config || req.body.data || req.body;
  db.prepare(
    `
    UPDATE system_config
    SET maintenanceMode = COALESCE(?, maintenanceMode),
        registrationOpen = COALESCE(?, registrationOpen),
        globalFeesFree = COALESCE(?, globalFeesFree),
        globalFeesPremium = COALESCE(?, globalFeesPremium),
        broadcast = COALESCE(?, broadcast),
        updatedAt = CURRENT_TIMESTAMP,
        updatedBy = ?
    WHERE id = 'global'
  `
  ).run(
    body.maintenanceMode === undefined ? null : Number(Boolean(body.maintenanceMode)),
    body.registrationOpen === undefined ? null : Number(Boolean(body.registrationOpen)),
    body.globalFeesFree ?? body.globalFees?.free ?? null,
    body.globalFeesPremium ?? body.globalFees?.premium ?? null,
    body.broadcast === undefined ? null : JSON.stringify(body.broadcast),
    req.user.id
  );
  res.json({ success: true, config: getConfig(), document: getConfig() });
});

// ===== TRADER OVERSIGHT & SUBSCRIPTION MANAGEMENT =====

// Subscription Management
app.get('/api/admin/subscriptions', requireRole(['admin']), (req: any, res): any => {
  const subscriptions = db
    .prepare('SELECT * FROM subscriptions WHERE is_active = 1 ORDER BY price ASC')
    .all();
  res.json({ success: true, subscriptions });
});

app.post('/api/admin/subscriptions', requireRole(['admin']), (req: any, res): any => {
  const { name, description, price, features, limits } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO subscriptions (id, name, description, price, features, limits, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(id, name, description, price, JSON.stringify(features || []), JSON.stringify(limits || {}));

  recordAdminAction(req.user.id, 'create_subscription', 'subscription', id, { name, price });
  res.json({ success: true, subscription: { id, name, description, price, features, limits } });
});

app.put('/api/admin/subscriptions/:id', requireRole(['admin']), (req: any, res): any => {
  const { name, description, price, features, limits, is_active } = req.body;
  const subscription = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

  db.prepare(
    `
    UPDATE subscriptions SET name = ?, description = ?, price = ?, features = ?, limits = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(
    name,
    description,
    price,
    JSON.stringify(features || []),
    JSON.stringify(limits || {}),
    is_active ? 1 : 0,
    req.params.id
  );

  recordAdminAction(req.user.id, 'update_subscription', 'subscription', req.params.id, {
    name,
    price,
    is_active,
  });
  res.json({ success: true });
});

app.delete('/api/admin/subscriptions/:id', requireRole(['admin']), (req: any, res): any => {
  const subscription = db
    .prepare('SELECT * FROM subscriptions WHERE id = ?')
    .get(req.params.id) as any;
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

  db.prepare(
    'UPDATE subscriptions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(req.params.id);
  recordAdminAction(req.user.id, 'deactivate_subscription', 'subscription', req.params.id, {
    name: subscription.name,
  });
  res.json({ success: true });
});

app.get('/api/subscriptions/available', authenticate, (_req: any, res): any => {
  const subscriptions = db
    .prepare("SELECT * FROM subscriptions WHERE is_active = 1 AND id != 'trial_full_access' ORDER BY price ASC")
    .all();
  const plans = subscriptions.map((sub: any) => ({
    ...sub,
    features: JSON.parse(sub.features || '[]'),
    limits: JSON.parse(sub.limits || '{}'),
  }));
  res.json({ success: true, plans });
});

app.get('/api/traders/:id/current-subscription', authenticate, (req: any, res): any => {
  if (req.user.id !== req.params.id && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const trader = db
    .prepare('SELECT id FROM users WHERE id = ? AND role = ?')
    .get(req.params.id, 'trader');
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  const traderSubscription = db
    .prepare(
      `
    SELECT ts.id AS traderSubscriptionId, ts.status, ts.activated_at, ts.expires_at, ts.auto_renew, ts.payment_method,
           ts.trial_started_at, ts.trial_ends_at, ts.trial_converted_at, ts.grace_ends_at,
           s.id AS id, s.name, s.description, s.price, s.features, s.limits
    FROM trader_subscriptions ts
    JOIN subscriptions s ON ts.subscription_id = s.id
    WHERE ts.trader_id = ? AND ts.status IN ('trial', 'active', 'past_due')
    ORDER BY ts.activated_at DESC LIMIT 1
  `
    )
    .get(req.params.id) as any;

  const subscription = traderSubscription || ensureTraderTrial(req.params.id);

  res.json({ success: true, subscription: normalizeSubscriptionRow(subscription) });
});

app.post('/api/traders/subscription-upgrade', authenticate, (req: any, res): any => {
  const { traderId, subscriptionId } = req.body;
  if (!traderId || !subscriptionId) {
    return res.status(400).json({ error: 'traderId and subscriptionId are required' });
  }
  const idemKey = idempotency.requireKey(req, res);
  if (idemKey === null) return;
  const existingResponse = idempotency.getResponse(traderId, idemKey, req.originalUrl);
  if (existingResponse.found) {
    return res.status(existingResponse.statusCode).json(existingResponse.response);
  }

  if (req.user.id !== traderId && !['admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You are not authorized to upgrade this trader' });
  }

  const trader = db
    .prepare('SELECT * FROM users WHERE id = ? AND role = ?')
    .get(traderId, 'trader') as any;
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  const subscription = db
    .prepare('SELECT * FROM subscriptions WHERE id = ? AND is_active = 1')
    .get(subscriptionId) as any;
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
  if (subscription.id === 'trial_full_access') {
    return res.status(400).json({ error: 'Trial is assigned automatically and cannot be purchased' });
  }

  const amount = Number(subscription.price || 0);
  const feeCalc = calculateFeeAmount('subscription', amount, trader.tier || 'free');

  if (trader.walletBalance < amount) {
    return res.status(400).json({ error: 'Insufficient wallet balance for upgrade' });
  }

  const result = db.transaction(() => {
    const transactionId = uuidv4();
    const walletTransactionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    db.prepare(
      'UPDATE users SET walletBalance = walletBalance - ?, tier = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(amount, 'premium', traderId);

    db.prepare(
      `
      INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
      VALUES (?, ?, 'subscription_payment', ?, ?, 'completed', CURRENT_TIMESTAMP)
    `
    ).run(walletTransactionId, traderId, amount, `Subscription upgrade to ${subscription.name}`);

    db.prepare(
      `
      INSERT INTO transactions (id, userId, amount, type, status, description, reference, transactionCode, feeAmount, netAmount, createdAt, updatedAt, timestamp)
      VALUES (?, ?, ?, 'subscription', 'completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      transactionId,
      traderId,
      amount,
      `Subscription upgrade to ${subscription.name}`,
      walletTransactionId,
      txCode('SUB'),
      feeCalc.totalFee,
      Math.max(0, amount - feeCalc.totalFee)
    );

    recordTransactionFee(
      transactionId,
      traderId,
      'subscription',
      feeCalc.totalFee,
      feeCalc.percentageFee
    );
    recordWalletLiabilityChange({
      transactionId,
      userId: traderId,
      amountDelta: -amount,
      description: `Subscription payment for ${subscription.name}`,
      metadata: { subscriptionId, feeAmount: feeCalc.totalFee },
    });
    db.prepare(
      `
      INSERT INTO ledger_entries (id, transactionId, accountType, accountId, direction, amount, currency, description, metadata, createdAt)
      VALUES (?, ?, 'revenue', 'platform_revenue', 'credit', ?, 'RWF', ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(
      uuidv4(),
      transactionId,
      amount,
      `Subscription payment for ${subscription.name}`,
      JSON.stringify({ traderId, subscriptionId, revenueStream: 'trader_subscription' })
    );
    db.prepare(
      `
      UPDATE revenue_accounts
      SET balance = balance + ?, updatedAt = CURRENT_TIMESTAMP
      WHERE code = 'platform_revenue'
    `
    ).run(amount);

    db.prepare(
      "UPDATE trader_subscriptions SET status = 'expired', trial_converted_at = CASE WHEN status = 'trial' THEN CURRENT_TIMESTAMP ELSE trial_converted_at END, updated_at = CURRENT_TIMESTAMP WHERE trader_id = ? AND status IN ('trial', 'active', 'past_due')"
    ).run(traderId);

    const traderSubscriptionId = uuidv4();
    db.prepare(
      `
      INSERT INTO trader_subscriptions (id, trader_id, subscription_id, status, activated_at, expires_at, auto_renew, payment_method, created_at, updated_at)
      VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, 0, 'wallet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(traderSubscriptionId, traderId, subscriptionId, expiresAt.toISOString());

    recordPlatformWalletTransaction({
      type: 'subscription_collection',
      direction: 'in',
      amount,
      userId: traderId,
      relatedTransactionId: transactionId,
      description: `Subscription payment collected for ${subscription.name}`,
      metadata: {
        subscriptionId,
        traderSubscriptionId,
        feeAmount: feeCalc.totalFee,
        source: 'wallet',
      },
    });

    return {
      transaction: {
        id: transactionId,
        amount,
        fee: feeCalc.totalFee,
        netAmount: Math.max(0, amount - feeCalc.totalFee),
      },
      subscription: {
        id: subscription.id,
        name: subscription.name,
        description: subscription.description,
        price: subscription.price,
        features: JSON.parse(subscription.features || '[]'),
        limits: JSON.parse(subscription.limits || '{}'),
        expiresAt: expiresAt.toISOString(),
        status: 'active',
      },
      message: `Subscription upgraded to ${subscription.name}`,
    };
  })();

  idempotency.saveResponse(traderId, idemKey, req.originalUrl, result);
  res.json({ success: true, ...result });
});

// Trader Subscription Management
app.get('/api/admin/traders/:id/subscription', requireRole(['admin']), (req: any, res): any => {
  const traderSubscription = db
    .prepare(
      `
    SELECT ts.*, s.name, s.description, s.price, s.features, s.limits
    FROM trader_subscriptions ts
    JOIN subscriptions s ON ts.subscription_id = s.id
    WHERE ts.trader_id = ? AND ts.status = 'active'
    ORDER BY ts.activated_at DESC LIMIT 1
  `
    )
    .get(req.params.id);

  if (!traderSubscription) {
    return res.json({ success: true, subscription: null });
  }

  res.json({ success: true, subscription: traderSubscription });
});

app.put('/api/admin/traders/:id/subscription', requireRole(['admin']), (req: any, res): any => {
  const { subscriptionId, autoRenew } = req.body;
  const trader = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'trader'")
    .get(req.params.id);
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  const subscription = db
    .prepare('SELECT * FROM subscriptions WHERE id = ? AND is_active = 1')
    .get(subscriptionId) as any;
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

  // Deactivate current subscription
  db.prepare(
    "UPDATE trader_subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE trader_id = ? AND status = 'active'"
  ).run(req.params.id);

  // Create new subscription
  const id = uuidv4();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

  db.prepare(
    `
    INSERT INTO trader_subscriptions (id, trader_id, subscription_id, status, activated_at, expires_at, auto_renew, created_at, updated_at)
    VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(id, req.params.id, subscriptionId, expiresAt.toISOString(), autoRenew ? 1 : 0);

  recordAdminAction(req.user.id, 'assign_subscription', 'trader_subscription', id, {
    traderId: req.params.id,
    subscriptionName: subscription.name,
  });
  res.json({ success: true });
});

app.post('/api/admin/traders/:id/activation-key', requireRole(['admin']), (req: any, res): any => {
  const { feature, expiresInDays } = req.body;
  const trader = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'trader'")
    .get(req.params.id);
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  const activationKey = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 30));

  // Store activation key (you might want to create a separate table for this)
  db.prepare(
    `
    INSERT INTO trader_subscriptions (id, trader_id, subscription_id, status, activated_at, expires_at, payment_method, created_at, updated_at)
    VALUES (?, ?, 'activation_key', 'active', CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(uuidv4(), req.params.id, expiresAt.toISOString(), `activation_key_${feature}`);

  recordAdminAction(req.user.id, 'generate_activation_key', 'trader', req.params.id, {
    feature,
    expiresInDays,
  });
  res.json({ success: true, activationKey, expiresAt: expiresAt.toISOString() });
});

// Business Analyst Management
app.get('/api/admin/business-analysts', requireRole(['admin']), (req: any, res): any => {
  const analysts = db
    .prepare(
      `
    SELECT ba.*, u.name, u.email, u.phone
    FROM business_analysts ba
    JOIN users u ON ba.user_id = u.id
    WHERE ba.is_active = 1
    ORDER BY ba.rating DESC
  `
    )
    .all();
  res.json({ success: true, analysts });
});

app.post('/api/admin/business-analysts', requireRole(['admin']), (req: any, res): any => {
  const { userId, specialization, experienceYears, certifications } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO business_analysts (id, user_id, specialization, experience_years, certifications, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `
  ).run(id, userId, specialization, experienceYears, JSON.stringify(certifications || []));

  recordAdminAction(req.user.id, 'create_business_analyst', 'business_analyst', id, {
    userName: user.name,
    specialization,
  });
  res.json({
    success: true,
    analyst: { id, userId, specialization, experienceYears, certifications },
  });
});

// Analyst Assignments
app.post('/api/admin/traders/:id/assign-analyst', requireRole(['admin']), (req: any, res): any => {
  const { analystId, priority, requirements } = req.body;
  const trader = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'trader'")
    .get(req.params.id);
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  const analyst = db
    .prepare('SELECT * FROM business_analysts WHERE id = ? AND is_active = 1')
    .get(analystId);
  if (!analyst) return res.status(404).json({ error: 'Business analyst not found' });

  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO analyst_assignments (id, trader_id, analyst_id, status, priority, requirements, assigned_at, created_at)
    VALUES (?, ?, ?, 'assigned', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  ).run(id, req.params.id, analystId, priority || 'medium', requirements);

  recordAdminAction(req.user.id, 'assign_analyst', 'analyst_assignment', id, {
    traderId: req.params.id,
    analystId,
    priority,
  });
  res.json({
    success: true,
    assignment: { id, traderId: req.params.id, analystId, priority, requirements },
  });
});

app.get('/api/admin/analyst-assignments', requireRole(['admin']), (req: any, res): any => {
  const assignments = db
    .prepare(
      `
    SELECT aa.*, t.name as trader_name, t.businessName, ba.specialization,
           u.name as analyst_name, u.email as analyst_email
    FROM analyst_assignments aa
    JOIN users t ON aa.trader_id = t.id
    JOIN business_analysts ba ON aa.analyst_id = ba.id
    JOIN users u ON ba.user_id = u.id
    ORDER BY aa.assigned_at DESC
  `
    )
    .all();
  res.json({ success: true, assignments });
});

// Business Model Control Center
app.get('/api/admin/business-model', requireRole(['admin']), (req: any, res): any => {
  const feeStats = db
    .prepare(
      `
    SELECT
      SUM(feeAmount) as totalFees,
      COUNT(*) as transactionCount,
      AVG(feeAmount) as averageFee
    FROM transaction_fees
    WHERE createdAt >= date('now', '-30 days')
  `
    )
    .get() as any;

  const dynamicFees = db
    .prepare(
      'SELECT * FROM dynamic_fees WHERE is_active = 1 ORDER BY fee_type, effective_from DESC'
    )
    .all();
  const subscriptions = db
    .prepare('SELECT * FROM subscriptions WHERE is_active = 1 ORDER BY price ASC')
    .all();
  const feeBreakdown = db
    .prepare(
      `
    SELECT feeType, COALESCE(SUM(feeAmount), 0) as totalFees, COUNT(*) as count, COALESCE(AVG(feeAmount), 0) as averageFee
    FROM transaction_fees
    WHERE createdAt >= date('now', '-30 days')
    GROUP BY feeType
    ORDER BY totalFees DESC
  `
    )
    .all();
  const collectionPipeline = db
    .prepare(
      `
    SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
    FROM payment_intents
    GROUP BY status
    ORDER BY amount DESC
  `
    )
    .all();
  const platformWallet = getPlatformWalletSummary();
  const platformWalletHistory = db
    .prepare(
      `
      SELECT pwt.*, u.name as userName, u.email as userEmail
      FROM platform_wallet_transactions pwt
      LEFT JOIN users u ON u.id = pwt.userId
      ORDER BY pwt.createdAt DESC
      LIMIT 25
    `
    )
    .all()
    .map((row: any) => ({ ...row, metadata: parseJsonField(row.metadata, {}) }));
  const revenueAccounts = db
    .prepare(
      `
    SELECT code, name, accountType, balance, description
    FROM revenue_accounts
    WHERE isActive = 1
    ORDER BY accountType, code
  `
    )
    .all();
  const agentCommissions = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'payable' THEN commissionAmount ELSE 0 END), 0) as payable,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN commissionAmount ELSE 0 END), 0) as paid,
      COALESCE(SUM(platformNet), 0) as platformNet,
      COUNT(*) as count
    FROM agent_commissions
  `
    )
    .get();
  const subscriptionMrr =
    (
      db
        .prepare(
          `
    SELECT COALESCE(SUM(s.price), 0) as value
    FROM trader_subscriptions ts
    JOIN subscriptions s ON s.id = ts.subscription_id
    WHERE ts.status = 'active'
      AND (ts.expires_at IS NULL OR ts.expires_at > CURRENT_TIMESTAMP)
  `
        )
        .get() as any
    )?.value || 0;
  const loanStats = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(amount), 0) as principalDisbursed,
        COALESCE(SUM(totalRepayment - amount), 0) as expectedInterest,
        COALESCE(SUM(amountRepaid), 0) as amountRepaid,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN totalRepayment - amountRepaid ELSE 0 END), 0) as overdueExposure
      FROM smart_loans
      WHERE createdAt >= date('now', '-30 days')
    `
    )
    .get() as any;
  const loanInterestIncome =
    (
      db
        .prepare(
          `
          SELECT COALESCE(SUM(amount), 0) as value
          FROM ledger_entries
          WHERE description = 'Loan interest income collected'
            AND createdAt >= date('now', '-30 days')
        `
        )
        .get() as any
    )?.value || 0;
  const loyaltyLiability =
    (
      db
        .prepare(
          `
          SELECT COALESCE(SUM(valueDelta), 0) as value, COALESCE(SUM(pointsDelta), 0) as points
          FROM loyalty_liability_entries
        `
        )
        .get() as any
    ) || { value: 0, points: 0 };
  const referralCost =
    (
      db
        .prepare(
          `
          SELECT COALESCE(SUM(valueDelta), 0) as value
          FROM loyalty_liability_entries
          WHERE type IN ('referral_qualified', 'referral_signup')
            AND createdAt >= date('now', '-30 days')
        `
        )
        .get() as any
    )?.value || 0;

  res.json({
    success: true,
    businessModel: {
      feeStats,
      feeBreakdown,
      dynamicFees,
      subscriptions,
      collectionPipeline,
      platformWallet,
      platformWalletHistory,
      revenueAccounts,
      agentCommissions,
      loanStats: {
        ...loanStats,
        interestIncome30d: loanInterestIncome,
      },
      loyaltyLiability,
      referralCost30d: referralCost,
      revenueProjection: {
        monthly: (feeStats?.totalFees || 0) + subscriptionMrr + loanInterestIncome,
        yearly: ((feeStats?.totalFees || 0) + subscriptionMrr + loanInterestIncome) * 12,
        subscriptionMrr,
        loanInterestIncome,
        netAfterLoyaltyCost: (feeStats?.totalFees || 0) + subscriptionMrr + loanInterestIncome - referralCost,
      },
    },
  });
});

app.put('/api/admin/business-model/fees', requireRole(['admin']), (req: any, res): any => {
  const { feeType, percentage, fixedAmount, conditions } = req.body;
  if (!feeType) return res.status(400).json({ error: 'Fee type is required' });

  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO dynamic_fees (id, fee_type, percentage, fixed_amount, conditions, is_active, effective_from, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    id,
    feeType,
    percentage || 0,
    fixedAmount || 0,
    JSON.stringify(conditions || {}),
    req.user.id
  );

  recordAdminAction(req.user.id, 'update_dynamic_fees', 'fee', id, {
    feeType,
    percentage,
    fixedAmount,
  });
  res.json({ success: true });
});

app.put('/api/admin/business-model/subscriptions', requireRole(['admin']), (req: any, res): any => {
  const { subscriptionId, price, features, limits } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'Subscription ID is required' });

  db.prepare(
    `
    UPDATE subscriptions SET price = ?, features = ?, limits = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(price, JSON.stringify(features || []), JSON.stringify(limits || {}), subscriptionId);

  recordAdminAction(req.user.id, 'update_subscription_pricing', 'subscription', subscriptionId, {
    price,
  });
  res.json({ success: true });
});

// Trader Analytics
app.get('/api/admin/traders/:id/analytics', requireRole(['admin']), (req: any, res): any => {
  const trader = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'trader'")
    .get(req.params.id);
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  const analytics = db
    .prepare(
      `
    SELECT * FROM trader_analytics
    WHERE trader_id = ?
    ORDER BY period_start DESC
    LIMIT 100
  `
    )
    .all(req.params.id);

  // Calculate real-time metrics
  const revenue = db
    .prepare(
      `
    SELECT SUM(amount) as total FROM transactions
    WHERE traderId = ? AND status = 'completed' AND createdAt >= date('now', '-30 days')
  `
    )
    .get(req.params.id) as any;

  const customers = db
    .prepare(
      `
    SELECT COUNT(DISTINCT customerId) as count FROM purchases
    WHERE traderId = ? AND createdAt >= date('now', '-30 days')
  `
    )
    .get(req.params.id) as any;

  const transactions = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM transactions
    WHERE traderId = ? AND createdAt >= date('now', '-30 days')
  `
    )
    .get(req.params.id) as any;

  res.json({
    success: true,
    analytics: {
      historical: analytics,
      current: {
        revenue: revenue?.total || 0,
        customers: customers?.count || 0,
        transactions: transactions?.count || 0,
        averageOrderValue: transactions?.count > 0 ? (revenue?.total || 0) / transactions.count : 0,
      },
    },
  });
});

// Generate business recommendations for trader
app.post('/api/admin/traders/:id/recommendations', requireRole(['admin']), (req: any, res): any => {
  const trader = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'trader'")
    .get(req.params.id);
  if (!trader) return res.status(404).json({ error: 'Trader not found' });

  // Get trader's business data
  const businessData = db
    .prepare(
      `
    SELECT
      COUNT(DISTINCT p.customerId) as customerCount,
      SUM(p.totalAmount) as totalRevenue,
      AVG(p.totalAmount) as avgOrderValue,
      COUNT(p.id) as totalOrders,
      MAX(p.createdAt) as lastOrderDate
    FROM purchases p
    WHERE p.traderId = ? AND p.createdAt >= date('now', '-90 days')
  `
    )
    .get(req.params.id) as any;

  // Generate AI-powered recommendations based on data
  const recommendations = [];

  if (businessData.customerCount < 10) {
    recommendations.push({
      title: 'Customer Acquisition Focus',
      description:
        'Your customer base is small. Consider marketing campaigns to attract more customers.',
      category: 'marketing',
      priority: 'high',
      estimatedImpact: businessData.avgOrderValue * 50, // Potential additional revenue
    });
  }

  if (businessData.avgOrderValue < 50000) {
    // Less than ~$350
    recommendations.push({
      title: 'Increase Average Order Value',
      description: 'Bundle products or offer upsells to increase transaction sizes.',
      category: 'operations',
      priority: 'medium',
      estimatedImpact: (60000 - businessData.avgOrderValue) * businessData.totalOrders * 0.2,
    });
  }

  if (
    !businessData.lastOrderDate ||
    new Date(businessData.lastOrderDate) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ) {
    recommendations.push({
      title: 'Re-engage Inactive Customers',
      description: "Send promotional offers to customers who haven't ordered recently.",
      category: 'marketing',
      priority: 'medium',
      estimatedImpact: businessData.avgOrderValue * businessData.customerCount * 0.1,
    });
  }

  // Save recommendations
  const savedRecommendations = [];
  for (const rec of recommendations) {
    const id = uuidv4();
    db.prepare(
      `
      INSERT INTO analyst_recommendations (id, assignment_id, title, description, category, priority, estimated_impact, implementation_status, created_at)
      VALUES (?, 'system_generated', ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `
    ).run(id, rec.title, rec.description, rec.category, rec.priority, rec.estimatedImpact);

    savedRecommendations.push({ id, ...rec });
  }

  recordAdminAction(req.user.id, 'generate_recommendations', 'trader', req.params.id, {
    count: recommendations.length,
  });
  res.json({ success: true, recommendations: savedRecommendations });
});

app.get('/api/:collectionName', authenticate, (req: any, res: any, next: any): any => {
  const collectionName = String(req.params.collectionName || '');
  if (!firestoreDocumentCollections.has(collectionName)) return next();

  const { limit, offset } = parseLimitOffset(req.query);
  const rows = db
    .prepare(
      `
    SELECT * FROM collection_documents WHERE collection = ?
  `
    )
    .all(collectionName) as any[];
  let documents: Array<Record<string, any>> = rows.map((row) => ({
    ...parseJsonObject(row.data),
    id: row.id,
    createdAt: parseJsonObject(row.data).createdAt ?? row.createdAt,
    updatedAt: parseJsonObject(row.data).updatedAt ?? row.updatedAt,
  }));

  documents = filterCollectionDocuments(documents, req.query).filter((document) =>
    canAccessGenericDocument(req, collectionName, document)
  );

  const sortBy = String(req.query.orderBy || req.query.sortBy || 'createdAt');
  const sortOrder =
    String(req.query.order || req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  documents.sort((a, b) => {
    const left = normalizeComparable(a[sortBy]);
    const right = normalizeComparable(b[sortBy]);
    if (left === right) return 0;
    return left > right ? sortOrder : -sortOrder;
  });

  const paged = documents.slice(offset, offset + limit);
  res.json({ success: true, [collectionName]: paged, data: paged, items: paged });
});

app.get('/api/:collectionName/:id', authenticate, (req: any, res: any, next: any): any => {
  const collectionName = String(req.params.collectionName || '');
  if (!firestoreDocumentCollections.has(collectionName)) return next();

  const document = getCollectionDocument(collectionName, req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found' });
  if (!canAccessGenericDocument(req, collectionName, document)) {
    return res.status(403).json({ error: 'You are not authorized to access this document' });
  }
  res.json({ success: true, document, data: document });
});

app.post('/api/:collectionName', authenticate, (req: any, res: any, next: any): any => {
  const collectionName = String(req.params.collectionName || '');
  if (!firestoreDocumentCollections.has(collectionName)) return next();

  const body = req.body.data || req.body || {};
  const id = body.id || uuidv4();
  const allowedBody = prepareGenericDocumentForWrite(req, collectionName, body);
  if (!allowedBody) {
    return res
      .status(403)
      .json({ error: 'You are not authorized to create documents in this collection' });
  }
  const document = saveCollectionDocument(collectionName, id, allowedBody);
  res.json({ success: true, id, document, data: document });
});

app.put('/api/:collectionName/:id', authenticate, (req: any, res: any, next: any): any => {
  const collectionName = String(req.params.collectionName || '');
  if (!firestoreDocumentCollections.has(collectionName)) return next();

  const current = getCollectionDocument(collectionName, req.params.id) || {};
  if (Object.keys(current).length > 0 && !canAccessGenericDocument(req, collectionName, current)) {
    return res.status(403).json({ error: 'You are not authorized to update this document' });
  }
  const body = req.body.data || req.body || {};
  const nextBody = applyFieldTransforms(current, body);
  const allowedBody = prepareGenericDocumentForWrite(req, collectionName, nextBody);
  if (!allowedBody) {
    return res.status(403).json({ error: 'You are not authorized to update this document' });
  }
  const document = saveCollectionDocument(collectionName, req.params.id, allowedBody);
  res.json({ success: true, document, data: document });
});

app.delete('/api/:collectionName/:id', authenticate, (req: any, res: any, next: any): any => {
  const collectionName = String(req.params.collectionName || '');
  if (!firestoreDocumentCollections.has(collectionName)) return next();

  const current = getCollectionDocument(collectionName, req.params.id);
  if (!current) return res.status(404).json({ error: 'Document not found' });
  if (!canAccessGenericDocument(req, collectionName, current)) {
    return res.status(403).json({ error: 'You are not authorized to delete this document' });
  }
  db.prepare('DELETE FROM collection_documents WHERE collection = ? AND id = ?').run(
    collectionName,
    req.params.id
  );
  res.json({ success: true });
});

// ============ ADMIN PORTAL ENDPOINTS ============
const adminOtpStore = new Map<string, { otpHash: string; expiresAt: number; attempts: number }>();

app.post('/api/admin/request-otp', adminOtpLimiter, async (req: any, res): Promise<any> => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ? AND role = ?')
      .get(email, 'admin') as any;
    if (!user) {
      logSystem(`Admin OTP requested for non-admin email: ${email}`, 'warn', 'admin-auth');
      return res.json({
        success: true,
        message: 'If this admin email exists, an OTP has been sent',
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    adminOtpStore.set(email, { otpHash: hashToken(otp), expiresAt, attempts: 0 });

    // Send OTP via email
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
      <div style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); padding: 40px 32px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">ESOKO Nexus</h1>
        <p style="color: #fed7aa; font-size: 16px; font-weight: 500; margin: 8px 0 0 0;">Admin Portal Access</p>
      </div>
      <div style="padding: 40px 32px;">
        <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">Your Admin Verification Code</h2>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">
          Use this code to access the admin portal. This code expires in 10 minutes.
        </p>
        <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 32px 0;">
          <div style="font-size: 36px; font-weight: 800; color: #ea580c; letter-spacing: 0.1em; font-family: 'Courier New', monospace;">${otp}</div>
        </div>
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <p style="color: #92400e; font-size: 14px; font-weight: 500; margin: 0; text-align: center;">
            ⚠️ This code is for admin access only. Do not share it with anyone.
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
          If you didn't request this code, please contact support immediately.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          © 2026 ESOKO • Secure Digital Trade Ecosystem
        </p>
      </div>
    </div>
  `;

    await sendAppEmail({
      from: SMTP_FROM,
      to: email,
      subject: 'ESOKO Nexus - Admin Portal Verification Code',
      html,
      text: `Your admin verification code is: ${otp}\n\nThis code expires in 10 minutes. Use it to access the admin portal.\n\nIf you didn't request this code, please contact support immediately.`,
    });

    console.log(`[ADMIN OTP] Email sent successfully to ${email}`);

    logSystem(`Admin OTP sent to ${email}`, 'info', 'admin-auth', user.id);

    res.json({ success: true, message: 'OTP sent to admin email' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/verify-otp', adminOtpLimiter, (req: any, res): any => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const otpRecord = adminOtpStore.get(email);
    if (!otpRecord) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    if (otpRecord.expiresAt < Date.now()) {
      adminOtpStore.delete(email);
      return res.status(401).json({ error: 'OTP has expired' });
    }

    if (otpRecord.attempts >= 5) {
      adminOtpStore.delete(email);
      return res.status(429).json({ error: 'Too many invalid OTP attempts. Request a new code.' });
    }

    if (otpRecord.otpHash !== hashToken(otp)) {
      otpRecord.attempts += 1;
      adminOtpStore.set(email, otpRecord);
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ? AND role = ?')
      .get(email, 'admin') as any;
    if (!user) {
      return res.status(401).json({ error: 'Admin user not found' });
    }

    const { accessToken } = issueAuthCookies(req, res, user);
    adminOtpStore.delete(email);
    logSystem(`Admin login successful for ${email}`, 'info', 'admin-auth', user.id);

    res.json({ success: true, user: publicUser(user), token: accessToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/stats', requireRole(['admin']), (_req: any, res) => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
    const totalTraders =
      (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'trader'").get() as any)
        ?.count || 0;
    const totalVolume =
      (
        db
          .prepare(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'purchase' AND status = 'completed'"
          )
          .get() as any
      )?.total || 0;
    const totalRevenue =
      (db.prepare('SELECT COALESCE(SUM(feeAmount), 0) as total FROM transaction_fees').get() as any)
        ?.total || 0;
    const totalTransactions =
      (db.prepare('SELECT COUNT(*) as count FROM transactions').get() as any)?.count || 0;
    const premiumUsers =
      (
        db
          .prepare(
            "SELECT COUNT(*) as count FROM users WHERE tier IN ('premium', 'gold', 'platinum')"
          )
          .get() as any
      )?.count || 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalTraders,
        totalVolume: Math.round(totalVolume),
        totalRevenue: Math.round(totalRevenue),
        totalTransactions,
        premiumUsers,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const search = String(req.query.search || '').trim();
    const role = req.query.role ? String(req.query.role).trim() : null;
    const status = req.query.status ? String(req.query.status).trim() : null;
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;

    const conditions: string[] = [];
    const params: any[] = [];

    if (role && role !== 'all') {
      conditions.push('role = ?');
      params.push(role);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      const term = `%${search}%`;
      conditions.push('(name LIKE ? OR email LIKE ? OR businessName LIKE ? OR appNumber LIKE ?)');
      params.push(term, term, term, term);
    }

    if (from) {
      conditions.push('DATE(createdAt) >= DATE(?)');
      params.push(from);
    }

    if (to) {
      conditions.push('DATE(createdAt) <= DATE(?)');
      params.push(to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const users = db
      .prepare(
        `
      SELECT id, email, name, role, tier, walletBalance, verificationStatus, status, createdAt, businessName
      FROM users ${where}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(...params, limit, offset);

    const countResult = db
      .prepare(`SELECT COUNT(*) as total FROM users ${where}`)
      .get(...params) as any;
    res.json({ success: true, users, total: countResult?.total || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Duplicate endpoint removed - using the comprehensive traders endpoint above

app.get('/api/admin/payments', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const status = req.query.status ? String(req.query.status) : null;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const payments = db
      .prepare(
        `
      SELECT id, amount, type, status, description, createdAt
      FROM transactions ${where}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(...params, limit, offset);

    res.json({ success: true, payments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/premium-users', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const premiumUsers = db
      .prepare(
        `
      SELECT id, email, name, tier, walletBalance, createdAt
      FROM users WHERE tier IN ('premium', 'gold', 'platinum')
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset);

    res.json({ success: true, premiumUsers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/database-stats', requireRole(['admin']), (_req: any, res) => {
  try {
    const stats = {
      users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0,
      traders:
        (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'trader'").get() as any)
          ?.count || 0,
      customers:
        (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get() as any)
          ?.count || 0,
      agents:
        (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'agent'").get() as any)
          ?.count || 0,
      products: (db.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0,
      purchases: (db.prepare('SELECT COUNT(*) as count FROM purchases').get() as any)?.count || 0,
      transactions:
        (db.prepare('SELECT COUNT(*) as count FROM transactions').get() as any)?.count || 0,
      transaction_fees:
        (db.prepare('SELECT COUNT(*) as count FROM transaction_fees').get() as any)?.count || 0,
      revenue_accounts:
        (db.prepare('SELECT COUNT(*) as count FROM revenue_accounts').get() as any)?.count || 0,
      ledger_entries:
        (db.prepare('SELECT COUNT(*) as count FROM ledger_entries').get() as any)?.count || 0,
      payment_intents:
        (db.prepare('SELECT COUNT(*) as count FROM payment_intents').get() as any)?.count || 0,
      agent_commissions:
        (db.prepare('SELECT COUNT(*) as count FROM agent_commissions').get() as any)?.count || 0,
      agent_settlements:
        (db.prepare('SELECT COUNT(*) as count FROM agent_settlements').get() as any)?.count || 0,
      subscriptions:
        (db.prepare('SELECT COUNT(*) as count FROM subscriptions').get() as any)?.count || 0,
      trader_subscriptions:
        (db.prepare('SELECT COUNT(*) as count FROM trader_subscriptions').get() as any)?.count || 0,
      notifications:
        (db.prepare('SELECT COUNT(*) as count FROM notifications').get() as any)?.count || 0,
    };

    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/database/stats', requireRole(['admin']), (_req: any, res) => {
  try {
    const stats = {
      users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0,
      traders:
        (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'trader'").get() as any)
          ?.count || 0,
      customers:
        (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get() as any)
          ?.count || 0,
      agents:
        (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'agent'").get() as any)
          ?.count || 0,
      products: (db.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0,
      purchases: (db.prepare('SELECT COUNT(*) as count FROM purchases').get() as any)?.count || 0,
      transactions:
        (db.prepare('SELECT COUNT(*) as count FROM transactions').get() as any)?.count || 0,
      notifications:
        (db.prepare('SELECT COUNT(*) as count FROM notifications').get() as any)?.count || 0,
    };

    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/config', requireRole(['admin']), (_req: any, res) => {
  try {
    const config = getConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Survey management endpoints
app.get('/api/admin/survey-questions', requireRole(['admin']), (req: any, res): any => {
  try {
    const questions = db
      .prepare(
        'SELECT * FROM survey_questions WHERE enabled = 1 ORDER BY orderIndex ASC, createdAt ASC'
      )
      .all();
    res.json({ success: true, questions: questions.map(normalizeSurveyQuestionRow) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/survey-questions', requireRole(['admin']), (req: any, res): any => {
  try {
    const { question, questionType, options, required, orderIndex } = req.body;
    if (!question || !questionType) {
      return res.status(400).json({ error: 'Question and question type are required' });
    }

    const id = uuidv4();
    db.prepare(
      `
      INSERT INTO survey_questions (id, question, questionType, options, required, orderIndex, enabled, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      id,
      question,
      questionType,
      options ? JSON.stringify(options) : null,
      required ? 1 : 0,
      orderIndex || 0
    );

    const newQuestion = normalizeSurveyQuestionRow(
      db.prepare('SELECT * FROM survey_questions WHERE id = ?').get(id)
    );
    res.json({ success: true, question: newQuestion });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/survey-questions/:id', requireRole(['admin']), (req: any, res): any => {
  try {
    const { question, questionType, options, required, orderIndex, enabled } = req.body;
    const questionId = req.params.id;

    const existing = db.prepare('SELECT * FROM survey_questions WHERE id = ?').get(questionId);
    if (!existing) {
      return res.status(404).json({ error: 'Survey question not found' });
    }

    db.prepare(
      `
      UPDATE survey_questions
      SET question = COALESCE(?, question),
          questionType = COALESCE(?, questionType),
          options = COALESCE(?, options),
          required = COALESCE(?, required),
          orderIndex = COALESCE(?, orderIndex),
          enabled = COALESCE(?, enabled),
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(
      question || null,
      questionType || null,
      options ? JSON.stringify(options) : null,
      required !== undefined ? (required ? 1 : 0) : null,
      orderIndex !== undefined ? orderIndex : null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      questionId
    );

    const updated = normalizeSurveyQuestionRow(
      db.prepare('SELECT * FROM survey_questions WHERE id = ?').get(questionId)
    );
    res.json({ success: true, question: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/survey-questions/:id', requireRole(['admin']), (req: any, res): any => {
  try {
    const questionId = req.params.id;
    const existing = db.prepare('SELECT * FROM survey_questions WHERE id = ?').get(questionId);
    if (!existing) {
      return res.status(404).json({ error: 'Survey question not found' });
    }

    db.prepare('DELETE FROM survey_responses WHERE questionId = ?').run(questionId);
    db.prepare('DELETE FROM survey_questions WHERE id = ?').run(questionId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/survey-responses', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const responses = db
      .prepare(
        `
      SELECT sr.*, sq.question, u.name as userName, u.email as userEmail
      FROM survey_responses sr
      JOIN survey_questions sq ON sr.questionId = sq.id
      JOIN users u ON sr.userId = u.id
      ORDER BY sr.createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset);

    const total =
      (db.prepare('SELECT COUNT(*) as count FROM survey_responses').get() as { count: number })
        ?.count || 0;
    res.json({ success: true, responses: responses.map(normalizeSurveyResponseRow), total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User survey endpoints
app.get('/api/survey-questions', authenticate, (req: any, res): any => {
  try {
    const questions = db
      .prepare(
        'SELECT id, question, questionType, options, required, orderIndex FROM survey_questions WHERE enabled = 1 ORDER BY orderIndex ASC, createdAt ASC'
      )
      .all();
    // Parse options JSON for each question
    const parsedQuestions = questions.map((q: any) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    }));
    res.json({ success: true, questions: parsedQuestions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/survey-responses', authenticate, (req: any, res): any => {
  try {
    const { responses } = req.body;
    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses must be an array' });
    }

    const userId = req.user.id;
    const insertedResponses: any[] = [];

    for (const response of responses) {
      const { questionId, response: answer } = response;
      if (!questionId || answer === undefined) {
        continue; // Skip invalid responses
      }

      // Check if user already responded to this question
      const existing = db
        .prepare('SELECT id FROM survey_responses WHERE userId = ? AND questionId = ?')
        .get(userId, questionId) as any;
      if (existing) {
        // Update existing response
        db.prepare(
          'UPDATE survey_responses SET response = ?, createdAt = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(JSON.stringify(answer), existing.id);
      } else {
        // Insert new response
        const id = uuidv4();
        db.prepare(
          'INSERT INTO survey_responses (id, userId, questionId, response, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
        ).run(id, userId, questionId, JSON.stringify(answer));
      }

      insertedResponses.push({ questionId, response: answer });
    }

    res.json({ success: true, responses: insertedResponses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/onboarding/research', authenticate, (req: any, res): any => {
  try {
    const responses = req.body.responses || {};
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ error: 'Responses object is required' });
    }
    const userRole = normalizeRole(req.body.role || req.user.role || 'customer');
    const insertQuestion = db.prepare(
      `
      INSERT OR IGNORE INTO survey_questions
        (id, flowId, audience, question, questionType, required, orderIndex, enabled, createdAt, updatedAt)
      VALUES (?, 'onboarding', ?, ?, 'text', 0, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    );
    const findQuestion = db.prepare(
      'SELECT id FROM survey_questions WHERE flowId = ? AND audience = ? AND question = ? LIMIT 1'
    );
    const upsertResponse = db.prepare(
      `
      INSERT INTO survey_responses (id, userId, questionId, response, createdAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    );
    let order = 0;
    for (const [key, value] of Object.entries(responses)) {
      if (value === undefined || value === null || value === '') continue;
      const question = `onboarding.${key}`;
      const questionId = `onboarding_${userRole}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_');
      insertQuestion.run(questionId, userRole, question, order++);
      const row = findQuestion.get('onboarding', userRole, question) as any;
      if (row?.id) {
        upsertResponse.run(uuidv4(), req.user.id, row.id, JSON.stringify(value));
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/survey-responses', authenticate, (req: any, res): any => {
  try {
    const userId = req.user.id;
    const responses = db
      .prepare(
        `
      SELECT sr.*, sq.question, sq.questionType
      FROM survey_responses sr
      JOIN survey_questions sq ON sr.questionId = sq.id
      WHERE sr.userId = ?
      ORDER BY sq.orderIndex ASC, sr.createdAt ASC
    `
      )
      .all(userId);

    // Parse responses
    const parsedResponses = responses.map((r: any) => ({
      ...r,
      response: JSON.parse(r.response),
    }));

    res.json({ success: true, responses: parsedResponses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CONTROL CENTER ENDPOINTS ============

app.get('/api/admin/control-center', requireRole(['admin']), (_req: any, res) => {
  try {
    const scalar = (sql: string, ...params: any[]) =>
      (db.prepare(sql).get(...params) as any)?.value || 0;

    const dailyActivity = db
      .prepare(
        `
      WITH days(day) AS (
        SELECT DATE('now', '-6 day')
        UNION ALL
        SELECT DATE(day, '+1 day') FROM days WHERE day < DATE('now')
      )
      SELECT
        days.day,
        COALESCE(tx.count, 0) as transactions,
        COALESCE(tx.volume, 0) as volume,
        COALESCE(fees.revenue, 0) as revenue,
        COALESCE(users.count, 0) as newUsers
      FROM days
      LEFT JOIN (
        SELECT DATE(createdAt) as day, COUNT(*) as count, COALESCE(SUM(amount), 0) as volume
        FROM transactions
        WHERE DATE(createdAt) >= DATE('now', '-6 day')
        GROUP BY DATE(createdAt)
      ) tx ON tx.day = days.day
      LEFT JOIN (
        SELECT DATE(createdAt) as day, COALESCE(SUM(feeAmount), 0) as revenue
        FROM transaction_fees
        WHERE DATE(createdAt) >= DATE('now', '-6 day')
        GROUP BY DATE(createdAt)
      ) fees ON fees.day = days.day
      LEFT JOIN (
        SELECT DATE(createdAt) as day, COUNT(*) as count
        FROM users
        WHERE DATE(createdAt) >= DATE('now', '-6 day')
        GROUP BY DATE(createdAt)
      ) users ON users.day = days.day
      ORDER BY days.day ASC
    `
      )
      .all() as any[];

    const roleDistribution = db
      .prepare(
        `
      SELECT COALESCE(role, 'unknown') as role, COUNT(*) as count
      FROM users
      GROUP BY COALESCE(role, 'unknown')
      ORDER BY count DESC
    `
      )
      .all() as any[];

    const statusDistribution = db
      .prepare(
        `
      SELECT COALESCE(status, 'active') as status, COUNT(*) as count
      FROM transactions
      GROUP BY COALESCE(status, 'active')
      ORDER BY count DESC
    `
      )
      .all() as any[];

    const feeRevenueByType = db
      .prepare(
        `
      SELECT feeType, COALESCE(SUM(feeAmount), 0) as amount, COUNT(*) as count
      FROM transaction_fees
      WHERE createdAt >= datetime('now', '-30 days')
      GROUP BY feeType
      ORDER BY amount DESC
    `
      )
      .all() as any[];

    const activeSubscriptionMrr = scalar(`
      SELECT COALESCE(SUM(s.price), 0) as value
      FROM trader_subscriptions ts
      JOIN subscriptions s ON s.id = ts.subscription_id
      WHERE ts.status = 'active'
        AND (ts.expires_at IS NULL OR ts.expires_at > CURRENT_TIMESTAMP)
    `);

    const subscriptionStats = db
      .prepare(
        `
      SELECT
        COUNT(*) as activeSubscriptions,
        COALESCE(SUM(s.price), 0) as monthlyRecurringRevenue,
        COALESCE(AVG(s.price), 0) as averagePlanPrice
      FROM trader_subscriptions ts
      JOIN subscriptions s ON s.id = ts.subscription_id
      WHERE ts.status = 'active'
        AND (ts.expires_at IS NULL OR ts.expires_at > CURRENT_TIMESTAMP)
    `
      )
      .get() as any;

    const paymentPipeline = db
      .prepare(
        `
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM payment_intents
      GROUP BY status
      ORDER BY amount DESC
    `
      )
      .all() as any[];

    const agentCommissionStats = db
      .prepare(
        `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'payable' THEN commissionAmount ELSE 0 END), 0) as payable,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commissionAmount ELSE 0 END), 0) as paid,
        COALESCE(SUM(platformNet), 0) as platformNet,
        COUNT(*) as count
      FROM agent_commissions
    `
      )
      .get() as any;

    const ledgerTotals = db
      .prepare(
        `
      SELECT
        accountType,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) as balance,
        COUNT(*) as entries
      FROM ledger_entries
      GROUP BY accountType
      ORDER BY accountType ASC
    `
      )
      .all() as any[];

    const revenueAccounts = db
      .prepare(
        `
      SELECT code, name, accountType, balance, description
      FROM revenue_accounts
      WHERE isActive = 1
      ORDER BY accountType, code
    `
      )
      .all() as any[];

    const thirtyDayFeeRevenue = feeRevenueByType.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );
    const revenueStreams = [
      {
        id: 'marketplace_commission',
        label: 'Marketplace Commission',
        amount: Number(feeRevenueByType.find((row) => row.feeType === 'purchase')?.amount || 0),
        count: Number(feeRevenueByType.find((row) => row.feeType === 'purchase')?.count || 0),
        collectionMethod: 'Auto-deducted before trader settlement',
      },
      {
        id: 'wallet_fees',
        label: 'Wallet Fees',
        amount: feeRevenueByType
          .filter((row) => ['deposit', 'withdrawal', 'transfer'].includes(row.feeType))
          .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        count: feeRevenueByType
          .filter((row) => ['deposit', 'withdrawal', 'transfer'].includes(row.feeType))
          .reduce((sum, row) => sum + Number(row.count || 0), 0),
        collectionMethod: 'Deducted during wallet movement',
      },
      {
        id: 'subscriptions',
        label: 'Trader Subscriptions',
        amount: activeSubscriptionMrr,
        count: Number(subscriptionStats?.activeSubscriptions || 0),
        collectionMethod: 'Monthly wallet deduction or provider payment',
      },
      {
        id: 'loan_services',
        label: 'Loan & Credit Services',
        amount: feeRevenueByType
          .filter((row) => String(row.feeType).startsWith('loan_'))
          .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        count: feeRevenueByType
          .filter((row) => String(row.feeType).startsWith('loan_'))
          .reduce((sum, row) => sum + Number(row.count || 0), 0),
        collectionMethod: 'Application/disbursement fees',
      },
    ];

    const pendingAlerts = scalar(`
      SELECT COUNT(*) as value FROM login_alerts
      WHERE status = 'pending' AND expiresAt > CURRENT_TIMESTAMP
    `);
    const openTickets = scalar(`
      SELECT COUNT(*) as value FROM tickets
      WHERE status IN ('open', 'in_progress')
    `);
    const failedTransactions24h = scalar(`
      SELECT COUNT(*) as value FROM transactions
      WHERE status = 'failed' AND createdAt > datetime('now', '-1 day')
    `);
    const failedEmails24h = scalar(`
      SELECT COUNT(*) as value FROM email_logs
      WHERE status = 'failed' AND createdAt > datetime('now', '-1 day')
    `);
    const suspendedUsers = scalar(`
      SELECT COUNT(*) as value FROM users
      WHERE status = 'suspended'
    `);
    const config = getConfig();
    const verificationSummary = {
      pending: scalar(
        "SELECT COUNT(*) as value FROM verification_requests WHERE status IN ('pending', 'submitted', 'needs_review')"
      ),
      autoVerified: scalar("SELECT COUNT(*) as value FROM verification_requests WHERE status = 'auto_verified'"),
      approved: scalar("SELECT COUNT(*) as value FROM verification_requests WHERE status = 'approved'"),
      rejected: scalar("SELECT COUNT(*) as value FROM verification_requests WHERE status = 'rejected'"),
      openRiskFlags: scalar("SELECT COUNT(*) as value FROM risk_flags WHERE status = 'open'"),
      missingLicenses: scalar(
        "SELECT COUNT(*) as value FROM risk_flags WHERE status = 'open' AND code LIKE 'missing_license_%'"
      ),
    };
    const traderResearch = {
      businessCategories: db
        .prepare(
          `
          SELECT COALESCE(businessCategory, 'Unknown') as label, COUNT(*) as count
          FROM verification_requests
          WHERE role = 'trader'
          GROUP BY COALESCE(businessCategory, 'Unknown')
          ORDER BY count DESC
          LIMIT 8
        `
        )
        .all(),
      districts: db
        .prepare(
          `
          SELECT COALESCE(district, 'Unknown') as label, COUNT(*) as count
          FROM verification_requests
          GROUP BY COALESCE(district, 'Unknown')
          ORDER BY count DESC
          LIMIT 8
        `
        )
        .all(),
      identityTypes: db
        .prepare(
          `
          SELECT COALESCE(identityType, 'Unknown') as label, COUNT(*) as count
          FROM verification_requests
          GROUP BY COALESCE(identityType, 'Unknown')
          ORDER BY count DESC
        `
        )
        .all(),
      riskPatterns: db
        .prepare(
          `
          SELECT code, severity, COUNT(*) as count
          FROM risk_flags
          WHERE status = 'open'
          GROUP BY code, severity
          ORDER BY count DESC
          LIMIT 10
        `
        )
        .all(),
    };

    const riskItems = [
      {
        id: 'verification-risk',
        label: 'Open verification risk flags',
        severity:
          verificationSummary.openRiskFlags > 10
            ? 'high'
            : verificationSummary.openRiskFlags > 0
              ? 'medium'
              : 'low',
        count: verificationSummary.openRiskFlags,
        action: 'Review verification center',
      },
      {
        id: 'login-alerts',
        label: 'Pending login approvals',
        severity: pendingAlerts > 0 ? 'high' : 'low',
        count: pendingAlerts,
        action: 'Review security queue',
      },
      {
        id: 'failed-transactions',
        label: 'Failed transactions in 24h',
        severity: failedTransactions24h > 5 ? 'high' : failedTransactions24h > 0 ? 'medium' : 'low',
        count: failedTransactions24h,
        action: 'Inspect payment feed',
      },
      {
        id: 'open-tickets',
        label: 'Open support tickets',
        severity: openTickets > 10 ? 'high' : openTickets > 0 ? 'medium' : 'low',
        count: openTickets,
        action: 'Respond in support center',
      },
      {
        id: 'failed-emails',
        label: 'Failed emails in 24h',
        severity: failedEmails24h > 0 ? 'medium' : 'low',
        count: failedEmails24h,
        action: 'Check email audit',
      },
      {
        id: 'maintenance',
        label: 'Maintenance mode',
        severity: config.maintenanceMode ? 'high' : 'low',
        count: config.maintenanceMode ? 1 : 0,
        action: 'Review system settings',
      },
    ];

    const controlCenter = {
      generatedAt: new Date().toISOString(),
      totals: {
        users: scalar('SELECT COUNT(*) as value FROM users'),
        traders: scalar("SELECT COUNT(*) as value FROM users WHERE role = 'trader'"),
        customers: scalar("SELECT COUNT(*) as value FROM users WHERE role = 'customer'"),
        products: scalar('SELECT COUNT(*) as value FROM products'),
        transactions: scalar('SELECT COUNT(*) as value FROM transactions'),
        completedVolume: scalar(
          "SELECT COALESCE(SUM(amount), 0) as value FROM transactions WHERE status = 'completed'"
        ),
        feeRevenue30d: thirtyDayFeeRevenue,
        projectedMonthlyRevenue: thirtyDayFeeRevenue + activeSubscriptionMrr,
        activeSubscriptionMrr,
        walletBalance: scalar('SELECT COALESCE(SUM(walletBalance), 0) as value FROM users'),
        suspendedUsers,
      },
      today: {
        transactions: scalar(
          "SELECT COUNT(*) as value FROM transactions WHERE DATE(createdAt) = DATE('now')"
        ),
        volume: scalar(
          "SELECT COALESCE(SUM(amount), 0) as value FROM transactions WHERE DATE(createdAt) = DATE('now')"
        ),
        revenue: scalar(
          "SELECT COALESCE(SUM(feeAmount), 0) as value FROM transaction_fees WHERE DATE(createdAt) = DATE('now')"
        ),
        newUsers: scalar("SELECT COUNT(*) as value FROM users WHERE DATE(createdAt) = DATE('now')"),
      },
      queues: {
        pendingAlerts,
        openTickets,
        pendingPurchases: scalar(
          "SELECT COUNT(*) as value FROM purchases WHERE status IN ('pending', 'submitted')"
        ),
        pendingDeliveries: scalar(
          "SELECT COUNT(*) as value FROM deliveries WHERE status IN ('pending', 'assigned', 'in_transit')"
        ),
        pendingVerifications: verificationSummary.pending,
      },
      verification: verificationSummary,
      research: traderResearch,
      dailyActivity,
      revenue: {
        streams: revenueStreams,
        feeRevenueByType,
        subscriptions: {
          active: Number(subscriptionStats?.activeSubscriptions || 0),
          mrr: activeSubscriptionMrr,
          averagePlanPrice: Number(subscriptionStats?.averagePlanPrice || 0),
        },
        paymentPipeline,
        agentCommissions: agentCommissionStats || { payable: 0, paid: 0, platformNet: 0, count: 0 },
        ledgerTotals,
        revenueAccounts,
      },
      roleDistribution,
      statusDistribution,
      riskItems,
      recentLogs: db
        .prepare(
          `
        SELECT id, message, level, source, createdAt
        FROM system_logs
        ORDER BY createdAt DESC
        LIMIT 8
      `
        )
        .all(),
    };

    res.json({ success: true, controlCenter });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system health metrics
app.get('/api/admin/health/check', requireRole(['admin']), (_req: any, res) => {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const config = getConfig();

    // Database check
    const dbCheck = db.prepare('SELECT 1').get() ? 'healthy' : 'unhealthy';

    // Get transaction volume (last hour)
    const lastHourTransactions = db
      .prepare(
        `
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM transactions
      WHERE createdAt > datetime('now', '-1 hour')
    `
      )
      .get() as any;

    // Get recent active users (last 24 hours)
    const recentActiveUsers = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM system_logs
      WHERE level = 'info' AND source = 'auth' AND createdAt > datetime('now', '-24 hours')
    `
      )
      .get() as any;

    // Email delivery stats
    const emailStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM email_logs WHERE createdAt > datetime('now', '-24 hours')
    `
      )
      .get() as any;

    res.json({
      success: true,
      health: {
        status: config.maintenanceMode ? 'maintenance' : 'operational',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        database: {
          status: dbCheck,
          responseTime: 'fast',
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        transactions: {
          lastHourCount: lastHourTransactions?.count || 0,
          lastHourVolume: lastHourTransactions?.total || 0,
        },
        users: {
          recentActive: recentActiveUsers?.count || 0,
        },
        email: {
          totalSent: emailStats?.sent || 0,
          totalFailed: emailStats?.failed || 0,
          successRate:
            emailStats?.total > 0
              ? Math.round(((emailStats.sent || 0) / emailStats.total) * 100)
              : 100,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test SMTP connectivity
app.post('/api/admin/smtp/test', requireRole(['admin']), async (req: any, res): Promise<any> => {
  try {
    if (!SMTP_USER || !SMTP_PASS || !SMTP_HOST) {
      return res.status(400).json({
        success: false,
        error: 'SMTP is not configured',
        details: 'Please set SMTP_USER, SMTP_PASS, and SMTP_HOST in environment variables',
      });
    }

    const testEmail = req.body.testEmail || req.user.email;
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid test email is required',
      });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #1f2937; background: #f9fafb;">
        <div style="background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #ea580c; margin: 0 0 16px 0;">SMTP Test Email</h1>
          <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
            This is a test email from your ESOKO Nexus admin portal to verify SMTP connectivity is working correctly.
          </p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px; color: #0284c7; font-weight: 500;">
              ✅ SMTP is configured and working!
            </p>
          </div>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            Timestamp: ${new Date().toISOString()}<br>
            Test Email: ${testEmail}
          </p>
        </div>
      </div>
    `;

    const startTime = Date.now();
    await sendAppEmail({
      from: SMTP_FROM,
      to: testEmail,
      subject: '✅ ESOKO Nexus SMTP Test - Connection Successful',
      html,
      text: 'This is a test email from ESOKO Nexus admin portal. SMTP is working correctly.',
    });
    const duration = Date.now() - startTime;

    logSystem(
      `SMTP test email sent successfully to ${testEmail}`,
      'info',
      'smtp-test',
      req.user.id
    );

    res.json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        from: SMTP_FROM,
        to: testEmail,
        responseTime: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('SMTP test failed:', error);
    logSystem(`SMTP test failed: ${error.message}`, 'error', 'smtp-test', req.user.id);

    res.status(500).json({
      success: false,
      error: 'SMTP test failed',
      details: error.message || error,
      suggestions: [
        'Check SMTP credentials in environment variables',
        'Verify SMTP host and port are correct',
        'Ensure firewall allows outbound SMTP connections',
        'Check email service provider settings',
      ],
    });
  }
});

// Get pending login alerts for admin dashboard
app.get('/api/admin/login-alerts/pending', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);

    const alerts = db
      .prepare(
        `
      SELECT 
        la.id,
        la.userId,
        la.status,
        la.expiresAt,
        la.ipAddress,
        la.userAgent,
        la.location,
        la.role,
        la.createdAt,
        u.email,
        u.name,
        u.phone,
        u.walletBalance
      FROM login_alerts la
      JOIN users u ON la.userId = u.id
      WHERE la.status = 'pending' AND la.expiresAt > CURRENT_TIMESTAMP
      ORDER BY la.createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset) as any[];

    const total =
      (
        db
          .prepare(
            `
      SELECT COUNT(*) as count
      FROM login_alerts
      WHERE status = 'pending' AND expiresAt > CURRENT_TIMESTAMP
    `
          )
          .get() as any
      )?.count || 0;

    res.json({
      success: true,
      alerts,
      pagination: { limit, offset, total },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manually confirm or deny login alert (admin action)
app.post('/api/admin/login-alerts/:id/action', requireRole(['admin']), (req: any, res): any => {
  try {
    const alertId = req.params.id;
    const action = String(req.body.action || '').toLowerCase();

    if (!['confirm', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Action must be confirm or deny' });
    }

    const alert = db.prepare('SELECT * FROM login_alerts WHERE id = ?').get(alertId) as any;
    if (!alert) {
      return res.status(404).json({ error: 'Login alert not found' });
    }

    const status = action === 'confirm' ? 'confirmed' : 'denied';
    db.prepare(
      `
      UPDATE login_alerts
      SET status = ?, decisionAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(status, alertId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(alert.userId) as any;
    recordAdminAction(req.user.id, `${action}_login_alert`, 'login_alert', alertId, {
      userId: alert.userId,
      reason: req.body.reason,
    });

    res.json({
      success: true,
      message: `Login alert ${status} by admin`,
      alert: { id: alertId, status },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/revenue/reconcile', requireRole(['admin']), (req: any, res): any => {
  try {
    const candidates = db
      .prepare(
        `
        SELECT
          t.id,
          t.userId,
          t.traderId,
          t.type,
          COALESCE(t.feeAmount, 0) as feeAmount,
          COALESCE(tf.existingFees, 0) as existingFees
        FROM transactions t
        LEFT JOIN (
          SELECT transactionId, COUNT(*) as existingFees
          FROM transaction_fees
          GROUP BY transactionId
        ) tf ON tf.transactionId = t.id
        WHERE COALESCE(t.feeAmount, 0) > 0
          AND COALESCE(tf.existingFees, 0) = 0
        ORDER BY t.createdAt ASC
      `
      )
      .all() as any[];

    let backfilled = 0;
    let totalFees = 0;
    db.transaction(() => {
      for (const tx of candidates) {
        const feeAmount = Number(tx.feeAmount || 0);
        if (feeAmount <= 0) continue;
        recordTransactionFee(
          tx.id,
          tx.traderId || tx.userId,
          inferFeeTypeFromTransaction(tx.type),
          feeAmount,
          null
        );
        backfilled += 1;
        totalFees += feeAmount;
      }
    })();

    recordAdminAction(req.user.id, 'reconcile_revenue_fees', 'revenue', 'transaction_fees', {
      backfilled,
      totalFees,
    });

    res.json({
      success: true,
      backfilled,
      totalFees,
      message:
        backfilled > 0
          ? 'Missing transaction fee records were backfilled.'
          : 'Revenue fee records are already reconciled.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual refund endpoint for transactions
app.post('/api/admin/transactions/:id/refund', requireRole(['admin']), (req: any, res): any => {
  try {
    const transactionId = req.params.id;
    const reason = String(req.body.reason || 'Admin refund').trim();
    const idemKey = idempotency.requireKey(req, res);
    if (idemKey === null) return;
    const existingResponse = idempotency.getResponse(req.user.id, idemKey, req.originalUrl);
    if (existingResponse.found) {
      return res.status(existingResponse.statusCode).json(existingResponse.response);
    }

    const transaction = db
      .prepare('SELECT * FROM transactions WHERE id = ?')
      .get(transactionId) as any;
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'refunded') {
      return res.status(400).json({ error: 'Transaction already refunded' });
    }

    let refundId = '';
    db.transaction(() => {
      // Update original transaction
      db.prepare(
        `
        UPDATE transactions
        SET status = 'refunded', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(transactionId);

      // Create refund record
      refundId = uuidv4();
      db.prepare(
        `
        INSERT INTO transactions (
          id, userId, senderId, recipientId, amount, type, status, 
          description, reference, transactionCode, createdAt, updatedAt, timestamp
        ) VALUES (?, ?, ?, ?, ?, 'refund', 'completed', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      ).run(
        refundId,
        transaction.userId,
        transaction.recipientId || null,
        transaction.senderId || null,
        transaction.amount,
        `Refund: ${reason}`,
        transactionId,
        txCode('REF')
      );

      // Refund user wallet
      db.prepare(
        `
        UPDATE users SET walletBalance = walletBalance + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
      `
      ).run(transaction.amount, transaction.userId);

      // Record wallet transaction
      db.prepare(
        `
        INSERT INTO wallet_transactions (id, userId, type, amount, description, status, createdAt)
        VALUES (?, ?, 'refund', ?, ?, 'completed', CURRENT_TIMESTAMP)
      `
      ).run(uuidv4(), transaction.userId, transaction.amount, reason);

      recordWalletLiabilityChange({
        transactionId: refundId,
        userId: transaction.userId,
        amountDelta: transaction.amount,
        description: `Refund credited to wallet: ${reason}`,
        metadata: { adminId: req.user.id, originalTransactionId: transactionId },
      });

      if (Number(transaction.feeAmount || 0) > 0) {
        recordLedgerEntry({
          transactionId: refundId,
          accountType: 'revenue',
          accountId: 'platform_revenue',
          direction: 'debit',
          amount: Number(transaction.feeAmount || 0),
          description: `Fee revenue reversed for refund: ${reason}`,
          metadata: { adminId: req.user.id, originalTransactionId: transactionId },
        });
        adjustRevenueAccount('platform_revenue', -Number(transaction.feeAmount || 0));
      }
    })();

    recordAdminAction(req.user.id, 'refund_transaction', 'transaction', transactionId, {
      reason,
      refundId,
    });

    const result = {
      success: true,
      message: 'Transaction refunded successfully',
      refundId,
    };
    idempotency.saveResponse(req.user.id, idemKey, req.originalUrl, result);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track failed login attempts for security
app.get('/api/security/failed-logins', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const timeRange = req.query.timeRange || '24h'; // 24h, 7d, 30d

    let timeCondition = "createdAt > datetime('now', '-1 day')";
    if (timeRange === '7d') {
      timeCondition = "createdAt > datetime('now', '-7 days')";
    } else if (timeRange === '30d') {
      timeCondition = "createdAt > datetime('now', '-30 days')";
    }

    const failedLogins = db
      .prepare(
        `
      SELECT 
        message,
        level,
        userId,
        createdAt,
        COUNT(*) as attemptCount
      FROM system_logs
      WHERE level = 'warn' AND message LIKE '%login%' AND ${timeCondition}
      GROUP BY DATE(createdAt), userId
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset) as any[];

    // Get suspicious accounts (multiple failed attempts)
    const suspiciousAccounts = db
      .prepare(
        `
      SELECT 
        userId,
        COUNT(*) as failedAttempts,
        MAX(createdAt) as lastAttempt
      FROM system_logs
      WHERE level = 'warn' AND message LIKE '%login%' AND ${timeCondition}
      GROUP BY userId
      HAVING COUNT(*) > 5
      ORDER BY COUNT(*) DESC
    `
      )
      .all() as any[];

    res.json({
      success: true,
      failedLogins,
      suspiciousAccounts,
      timeRange,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get real-time transaction feed for admin
app.get('/api/admin/transactions/feed', requireRole(['admin']), (req: any, res): any => {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const search = String(req.query.search || '').trim();
    const status = req.query.status ? String(req.query.status).trim() : null;
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;
    const limit_final = Math.min(limit, 100); // Max 100 for feed

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        '(u.name LIKE ? OR u.email LIKE ? OR sender.name LIKE ? OR recipient.name LIKE ? OR trader.name LIKE ? OR t.description LIKE ? OR t.id LIKE ? OR t.transactionCode LIKE ? OR t.reference LIKE ?)'
      );
      params.push(term, term, term, term, term, term, term, term, term);
    }

    if (from) {
      conditions.push('DATE(t.createdAt) >= DATE(?)');
      params.push(from);
    }

    if (to) {
      conditions.push('DATE(t.createdAt) <= DATE(?)');
      params.push(to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const transactions = db
      .prepare(
        `
      SELECT 
        t.id,
        t.userId,
        t.senderId,
        t.recipientId,
        t.customerId,
        t.traderId,
        t.type,
        t.amount,
        COALESCE(t.feeAmount, fee_summary.feeTotal, 0) as feeAmount,
        COALESCE(t.netAmount, t.amount - COALESCE(t.feeAmount, fee_summary.feeTotal, 0)) as netAmount,
        t.amount as grossAmount,
        t.status,
        t.description,
        t.transactionCode,
        t.reference,
        t.metadata,
        t.createdAt,
        u.name,
        u.email,
        u.role,
        sender.name as senderName,
        sender.email as senderEmail,
        recipient.name as recipientName,
        recipient.email as recipientEmail,
        trader.name as traderName,
        trader.email as traderEmail,
        fee_summary.feeEntries,
        fee_summary.feeTotal,
        fee_summary.feeStatus
      FROM transactions t
      JOIN users u ON t.userId = u.id
      LEFT JOIN users sender ON sender.id = t.senderId
      LEFT JOIN users recipient ON recipient.id = t.recipientId
      LEFT JOIN users trader ON trader.id = t.traderId
      LEFT JOIN (
        SELECT
          transactionId,
          COUNT(*) as feeEntries,
          COALESCE(SUM(feeAmount), 0) as feeTotal,
          GROUP_CONCAT(DISTINCT status) as feeStatus
        FROM transaction_fees
        GROUP BY transactionId
      ) fee_summary ON fee_summary.transactionId = t.id
      ${where}
      ORDER BY t.createdAt DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(...params, limit_final, offset) as any[];

    const totalResult = db
      .prepare(
        `SELECT COUNT(*) as total
         FROM transactions t
         JOIN users u ON t.userId = u.id
         LEFT JOIN users sender ON sender.id = t.senderId
         LEFT JOIN users recipient ON recipient.id = t.recipientId
         LEFT JOIN users trader ON trader.id = t.traderId
         ${where}`
      )
      .get(...params) as any;

    res.json({
      success: true,
      transactions,
      total: totalResult?.total || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dashboard quick stats
app.get('/api/admin/dashboard/quick-stats', requireRole(['admin']), (_req: any, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const stats = {
      todayTransactions:
        (
          db
            .prepare(
              `
        SELECT COUNT(*) as count FROM transactions WHERE DATE(createdAt) = ?
      `
            )
            .get(today) as any
        )?.count || 0,
      todayRevenue:
        (
          db
            .prepare(
              `
        SELECT COALESCE(SUM(feeAmount), 0) as total FROM transaction_fees WHERE DATE(createdAt) = ?
      `
            )
            .get(today) as any
        )?.total || 0,
      pendingLoginAlerts:
        (
          db
            .prepare(
              `
        SELECT COUNT(*) as count FROM login_alerts WHERE status = 'pending' AND expiresAt > CURRENT_TIMESTAMP
      `
            )
            .get() as any
        )?.count || 0,
      openTickets:
        (
          db
            .prepare(
              `
        SELECT COUNT(*) as count FROM tickets WHERE status IN ('open', 'in_progress')
      `
            )
            .get() as any
        )?.count || 0,
      newUsersToday:
        (
          db
            .prepare(
              `
        SELECT COUNT(*) as count FROM users WHERE DATE(createdAt) = ?
      `
            )
            .get(today) as any
        )?.count || 0,
      failedTransactions:
        (
          db
            .prepare(
              `
        SELECT COUNT(*) as count FROM transactions WHERE status = 'failed' AND DATE(createdAt) = ?
      `
            )
            .get(today) as any
        )?.count || 0,
    };

    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    hint: 'The backend is running, but this /api route does not exist.',
  });
});

try {
  bootstrapInitialAdmin();
} catch (error: any) {
  console.error('Bootstrap admin failed:', error);
  logSystem(`Bootstrap admin failed: ${error.message || error}`, 'error', 'auth');
}

// Error handling middleware - must come after all other middleware and routes
app.use(errorHandler);

async function startServer() {
  let vite: any | null = null;
  const distDir = path.join(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production';

  async function findAvailablePort(startPort: number, maxAttempts = 20) {
    for (let candidate = startPort; candidate < startPort + maxAttempts; candidate += 1) {
      const portIsFree = await new Promise<boolean>((resolve) => {
        const tester = net.createServer();
        tester.once('error', () => resolve(false));
        tester.once('listening', () => {
          tester.close(() => resolve(true));
        });
        tester.listen(candidate, '127.0.0.1');
      });
      if (portIsFree) {
        return candidate;
      }
    }
    return new Promise<number>((resolve, reject) => {
      const tester = net.createServer();
      tester.once('error', reject);
      tester.listen(0, '127.0.0.1', () => {
        const address = tester.address();
        if (!address || typeof address === 'string') {
          tester.close(() => reject(new Error('Unable to determine free port')));
          return;
        }
        const freePort = address.port;
        tester.close(() => resolve(freePort));
      });
    });
  }

  const listenPort = await findAvailablePort(port);
  if (listenPort !== port) {
    console.warn(`Port ${port} is already in use; falling back to ${listenPort}.`);
  }

  if (!isProduction) {
    const desiredHmrPort = Number(process.env.HMR_PORT || (port === 5173 ? 24678 : port + 20000));
    const hmrPort = await findAvailablePort(desiredHmrPort);
    if (hmrPort !== desiredHmrPort) {
      console.warn(`HMR port ${desiredHmrPort} is already in use; falling back to ${hmrPort}.`);
    }
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: hmrPort } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distDir, {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
          }
        },
      })
    );
  }

  app.use(async (req, res) => {
    const htmlPath = isProduction
      ? path.join(distDir, 'index.html')
      : path.join(__dirname, 'index.html');
    try {
      let html = fs.readFileSync(htmlPath, 'utf-8');
      if (vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }
      res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }).end(html);
    } catch (error: any) {
      res.status(500).send(error.message || 'Unable to load app');
    }
  });

  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH;

  if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    try {
      const sslOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      activeServer = https.createServer(sslOptions, app).listen(listenPort, () => {
        console.log(`🔒 HTTPS Server running at https://localhost:${listenPort}`);
        console.log(`SQLite database: ${path.join(process.cwd(), 'data', 'esoko.db')}`);
        console.log('Self-contained mode: Firebase and Firestore are not used.');
      });
    } catch (error) {
      console.error('Failed to start HTTPS server:', error);
      console.log('Falling back to HTTP...');
      activeServer = app.listen(listenPort, () => {
        console.log(`⚠️  HTTP Server running at http://localhost:${listenPort} (HTTPS failed)`);
        console.log(`SQLite database: ${path.join(process.cwd(), 'data', 'esoko.db')}`);
        console.log('Self-contained mode: Firebase and Firestore are not used.');
      });
    }
  } else {
    activeServer = app.listen(listenPort, () => {
      console.log(`Server running at http://localhost:${listenPort}`);
      console.log(`SQLite database: ${path.join(process.cwd(), 'data', 'esoko.db')}`);
      console.log('Self-contained mode: Firebase and Firestore are not used.');
    });
  }

  startLoanPaymentReminderScheduler();
}

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);

  if (loanReminderInterval) {
    clearInterval(loanReminderInterval);
    loanReminderInterval = null;
  }

  for (const client of liveSyncClients.values()) {
    try {
      client.end();
    } catch {}
  }
  liveSyncClients.clear();

  const finish = () => {
    try {
      db.close();
    } catch (error) {
      console.error('Failed to close database:', error);
    }
    process.exit(0);
  };

  if (activeServer) {
    activeServer.close(finish);
    setTimeout(() => {
      console.error('Graceful shutdown timed out; forcing exit');
      finish();
    }, 10000).unref();
  } else {
    finish();
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
