import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from './apiClient';

export interface NotificationItem {
  id: string;
  userId: string;
  message: string;
  type: string;
  subType?: 'transaction' | 'promo' | 'system';
  metadata?: any;
  read: boolean;
  timestamp: string;
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

export async function getNotifications() {
  const headers = await getAuthHeaders();
  return apiGet<{ notifications: NotificationItem[] }>('/api/notifications', {
    headers,
  });
}

export async function createNotification(payload: {
  userId: string;
  message: string;
  type: string;
  subType?: 'transaction' | 'promo' | 'system';
  metadata?: any;
  read?: boolean;
}) {
  const headers = await getAuthHeaders();
  return apiPost('/api/notifications', payload, {
    headers,
  });
}

export async function markNotificationRead(notificationId: string) {
  const headers = await getAuthHeaders();
  return apiPut(`/api/notifications/${notificationId}/read`, undefined, {
    headers,
  });
}

export async function deleteNotification(notificationId: string) {
  const headers = await getAuthHeaders();
  return apiDelete(`/api/notifications/${notificationId}`, undefined, {
    headers,
  });
}

export async function markAllRead() {
  const headers = await getAuthHeaders();
  return apiPost('/api/notifications/mark-all-read', undefined, {
    headers,
  });
}

export async function clearAllNotifications() {
  const headers = await getAuthHeaders();
  return apiDelete('/api/notifications', undefined, {
    headers,
  });
}
