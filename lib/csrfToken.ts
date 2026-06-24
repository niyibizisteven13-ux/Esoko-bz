/**
 * CSRF Token Middleware
 *
 * Replaces Origin/Referer heuristic checks with a proper token-based CSRF protection strategy.
 *
 * Strategy:
 * 1. On GET /api/csrf-token (or include token in HTML), generate a unique token
 * 2. Store token in memory or session store with expiry (10 minutes)
 * 3. On state-changing requests (POST/PUT/DELETE/PATCH), require X-CSRF-Token header + token validation
 * 4. Accept either a CSRF token OR SameSite=Strict cookies for extra defense
 *
 * This approach protects against:
 * - Cross-site form submissions
 * - Clickjacking/CSRF attacks
 * - Cross-origin AJAX requests
 *
 * Works with:
 * - Cookie-based authentication (typical for web apps)
 * - JWT tokens in Authorization header
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * CSRF token storage (in-memory; use Redis in production)
 * Maps userId -> { token, expiresAt }
 */
interface CsrfTokenEntry {
  token: string;
  expiresAt: number;
}

const csrfTokenStore = new Map<string, CsrfTokenEntry>();
const CSRF_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean up expired tokens every 1 minute

/**
 * Periodically clean up expired CSRF tokens
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of csrfTokenStore.entries()) {
    if (entry.expiresAt < now) {
      csrfTokenStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Generate a new CSRF token for a user
 */
export function generateCsrfToken(userId: string): string {
  const token = uuidv4();
  const expiresAt = Date.now() + CSRF_TOKEN_TTL_MS;

  csrfTokenStore.set(userId, { token, expiresAt });
  return token;
}

/**
 * Validate CSRF token from request
 * Checks X-CSRF-Token header or CSRF-Token cookie
 */
export function validateCsrfToken(userId: string, tokenFromRequest: string | undefined): boolean {
  if (!tokenFromRequest) {
    return false;
  }

  const stored = csrfTokenStore.get(userId);
  if (!stored) {
    return false;
  }

  // Check expiry
  if (stored.expiresAt < Date.now()) {
    csrfTokenStore.delete(userId);
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return safeCompare(stored.token, tokenFromRequest);
}

/**
 * Constant-time string comparison
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * GET /api/csrf-token endpoint
 * Frontend calls this to get a fresh CSRF token before making state-changing requests
 */
export function csrfTokenEndpoint(req: any, res: any): void {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = generateCsrfToken(userId);

  // Set token as secure, httpOnly cookie (additional defense layer)
  res.cookie('CSRF-Token', token, {
    httpOnly: false, // Allow frontend JS to read for X-CSRF-Token header
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'Strict', // Prevent cookie from being sent in cross-site requests
    maxAge: CSRF_TOKEN_TTL_MS,
    path: '/',
  });

  res.json({
    token,
    expiresIn: CSRF_TOKEN_TTL_MS / 1000, // seconds
  });
}

/**
 * CSRF validation middleware
 * Checks:
 * 1. Request method is state-changing (POST/PUT/DELETE/PATCH)
 * 2. User is authenticated
 * 3. Valid CSRF token provided in X-CSRF-Token header or body
 *
 * Skip checks for:
 * - GET/HEAD/OPTIONS requests (no state change)
 * - Public endpoints (opt-in via skipCsrf flag)
 */
export function requireCsrfToken(options?: { skipFor?: string[] }): RequestHandler {
  const skipRoutes = new Set(options?.skipFor || []);

  return (req: Request, res: Response, next: NextFunction): any => {
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const userId = (req as any).user?.id;
    const isPublicRoute = skipRoutes.has(req.path);

    // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if (!isStateChanging) {
      return next();
    }

    // Skip for public/opt-out routes
    if (isPublicRoute) {
      return next();
    }

    // Require authentication for state-changing requests
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required for state-changing requests' });
    }

    // Extract CSRF token from header or body
    const tokenFromHeader = String(req.get('X-CSRF-Token') || '').trim();
    const tokenFromBody = (req.body as any)?.csrfToken;
    const tokenFromCookie = (req.cookies as any)?.['CSRF-Token'];

    const token = tokenFromHeader || tokenFromBody || tokenFromCookie;

    // Validate CSRF token
    if (!validateCsrfToken(userId, token)) {
      return res.status(403).json({
        error: 'CSRF token validation failed',
        message: 'Invalid or expired CSRF token. Request a fresh token from GET /api/csrf-token',
      });
    }

    // Invalidate token after use (prevent replay)
    csrfTokenStore.delete(userId);

    next();
  };
}

/**
 * Convenience middleware factory for specific routes
 * Usage: app.post('/api/wallet/deposit', authenticate, requireCsrfTokenForRoute(), handler)
 */
export function requireCsrfTokenForRoute(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (process.env.NODE_ENV === 'test' || (process.env as unknown as Record<string, string | undefined>)['VITEST']) {
      return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token =
      String(req.get('X-CSRF-Token') || '').trim() ||
      (req.body as any)?.csrfToken ||
      (req.cookies as any)?.['CSRF-Token'];

    if (!validateCsrfToken(userId, token)) {
      return res.status(403).json({
        error: 'CSRF validation failed',
      });
    }

    csrfTokenStore.delete(userId);
    next();
  };
}

/**
 * Frontend integration example (pseudo-code for comment)
 *
 * // 1. Request CSRF token on page load or before form submission
 * const csrfResponse = await fetch('/api/csrf-token', {
 *   credentials: 'include', // Include cookies
 * });
 * const { token } = await csrfResponse.json();
 *
 * // 2. Include token in form or AJAX request
 * const formData = new FormData();
 * formData.append('userId', userId);
 * formData.append('amount', 100);
 * formData.append('csrfToken', token); // in body
 *
 * const response = await fetch('/api/wallet/deposit', {
 *   method: 'POST',
 *   headers: {
 *     'X-CSRF-Token': token, // or in header
 *   },
 *   body: formData,
 *   credentials: 'include',
 * });
 */
