import { z } from 'zod';
import { ValidationError } from './apiError';

/**
 * Common validation schemas for reuse across the app
 */

// Auth schemas
const StrongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: StrongPasswordSchema,
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['customer', 'trader', 'agent', 'manager', 'admin']).optional(),
  })
  .passthrough();

export const PasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetTokenSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Product schemas
export const CreateProductSchema = z.object({
  name: z.string().min(2, 'Product name required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category required'),
  price: z.number().positive('Price must be positive'),
  discount: z.number().min(0).max(100).optional().default(0),
  stock: z.number().int().min(0).optional().default(0),
  image: z.string().url().optional(),
  code: z.string().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

// Purchase schemas
export const CreatePurchaseSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive('Quantity must be positive'),
  totalAmount: z.number().positive('Amount must be positive'),
  notes: z.string().optional(),
});

// Transaction schemas
export const CreateTransactionSchema = z.object({
  recipientId: z.string().optional(),
  customerId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['deposit', 'withdrawal', 'transfer', 'purchase', 'payment']),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
});

// User schemas
export const UpdateUserSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  businessName: z.string().optional(),
  businessCategory: z.string().optional(),
  location: z.string().optional(),
  tin: z.string().optional(),
  profilePhoto: z.string().url().optional(),
});

/**
 * Generic validator function
 */
export function validate<T>(schema: z.ZodSchema, data: unknown): T {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        fieldErrors[path] = err.message;
      });
      throw new ValidationError('Validation failed', fieldErrors);
    }
    throw error;
  }
}

/**
 * Safe parse without throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    result.error.errors.forEach((err) => {
      const path = err.path.join('.');
      fieldErrors[path] = err.message;
    });
    return { success: false, errors: fieldErrors };
  }
  return { success: true, data: result.data as T };
}
