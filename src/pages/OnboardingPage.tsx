import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut, apiPost } from '../services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { emailService } from '../services/emailService';
import { getCurrentUser } from '../services/sessionService';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Store,
  ShoppingBag,
  Truck,
  Smartphone,
  Globe,
  Zap,
  TrendingUp,
  ShieldCheck,
  Package,
  AlertTriangle,
  Mail,
  Check,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import Logo from '../components/Logo';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function OnboardingPage() {
  const { t } = useLanguage();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const [surveyData, setSurveyData] = useState({
    role: '' as 'trader' | 'customer' | '',
    businessType: '',
    businessSize: '',
    primaryDevice: 'Smartphone',
    interests: [] as string[],
    district: '',
    shoppingHabit: '',
    savingsGoal: false,
    dashboardPreference: 'classic',
    termsAccepted: false,
  });

  useEffect(() => {
    const initialize = async () => {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const response = await apiGet<{ user: any }>(`/api/users/${user.id}`);
        if (response && response.user) {
          const data = response.user;
          if (data.onboardingComplete) {
            navigate(`/${data.role || 'customer'}`, { replace: true });
            return;
          }
          setUserData(data);
          setEmailVerified(Boolean(data.emailVerified));
          setSurveyData((prev) => ({
            ...prev,
            role: (data.role as 'customer' | 'trader' | '') || '',
          }));
        } else {
          // New user (e.g. Google Sign-In for the first time)
          setUserData({ isNew: true });
        }
      } catch (err) {
        console.error('Fetch user error:', err);
      }
    };

    initialize();
  }, [navigate]);

  const handleComplete = async () => {
    const user = await getCurrentUser();
    if (!user || !userData) return;
    setLoading(true);
    let updatePayload: any = {};
    try {
      const activeRole = surveyData.role || userData.role || 'customer';

      // Map survey data to features
      const suggestedFeatures = [...(userData.features || [])];

      if (activeRole === 'trader') {
        if (surveyData.businessSize === 'Large' || surveyData.businessSize === 'Medium') {
          suggestedFeatures.push('analytics_pro', 'inventory_advanced', 'team_management');
        }
        if (surveyData.businessType === 'Wholesaler') {
          suggestedFeatures.push('supply_chain');
        }
        if (surveyData.primaryDevice === 'Smartphone') {
          suggestedFeatures.push('mobile_pos');
        }
        if (surveyData.interests.includes('sales')) suggestedFeatures.push('loyalty_engine');
        if (surveyData.interests.includes('stock')) suggestedFeatures.push('inventory_advanced');
        if (surveyData.interests.includes('tax_health')) suggestedFeatures.push('tax_compliance');
      } else if (activeRole === 'customer') {
        // Customer features
        if (surveyData.savingsGoal) suggestedFeatures.push('analytics_pro');
        if (surveyData.interests.includes('deals')) suggestedFeatures.push('loyalty_engine');
      }

      // Remove duplicates
      const uniqueFeatures = Array.from(new Set(suggestedFeatures));

      const appNumber =
        userData.appNumber || Math.floor(10000000 + Math.random() * 90000000).toString();

      // Prepare only updated fields to avoid diffing the whole document
      updatePayload = {
        role: activeRole,
        features: uniqueFeatures,
        appNumber,
        walletBalance:
          userData.walletBalance || userData.walletBalance === 0
            ? userData.walletBalance
            : activeRole === 'agent'
              ? 50000
              : 0,
        loyaltyPoints: userData.loyaltyPoints || 0,
        tier: userData.tier || 'free',
        status: activeRole === 'agent' ? 'pending' : 'active',
        onboardingComplete: true,
        updatedAt: new Date().toISOString(),

        // Survey fields
        dashboardPreference: surveyData.dashboardPreference,
        primaryDevice: surveyData.primaryDevice,
        interests: surveyData.interests,
      };

      if (activeRole === 'trader') {
        if (surveyData.businessType) updatePayload.businessType = surveyData.businessType;
        if (surveyData.businessSize) updatePayload.businessSize = surveyData.businessSize;
      } else {
        if (surveyData.district) updatePayload.district = surveyData.district;
        if (surveyData.shoppingHabit) updatePayload.shoppingHabit = surveyData.shoppingHabit;
        if (surveyData.savingsGoal !== undefined)
          updatePayload.savingsGoal = surveyData.savingsGoal;
      }

      // Update user data
      await apiPut('/api/users/' + user.id, updatePayload);

      await apiPost('/api/onboarding/research', {
        role: activeRole,
        responses: {
          ...surveyData,
          completedAt: new Date().toISOString(),
        },
      });

      // Update user to include terms acceptance
      try {
        await apiPut('/api/users/' + user.id, {
          termsAcceptedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to record terms acceptance:', err);
      }

      // Send welcome notification - wrap in try-catch to avoid blocking redirect if it fails
      try {
        await apiPost('/api/notifications', {
          userId: user.id,
          message: `Welcome to ESOKO! Your profile is now set up with ${surveyData.dashboardPreference} dashboard preference.`,
          type: 'success',
          subType: 'system',
        });

        // Send Welcome Email
        if (user.email) {
          emailService.sendWelcomeEmail(
            user.email,
            user.name || userData.name || 'User',
            activeRole
          );
        }
      } catch (notifErr) {
        console.error('Could not send onboarding notification:', notifErr);
      }

      // Force a tiny delay so Firestore can reflect the update before we navigate
      // This helps App.tsx see onboardingComplete=true
      await new Promise((r) => setTimeout(r, 800));

      // Use window.location.href for a full reload to ensure App.tsx sees the fresh Firestore state
      setLoading(false);
      window.location.href = `/${activeRole}`;
    } catch (err: any) {
      console.error('Onboarding error:', err);
      // Detailed logging for debugging
      console.log('Onboarding data payload:', updatePayload);
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (
      window.confirm(
        'Are you sure you want to skip personalization? You can update your profile later in settings.'
      )
    ) {
      const user = await getCurrentUser();
      if (!user) return;
      setLoading(true);
      try {
        const activeRole = userData?.role || surveyData.role || 'customer';

        await apiPut('/api/users/' + user.id, {
          onboardingComplete: true,
          role: activeRole,
          updatedAt: new Date().toISOString(),
        });

        // Force a tiny delay so the update can reflect before we navigate
        await new Promise((r) => setTimeout(r, 800));

        const dashboardPath =
          activeRole === 'admin'
            ? '/admin'
            : activeRole === 'agent'
              ? '/agent'
              : activeRole === 'manager'
                ? '/manager'
                : `/${activeRole}`;

        window.location.href = dashboardPath;
      } catch (err: any) {
        console.error('Skip onboarding error:', err);
        setError(err.message || 'Failed to skip onboarding. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleInterest = (interest: string) => {
    setSurveyData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const sendVerificationEmail = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    setLoading(true);
    try {
      await apiPost('/api/auth/send-verification-email', {});
      setEmailVerificationSent(true);
      await sendNotification(
        user.id,
        'Verification email sent! Check your inbox.',
        'success',
        'system'
      );
    } catch (err: any) {
      console.error('Failed to send verification email:', err);
      setEmailVerificationSent(false);
      setError(
        'Email delivery is temporarily unavailable. You can continue now and verify your email later from settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshEmailVerificationStatus = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiGet<{ user: any }>(`/api/users/${user.id}`);
      const verified = Boolean(response?.user?.emailVerified);
      setUserData(response?.user || userData);
      setEmailVerified(verified);
      if (!verified) {
        setError('Email is not verified yet. Open the link in your inbox, then check again.');
      } else {
        setError(null);
        await sendNotification(user.id, 'Email verified. You can continue.', 'success', 'system');
      }
    } catch (err: any) {
      setError(err.message || 'Could not refresh email verification status.');
    } finally {
      setLoading(false);
    }
  };

  if (!userData) return null;

  // Total steps: Role (if new) + 4 survey steps + preference + terms/email
  const isNew = userData.isNew;
  const isTrader = (surveyData.role || userData.role) === 'trader';
  const displayStep = isNew ? step : step; // We can keep step numbers 1-5
  const totalSteps = 7;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${step >= s ? 'w-8 bg-orange-600' : 'w-4 bg-white/5'}`}
              />
            ))}
          </div>
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
            {t.onboarding.step} {step} {t.onboarding.of} 7
          </p>
        </div>

        <div className="bg-[#0a0a0a] p-8 rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500"
              >
                <AlertTriangle size={18} />
                <p className="text-xs font-bold">{error}</p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {isNew ? (
                  <>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black text-white tracking-tight">
                        How will you use ESOKO?
                      </h2>
                      <p className="text-neutral-500">
                        Choose your primary account type to get started.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        {
                          id: 'customer',
                          icon: <ShoppingBag />,
                          label: t.common.customer,
                          desc: 'Shop and pay securely',
                        },
                        {
                          id: 'trader',
                          icon: <Store />,
                          label: t.common.trader,
                          desc: 'Manage business and inventory',
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSurveyData({ ...surveyData, role: item.id as any })}
                          className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 text-center ${surveyData.role === item.id ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                        >
                          <div
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${surveyData.role === item.id ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-500'}`}
                          >
                            {item.icon}
                          </div>
                          <div>
                            <span className="font-bold block">{item.label}</span>
                            <span className="text-[10px] uppercase tracking-widest font-black opacity-40">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black text-white tracking-tight">
                        {isTrader ? t.onboarding.businessType : t.onboarding.shoppingHabits}
                      </h2>
                      <p className="text-neutral-500">{t.onboarding.subtitle}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {isTrader
                        ? [
                            { id: 'Retailer', icon: <Store />, label: t.onboarding.traderTitle },
                            {
                              id: 'Wholesaler',
                              icon: <Truck />,
                              label: 'Wholesaler / Distributor',
                            },
                            {
                              id: 'Market stall',
                              icon: <ShoppingBag />,
                              label: 'Market Stall / Vendor',
                            },
                            { id: 'Service Provider', icon: <Zap />, label: 'Service Provider' },
                          ].map((item) => (
                            <button
                              key={item.id}
                              onClick={() =>
                                setSurveyData({ ...surveyData, businessType: item.id })
                              }
                              className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${surveyData.businessType === item.id ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                            >
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center ${surveyData.businessType === item.id ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-500'}`}
                              >
                                {item.icon}
                              </div>
                              <span className="font-bold">{item.label}</span>
                            </button>
                          ))
                        : [
                            { id: 'daily', label: 'Daily', desc: 'I buy small items every day' },
                            { id: 'weekly', label: 'Weekly', desc: 'I do a big shop once a week' },
                            { id: 'monthly', label: 'Monthly', desc: 'I stock up once a month' },
                            {
                              id: 'occasional',
                              label: 'Occasional',
                              desc: 'I only shop when I need something specific',
                            },
                          ].map((item) => (
                            <button
                              key={item.id}
                              onClick={() =>
                                setSurveyData({ ...surveyData, shoppingHabit: item.id })
                              }
                              className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-1 text-left ${surveyData.shoppingHabit === item.id ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                            >
                              <span className="font-bold">{item.label}</span>
                              <span className="text-xs opacity-60">{item.desc}</span>
                            </button>
                          ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {isTrader ? 'Business Size' : 'Savings Goals'}
                  </h2>
                  <p className="text-neutral-500">
                    {isTrader
                      ? 'How large is your operation?'
                      : 'Do you want to track your spending and set savings goals?'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {isTrader
                    ? [
                        {
                          id: 'Small',
                          label: 'Small (1-2 employees)',
                          desc: 'Perfect for individual vendors',
                        },
                        {
                          id: 'Medium',
                          label: 'Medium (3-10 employees)',
                          desc: 'Growing businesses',
                        },
                        {
                          id: 'Large',
                          label: 'Large (10+ employees)',
                          desc: 'Enterprise level operations',
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSurveyData({ ...surveyData, businessSize: item.id })}
                          className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-1 text-left ${surveyData.businessSize === item.id ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                        >
                          <span className="font-bold">{item.label}</span>
                          <span className="text-xs opacity-60">{item.desc}</span>
                        </button>
                      ))
                    : [
                        {
                          id: true,
                          label: 'Yes, help me save',
                          desc: 'I want to set budgets and track my progress',
                        },
                        {
                          id: false,
                          label: 'No, just payments',
                          desc: 'I only want to use the wallet for quick transactions',
                        },
                      ].map((item) => (
                        <button
                          key={String(item.id)}
                          onClick={() => setSurveyData({ ...surveyData, savingsGoal: item.id })}
                          className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-1 text-left ${surveyData.savingsGoal === item.id ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                        >
                          <span className="font-bold">{item.label}</span>
                          <span className="text-xs opacity-60">{item.desc}</span>
                        </button>
                      ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">Primary Device</h2>
                  <p className="text-neutral-500">Which device do you use most for ESOKO?</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'Smartphone', icon: <Smartphone />, label: 'Smartphone' },
                    { id: 'Computer', icon: <Globe />, label: 'Computer / Laptop' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSurveyData({ ...surveyData, primaryDevice: item.id })}
                      className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 text-center ${surveyData.primaryDevice === item.id ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                    >
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center ${surveyData.primaryDevice === item.id ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-500'}`}
                      >
                        {item.icon}
                      </div>
                      <span className="font-bold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    Interests & Goals
                  </h2>
                  <p className="text-neutral-500">Select what you want to achieve with ESOKO.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(isTrader
                    ? [
                        { id: 'sales', icon: <TrendingUp size={16} />, label: 'Increase Sales' },
                        { id: 'stock', icon: <Package size={16} />, label: 'Manage Stock' },
                        {
                          id: 'tax_health',
                          icon: <ShieldCheck size={16} />,
                          label: 'Tax Integrity',
                        },
                        { id: 'payments', icon: <Zap size={16} />, label: 'Digital Payments' },
                      ]
                    : [
                        { id: 'deals', icon: <TrendingUp size={16} />, label: 'Find Best Deals' },
                        { id: 'savings', icon: <ShieldCheck size={16} />, label: 'Save Money' },
                        {
                          id: 'convenience',
                          icon: <Smartphone size={16} />,
                          label: 'Fast Payments',
                        },
                        { id: 'security', icon: <ShieldCheck size={16} />, label: 'Secure Wallet' },
                      ]
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleInterest(item.id)}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 text-left ${surveyData.interests.includes(item.id) ? 'border-orange-600 bg-orange-500/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-400 hover:border-orange-500/30'}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${surveyData.interests.includes(item.id) ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-500'}`}
                      >
                        {item.icon}
                      </div>
                      <span className="font-bold text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    Terms & Email Verification
                  </h2>
                  <p className="text-neutral-500">
                    Please accept our terms and verify your email. Document upload is optional and can be done later if you want a verified badge.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Terms Acceptance */}
                  <div className="p-5 rounded-2xl border-2 border-white/5 bg-white/5 space-y-3">
                    <button
                      onClick={() =>
                        setSurveyData({ ...surveyData, termsAccepted: !surveyData.termsAccepted })
                      }
                      className="flex items-start gap-3 w-full"
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center transition-all mt-0.5 ${surveyData.termsAccepted ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white/5 border border-white/10'}`}
                      >
                        {surveyData.termsAccepted && <Check size={16} />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-neutral-300">
                          I accept the Terms of Service and Privacy Policy
                        </p>
                        <div className="flex gap-2 mt-1 text-xs text-orange-500">
                          <a
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            Terms of Service
                          </a>
                          <span>•</span>
                          <a
                            href="/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            Privacy Policy
                          </a>
                          <span>•</span>
                          <a
                            href="/restrictions"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            Acceptable Use
                          </a>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Email Verification */}
                  <div className="p-5 rounded-2xl border-2 border-white/5 bg-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${emailVerified ? 'bg-green-600/20 text-green-500' : 'bg-orange-600/20 text-orange-500'}`}
                        >
                          {emailVerified ? <Check size={20} /> : <Mail size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-300">
                            {emailVerified ? 'Email Verified ✓' : 'Verify Your Email'}
                          </p>
                          <p className="text-xs text-neutral-500">{userData?.email}</p>
                        </div>
                      </div>
                      {!emailVerified && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={sendVerificationEmail}
                            disabled={loading || emailVerificationSent}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                          >
                            {emailVerificationSent ? 'Sent' : 'Send'}
                          </button>
                          <button
                            onClick={refreshEmailVerificationStatus}
                            disabled={loading}
                            className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20 transition-all disabled:opacity-50"
                          >
                            Check
                          </button>
                        </div>
                      )}
                    </div>
                    {emailVerificationSent && !emailVerified && (
                      <p className="text-xs text-neutral-500">
                        Check your email for a verification link. It will expire in 24 hours. After opening it, return here and press Check.
                      </p>
                    )}
                    {!emailVerified && (
                      <p className="text-xs text-neutral-500">
                        Email verification is optional while email delivery is being configured. You can continue and verify later.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">Help Us Improve</h2>
                  <p className="text-neutral-500">
                    Your feedback helps us build a better platform for everyone.
                  </p>
                </div>

                <SurveyQuestions onComplete={handleComplete} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              {step > 1 && (
                <button
                  onClick={() => setStep((step - 1) as Step)}
                  className="px-6 py-4 bg-white/5 text-neutral-400 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <ArrowLeft size={20} /> {t.onboarding.back}
                </button>
              )}
            </div>

            <button
              onClick={() => {
                if (step < 7) setStep((step + 1) as Step);
                else handleComplete();
              }}
              disabled={
                loading ||
                (step === 1 &&
                  (isNew
                    ? !surveyData.role
                    : isTrader
                      ? !surveyData.businessType
                      : !surveyData.shoppingHabit)) ||
                (step === 2 &&
                  (isTrader ? !surveyData.businessSize : surveyData.savingsGoal === undefined)) ||
                (step === 5 && !surveyData.termsAccepted)
              }
              className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-orange-900/20"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {step === 7 ? t.onboarding.complete : t.onboarding.next}
                  {step === 7 ? <CheckCircle2 size={20} /> : <ArrowRight size={20} />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurveyQuestions({ onComplete }: { onComplete: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/survey-questions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Failed to fetch survey questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const responseData = Object.entries(responses).map(([questionId, response]) => ({
        questionId,
        response,
      }));

      await fetch('/api/survey-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ responses: responseData }),
      });

      onComplete();
    } catch (err) {
      console.error('Failed to submit survey:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = questions.every((q) => !q.required || responses[q.id] !== undefined);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-neutral-500">
          No survey questions available. You can proceed to the next step.
        </p>
        <button
          onClick={onComplete}
          className="mt-4 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <div key={question.id} className="space-y-3">
          <label className="block text-lg font-bold text-white">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {question.questionType === 'text' && (
            <textarea
              value={responses[question.id] || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-neutral-500 outline-none focus:border-orange-500"
              rows={3}
              placeholder="Your answer..."
            />
          )}

          {question.questionType === 'multiple-choice' && question.options && (
            <div className="space-y-2">
              {question.options.map((option: string, idx: number) => (
                <label key={idx} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={responses[question.id] === option}
                    onChange={(e) => handleResponseChange(question.id, e.target.value)}
                    className="w-4 h-4 text-orange-500 bg-white/5 border-white/10 focus:ring-orange-500"
                  />
                  <span className="text-neutral-300">{option}</span>
                </label>
              ))}
            </div>
          )}

          {question.questionType === 'rating' && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleResponseChange(question.id, rating)}
                  className={`w-12 h-12 rounded-xl border-2 transition-all ${
                    responses[question.id] === rating
                      ? 'border-orange-500 bg-orange-500/20 text-orange-500'
                      : 'border-white/10 bg-white/5 text-neutral-400 hover:border-orange-500/50'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end items-center pt-6">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit & Continue'}
        </button>
      </div>
    </div>
  );
}
