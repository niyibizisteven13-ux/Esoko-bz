export type Role = 'customer' | 'trader' | 'agent' | 'manager' | 'admin' | 'branch_manager' | 'staff';

export function normalizeRole(role: any): Role {
  const allowed: Role[] = ['customer', 'trader', 'agent', 'manager', 'admin', 'branch_manager', 'staff'];
  return allowed.includes(role) ? role : 'customer';
}
