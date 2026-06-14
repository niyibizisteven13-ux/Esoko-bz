import { apiGet, apiPost, authHeaders } from './apiClient';
import { enqueueOfflineAction, isLikelyNetworkError } from './offlineQueue';

export interface CreditScoreExport {
  schema: string;
  generatedAt: string;
  borrower: {
    id: string;
    name?: string;
    phone?: string;
    tin?: string | null;
    role?: string;
  };
  score: number;
  grade: string;
  currency: 'RWF';
  metrics: Record<string, number>;
  factors: string[];
}

export interface BusinessFailureRisk {
  level: 'healthy' | 'watch' | 'high';
  ratio: number;
  revenue: number;
  personalExpenses: number;
  businessExpenses: number;
  messageRw: string;
}

export async function getBusinessSurvivalSnapshot(traderId: string) {
  return apiGet<{
    success: boolean;
    creditScore: { score: number; grade: string; factors: string[]; bankPayload: CreditScoreExport };
    failureRisk: BusinessFailureRisk;
    groupOrders: any[];
    voiceEntries: any[];
  }>(`/api/business-survival/${encodeURIComponent(traderId)}`, {
    headers: authHeaders(),
  });
}

export async function exportCreditScore(userId: string) {
  return apiGet<{ success: boolean; export: CreditScoreExport }>(
    `/api/credit-score/${encodeURIComponent(userId)}/export`,
    {
      headers: authHeaders(),
    }
  );
}

export async function postVoiceLedgerEntry(payload: {
  traderId: string;
  rawText: string;
  language?: 'rw' | 'en' | 'fr';
}) {
  try {
    return await apiPost('/api/voice-ledger', payload, {
      headers: authHeaders(),
    });
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error;
    const queued = await enqueueOfflineAction({
      path: '/api/voice-ledger',
      method: 'POST',
      body: payload,
      headers: authHeaders(),
    });
    return { success: true, queued, offline: true };
  }
}

export async function runGroupOrderAggregation(threshold = 50) {
  return apiPost<{ success: boolean; activated: any[]; threshold: number }>(
    '/api/group-orders/run',
    { threshold },
    { headers: authHeaders() }
  );
}

export async function getGroupOrders() {
  return apiGet<{ success: boolean; groupOrders: any[] }>('/api/group-orders', {
    headers: authHeaders(),
  });
}
