/**
 * Zod validation schemas for money-moving and admin endpoints
 *
 * These schemas provide strict input validation for financial operations:
 * - Wallet deposits, withdrawals, transfers
 * - Purchases and payments
 * - Admin user management and verification
 * - OTP flows
 *
 * Each endpoint should call schema.parse(req.body) or schema.safeParse()
 * to validate and reject invalid/malicious payloads with 400 Bad Request.
 */

import { z } from 'zod';

/**
 * Monetary amount validation
 * - Positive decimal, max 2 decimals (cents)
 * - Min: 0.01, Max: 999999.99
 */
const MoneyAmount = z
  .number()
  .positive('Amount must be positive')
  .finite('Amount must be a finite number')
  .max(999999.99, 'Amount exceeds maximum')
  .refine((v) => Number(v.toFixed(2)) === v, 'Amount must have at most 2 decimal places');

/**
 * Clean alphanumeric/uuid-friendly ID validation
 */
export const IdSchema = z
  .string()
  .min(1, 'ID must not be empty')
  .max(100, 'ID must be <= 100 characters')
  .regex(/^[\w\-]+$/, 'ID contains invalid characters');

/**
 * Wallet Deposit Validation
 * POST /api/wallet/deposit
 */
export const WalletDepositSchema = z.object({
  userId: IdSchema,
  amount: MoneyAmount,
  method: z.enum(['mobile_money', 'bank_transfer', 'card', 'cash'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  reference: z.string().optional().nullable(),
  description: z.string().max(255, 'Description must be <= 255 chars').optional().nullable(),
});

export type WalletDepositInput = z.infer<typeof WalletDepositSchema>;

/**
 * Wallet Withdrawal Validation
 * POST /api/wallet/withdraw
 */
export const WalletWithdrawSchema = z.object({
  userId: IdSchema.optional(),
  amount: MoneyAmount,
  method: z.enum(['bank_transfer', 'mobile_money', 'cash'], {
    errorMap: () => ({ message: 'Invalid withdrawal method' }),
  }),
  recipientAccount: z.string().min(1, 'recipientAccount is required').max(255),
  description: z.string().max(255, 'Description must be <= 255 chars').optional().nullable(),
});

export type WalletWithdrawInput = z.infer<typeof WalletWithdrawSchema>;

/**
 * Wallet Transfer Validation
 * POST /api/wallet/transfer
 */
export const WalletTransferSchema = z.object({
  fromUserId: IdSchema.optional(),
  senderId: IdSchema.optional(),
  toUserId: IdSchema.optional(),
  recipientId: IdSchema.optional(),
  amount: MoneyAmount,
  reference: z.string().optional().nullable(),
  description: z.string().max(255, 'Description must be <= 255 chars').optional().nullable(),
});

export type WalletTransferInput = z.infer<typeof WalletTransferSchema>;

/**
 * Purchase Creation Validation
 * POST /api/purchases
 */
export const PurchaseCreateSchema = z.object({
  productId: IdSchema,
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive').optional().default(1),
  customerId: IdSchema.optional(),
  recordedBy: z.enum(['trader', 'customer', 'admin', 'agent']).optional(),
  isDelivery: z.boolean().optional(),
});

export type PurchaseCreateInput = z.infer<typeof PurchaseCreateSchema>;

/**
 * Admin User Verification Validation
 * POST /api/admin/verify-user
 */
export const AdminVerifyUserSchema = z.object({
  userId: IdSchema,
  verified: z.boolean({ invalid_type_error: 'verified must be true or false' }),
  reason: z.string().max(500, 'Reason must be <= 500 chars').optional(),
  verificationLevel: z.enum(['basic', 'verified', 'premium']).optional(),
});

export type AdminVerifyUserInput = z.infer<typeof AdminVerifyUserSchema>;

/**
 * Admin User Update Validation
 * PUT /api/admin/users/:id
 */
export const AdminUpdateUserSchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  role: z.enum(['customer', 'trader', 'agent', 'admin']).optional(),
  verified: z.boolean().optional(),
  subscriptionTier: z.enum(['free', 'basic', 'premium']).optional(),
  notes: z.string().max(1000, 'Notes must be <= 1000 chars').optional(),
});

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

/**
 * Admin OTP Request Validation
 * POST /api/admin/request-otp
 */
export const AdminOtpRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type AdminOtpRequestInput = z.infer<typeof AdminOtpRequestSchema>;

/**
 * Admin OTP Verification Validation
 * POST /api/admin/verify-otp
 */
export const AdminOtpVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'OTP must be exactly 6 characters').regex(/^\d+$/, 'OTP must be numeric'),
});

export type AdminOtpVerifyInput = z.infer<typeof AdminOtpVerifySchema>;

/**
 * File Upload Validation
 * POST /api/upload
 */
export const FileUploadSchema = z.object({
  purpose: z.enum(['verification', 'business_proof', 'product_image', 'receipt', 'other'], {
    errorMap: () => ({ message: 'Invalid upload purpose' }),
  }),
  description: z.string().max(255, 'Description must be <= 255 chars').optional(),
  // file is handled separately via multer; this just validates metadata
});

export type FileUploadInput = z.infer<typeof FileUploadSchema>;

/**
 * Loyalty Redemption Validation
 * POST /api/wallet/loyalty/redeem
 */
export const LoyaltyRedeemSchema = z.object({
  userId: IdSchema,
  pointsToRedeem: z.number().int('Points must be an integer').positive('Points must be positive'),
  redeemType: z.enum(['cash_back', 'discount_coupon', 'fee_waiver']),
});

export type LoyaltyRedeemInput = z.infer<typeof LoyaltyRedeemSchema>;

/**
 * Loan Application Validation
 * POST /api/wallet/loans/apply
 */
export const LoanApplicationSchema = z.object({
  userId: IdSchema,
  loanAmount: MoneyAmount,
  loanTerm: z.number().int('Term must be an integer').min(1).max(365),
  purpose: z.string().max(500, 'Purpose must be <= 500 chars'),
  collateral: z.string().optional(),
});

export type LoanApplicationInput = z.infer<typeof LoanApplicationSchema>;

/**
 * Voucher Creation & Redemption
 */
export const VoucherCreateSchema = z.object({
  code: z
    .string()
    .min(4, 'Code must be at least 4 characters')
    .max(20, 'Code must be <= 20 characters')
    .regex(/^[A-Z0-9\-]+$/, 'Code must be uppercase letters, numbers, and hyphens'),
  amount: MoneyAmount,
  redeemable_by: z.string().optional().nullable(),
  batch_count: z.number().min(1).max(1000).optional(),
  expires_at: z.string().datetime().or(z.date()),
  notes: z.string().optional(),
});

export type VoucherCreateInput = z.infer<typeof VoucherCreateSchema>;

export const VoucherRedeemSchema = z.object({
  code: z.string().min(1, 'Voucher code required'),
  order_id: IdSchema.optional(),
});

export type VoucherRedeemInput = z.infer<typeof VoucherRedeemSchema>;

/**
 * Transaction Recording (internal API)
 */
export const TransactionCreateSchema = z.object({
  from_user_id: IdSchema.optional(),
  to_user_id: IdSchema.optional(),
  amount: MoneyAmount,
  type: z.enum(['sale', 'deposit', 'withdrawal', 'loan_advance', 'loan_payment', 'refund', 'fee']),
  ref_id: IdSchema.optional(),
  memo: z.string().max(255).optional(),
});

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>;

/**
 * Helper function to create a middleware that validates request body
 * Usage: app.post('/api/wallet/deposit', validateBody(WalletDepositSchema), handler)
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = Object.fromEntries(
          error.errors.map((e) => [e.path.join('.'), e.message])
        );
        return res.status(400).json({
          error: 'Validation failed',
          fields: fieldErrors,
        });
      }
      res.status(400).json({ error: 'Invalid request' });
    }
  };
}
