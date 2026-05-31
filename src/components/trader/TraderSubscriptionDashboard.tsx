import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import {
  getAvailableSubscriptionPlans,
  getTraderCurrentSubscription,
} from '../../services/adminService';
import walletService from '../../services/walletService';
import TraderUpgrade from './TraderUpgrade';

export default function TraderSubscriptionDashboard({
  traderId,
  userData,
  onUpgrade,
}: {
  traderId: string;
  userData: any;
  onUpgrade: () => void;
}) {
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    const loadSubscriptionDashboard = async () => {
      setLoading(true);
      try {
        const [subscriptionRes, plansRes, walletRes] = await Promise.allSettled([
          getTraderCurrentSubscription(traderId),
          getAvailableSubscriptionPlans(),
          walletService.getWallet(traderId),
        ]);

        if (subscriptionRes.status === 'fulfilled' && subscriptionRes.value.success) {
          setCurrentSubscription(subscriptionRes.value.subscription);
        }
        if (plansRes.status === 'fulfilled' && plansRes.value.success) {
          setPlans(plansRes.value.plans || []);
        }
        if (walletRes.status === 'fulfilled') {
          setWallet(walletRes.value);
        }
      } finally {
        setLoading(false);
      }
    };

    if (traderId) void loadSubscriptionDashboard();
  }, [traderId]);

  const activePlanName = currentSubscription?.name || userData?.tier || 'Free';
  const activeFeatures = currentSubscription?.features || userData?.features || [];
  const isTrial = currentSubscription?.status === 'trial' && !currentSubscription?.trialExpired;
  const requiresUpgrade = currentSubscription?.requiresUpgrade || currentSubscription?.trialExpired;
  const expiresAt =
    currentSubscription?.trialEndsAt ||
    currentSubscription?.trial_ends_at ||
    currentSubscription?.expires_at ||
    currentSubscription?.expiresAt;
  const nextPlan = plans.find((plan) => Number(plan.price || 0) > Number(currentSubscription?.price || 0));
  const monthlyPrice = Number(currentSubscription?.price || 0);
  const planCount = plans.length;
  const unlockedCount = activeFeatures.length;

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-[2rem] bg-[#0a0a0a] border border-white/5">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] bg-gradient-to-br from-orange-600 to-slate-950 p-6 md:p-8 text-white shadow-2xl shadow-orange-950/30 overflow-hidden relative"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-100">
                  Trader Premium
                </p>
                <h2 className="mt-3 text-3xl md:text-4xl font-black leading-tight">
                  {activePlanName} Plan
                </h2>
                <p className="mt-3 max-w-xl text-sm font-bold text-white/70">
                  {isTrial
                    ? `You have full access for ${currentSubscription?.daysRemaining ?? 0} more days. Upgrade anytime to keep everything active.`
                    : requiresUpgrade
                      ? 'Your full-access trial has ended. Upgrade from your wallet to continue premium tools.'
                      : 'Upgrade from your wallet to unlock advanced analytics, accounting, team tools, verified reports, supply features, and stronger fee discounts.'}
                </p>
              </div>
              <div className="h-16 w-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Crown size={34} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard label="Wallet Balance" value={`RWF ${formatCurrency(wallet?.balance || 0)}`} />
              <MetricCard
                label={isTrial ? 'Trial Days Left' : 'Monthly Price'}
                value={isTrial ? String(currentSubscription?.daysRemaining ?? 0) : `RWF ${formatCurrency(monthlyPrice)}`}
              />
              <MetricCard label="Features" value={String(unlockedCount)} />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowPlans((value) => !value)}
                className="rounded-2xl bg-white text-orange-600 px-5 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-50"
              >
                <Sparkles size={16} />
                {showPlans ? 'Hide Upgrade Plans' : 'View Upgrade Plans'}
              </button>
              {nextPlan && (
                <div className="rounded-2xl bg-black/25 border border-white/10 px-5 py-4 text-xs font-bold text-white/80">
                  Next upgrade: <span className="text-white">{nextPlan.name}</span> at RWF{' '}
                  {formatCurrency(nextPlan.price || 0)}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-[2rem] bg-[#0a0a0a] border border-white/5 p-6 md:p-8 text-white"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">
                Subscription Status
              </p>
              <h3 className="text-xl font-black mt-2">Access Dashboard</h3>
            </div>
            <ShieldCheck className="text-green-400" size={28} />
          </div>

          <div className="space-y-3">
            <StatusRow
              icon={<CheckCircle2 size={18} />}
              label="Status"
              value={
                isTrial
                  ? '15-day full access'
                  : currentSubscription?.status === 'active'
                    ? 'Active'
                    : requiresUpgrade
                      ? 'Upgrade required'
                      : 'Free / No paid plan'
              }
            />
            <StatusRow
              icon={<Wallet size={18} />}
              label="Payment Method"
              value={currentSubscription?.payment_method || 'Wallet upgrade'}
            />
            <StatusRow
              icon={<TrendingUp size={18} />}
              label="Available Plans"
              value={`${planCount} plans`}
            />
            <StatusRow
              icon={<Zap size={18} />}
              label="Expires"
              value={expiresAt ? new Date(expiresAt).toLocaleDateString() : 'No expiry yet'}
            />
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 border border-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3">
              Current Feature Access
            </p>
            {activeFeatures.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFeatures.slice(0, 10).map((feature: string) => (
                  <span
                    key={feature}
                    className="rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-black text-orange-300 border border-orange-500/10"
                  >
                    {feature.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold text-neutral-500">
                Basic trader tools are active. Premium tools unlock after upgrade.
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {showPlans && (
        <div className="rounded-[2rem] bg-white dark:bg-neutral-950 border border-neutral-100 dark:border-white/10 p-4 md:p-6">
          <TraderUpgrade
            traderId={traderId}
            currentTier={userData?.tier || 'free'}
            isTrialActive={false}
            traderEmail={userData?.email}
            traderName={userData?.businessName || userData?.name}
            onUpgrade={onUpgrade}
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function StatusRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 border border-white/5 p-4">
      <div className="flex items-center gap-3 text-neutral-400">
        {icon}
        <span className="text-xs font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-sm font-black text-white text-right">{value}</span>
    </div>
  );
}
