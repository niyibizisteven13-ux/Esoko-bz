import { describe, expect, it } from 'vitest';
import { resolveVerificationDestination } from '../lib/verificationOtp';

describe('resolveVerificationDestination', () => {
  it('falls back to the authenticated user email when the client omits the destination', () => {
    expect(resolveVerificationDestination(undefined, { email: 'user@example.com' }, 'email')).toBe('user@example.com');
  });

  it('falls back to the authenticated user phone for whatsapp verification', () => {
    expect(resolveVerificationDestination(undefined, { phone: '+250788123456' }, 'whatsapp')).toBe('+250788123456');
  });

  it('prefers the client-supplied destination when present', () => {
    expect(resolveVerificationDestination('alternate@example.com', { email: 'user@example.com' }, 'email')).toBe('alternate@example.com');
  });
});
