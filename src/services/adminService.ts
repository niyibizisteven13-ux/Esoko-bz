import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function fetchSystemConfig() {
  return apiGet<{ success: boolean; config: any }>('/api/platform/config');
}

export async function updateSystemConfig(data: any) {
  return apiPut<{ success: boolean; config: any }>('/api/platform/config', data);
}

export async function fetchSystemLogs(limit = 50, offset = 0) {
  return apiGet<{ success: boolean; logs: any[] }>('/api/system-logs', {
    params: { limit, offset },
  });
}

export async function logSystemActivity(
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
  source = 'Nexus Admin',
  userId?: string
) {
  return apiPost('/api/system-logs', { message, level, source, userId });
}

export async function searchUsers(term: string) {
  return apiGet<{ success: boolean; users: any[] }>('/api/users/search', {
    params: { query: term },
  });
}

export async function fetchUsers(params: Record<string, any> = {}) {
  return apiGet<{ success: boolean; users: any[] }>('/api/users', { params });
}

export async function fetchUserById(id: string) {
  return apiGet<{ success: boolean; user: any }>(`/api/users/${id}`);
}

export async function fetchAdminUserDetails(id: string) {
  return apiGet<{ success: boolean; user: any }>(`/api/admin/users/${id}`);
}

export async function updateUserById(id: string, data: any) {
  return apiPut<{ success: boolean; user: any }>(`/api/users/${id}`, { data });
}

export async function deleteAdminUser(id: string) {
  return apiDelete<{ success: boolean }>(`/api/admin/users/${id}`);
}

export async function fetchAdminDashboard() {
  return apiGet<{ success: boolean; dashboard: any }>('/api/admin/dashboard');
}

export async function fetchAdminTransactions(limit = 50, offset = 0) {
  return apiGet<{ success: boolean; transactions: any[] }>('/api/admin/transactions', {
    params: { limit, offset },
  });
}

export async function fetchPremiumUsers(limit = 50, offset = 0) {
  return apiGet<{ success: boolean; users: any[] }>('/api/users', {
    params: { tier: 'premium', limit, offset },
  });
}

export async function fetchTraders(limit = 50, offset = 0) {
  return apiGet<{ success: boolean; users: any[] }>('/api/users', {
    params: { role: 'trader', limit, offset },
  });
}

export async function fetchCollectionStats(names: string[]) {
  return apiPost<{ success: boolean; stats: { name: string; count: number }[] }>(
    '/api/admin/collection-stats',
    { names }
  );
}

export async function fetchCollectionDocuments(name: string, limit = 50, offset = 0) {
  return apiGet<{ success: boolean; documents: any[] }>(`/api/admin/collection-docs`, {
    params: { name, limit, offset },
  });
}

export async function fetchUserFees(userId: string) {
  return apiGet<{ success: boolean; fees: any }>(`/api/admin/users/${userId}/fees`);
}

export async function fetchUserAccountDetails(userId: string) {
  return apiGet<{ success: boolean; accountDetails: any }>(
    `/api/admin/users/${userId}/account-details`
  );
}

export async function fetchFeeStats() {
  return apiGet<{ success: boolean; feeStats: any }>('/api/admin/fees/stats');
}

export async function fetchTradersList(limit = 50, offset = 0, status?: string) {
  return apiGet<{ success: boolean; traders: any[]; total: number }>('/api/admin/traders', {
    params: { limit, offset, status },
  });
}

export async function fetchTraderSubscription(traderId: string) {
  return apiGet<{ success: boolean; subscription: any }>(
    `/api/admin/traders/${traderId}/subscription`
  );
}

export async function updateTraderSubscription(
  traderId: string,
  subscriptionId: string,
  autoRenew = false
) {
  return apiPut<{ success: boolean }>(`/api/admin/traders/${traderId}/subscription`, {
    subscriptionId,
    autoRenew,
  });
}

export async function generateTraderActivationKey(
  traderId: string,
  feature: string,
  expiresInDays = 30
) {
  return apiPost<{ success: boolean; activationKey: string; expiresAt: string }>(
    `/api/admin/traders/${traderId}/activation-key`,
    {
      feature,
      expiresInDays,
    }
  );
}

export async function fetchBusinessAnalysts() {
  return apiGet<{ success: boolean; analysts: any[] }>('/api/admin/business-analysts');
}

export async function createBusinessAnalyst(data: {
  userId: string;
  specialization: string;
  experienceYears: number;
  certifications: string[];
}) {
  return apiPost<{ success: boolean; analyst: any }>('/api/admin/business-analysts', data);
}

export async function assignAnalystToTrader(
  traderId: string,
  analystId: string,
  priority: 'low' | 'medium' | 'high',
  requirements: string
) {
  return apiPost<{ success: boolean; assignment: any }>(
    `/api/admin/traders/${traderId}/assign-analyst`,
    {
      analystId,
      priority,
      requirements,
    }
  );
}

export async function fetchAnalystAssignments() {
  return apiGet<{ success: boolean; assignments: any[] }>('/api/admin/analyst-assignments');
}

export async function fetchBusinessModel() {
  return apiGet<{ success: boolean; businessModel: any }>('/api/admin/business-model');
}

export async function fetchPlatformWallet() {
  return apiGet<{ success: boolean; wallet: any; history: any[] }>('/api/admin/platform-wallet');
}

export async function sendPlatformWalletMoney(data: {
  recipientId: string;
  amount: number;
  description: string;
}) {
  return apiPost<{ success: boolean; transactionId: string; wallet: any; message: string }>(
    '/api/admin/platform-wallet/send',
    data
  );
}

export async function fetchLoanPolicy() {
  return apiGet<{ success: boolean; policy: any }>('/api/admin/loan-policy');
}

export async function updateLoanPolicy(data: any) {
  return apiPut<{ success: boolean; policy: any }>('/api/admin/loan-policy', data);
}

export async function fetchLoyaltyPolicy() {
  return apiGet<{ success: boolean; policy: any }>('/api/admin/loyalty-policy');
}

export async function updateLoyaltyPolicy(data: any) {
  return apiPut<{ success: boolean; policy: any }>('/api/admin/loyalty-policy', data);
}

export async function addDynamicFeeRule(data: {
  feeType: string;
  percentage: number;
  fixedAmount: number;
  conditions: any;
}) {
  return apiPut<{ success: boolean }>('/api/admin/business-model/fees', data);
}

export async function updateSubscriptionPricing(
  subscriptionId: string,
  price: number,
  features: any[],
  limits: any
) {
  return apiPut<{ success: boolean }>('/api/admin/business-model/subscriptions', {
    subscriptionId,
    price,
    features,
    limits,
  });
}

export async function fetchSubscriptionPlans() {
  return apiGet<{ success: boolean; subscriptions: any[] }>('/api/admin/subscriptions');
}

export async function createSubscriptionPlan(data: {
  name: string;
  description: string;
  price: number;
  features: string[];
  limits: any;
}) {
  return apiPost<{ success: boolean; subscription: any }>('/api/admin/subscriptions', data);
}

export async function updateSubscriptionPlan(
  subscriptionId: string,
  data: {
    name: string;
    description: string;
    price: number;
    features: string[];
    limits: any;
    is_active: boolean;
  }
) {
  return apiPut<{ success: boolean }>(`/api/admin/subscriptions/${subscriptionId}`, data);
}

export async function deactivateSubscriptionPlan(subscriptionId: string) {
  return apiDelete<{ success: boolean }>(`/api/admin/subscriptions/${subscriptionId}`);
}

export async function fetchTraderAnalytics(traderId: string) {
  return apiGet<{ success: boolean; analytics: any }>(`/api/admin/traders/${traderId}/analytics`);
}

export async function upgradeTraderSubscription(traderId: string, subscriptionId: string) {
  const idempotencyKey = `subscription-${traderId}-${subscriptionId}-${Date.now()}`;
  return apiPost<{
    success: boolean;
    subscription: any;
    transaction: any;
    message: string;
  }>(
    '/api/traders/subscription-upgrade',
    {
      traderId,
      subscriptionId,
      idempotencyKey,
    },
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    }
  );
}

export async function getTraderCurrentSubscription(traderId: string) {
  return apiGet<{ success: boolean; subscription: any }>(
    `/api/traders/${traderId}/current-subscription`
  );
}

export async function getAvailableSubscriptionPlans() {
  return apiGet<{ success: boolean; plans: any[] }>('/api/subscriptions/available');
}
