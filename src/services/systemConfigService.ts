import { apiGet, apiPut } from './apiClient';

export interface SystemConfig {
  id: string;
  maintenanceMode: boolean;
  globalFeesFree: number;
  globalFeesPremium: number;
  systemHealthStatus: string;
  systemHealthLastCheck?: string;
  broadcast?: string;
  updatedAt: string;
  updatedBy?: string;
}

export const getSystemConfig = async (): Promise<{ config: SystemConfig }> => {
  return apiGet('/api/platform/config');
};

export const updateSystemConfig = async (
  updates: Partial<SystemConfig>
): Promise<{ success: boolean }> => {
  return apiPut('/api/platform/config', updates);
};
