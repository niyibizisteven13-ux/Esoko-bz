import { apiGet, apiPost, apiPut, apiDelete, authHeaders } from './apiClient';

export interface TransactionItem {
  id: string;
  userId: string;
  type: string;
  amount: number;
  fee?: number;
  category?: string;
  status?: string;
  reference?: string;
  metadata?: any;
  createdAt?: string;
  [key: string]: any;
}

export interface TransactionQueryParams {
  userId?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | boolean | undefined;
}

export async function getTransactions(params?: TransactionQueryParams) {
  return apiGet<{ transactions: TransactionItem[] }>('/api/transactions', {
    params,
    headers: authHeaders(),
  });
}

export async function getTransaction(transactionId: string) {
  return apiGet<{ transaction: TransactionItem }>(`/api/transactions/${transactionId}`, {
    headers: authHeaders(),
  });
}

export async function createTransaction(payload: Partial<TransactionItem>) {
  return apiPost('/api/transactions', payload, {
    headers: authHeaders(),
  });
}

export async function updateTransaction(transactionId: string, payload: Partial<TransactionItem>) {
  return apiPut(`/api/transactions/${transactionId}`, payload, {
    headers: authHeaders(),
  });
}

export async function deleteTransaction(transactionId: string) {
  return apiDelete(`/api/transactions/${transactionId}`, undefined, {
    headers: authHeaders(),
  });
}
