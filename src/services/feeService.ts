import { apiGet, apiPost, apiPut } from './apiClient';

export interface FeeConfig {
  id: string;
  feeType: string;
  fixedFee: number;
  percentageFee: number;
  minFee: number;
  maxFee: number;
  description?: string;
  enabled: boolean;
}

export interface FeeCalculation {
  feeType: string;
  amount: number;
  calculatedFee: number;
  netAmount: number;
  breakdown: {
    fixedFee: number;
    percentageFee: number;
    totalFee: number;
  };
}

const getSendFeeRate = (amount: number) => {
  if (amount <= 5000) return 0.015;
  if (amount <= 20000) return 0.013;
  if (amount <= 100000) return 0.012;
  return 0.01;
};

const getWithdrawalFeeRate = (amount: number) => {
  return getSendFeeRate(amount) + 0.002;
};

export interface TransactionFee {
  id: string;
  transactionId: string;
  userId: string;
  feeType: string;
  feeAmount: number;
  appliedRate?: number;
  status: string;
  createdAt: string;
}

/**
 * Get all fee configurations from server
 */
export async function getFeeConfigs(): Promise<FeeConfig[]> {
  try {
    const response = await apiGet<{ success: boolean; fees: FeeConfig[] }>('/api/fees/config');
    return response.fees || [];
  } catch (error) {
    console.error('Error fetching fee configs:', error);
    return [];
  }
}

/**
 * Get specific fee configuration by type
 */
export async function getFeeConfig(feeType: string): Promise<FeeConfig | null> {
  try {
    const response = await apiGet<{ success: boolean; fee: FeeConfig }>(
      '/api/fees/config/' + feeType
    );
    return response.fee || null;
  } catch (error) {
    console.error(`Error fetching fee config for ${feeType}:`, error);
    return null;
  }
}

/**
 * Calculate fee for a given amount
 */
export async function calculateFee(
  feeType: string,
  amount: number,
  userId?: string,
  userTier?: string
): Promise<FeeCalculation | null> {
  try {
    // DEPOSITS ARE COMPLETELY FREE - No service charges to attract users
    if (feeType === 'deposit') {
      return {
        feeType,
        amount,
        calculatedFee: 0,
        netAmount: amount,
        breakdown: { fixedFee: 0, percentageFee: 0, totalFee: 0 },
      };
    }

    const feeConfig = await getFeeConfig(feeType);
    if (!feeConfig || !feeConfig.enabled) {
      return {
        feeType,
        amount,
        calculatedFee: 0,
        netAmount: amount,
        breakdown: { fixedFee: 0, percentageFee: 0, totalFee: 0 },
      };
    }

    let fixedFee = feeConfig.fixedFee || 0;
    let percentageFeeAmount = amount * (feeConfig.percentageFee || 0) || 0;
    let totalFee = fixedFee + percentageFeeAmount;

    let discount = 0;
    if (userTier === 'premium') discount = totalFee * 0.1;
    else if (userTier === 'gold') discount = totalFee * 0.15;
    else if (userTier === 'platinum') discount = totalFee * 0.2;
    totalFee -= discount;

    const calculatedFee = Math.max(feeConfig.minFee, Math.min(totalFee, feeConfig.maxFee));

    return {
      feeType,
      amount,
      calculatedFee,
      netAmount: amount - calculatedFee,
      breakdown: {
        fixedFee,
        percentageFee: percentageFeeAmount,
        totalFee: calculatedFee,
      },
    };
  } catch (error) {
    console.error('Error calculating fee:', error);
    return null;
  }
}

/**
 * Create a fee record for a transaction
 */
export async function createTransactionFee(
  transactionId: string,
  userId: string,
  feeType: string,
  feeAmount: number,
  appliedRate?: number
): Promise<TransactionFee | null> {
  try {
    const response = await apiPost<{ success: boolean; fee: TransactionFee }>(
      '/api/fees/transaction',
      {
        transactionId,
        userId,
        feeType,
        feeAmount,
        appliedRate,
      }
    );
    return response.fee || null;
  } catch (error) {
    console.error('Error creating transaction fee:', error);
    return null;
  }
}

/**
 * Get all fees for a user within a date range
 */
export async function getUserFees(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<TransactionFee[]> {
  try {
    const params: Record<string, string> = { userId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await apiGet<{ success: boolean; fees: TransactionFee[] }>(
      `/api/fees/user/${userId}`,
      { params }
    );
    return response.fees || [];
  } catch (error) {
    console.error('Error fetching user fees:', error);
    return [];
  }
}

/**
 * Get fee statistics (admin only)
 */
export async function getFeeStats(): Promise<any> {
  try {
    const response = await apiGet('/api/fees/stats');
    return response;
  } catch (error) {
    console.error('Error fetching fee stats:', error);
    return null;
  }
}

/**
 * Update fee configuration (admin only)
 */
export async function updateFeeConfig(
  feeType: string,
  updates: Partial<FeeConfig>
): Promise<FeeConfig | null> {
  try {
    const response = await apiPut<{ success: boolean; fee: FeeConfig }>(
      `/api/fees/config/${feeType}`,
      updates
    );
    return response.fee || null;
  } catch (error) {
    console.error(`Error updating fee config for ${feeType}:`, error);
    return null;
  }
}

/**
 * Calculate fee for wallet operations with user tier consideration
 */
export async function calculateWalletFee(
  operationType: 'deposit' | 'withdrawal' | 'transfer',
  amount: number,
  userId: string
): Promise<FeeCalculation | null> {
  try {
    const cleanedAmount = Math.max(0, amount);
    if (operationType === 'deposit') {
      return {
        feeType: operationType,
        amount: cleanedAmount,
        calculatedFee: 0,
        netAmount: cleanedAmount,
        breakdown: {
          fixedFee: 0,
          percentageFee: 0,
          totalFee: 0,
        },
      };
    }

    const rate =
      operationType === 'withdrawal'
        ? getWithdrawalFeeRate(cleanedAmount)
        : getSendFeeRate(cleanedAmount);

    const calculatedFee = Math.round(cleanedAmount * rate);

    return {
      feeType: operationType,
      amount: cleanedAmount,
      calculatedFee,
      netAmount: cleanedAmount - calculatedFee,
      breakdown: {
        fixedFee: 0,
        percentageFee: Math.round(cleanedAmount * rate),
        totalFee: calculatedFee,
      },
    };
  } catch (error) {
    console.error('Error calculating wallet fee:', error);
    return null;
  }
}
