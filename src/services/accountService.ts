import { apiGet, apiPost } from './apiClient';

export async function getAccounts() {
  return apiGet<any>('/api/accounts');
}

export async function createAccountRole(payload: {
  role: 'customer' | 'trader' | 'agent';
  businessName?: string;
  businessCategory?: string;
  businessLocation?: string;
  location?: string;
  tin?: string;
  category?: string;
}) {
  return apiPost<any>('/api/accounts/create-role', payload);
}

export async function submitVerificationDocument(payload: {
  accountId?: string;
  type: string;
  fileUrl: string;
  metadata?: Record<string, any>;
}) {
  return apiPost<any>('/api/verification/documents', payload);
}
