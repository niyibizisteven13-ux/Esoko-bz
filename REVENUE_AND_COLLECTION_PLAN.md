# Esoko Nexus Revenue & Collection Plan

**Date:** May 14, 2026  
**Purpose:** Define how the app makes money, how revenue is collected, how it is recorded, and what must be built before production financial operations.

---

## Implementation Status

The first implementation pass is now wired into the app:

- Admin dashboard tab renamed to **Control Center**.
- Control Center now shows revenue streams, 30-day fee revenue, subscription MRR, projected monthly revenue, payment pipeline, agent commissions, and ledger totals.
- Fee Collection tab now shows fee breakdown, payment-intent pipeline, and revenue accounts.
- SQLite now has revenue/collection tables: `revenue_accounts`, `ledger_entries`, `payment_intents`, `agent_commissions`, and `agent_settlements`.
- Database Control can inspect the new revenue tables.
- New transaction fees post platform revenue ledger entries going forward.
- Subscription upgrades post subscription revenue ledger entries going forward.

Remaining implementation work: backfill ledger entries for historical transactions, add subscription auto-renewal, create agent commission posting rules, and integrate real provider callbacks for mobile money/card/bank collections.

---

## 1. Business Model Summary

Esoko Nexus should make money from four core revenue lines:

1. **Transaction fees** on marketplace purchases, wallet deposits, withdrawals, transfers, and loan-related actions.
2. **Trader subscriptions** for premium commerce tools such as advanced inventory, analytics, payroll, accounting, tax/business-health tools, team management, and priority support.
3. **Agent/merchant network revenue** from assisted cash-in/cash-out, onboarding, verification, and field operations.
4. **Value-added services** such as business analytics, paid feature activation, tax/accounting support, loan facilitation, receipts, payroll tools, supplier tools, and premium support.

The app already has useful foundations for this:

- `fees_config`
- `transaction_fees`
- `subscriptions`
- `trader_subscriptions`
- `dynamic_fees`
- `smart_loans`
- `wallet_transactions`
- `transactions`
- admin fee/revenue screens
- trader subscription upgrade endpoints

The next step is to turn those capabilities into a consistent revenue operating system.

---

## 2. Revenue Streams

### A. Marketplace Commission

**What it is:** A platform fee charged when a customer buys from a trader.

**Current app support:** Purchases calculate a `purchase` fee, credit the trader net amount, record a transaction, and store a fee record.

**Suggested default:**

| Trader Tier | Platform Fee |
|---|---:|
| Free | 2.0% per completed purchase |
| Premium | 1.0% to 1.5% per completed purchase |
| Enterprise/Partner | Custom negotiated fee |

**Collection method:** Deduct automatically from the payment before trader settlement.

**Example:**

- Customer pays RWF 10,000.
- Platform fee is 2% = RWF 200.
- Trader receives RWF 9,800.
- Platform revenue records RWF 200.

**Must-have controls:**

- Fee visible before checkout.
- Fee recorded in `transaction_fees`.
- Trader receipts show gross, fee, and net settlement.
- Refund logic reverses the fee if the transaction is refunded.

---

### B. Wallet Fees

**What it is:** Small fees for wallet movement and cash services.

**Current app support:** Default fees exist for `deposit`, `withdrawal`, and `transfer`.

**Suggested model:**

| Action | Customer Fee | Who Pays | Notes |
|---|---:|---|---|
| Wallet deposit | 0% to 1% or fixed fee | User or absorbed by platform | Keep low to encourage wallet funding. |
| Withdrawal | 1% to 2% plus fixed fee | User | Covers cash-out/agent/partner costs. |
| P2P transfer | 0.5% to 1% capped | Sender | Keep cap low for adoption. |
| Merchant payment | Included in marketplace commission | Trader | Avoid double-charging customer. |

**Collection method:** Deduct during wallet transaction.

**Important:** Cash-in fees should be tested carefully. High deposit fees reduce wallet adoption.

---

### C. Trader Subscription Plans

**What it is:** Recurring paid plans for traders who need more powerful business tools.

**Current app support:** `subscriptions`, `trader_subscriptions`, subscription upgrade endpoint, feature access concepts, admin subscription UI.

**Suggested packages:**

| Plan | Monthly Price | Target User | Included Features |
|---|---:|---|---|
| Free | RWF 0 | New/small trader | Products, basic wallet, purchases, support. |
| Starter | RWF 5,000 | Active micro trader | More products, QR/pay code, receipts, basic analytics. |
| Growth | RWF 15,000 | Growing business | Advanced analytics, customer tools, supplier tools, inventory alerts. |
| Pro | RWF 35,000 | Serious trader/team | Payroll, accounting, tax/business-health, team members, priority support. |
| Enterprise | Custom | Larger merchants/cooperatives | SLA, custom fees, account manager, API/export support. |

**Collection method options:**

- Deduct from trader wallet monthly.
- Pay with mobile money/bank/card through a payment provider.
- Admin/manual activation for pilots.
- Activation key for partner-sponsored subscriptions.

**Grace period:** 3 to 7 days after failed renewal, then downgrade to Free while keeping data read-only or feature-limited.

---

### D. Feature Add-Ons

**What it is:** Paid unlocks for advanced tools without forcing a full subscription.

**Good add-ons for this app:**

| Add-On | Suggested Price | Collection |
|---|---:|---|
| Advanced analytics | RWF 5,000/month | Wallet or payment provider |
| Payroll module | RWF 8,000/month | Wallet or subscription bundle |
| Tax/business-health reports | RWF 3,000/report or RWF 10,000/month | Wallet |
| Bulk product upload | RWF 2,000 per batch or included in Growth | Wallet |
| Team member seats | RWF 1,000 to 2,000 per seat/month | Wallet |
| Premium support | RWF 10,000/month | Wallet/subscription |

**Collection method:** Add `feature_entitlements` or use existing subscription features until a dedicated table is added.

---

### E. Agent Network Revenue

**What it is:** Revenue from agents who perform assisted services: cash-in, cash-out, onboarding, verification, support, and field sales.

**Suggested agent model:**

| Service | Platform Revenue | Agent Commission |
|---|---:|---:|
| Cash-in | Small fixed fee or 0% | Optional fixed commission |
| Cash-out | 1% to 2% fee | Share 30% to 60% of fee |
| Trader onboarding | RWF 500 to 2,000 per verified trader | Paid commission |
| KYC/verification visit | Fixed service fee | Agent commission |
| Premium subscription sale | First-month commission | Agent gets share |

**Collection method:**

- Fees are collected from user/trader wallet.
- Agent commission is recorded as payable.
- Platform net revenue = fee collected - agent commission.

**Needed tables:**

- `agent_commissions`
- `agent_settlements`
- `agent_float_limits`

---

### F. Loan Facilitation & Credit Tools

**What it is:** Revenue from loan applications, loan disbursement facilitation, and credit-readiness reports.

**Current app support:** `smart_loans`, `loan_application`, and `loan_disbursement` fee configs exist.

**Suggested model:**

| Revenue Item | Suggested Charge |
|---|---:|
| Loan application fee | Fixed RWF 1,000 to 5,000 |
| Loan disbursement facilitation | 0.5% to 1.0% |
| Credit-readiness report | RWF 2,000 to 10,000 |
| Partner referral commission | Negotiated with lender |

**Important:** If real lending or loan brokerage is involved, get legal/regulatory review before launch.

---

### G. Advertising & Promotions

**What it is:** Paid placement for traders and promoted products.

**Suggested model:**

| Promotion | Suggested Price |
|---|---:|
| Featured trader listing | RWF 5,000/week |
| Featured product | RWF 2,000/week |
| Category sponsorship | Custom |
| Push notification campaign | RWF 5,000 to 25,000 per campaign |

**Guardrails:**

- Label promoted content clearly.
- Do not let ads override relevance or trust.
- Restrict financial/health claims.

---

### H. Data & Business Insights

**What it is:** Aggregated analytics for traders, cooperatives, brands, or partners.

**Safe approach:**

- Sell trader-owned reports to that trader.
- Sell aggregated, anonymized market insights only after privacy/legal review.
- Never sell individual customer data.

**Possible products:**

- Monthly trader performance report.
- Category demand report.
- Inventory movement report.
- Customer retention report.

---

## 3. How Money Is Collected

### Collection Channels

The app should support these collection methods:

1. **Internal wallet deduction**
   - Best for fees, subscriptions, feature add-ons, loan fees, reports.
   - Fastest to implement because wallet logic already exists.

2. **Mobile money collection**
   - Customer/trader pays via mobile money provider.
   - Provider callback confirms payment.
   - App credits wallet or activates subscription after verified callback.

3. **Bank transfer/manual settlement**
   - Useful for enterprise plans and pilots.
   - Admin confirms payment manually.

4. **Card/payment gateway**
   - Useful later for larger merchants or cross-border users.

5. **Agent cash collection**
   - Agent receives cash and credits wallet.
   - Requires float management, receipt, audit trail, and reconciliation.

---

## 4. Revenue Collection Flows

### Flow 1: Marketplace Purchase

1. Customer confirms purchase.
2. App checks wallet balance.
3. App calculates platform fee.
4. Customer wallet is debited by gross amount.
5. Trader wallet is credited with net amount.
6. Platform fee is recorded in `transaction_fees`.
7. Purchase, transaction, wallet ledger, and receipt are created.
8. Admin dashboard updates revenue metrics.

**Accounting view:**

- Debit customer wallet liability.
- Credit trader wallet liability for net amount.
- Credit platform revenue for fee.

---

### Flow 2: Wallet Deposit

1. User or agent initiates deposit.
2. Payment source is verified.
3. Deposit fee is calculated if enabled.
4. User wallet is credited net amount.
5. Platform fee is recorded.
6. Receipt is generated.

**Recommendation:** Consider no deposit fee at launch to drive adoption.

---

### Flow 3: Wallet Withdrawal

1. User requests cash-out.
2. App checks wallet balance.
3. Withdrawal fee is calculated.
4. User wallet is debited amount + fee.
5. Agent/bank/mobile-money payout is initiated.
6. Platform fee and any agent commission are recorded.
7. Receipt is generated.

**Risk control:** Withdrawals need stricter fraud, daily limits, and audit review than deposits.

---

### Flow 4: Subscription Renewal

1. Renewal job checks active subscriptions daily.
2. If due, app attempts wallet deduction.
3. If successful, extend subscription period.
4. If failed, mark as `past_due`.
5. After grace period, downgrade feature access.
6. Notify trader before and after renewal.

**Needed implementation:** A renewal worker or scheduled task.

---

### Flow 5: Agent Service Collection

1. Agent performs service.
2. App records service transaction.
3. Fee is charged to user/trader or platform.
4. Agent commission is calculated.
5. Commission is held as payable.
6. Admin settles agent commission daily/weekly.

---

## 5. Pricing Strategy

### Launch Pricing

Start simple:

- 2% marketplace fee for Free traders.
- 1% to 1.5% marketplace fee for paid traders.
- Free deposits for launch.
- Withdrawal fee only where real payout costs exist.
- Starter subscription at RWF 5,000/month.
- Growth subscription at RWF 15,000/month.
- Pro subscription at RWF 35,000/month.

### Why this works

- Free plan removes onboarding friction.
- Marketplace commission monetizes real value.
- Subscriptions monetize power users.
- Lower fees for paid traders create an upgrade incentive.
- Wallet fees are secondary, not the main business model.

---

## 6. Ledger & Reconciliation Requirements

Before production, the app should have a clear ledger model.

### Required Ledger Concepts

| Concept | Purpose |
|---|---|
| Customer wallet liability | Money owed to customers. |
| Trader wallet liability | Money owed to traders. |
| Agent float | Cash/float managed by agents. |
| Platform revenue | Earned fees and subscriptions. |
| Pending settlement | Funds awaiting payout/settlement. |
| Refund reserve | Reversible/recent transactions. |

### Required Reports

- Daily gross transaction volume.
- Daily platform revenue.
- Fees by fee type.
- Trader settlements.
- Agent commissions payable.
- Failed payments.
- Refunds/reversals.
- Wallet liability balance.
- Difference between ledger and bank/mobile-money settlement.

### Reconciliation Rule

Every money movement must have:

- One business event.
- One transaction record.
- One or more wallet ledger records.
- One fee record if revenue is collected.
- One settlement status.
- One audit trail.

---

## 7. Admin Controls Needed

### Fee Management

Already partly present through `fees_config` and `dynamic_fees`.

Admin should be able to:

- Enable/disable fees.
- Set fixed fee.
- Set percentage fee.
- Set min/max caps.
- Set effective dates.
- Preview impact before saving.
- Require OTP for fee changes.

### Subscription Management

Admin should be able to:

- Create plans.
- Edit prices.
- Activate/deactivate plans.
- Assign manual subscriptions.
- Generate activation keys.
- See failed renewals.
- Export subscription revenue.

### Revenue Dashboard

Admin dashboard should show:

- Today revenue.
- Month-to-date revenue.
- Revenue by stream.
- Fees collected.
- Subscriptions collected.
- Agent commissions.
- Refunds.
- Net revenue after commissions/refunds.

---

## 8. Implementation Roadmap

### Phase 1: Stabilize Existing Revenue Logic

- Confirm every purchase, wallet, loan, and subscription fee writes to `transaction_fees`.
- Add `feeAmount`, `feeType`, `grossAmount`, and `netAmount` consistently to transaction responses.
- Add tests for purchase fee, deposit fee, withdrawal fee, transfer fee, and loan application fee.
- Add admin export for transaction fees.

### Phase 2: Subscription Billing

- Add renewal dates and billing status to `trader_subscriptions`.
- Add scheduled renewal job.
- Deduct subscription payments from wallet.
- Add grace-period downgrade.
- Add subscription receipts and notifications.

### Phase 3: Revenue Ledger

- Add a proper ledger table:

```sql
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  transactionId TEXT,
  accountType TEXT NOT NULL,
  accountId TEXT,
  direction TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  description TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- Write balanced entries for every transaction.
- Add reconciliation dashboard.

### Phase 4: Agent Commission System

- Add commission rules.
- Record agent commission per service.
- Add settlement status.
- Add weekly settlement export.

### Phase 5: Payment Provider Integration

- Add payment intent table.
- Add provider callback/webhook verification.
- Activate wallets/subscriptions only after verified callback.
- Add reconciliation with provider statements.

### Phase 6: Production Controls

- Add permission tests.
- Add fee-change audit logs.
- Add OTP approval for fee/subscription changes.
- Add refund/reversal logic.
- Add tax/accounting export.

---

## 9. Metrics To Track

### Revenue Metrics

- Gross transaction volume.
- Net platform revenue.
- Take rate = platform revenue / gross volume.
- Subscription MRR.
- ARPU per trader.
- Revenue per active trader.
- Revenue per active agent.
- Refund rate.
- Failed payment rate.

### Product Metrics

- Active traders.
- Active customers.
- Purchase conversion rate.
- Average order value.
- Wallet deposit frequency.
- Trader upgrade rate.
- Subscription churn.
- Agent transaction volume.

### Risk Metrics

- Failed login alerts.
- Blocked wallet operations.
- Manual admin wallet adjustments.
- Refunds by trader.
- Unusual withdrawal spikes.
- Ledger mismatch amount.

---

## 10. Production Policy Recommendations

### Pricing Rules

- Show fees before confirmation.
- Never hide fee deductions from traders.
- Provide receipts for every paid fee.
- Notify users before subscription renewal.
- Keep fee changes versioned and auditable.

### Settlement Rules

- Do not pay out funds that may still be reversed.
- Hold suspicious transactions for review.
- Set withdrawal limits by verification status.
- Set agent float limits.
- Reconcile daily.

### Compliance Rules

- Get legal/regulatory review before real wallet, lending, or payment-provider launch.
- Separate platform funds from operational funds.
- Keep audit logs for money movement.
- Add clear Terms, Privacy, Acceptable Use, Refund, and Fee Schedule pages.

---

## 11. Recommended First Build Tasks

1. Add a dedicated `revenue_accounts` or `ledger_entries` table.
2. Make purchase/deposit/withdraw/transfer write balanced ledger entries.
3. Add subscription renewal and wallet deduction.
4. Add agent commission tables.
5. Add tests for all fee calculations.
6. Add admin revenue export.
7. Add a public Fee Schedule page.
8. Add refund/reversal support.
9. Add provider payment-intent and callback tables.
10. Add daily reconciliation report.

---

## 12. Priority Decision

The best first monetization path is:

1. **Marketplace commission**
2. **Trader subscription plans**
3. **Withdrawal/agent service fees**
4. **Feature add-ons**
5. **Loan/report/analytics revenue**

Do not rely on customer wallet fees as the main business. The app should earn mostly when traders sell more and when traders upgrade for better business tools.
