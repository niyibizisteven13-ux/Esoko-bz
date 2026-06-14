import { apiGet } from './apiClient';
import { authHeaders } from './apiClient';

export interface BusinessAlert {
  type: 'low_stock' | 'low_balance' | 'general';
  message: string;
}

export async function getBusinessAlerts(userId: string) {
  return apiGet<{ success: boolean; alerts: BusinessAlert[] }>(`/api/alerts/${encodeURIComponent(userId)}`, {
    headers: authHeaders(),
  });
}
