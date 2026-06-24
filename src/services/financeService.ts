import { apiGet, apiPost } from './apiClient';

export interface Balance {
  balance: number;
  reserved: number;
  totalEarned: number;
}

export interface Transaction {
  id: string;
  from_user_id?: string;
  to_user_id?: string;
  amount: number;
  type: string;
  ref_id?: string;
  memo?: string;
  created_at: string;
}

export interface TransactionHistory {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get trader account balance
 */
export async function getBalance(): Promise<Balance> {
  const response = await apiGet('/api/balance') as any;
  if (!response.success) throw new Error(response.error);
  return response as Balance;
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(limit = 20, offset = 0): Promise<TransactionHistory> {
  const response = await apiGet(`/api/transactions?limit=${limit}&offset=${offset}`) as any;
  if (!response.success) throw new Error(response.error);
  return response as TransactionHistory;
}

/**
 * Check voucher validity
 */
export async function checkVoucher(code: string) {
  return await apiGet(`/api/vouchers/${code}`);
}

/**
 * Redeem voucher
 */
export async function redeemVoucher(code: string, orderId?: string) {
  const response = await apiPost(`/api/vouchers/${code}/redeem`, { order_id: orderId }) as any;
  if (!response.success && response.error) throw new Error(response.error);
  return response;
}

/**
 * Withdraw balance
 */
export async function withdrawBalance(amount: number, method: string) {
  const response = await apiPost('/api/balance/withdraw', { amount, method }) as any;
  if (!response.success) throw new Error(response.error);
  return response;
}
