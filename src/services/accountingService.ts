import { apiGet, apiPut, authHeaders } from './apiClient';

export interface TraderFinancialsPayload {
  traderId: string;
  financialData: {
    assets: number;
    liabilities: number;
    equity: number;
    revenue: number;
    expenses: number;
    vatPayable?: number;
  };
  fixedAssets: any[];
  trialBalanceEntries: any[];
  updatedAt?: string;
  modifiedAt?: string;
}

export async function getTraderFinancials(traderId: string) {
  const response = await apiGet<{ success: boolean; document?: any; data?: any }>(
    `/api/trader_financials/${encodeURIComponent(traderId)}`,
    {
      headers: authHeaders(),
    }
  );

  return response.document || response.data || response;
}

export async function saveTraderFinancials(traderId: string, payload: TraderFinancialsPayload) {
  return apiPut<{ success: boolean; document?: any; data?: any }>(
    `/api/trader_financials/${encodeURIComponent(traderId)}`,
    payload,
    {
      headers: authHeaders(),
    }
  );
}
