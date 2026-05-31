export const ACCOUNT_VERIFIED_STATUSES = new Set([
  'verified',
  'basic_verified',
  'business_verified',
  'sector_verified',
]);

export function isAccountVerified(user: any) {
  return ACCOUNT_VERIFIED_STATUSES.has(String(user?.verificationStatus || '').toLowerCase());
}
