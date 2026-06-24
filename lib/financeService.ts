import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const TRANSACTION_TYPES = ['sale', 'deposit', 'withdrawal', 'loan_advance', 'loan_payment', 'refund', 'fee', 'voucher_redemption'];

export class FinanceService {
  constructor(private db: Database.Database) {}

  /**
   * Create a voucher
   */
  createVoucher(code: string, amount: number, expiresAt: Date, redeemableBy?: string, batchCount = 1) {
    const vouchers = [];
    for (let i = 0; i < batchCount; i++) {
      const uniqueCode = batchCount === 1 ? code : `${code}-${i + 1}`;
      const id = uuidv4();
      try {
        this.db
          .prepare(
            `
          INSERT INTO vouchers (id, code, amount, issuer, redeemable_by, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .run(id, uniqueCode, amount, 'platform', redeemableBy || null, expiresAt.toISOString());
        vouchers.push({ id, code: uniqueCode, amount });
      } catch (err) {
        // Skip duplicates
        console.warn(`Voucher code ${uniqueCode} already exists`);
      }
    }
    return vouchers;
  }

  /**
   * Redeem a voucher
   */
  redeemVoucher(code: string, userId: string, orderId?: string) {
    const voucher = this.db.prepare('SELECT * FROM vouchers WHERE code = ? AND used_by IS NULL').get(code) as any;

    if (!voucher) {
      throw new Error('Voucher not found or already used');
    }

    if (new Date(voucher.expires_at) < new Date()) {
      throw new Error('Voucher has expired');
    }

    if (voucher.redeemable_by && voucher.redeemable_by !== userId) {
      throw new Error('Voucher is not redeemable by this user');
    }

    // Mark as used
    this.db
      .prepare('UPDATE vouchers SET used_by = ?, used_at = ?, order_id = ? WHERE id = ?')
      .run(userId, new Date().toISOString(), orderId || null, voucher.id);

    // Credit user account balance
    this.creditTraderAccount(userId, voucher.amount, 'voucher_redemption', voucher.id);

    return { success: true, amount: voucher.amount, code };
  }

  /**
   * Record a transaction in ledger
   */
  recordTransaction(
    fromUserId: string | null,
    toUserId: string | null,
    amount: number,
    type: string,
    refId?: string,
    memo?: string
  ) {
    if (!TRANSACTION_TYPES.includes(type)) {
      throw new Error(`Invalid transaction type: ${type}`);
    }

    const id = uuidv4();
    this.db
      .prepare(
        `
      INSERT INTO finance_transactions (id, from_user_id, to_user_id, amount, type, ref_id, memo, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
    `
      )
      .run(fromUserId, toUserId, amount, type, refId || null, memo || null);

    // Auto-credit recipient if sale
    if (type === 'sale' && toUserId) {
      this.creditTraderAccount(toUserId, amount, 'sale', refId);
    }

    return id;
  }

  /**
   * Credit trader account (internal)
   */
  private creditTraderAccount(traderId: string, amount: number, reason: string, refId?: string) {
    // Ensure trader_accounts exists
    const existing = this.db
      .prepare('SELECT * FROM trader_accounts WHERE trader_id = ?')
      .get(traderId) as any;

    if (!existing) {
      this.db
        .prepare(
          `
        INSERT INTO trader_accounts (id, trader_id, balance, total_earned)
        VALUES (?, ?, ?, ?)
      `
        )
        .run(uuidv4(), traderId, amount, amount);
    } else {
      this.db
        .prepare(
          `
        UPDATE trader_accounts 
        SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ?
        WHERE trader_id = ?
      `
        )
        .run(amount, amount, new Date().toISOString(), traderId);
    }
  }

  /**
   * Get trader balance
   */
  getTraderBalance(traderId: string) {
    const account = this.db
      .prepare('SELECT * FROM trader_accounts WHERE trader_id = ?')
      .get(traderId) as any;

    return account
      ? { balance: account.balance, reserved: account.reserved_amount, totalEarned: account.total_earned }
      : { balance: 0, reserved: 0, totalEarned: 0 };
  }

  /**
   * Withdraw from trader balance
   */
  withdrawBalance(traderId: string, amount: number, method: string) {
    const account = this.db
      .prepare('SELECT * FROM trader_accounts WHERE trader_id = ?')
      .get(traderId) as any;

    if (!account || account.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Debit account
    this.db
      .prepare(
        `
      UPDATE trader_accounts 
      SET balance = balance - ?, updated_at = ?
      WHERE trader_id = ?
    `
      )
      .run(amount, new Date().toISOString(), traderId);

    // Record transaction
    this.recordTransaction(traderId, null, amount, 'withdrawal', undefined, `Withdrawal via ${method}`);

    return { success: true, newBalance: account.balance - amount };
  }

  /**
   * Get trader transaction history
   */
  getTransactionHistory(traderId: string, limit = 20, offset = 0) {
    const transactions = this.db
      .prepare(
        `
      SELECT * FROM finance_transactions 
      WHERE (from_user_id = ? OR to_user_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(traderId, traderId, limit, offset) as any[];

    const total = (
      this.db
        .prepare('SELECT COUNT(*) as count FROM finance_transactions WHERE from_user_id = ? OR to_user_id = ?')
        .get(traderId, traderId) as any
    ).count;

    return { transactions, total, limit, offset };
  }

  /**
   * Check voucher validity
   */
  checkVoucher(code: string) {
    const voucher = this.db.prepare('SELECT * FROM vouchers WHERE code = ?').get(code) as any;

    if (!voucher) return { valid: false, reason: 'not_found' };
    if (voucher.used_by) return { valid: false, reason: 'already_used' };
    if (new Date(voucher.expires_at) < new Date()) return { valid: false, reason: 'expired' };

    return { valid: true, amount: voucher.amount, code };
  }
}

export default FinanceService;
