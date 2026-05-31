import jwt from 'jsonwebtoken';
import type Database from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';
import type { Role } from './roles.ts';

interface AuthMiddlewareOptions {
  db: Database.Database;
  jwtSecret: string;
  consumeRefreshToken: (rawRefreshToken: string | undefined, req: Request, res: Response) => any;
  clearAuthCookies: (res: Response) => void;
}

export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const { db, jwtSecret, consumeRefreshToken, clearAuthCookies } = options;

  function authenticate(req: Request, res: Response, next: NextFunction): void {
    const rawAuthHeader = String(
      req.headers.authorization || req.header('x-access-token') || req.header('x-auth-token') || ''
    );
    const headerToken = rawAuthHeader.startsWith('Bearer ')
      ? rawAuthHeader.slice(7)
      : rawAuthHeader;
    const token = headerToken || req.cookies.nexus_auth_token;
    if (!token) {
      const refreshed = consumeRefreshToken(req.cookies.nexus_refresh_token, req, res);
      if (refreshed?.user) {
        (req as any).user = refreshed.user;
        next();
        return;
      }
      res.status(401).json({ error: 'No authorization token' });
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId) as any;
      if (!user) {
        res.status(401).json({ error: 'User no longer exists' });
        return;
      }
      if (user.status === 'suspended') {
        clearAuthCookies(res);
        res.status(403).json({ error: 'Account suspended. Contact support to restore access.' });
        return;
      }
      (req as any).user = user;
      next();
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError') {
        const refreshed = consumeRefreshToken(req.cookies.nexus_refresh_token, req, res);
        if (refreshed?.user) {
          (req as any).user = refreshed.user;
          next();
          return;
        }
      }
      res.status(401).json({ error: 'Invalid token', details: error.message });
    }
  }

  function requireRole(roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      authenticate(req, res, (): void => {
        const user = (req as any).user;
        const teamMembershipId = String(req.cookies?.nexus_team_access || '');
        if (!roles.includes(user.role) && roles.includes('trader') && teamMembershipId) {
          const membership = db
            .prepare('SELECT * FROM team_members WHERE id = ? AND userId = ? AND status = ?')
            .get(teamMembershipId, user.id, 'active') as any;
          if (membership) {
            (req as any).teamAccess = membership;
            (req as any).effectiveTraderId = membership.traderId;
            next();
            return;
          }
        }
        if (!roles.includes(user.role)) {
          res.status(403).json({ error: `${roles.join(' or ')} access required` });
          return;
        }
        next();
      });
    };
  }

  return { authenticate, requireRole };
}
