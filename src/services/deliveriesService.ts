import { apiGet, apiPut, apiPost } from './apiClient';

export interface Delivery {
  id: string;
  purchaseId: string;
  customerId: string;
  traderId: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'in-transit' | 'delivered' | 'cancelled';
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  trackingNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const getDelivery = async (purchaseId: string): Promise<{ delivery: Delivery }> => {
  return apiGet(`/api/deliveries/${purchaseId}`);
};

export const updateDelivery = async (
  id: string,
  updates: Partial<Delivery>
): Promise<{ success: boolean }> => {
  return apiPut(`/api/deliveries/${id}`, updates);
};
