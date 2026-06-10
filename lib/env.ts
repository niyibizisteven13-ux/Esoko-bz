import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

type SameSite = 'strict' | 'lax' | 'none';

export interface AppConfig {
  appUrl?: string;
  cookieSameSite: SameSite;
  devJwtSecret?: string;
  frontendUrls: string[];
  isProduction: boolean;
  jwtSecret?: string;
  port: number;
  smtp: {
    from: string;
    host: string;
    pass: string;
    port: number;
    secure: boolean;
    user: string;
  };
  trustProxy: boolean;
  uploadMaxBytes: number;
}

function parseUrls(value: string | undefined, name: string) {
  const urls = (value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      throw new Error(`${name} contains an invalid URL: ${url}`);
    }
  }

  return urls;
}

function parsePositiveNumber(value: string | undefined, fallback: number, name: string) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

export function loadAppConfig(rootDir = process.cwd()): AppConfig {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  const env = process.env as unknown as Record<string, string | undefined>;
  const isProduction = env.NODE_ENV === 'production';
  const smtpPort = parsePositiveNumber(env.SMTP_PORT || env.MAIL_PORT, 465, 'SMTP_PORT');
  const frontendUrls = parseUrls(env.FRONTEND_URLS, 'FRONTEND_URLS');
  const appUrl = env.APP_URL?.trim() || undefined;

  if (appUrl) {
    parseUrls(appUrl, 'APP_URL');
  }

  const jwtSecret = env.JWT_SECRET?.trim() || undefined;
  const devJwtSecret = env.DEV_JWT_SECRET?.trim() || undefined;
  const missing: string[] = [];

  if (isProduction) {
    if (!jwtSecret) missing.push('JWT_SECRET');
  } else if (!jwtSecret && !devJwtSecret) {
    missing.push('DEV_JWT_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  if (isProduction && jwtSecret && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (isProduction && !appUrl) {
    console.warn(
      'WARNING: APP_URL is not set. Public links will be inferred from request host/proxy headers.'
    );
  }

  if (isProduction && frontendUrls.length === 0) {
    console.warn(
      'WARNING: FRONTEND_URLS is not set. Same-origin, Render, and Cloudflare tunnel origins will still be accepted.'
    );
  }

  if (!isProduction && !jwtSecret && devJwtSecret) {
    console.warn('WARNING: Using DEV_JWT_SECRET. Set JWT_SECRET before deploying.');
  }

  const cookieSameSite = (env.COOKIE_SAMESITE || (isProduction ? 'strict' : 'lax')).toLowerCase();
  if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
    throw new Error('COOKIE_SAMESITE must be one of: strict, lax, none');
  }

  if (isProduction && cookieSameSite === 'none' && env.TRUST_PROXY !== '1' && env.TRUST_PROXY !== 'true') {
    console.warn('WARNING: COOKIE_SAMESITE=None usually needs TRUST_PROXY=1 behind a TLS proxy.');
  }

  const smtpUser = env.SMTP_USER || env.SMTP_USERNAME || env.MAIL_USER || env.MAIL_USERNAME || '';
  const smtpPass =
    env.SMTP_PASS || env.SMTP_PASSWORD || env.MAIL_PASS || env.MAIL_PASSWORD || '';
  const smtpHost = env.SMTP_HOST || env.MAIL_HOST || '';
  const smtpFrom = env.SMTP_FROM || env.MAIL_FROM || smtpUser;
  const smtpRequireAuth = env.SMTP_REQUIRE_AUTH !== 'false';
  if (isProduction && (!smtpHost || !smtpFrom || (smtpRequireAuth && (!smtpUser || !smtpPass)))) {
    console.warn(
      'WARNING: SMTP is not fully configured. Set SMTP_HOST, SMTP_FROM, and SMTP credentials, or set SMTP_REQUIRE_AUTH=false for trusted relay.'
    );
  }

  return {
    appUrl,
    cookieSameSite: cookieSameSite as SameSite,
    devJwtSecret,
    frontendUrls,
    isProduction,
    jwtSecret,
    port: parsePositiveNumber(env.PORT, 5173, 'PORT'),
    smtp: {
      from: smtpFrom,
      host: smtpHost || 'smtp.gmail.com',
      pass: smtpPass,
      port: smtpPort,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : smtpPort === 465,
      user: smtpUser,
    },
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    uploadMaxBytes: parsePositiveNumber(env.UPLOAD_MAX_MB, 50, 'UPLOAD_MAX_MB') * 1024 * 1024,
  };
}
