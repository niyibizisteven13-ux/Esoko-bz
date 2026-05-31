import { apiGet, apiPost, authHeaders } from './apiClient';
import { authenticateBiometric } from '../lib/biometrics';
import { enqueueOfflineAction, isLikelyNetworkError } from './offlineQueue';

interface WalletData {
  userId: string;
  balance: number;
  currency: string;
  loyaltyPoints: number;
  totalEarned: number;
  transactions: any[];
  lastUpdated: string;
}

interface DepositResponse {
  success: boolean;
  transactionId: string;
  message: string;
  oldBalance?: number;
  newBalance?: number;
  pendingSync?: boolean;
}

interface WithdrawalResponse {
  success: boolean;
  transactionId: string;
  message: string;
  oldBalance?: number;
  newBalance?: number;
  biometricRequired?: boolean;
}

interface TransferResponse {
  success: boolean;
  transactionId: string;
  message: string;
  oldBalance?: number;
  newBalance?: number;
  biometricRequired?: boolean;
  pendingSync?: boolean;
}

interface BiometricAuthResult {
  authenticated: boolean;
  error?: string;
}

interface LoanResponse {
  success: boolean;
  loanId: string;
  status: string;
  approvalStatus: string;
  approvalScore: number;
  riskLevel: string;
  interestRate: number;
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
  applicationFee: number;
  feePaymentMethod: 'wallet' | 'points';
  processingFee: number;
  disbursementTransactionId?: string | null;
  whatsapp?: {
    number: string;
    message: string;
    url: string;
  };
  message: string;
}

interface LoanPreview {
  success: boolean;
  amount: number;
  loanTerm: number;
  interestRate: number;
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
  applicationFee: number;
  processingFee: number;
  approvalScore: number;
  approvalStatus: string;
  riskLevel: string;
  schedule: Array<{
    installment: number;
    payment: number;
    interest: number;
    principal: number;
    balance: number;
  }>;
}

interface Loan {
  id: string;
  userId: string;
  amount: number;
  status: string;
  interestRate: number;
  loanTerm: number;
  monthlyPayment: number;
  totalRepayment: number;
  amountRepaid: number;
  approvalScore?: number;
  approvalStatus?: string;
  riskLevel?: string;
  nextInstallmentDue?: string;
  pendingInstallments?: number;
  createdAt: string;
}

export const walletService = {
  // Authenticate with biometric for secure transactions
  authenticateBiometricForTransaction: async (): Promise<BiometricAuthResult> => {
    try {
      const result = await authenticateBiometric();
      if (!result.success) {
        return { authenticated: false, error: result.message };
      }
      return { authenticated: true };
    } catch (err: any) {
      return { authenticated: false, error: err.message || 'Biometric authentication error' };
    }
  },

  // Get wallet information
  getWallet: async (userId: string): Promise<WalletData> => {
    const data = await apiGet<{ success: boolean; wallet: WalletData }>(`/api/wallet/${userId}`, {
      headers: authHeaders(),
    });

    if (!data.success) {
      throw new Error('Failed to fetch wallet');
    }

    return data.wallet;
  },

  // Deposit funds - FREE, no biometric required
  deposit: async (
    userId: string,
    amount: number,
    method: string,
    reference?: string
  ): Promise<DepositResponse> => {
    const idempotencyKey = reference || `deposit-${userId}-${Date.now()}`;
    const body = { userId, amount, method, reference: idempotencyKey, idempotencyKey };
    const headers = { ...authHeaders(), 'Idempotency-Key': idempotencyKey };
    let data: DepositResponse;
    try {
      data = await apiPost<DepositResponse>(`/api/wallet/deposit`, body, { headers });
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;
      const queued = await enqueueOfflineAction({
        path: '/api/wallet/deposit',
        method: 'POST',
        body,
        headers,
      });
      return {
        success: true,
        pendingSync: true,
        transactionId: queued.id,
        message: 'Deposit recorded offline and will sync when internet returns.',
      };
    }

    if (!data.success) {
      throw new Error(data.message || 'Deposit failed');
    }

    return data;
  },

  // Withdraw funds - REQUIRES BIOMETRIC
  withdraw: async (
    userId: string,
    amount: number,
    method: string,
    reference?: string
  ): Promise<WithdrawalResponse> => {
    // Authenticate with biometric first
    const bioResult = await walletService.authenticateBiometricForTransaction();
    if (!bioResult.authenticated) {
      throw new Error(bioResult.error || 'Biometric authentication required for withdrawal');
    }

    const idempotencyKey = reference || `withdraw-${userId}-${Date.now()}`;
    const data = await apiPost<WithdrawalResponse>(
      `/api/wallet/withdraw`,
      { userId, amount, method, reference: idempotencyKey, idempotencyKey },
      {
        headers: { ...authHeaders(), 'Idempotency-Key': idempotencyKey },
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Withdrawal failed');
    }

    return data;
  },

  // Transfer funds peer-to-peer - REQUIRES BIOMETRIC
  transfer: async (
    senderId: string,
    recipientId: string,
    amount: number,
    reference?: string,
    options?: { skipBiometric?: boolean }
  ): Promise<TransferResponse> => {
    if (!options?.skipBiometric) {
      const bioResult = await walletService.authenticateBiometricForTransaction();
      if (!bioResult.authenticated) {
        throw new Error(bioResult.error || 'Biometric authentication required for transfer');
      }
    }

    const idempotencyKey = reference || `transfer-${senderId}-${recipientId}-${Date.now()}`;
    const body = { senderId, recipientId, amount, reference: idempotencyKey, idempotencyKey };
    const headers = { ...authHeaders(), 'Idempotency-Key': idempotencyKey };
    let data: TransferResponse;
    try {
      data = await apiPost<TransferResponse>(`/api/wallet/transfer`, body, { headers });
    } catch (error) {
      if (!isLikelyNetworkError(error)) throw error;
      const queued = await enqueueOfflineAction({
        path: '/api/wallet/transfer',
        method: 'POST',
        body,
        headers,
      });
      return {
        success: true,
        pendingSync: true,
        transactionId: queued.id,
        message: 'Transfer recorded offline and will sync when internet returns.',
      };
    }

    if (!data.success) {
      throw new Error(data.message || 'Transfer failed');
    }

    return data;
  },

  // Redeem loyalty points
  redeemLoyaltyPoints: async (userId: string, points: number): Promise<any> => {
    const data = await apiPost<any>(
      `/api/wallet/loyalty/redeem`,
      { userId, points },
      {
        headers: authHeaders(),
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Loyalty redemption failed');
    }

    return data;
  },

  // Get user's loans
  getLoans: async (userId: string, status?: string): Promise<Loan[]> => {
    const data = await apiGet<{ success: boolean; loans: Loan[] }>(`/api/wallet/loans/${userId}`, {
      params: status ? { status } : undefined,
      headers: authHeaders(),
    });

    if (!data.success) {
      throw new Error('Failed to fetch loans');
    }

    return data.loans;
  },

  // Apply for loan
  applyForLoan: async (
    userId: string,
    amount: number,
    loanTerm?: number,
    feePaymentMethod: 'wallet' | 'points' = 'wallet'
  ): Promise<LoanResponse> => {
    const data = await apiPost<LoanResponse>(
      `/api/wallet/loans/apply`,
      { userId, amount, loanTerm, feePaymentMethod },
      {
        headers: authHeaders(),
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Loan application failed');
    }

    return data;
  },

  repayLoan: async (loanId: string, amount: number): Promise<any> => {
    const data = await apiPost<any>(
      `/api/wallet/loans/${loanId}/repay`,
      { amount, paymentMethod: 'wallet' },
      {
        headers: authHeaders(),
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Loan repayment failed');
    }

    return data;
  },

  disburseLoan: async (loanId: string): Promise<any> => {
    const data = await apiPost<any>(
      `/api/wallet/loans/${loanId}/disburse`,
      {},
      {
        headers: authHeaders(),
      }
    );

    if (!data.success) {
      throw new Error(data.message || 'Loan disbursement failed');
    }

    return data;
  },

  // Preview loan interest and repayment schedule
  previewLoan: async (userId: string, amount: number, loanTerm?: number): Promise<LoanPreview> => {
    const data = await apiPost<LoanPreview>(
      `/api/wallet/loans/preview`,
      { userId, amount, loanTerm },
      {
        headers: authHeaders(),
      }
    );

    if (!data.success) {
      throw new Error('Failed to preview loan');
    }

    return data;
  },
};

export default walletService;
