import React, { useEffect, useState } from 'react';
import { Wallet, TrendingUp, Send, Loader2, AlertCircle } from 'lucide-react';
import { getBalance, getTransactionHistory, withdrawBalance, Balance, Transaction } from '../../services/financeService';
import RunwayCard from './RunwayCard';

const TraderFinance: React.FC = () => {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [runway, setRunway] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [balanceData, historyData] = await Promise.all([getBalance(), getTransactionHistory()]);
        setBalance(balanceData);
        setTransactions(historyData.transactions);
        // fetch runway estimate (uses authenticated trader context)
        try {
          const r = await fetch('/api/traders/me/financials/runway');
          const jd = await r.json();
          if (jd?.success) setRunway(jd);
        } catch (e) {
          // ignore runway fetch errors silently
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load balance');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!withdrawAmount || amount <= 0 || (balance && amount > balance.balance)) {
      setError('Enter a valid amount');
      return;
    }

    setWithdrawing(true);
    setError('');
    setSuccess('');
    try {
      await withdrawBalance(amount, 'bank_transfer');
      setWithdrawAmount('');
      setSuccess('Withdrawal request submitted. Funds will arrive in 1-2 business days.');
      // Reload balance
      const newBalance = await getBalance();
      setBalance(newBalance);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-orange-500" size={24} />
        </div>
        {runway && (
          <RunwayCard
            balance={runway.balance || 0}
            avgMonthlyOutflow={runway.avgMonthlyOutflow || 0}
            runwayMonths={runway.runwayMonths}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Balance Card */}
      <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="text-orange-500" size={24} />
          <h2 className="text-lg font-black text-white">Account Balance</h2>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Available</p>
            <p className="mt-1 text-2xl font-black text-white">RWF {(balance?.balance || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Total Earned</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">{(balance?.totalEarned || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Withdraw Form */}
        <div className="space-y-3">
          <input
            type="number"
            placeholder="Amount to withdraw (RWF)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white placeholder:text-white/25 focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={handleWithdraw}
            disabled={withdrawing || !withdrawAmount}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40"
          >
            {withdrawing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Withdraw
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <AlertCircle className="mt-1 flex-shrink-0 text-red-400" size={18} />
          <p className="text-sm font-bold text-red-100">{error}</p>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <TrendingUp className="mt-1 flex-shrink-0 text-emerald-400" size={18} />
          <p className="text-sm font-bold text-emerald-100">{success}</p>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-white">Recent Transactions</h3>
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          {transactions.length === 0 ? (
            <p className="text-center text-xs text-white/40">No transactions yet</p>
          ) : (
            transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <div>
                  <p className="text-xs font-bold text-white capitalize">{tx.type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-white/40">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <p
                  className={`text-xs font-black ${
                    tx.type === 'sale' || tx.type === 'deposit' || tx.type === 'voucher_redemption'
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {tx.type === 'sale' || tx.type === 'deposit' || tx.type === 'voucher_redemption' ? '+' : '-'}RWF{' '}
                  {tx.amount.toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TraderFinance;
