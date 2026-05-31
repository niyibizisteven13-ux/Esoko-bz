import { apiGet, apiPost, apiPut, apiDelete, authHeaders } from './apiClient';
import { enqueueOfflineAction, isLikelyNetworkError } from './offlineQueue';

export interface PurchaseItem {
  id: string;
  traderId: string;
  customerId: string;
  productId: string;
  quantity: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface PurchaseQueryParams {
  traderId?: string;
  customerId?: string;
  status?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | boolean | undefined;
}

export async function getPurchases(params?: PurchaseQueryParams) {
  return apiGet<{ purchases: PurchaseItem[] }>('/api/purchases', {
    params,
    headers: authHeaders(),
  });
}

export async function getPurchase(purchaseId: string) {
  return apiGet<{ purchase: PurchaseItem }>(`/api/purchases/${purchaseId}`, {
    headers: authHeaders(),
  });
}

export async function createPurchase(payload: Partial<PurchaseItem>) {
  const idempotencyKey = String(
    (payload as any).idempotencyKey ||
      (payload as any).reference ||
      `purchase-${payload.productId || 'product'}-${Date.now()}`
  );
  const body = { ...payload, idempotencyKey };
  const headers = { ...authHeaders(), 'Idempotency-Key': idempotencyKey };
  try {
    return await apiPost('/api/purchases', body, { headers });
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error;
    const queued = await enqueueOfflineAction({
      path: '/api/purchases',
      method: 'POST',
      body,
      headers,
    });
    return {
      success: true,
      pendingSync: true,
      id: queued.id,
      purchase: {
        id: queued.id,
        ...payload,
        status: 'pending_sync',
        paymentStatus: 'pending_sync',
        createdAt: queued.createdAt,
      },
      message: 'Purchase payment recorded offline and will sync when internet returns.',
    };
  }
}

export async function updatePurchase(purchaseId: string, payload: Partial<PurchaseItem>) {
  return apiPut(`/api/purchases/${purchaseId}`, payload, {
    headers: authHeaders(),
  });
}

export async function deletePurchase(purchaseId: string) {
  return apiDelete(`/api/purchases/${purchaseId}`, {
    headers: authHeaders(),
  });
}
