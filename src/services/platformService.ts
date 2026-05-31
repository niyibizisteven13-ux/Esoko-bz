import { apiGet, apiPut } from './apiClient';

export interface PlatformConfig {
  maintenanceMode: boolean;
  globalFees: { free: number; premium: number };
  systemHealth: { status: string; lastCheck: string };
  broadcast: any;
  updatedAt?: string;
  updatedBy?: string;
}

export const getPlatformConfig = async (): Promise<PlatformConfig> => {
  const response = await apiGet<{ success: boolean; config: PlatformConfig }>(
    '/api/platform/config'
  );
  return response.config;
};

export const updatePlatformConfig = async (config: Partial<PlatformConfig>): Promise<void> => {
  await apiPut('/api/platform/config', { config });
};
