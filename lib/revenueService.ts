import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export function createRevenueService(db: Database.Database) {
  function recordLedgerEntry(input: {
    transactionId?: string | null;
    accountType: string;
    accountId: string;
    direction: 'credit' | 'debit';
    amount: number;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.amount <= 0) return null;
    const id = uuidv4();
    db.prepare(
      `
      INSERT INTO ledger_entries (id, transactionId, accountType, accountId, direction, amount, currency, description, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'RWF', ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(
      id,
      input.transactionId || null,
      input.accountType,
      input.accountId,
      input.direction,
      input.amount,
      input.description,
      JSON.stringify(input.metadata || {})
    );
    return id;
  }

  function adjustRevenueAccount(code: string, amountDelta: number) {
    db.prepare(
      `
      UPDATE revenue_accounts
      SET balance = balance + ?, updatedAt = CURRENT_TIMESTAMP
      WHERE code = ?
    `
    ).run(amountDelta, code);
  }

  function recordWalletLiabilityChange(input: {
    transactionId?: string | null;
    userId: string;
    amountDelta: number;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    const amount = Math.abs(input.amountDelta);
    const direction = input.amountDelta >= 0 ? 'credit' : 'debit';
    const entryId = recordLedgerEntry({
      transactionId: input.transactionId,
      accountType: 'liability',
      accountId: 'wallet_liability',
      direction,
      amount,
      description: input.description,
      metadata: {
        userId: input.userId,
        amountDelta: input.amountDelta,
        ...(input.metadata || {}),
      },
    });

    adjustRevenueAccount('wallet_liability', input.amountDelta);
    return entryId;
  }

  function recordTransactionFee(
    transactionId: string,
    userId: string,
    feeType: string,
    feeAmount: number,
    appliedRate: number | null = null
  ) {
    const feeId = uuidv4();
    db.prepare(
      `
      INSERT INTO transaction_fees (id, transactionId, userId, feeType, feeAmount, appliedRate, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'applied', CURRENT_TIMESTAMP)
    `
    ).run(feeId, transactionId, userId, feeType, feeAmount, appliedRate);

    if (feeAmount > 0) {
      recordLedgerEntry({
        transactionId,
        accountType: 'revenue',
        accountId: 'platform_revenue',
        direction: 'credit',
        amount: feeAmount,
        description: `${feeType} fee collected`,
        metadata: { feeId, feeType, userId, appliedRate },
      });
      adjustRevenueAccount('platform_revenue', feeAmount);
    }

    return feeId;
  }

  return { adjustRevenueAccount, recordLedgerEntry, recordTransactionFee, recordWalletLiabilityChange };
}
