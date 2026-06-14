import { apiGet, apiPost, apiPut } from './apiClient';
import { authHeaders } from './apiClient';

export interface BulkRequestItem {
  id: string;
  traderId: string;
  itemName: string;
  quantity: number;
  location: string;
  notes: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export async function getBulkRequests(traderId?: string) {
  return apiGet<{ success: boolean; bulkRequests: BulkRequestItem[] }>('/api/bulk-requests', {
    params: traderId ? { traderId } : {},
    headers: authHeaders(),
  });
}

export async function createBulkRequest(payload: {
  itemName: string;
  quantity: number;
  location: string;
  notes?: string;
}) {
  return apiPost<{ success: boolean; bulkRequest: BulkRequestItem }>('/api/bulk-requests', payload, {
    headers: authHeaders(),
  });
}

export async function updateBulkRequestStatus(id: string, status: 'fulfilled' | 'cancelled') {
  return apiPut<{ success: boolean; bulkRequest: BulkRequestItem }>(`/api/bulk-requests/${encodeURIComponent(id)}`, {
    status,
  }, {
    headers: authHeaders(),
  });
}
