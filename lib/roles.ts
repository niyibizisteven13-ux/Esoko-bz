export type Role = 'customer' | 'trader' | 'agent' | 'manager' | 'admin';

export function normalizeRole(role: any): Role {
  const allowed: Role[] = ['customer', 'trader', 'agent', 'manager', 'admin'];
  return allowed.includes(role) ? role : 'customer';
}
