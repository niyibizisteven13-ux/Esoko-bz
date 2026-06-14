import { apiGet } from './apiClient';
import { authHeaders } from './apiClient';

export interface BusinessSummary {
  traderId: string;
  totalSales: number;
  totalOrders: number;
  todaySales: number;
  lowStockCount: number;
  walletBalance: number;
  creditScore: number;
  recommendedAction: string;
}

export async function getBusinessSummary(traderId: string) {
  return apiGet<{ success: boolean; summary: BusinessSummary }>(
    `/api/reports/business-summary/${encodeURIComponent(traderId)}`,
    {
      headers: authHeaders(),
    }
  );
}
