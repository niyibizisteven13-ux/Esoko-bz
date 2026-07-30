import React, { useState, useEffect } from 'react';
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  Star,
  Rocket,
  MessageSquare,
  TrendingUp,
  User,
  Loader2,
  AlertCircle,
  X,
  ArrowRight,
  Wallet,
  CreditCard,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import {
  getAvailableSubscriptionPlans,
  getTraderCurrentSubscription,
  upgradeTraderSubscription,
} from '../../services/adminService';
import walletService from '../../services/walletService';
import { createNotification } from '../../services/notificationService';
import { sendEmail } from '../../services/emailService';

export default function TraderUpgrade({
  traderId,
  currentTier,
  isTrialActive,
  onUpgrade,
  traderEmail,
  traderName,
}: {
  traderId: string;
  currentTier: string;
  isTrialActive: boolean;
  onUpgrade: () => void;
  traderEmail?: string;
  traderName?: string;
}) {
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isTrial =
    currentSubscription?.status === 'trial' && !currentSubscription?.trialExpired;
  const requiresUpgrade =
    currentSubscription?.requiresUpgrade || currentSubscription?.trialExpired;

  useEffect(() => {
    fetchPlansAndCurrentSubscription();
  }, [traderId]);

  const fetchPlansAndCurrentSubscription = async () => {
    setPlansLoading(true);
    setError(null);

    try {
      const plansRes = await getAvailableSubscriptionPlans();
      if (plansRes.success) {
        setSubscriptionPlans(plansRes.plans || []);
      } else {
        throw new Error('Unable to fetch subscription plans');
      }
    } catch (err: any) {
      console.error('Failed to fetch subscription plans:', err);
      setError(`Failed to load subscription plans: ${err.message || 'Unknown error'}`);
    }

    try {
      const currentRes = await getTraderCurrentSubscription(traderId);
      if (currentRes.success) {
        setCurrentSubscription(currentRes.subscription);
      }
    } catch (err: any) {
      console.warn('Failed to fetch current subscription:', err);
    }

    try {
      const walletRes = await walletService.getWallet(traderId);
      if (walletRes) {
        setWallet(walletRes);
      }
    } catch (err: any) {
      console.warn('Failed to load wallet info:', err);
      if (!error) {
        setError('Failed to load wallet balance. You can still view plans.');
      }
    }

    setPlansLoading(false);
  };

  const handleUpgradeClick = (plan: any) => {
    if (!wallet || wallet.balance < plan.price) {
      setError('Insufficient wallet balance for this upgrade');
      return;
    }
    setSelectedPlan(plan);
    setShowConfirmation(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan) return;

    setUpgrading(true);
    setError(null);

    try {
      const result = await upgradeTraderSubscription(traderId, selectedPlan.id);

      if (!result.success) {
        throw new Error(result.message || 'Upgrade failed');
      }

      // Send in-app notification
      try {
        await createNotification({
          userId: traderId,
          message: `Subscription upgraded to ${selectedPlan.name}! All features are now active.`,
          type: 'subscription',
          subType: 'promo',
          metadata: {
            subscriptionId: selectedPlan.id,
            transactionId: result.transaction?.id,
            amount: selectedPlan.price,
          },
        });
      } catch (notifErr) {
        console.error('Failed to create notification:', notifErr);
      }

      // Send email confirmation
      if (traderEmail) {
        try {
          await sendEmail({
            to: traderEmail,
            message: {
              subject: `✅ Subscription Upgraded: Welcome to ${selectedPlan.name}!`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h1 style="color: #ea580c; text-align: center;">🎉 Upgrade Successful!</h1>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="margin-top: 0;">Hello ${traderName || 'Trader'},</h2>
                    <p>Your subscription has been successfully upgraded to <strong>${selectedPlan.name}</strong>.</p>
                    
                    <h3 style="color: #333; border-bottom: 2px solid #ea580c; padding-bottom: 10px;">Plan Details</h3>
                    <table style="width: 100%; margin: 15px 0;">
                      <tr>
                        <td style="padding: 8px; font-weight: bold;">Plan:</td>
                        <td style="padding: 8px;">${selectedPlan.name}</td>
                      </tr>
                      <tr style="background: #fafafa;">
                        <td style="padding: 8px; font-weight: bold;">Amount Paid:</td>
                        <td style="padding: 8px;">RWF ${selectedPlan.price.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px; font-weight: bold;">Billing Cycle:</td>
                        <td style="padding: 8px;">${selectedPlan.billingCycle || 'Monthly'}</td>
                      </tr>
                      <tr style="background: #fafafa;">
                        <td style="padding: 8px; font-weight: bold;">Status:</td>
                        <td style="padding: 8px;"><span style="background: #4ade80; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">ACTIVE</span></td>
                      </tr>
                    </table>

                    <h3 style="color: #333; border-bottom: 2px solid #ea580c; padding-bottom: 10px;">Your New Features</h3>
                    <ul style="list-style: none; padding: 0;">
                      ${
                        selectedPlan.features
                          ?.map(
                            (feature: string) => `
                        <li style="padding: 8px 0; display: flex; align-items: center;">
                          <span style="color: #4ade80; font-weight: bold; margin-right: 10px;">✓</span>
                          ${feature}
                        </li>
                      `
                          )
                          .join('') || ''
                      }
                    </ul>

                    <div style="background: #fff9e6; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px;"><strong>💡 Tip:</strong> Make sure to explore all your new features in the trader dashboard!</p>
                    </div>

                    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
                      If you have any questions, contact our support team at support@esoko.com or reply to this email.
                    </p>
                  </div>
                  <p style="text-align: center; color: #ea580c; font-weight: bold;">Welcome to the Bwenge Premium Community! 🚀</p>
                </div>
              `,
            },
          });
        } catch (emailErr) {
          console.error('Failed to send email:', emailErr);
        }
      }

      setSuccess(true);
      setShowConfirmation(false);
      setTimeout(() => {
        setSelectedPlan(null);
        setSuccess(false);
        onUpgrade();
        fetchPlansAndCurrentSubscription();
      }, 3000);
    } catch (err: any) {
      console.error('Upgrade error:', err);
      setError(err.message || 'Failed to complete upgrade');
    } finally {
      setUpgrading(false);
    }
  };

  // Show current paid subscription or active full-access trial
  if (
    currentSubscription &&
    (currentSubscription.status === 'active' || isTrial) &&
    !requiresUpgrade &&
    !showConfirmation
  ) {
    return (
      <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-8 rounded-[3rem] text-white shadow-xl shadow-orange-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck size={160} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Star className="text-white" size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight leading-none">
                {currentSubscription.name}
              </h3>
              <p className="text-orange-100 text-sm font-bold mt-1 uppercase tracking-widest">
                {isTrial ? '15-Day Full Access Trial' : 'Active Subscription'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {currentSubscription.features?.slice(0, 3).map((feature: string, i: number) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10"
              >
                <p className="font-black text-sm">{feature}</p>
              </div>
            ))}
          </div>
          <p className="text-orange-100 text-sm mb-4">
            {isTrial ? (
              <>
                Full access ends in <strong>{currentSubscription.daysRemaining ?? 0} days</strong>.
              </>
            ) : (
              <>
                Monthly Fee: <strong>RWF {currentSubscription.price.toLocaleString()}</strong>
              </>
            )}
          </p>
          <button
            onClick={() => setShowConfirmation(true)}
            className="px-6 py-3 bg-white text-orange-600 rounded-2xl font-bold hover:bg-orange-50 transition-all flex items-center gap-2"
          >
            <ArrowRight size={18} />
            {isTrial ? 'Choose Paid Plan' : 'Upgrade to Higher Plan'}
          </button>
        </div>
      </div>
    );
  }

  // Show upgrade plans
  return (
    <div className="space-y-6">
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-green-50 border-2 border-green-300 rounded-3xl p-6 text-center"
        >
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-xl font-black text-green-700 mb-2">🎉 Upgrade Successful!</h3>
          <p className="text-green-600">
            Your subscription has been activated. Email confirmation sent.
          </p>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-red-50 border-2 border-red-300 rounded-3xl p-4 flex items-center gap-3"
        >
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-red-700 font-bold">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-700"
          >
            <X size={20} />
          </button>
        </motion.div>
      )}

      {!showConfirmation ? (
        <>
          <div>
            <h3 className="text-2xl font-black text-neutral-900 mb-2">
              {requiresUpgrade ? 'Your Trial Has Ended' : 'Choose Your Subscription Plan'}
            </h3>
            <p className="text-neutral-600 mb-6">
              {requiresUpgrade
                ? 'Upgrade now to continue using premium tools. Payment will be deducted from your wallet.'
                : 'Upgrade your business with advanced features. Payment will be deducted from your wallet.'}
            </p>
          </div>

          {plansLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-3" />
              <p className="text-neutral-500">Loading subscription plans...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptionPlans.map((plan) => {
                const hasInsufficientBalance = !wallet || wallet.balance < plan.price;
                const isCurrentPlan = currentSubscription && currentSubscription.id === plan.id;

                return (
                  <motion.div
                    key={plan.id}
                    whileHover={!hasInsufficientBalance ? { scale: 1.03 } : {}}
                    className={`relative rounded-3xl p-6 border-2 transition-all ${
                      isCurrentPlan
                        ? 'bg-orange-50 border-orange-400'
                        : hasInsufficientBalance
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white border-gray-200 hover:border-orange-400 cursor-pointer'
                    }`}
                    onClick={() =>
                      !hasInsufficientBalance && !isCurrentPlan && handleUpgradeClick(plan)
                    }
                  >
                    {isCurrentPlan && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Current
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-xl font-black text-neutral-900 mb-1">{plan.name}</h4>
                      <p className="text-sm text-neutral-500">{plan.description}</p>
                    </div>

                    <div className="bg-gradient-to-r from-orange-100 to-orange-50 rounded-2xl p-4 mb-4">
                      <p className="text-sm text-neutral-600 mb-1">Monthly Fee</p>
                      <p className="text-3xl font-black text-orange-600">
                        RWF {plan.price.toLocaleString()}
                      </p>
                    </div>

                    {plan.features && (
                      <ul className="space-y-2 mb-6">
                        {plan.features.slice(0, 5).map((feature: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2
                              size={16}
                              className="text-green-500 flex-shrink-0 mt-0.5"
                            />
                            <span className="text-neutral-700">{feature}</span>
                          </li>
                        ))}
                        {plan.features.length > 5 && (
                          <li className="text-sm text-neutral-500 italic">
                            + {plan.features.length - 5} more features
                          </li>
                        )}
                      </ul>
                    )}

                    <button
                      disabled={hasInsufficientBalance || isCurrentPlan || loading}
                      onClick={() =>
                        !hasInsufficientBalance && !isCurrentPlan && handleUpgradeClick(plan)
                      }
                      className={`w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                        isCurrentPlan
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : hasInsufficientBalance
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      {isCurrentPlan ? (
                        <>
                          <CheckCircle2 size={18} />
                          Your Current Plan
                        </>
                      ) : hasInsufficientBalance ? (
                        <>
                          <AlertCircle size={18} />
                          Insufficient Balance
                        </>
                      ) : (
                        <>
                          <CreditCard size={18} />
                          Upgrade Now
                        </>
                      )}
                    </button>

                    {hasInsufficientBalance && (
                      <p className="text-xs text-red-600 text-center mt-2">
                        Need RWF {(plan.price - (wallet?.balance || 0)).toLocaleString()} more
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              <strong>💳 Wallet Balance:</strong>{' '}
              {wallet ? formatCurrency(wallet.balance) : 'Loading...'} RWF
            </p>
          </div>
        </>
      ) : selectedPlan ? (
        // Confirmation screen
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl border-2 border-orange-200 p-8 shadow-xl">
            <h3 className="text-2xl font-black text-neutral-900 mb-6 text-center">
              Confirm Upgrade
            </h3>

            <div className="space-y-4 mb-8 bg-orange-50 rounded-2xl p-6">
              <div className="flex justify-between items-center pb-4 border-b-2 border-orange-200">
                <span className="text-neutral-600 font-bold">Plan:</span>
                <span className="text-lg font-black text-orange-600">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b-2 border-orange-200">
                <span className="text-neutral-600 font-bold">Monthly Fee:</span>
                <span className="text-lg font-black text-orange-600">
                  RWF {selectedPlan.price.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 font-bold">Wallet Balance:</span>
                <span
                  className={`text-lg font-black ${
                    wallet && wallet.balance >= selectedPlan.price
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  RWF {wallet ? wallet.balance.toLocaleString() : '0'}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 border-2 border-green-300 rounded-2xl bg-green-50 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5" />
                <span className="text-sm font-bold text-neutral-700">
                  I authorize this transaction
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 border-2 border-blue-300 rounded-2xl bg-blue-50 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5" />
                <span className="text-sm font-bold text-neutral-700">Send email confirmation</span>
              </label>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-600 rounded-lg p-3 mb-6">
              <p className="text-xs text-yellow-900">
                <Lock className="w-3 h-3 inline mr-1" />
                Your payment is secure and encrypted. No refunds after upgrade.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={upgrading}
                className="flex-1 py-3 border-2 border-neutral-300 text-neutral-700 rounded-2xl font-bold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpgrade}
                disabled={upgrading}
                className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {upgrading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
