import { apiGet, apiPut, apiPost, apiDelete, getAuthToken } from './apiClient';
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  walletBalance?: number;
  appNumber?: string;
  verificationStatus?: string;
  tier?: string;
  upgradedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function getUser(userId: string) {
  const headers = await getAuthHeaders();
  return apiGet<{ user: UserProfile }>(`/api/users/${userId}`, { headers });
}

export async function updateUser(userId: string, data: Partial<UserProfile>) {
  const headers = await getAuthHeaders();
  return apiPut<{ user: UserProfile }>(`/api/users/${userId}`, { data }, { headers });
}

export async function getAllUsers(options?: {
  limit?: number;
  offset?: number;
  role?: string;
  status?: string;
}) {
  const headers = await getAuthHeaders();
  const params: any = {};
  if (options?.limit) params.limit = options.limit;
  if (options?.offset) params.offset = options.offset;
  if (options?.role) params.role = options.role;
  if (options?.status) params.status = options.status;
  return apiGet<{ users: UserProfile[] }>('/api/users', { params, headers });
}

export async function searchUsers(query: string) {
  const headers = await getAuthHeaders();
  return apiGet<{ users: UserProfile[] }>('/api/users/search', {
    params: { query },
    headers,
  });
}

export async function deleteUser(userId: string) {
  const headers = await getAuthHeaders();
  return apiDelete(`/api/admin/users/${userId}`, undefined, { headers });
}
