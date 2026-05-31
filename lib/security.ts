import crypto from 'crypto';

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyPassword(password: string, stored: string) {
  if (!stored) return false;
  if (!stored.startsWith('scrypt:')) {
    return stored === password;
  }

  const [, salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');
  return original.length === candidate.length && crypto.timingSafeEqual(original, candidate);
}
