import type { Request, RequestHandler } from 'express';

const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface OriginGuardOptions {
  isProduction: boolean;
  frontendUrls: string[];
  appUrl?: string;
  port: number;
  allowDynamicPublicOrigins?: boolean;
}

function devAllowedOrigins(port: number) {
  return new Set([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://10.0.2.2:5173',
    'http://10.0.2.2:3000',
    'capacitor://localhost',
    'capacitor://127.0.0.1',
  ]);
}

function configuredAllowedOrigins(req: Request, options: OriginGuardOptions) {
  const currentOrigin = `${req.protocol}://${req.get('host')}`;
  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim();
  const forwardedHost = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  const forwardedOrigin =
    forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;
  return new Set(
    [
      currentOrigin,
      forwardedOrigin,
      options.appUrl,
      ...options.frontendUrls,
      ...(!options.isProduction ? Array.from(devAllowedOrigins(options.port)) : []),
    ].filter(Boolean) as string[]
  );
}

function isTrustedBrowserOrigin(req: Request, options: OriginGuardOptions) {
  const origin = req.get('origin');
  const referer = req.get('referer');
  const allowedOrigins = configuredAllowedOrigins(req, options);

  const allowDynamicOrigins = !options.isProduction || options.allowDynamicPublicOrigins === true;
  if (origin) return allowedOrigins.has(origin) || (allowDynamicOrigins && isTrustedDynamicPublicOrigin(origin));
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.has(refererOrigin) || (allowDynamicOrigins && isTrustedDynamicPublicOrigin(refererOrigin));
    } catch {
      return false;
    }
  }

  return true;
}

export function isTrustedDynamicPublicOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname.endsWith('.trycloudflare.com') || url.hostname.endsWith('.onrender.com'))
    );
  } catch {
    return false;
  }
}

export function createOriginGuard(options: OriginGuardOptions): RequestHandler {
  return (req, res, next) => {
    if (stateChangingMethods.has(req.method) && !isTrustedBrowserOrigin(req, options)) {
      res.status(403).json({ error: 'Request origin is not allowed' });
      return;
    }
    next();
  };
}
