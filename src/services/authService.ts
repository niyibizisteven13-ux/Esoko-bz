import { apiGet, apiPost } from './apiClient';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: string;
  surveyResponses?: Array<{ questionId: string; response: unknown }>;
}

export interface AuthResponse {
  token: string;
  user: any;
}

export async function login(payload: LoginPayload) {
  const response = await apiPost<AuthResponse>('/api/auth/login', payload);
  return response;
}

export async function register(payload: RegisterPayload) {
  const response = await apiPost<AuthResponse>('/api/auth/register', payload);
  return response;
}

export async function logout() {
  // Clear user-specific cached data
  localStorage.removeItem('current_user_id');
  localStorage.removeItem('user_cache');

  // Clear trial-related flags that are user-specific
  Object.keys(localStorage).forEach((key) => {
    if (key.includes('team_trial_used_') || key.includes('accounting_trial_used_')) {
      localStorage.removeItem(key);
    }
  });

  return apiPost('/api/auth/logout');
}

export async function getCurrentUser() {
  return apiGet<{ user: any }>('/api/me');
}

export async function refreshSession() {
  return apiPost<{ user: any; token?: string }>('/api/auth/refresh');
}

export async function requestPasswordReset(email: string) {
  return apiPost('/api/auth/password-reset', { email });
}

export async function verifyResetToken(token: string, password: string) {
  return apiPost('/api/auth/verify-reset-token', { token, password });
}
