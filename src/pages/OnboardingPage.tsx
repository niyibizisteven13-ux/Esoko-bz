import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Monitor,
  ShoppingBag,
  Smartphone,
  Store,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiGet, apiPost, apiPut } from '../services/apiClient';
import { getCurrentUser } from '../services/sessionService';
import Logo from '../components/Logo';

type Role = 'customer' | 'trader';
type Step = 1 | 2 | 3;

const traderPurposeOptions = ['Retail shop', 'Wholesale', 'Food and grocery', 'Services', 'Other'];
const customerPurposeOptions = [
  'Buy for home',
  'Buy for business',
  'Find deals',
  'Track receipts',
  'Other',
];

const traderGoals = ['Sell faster', 'Track stock', 'Send receipts', 'Get verified', 'Backup sales'];
const customerGoals = [
  'Find nearby shops',
  'Save receipts',
  'Pay quickly',
  'Compare prices',
  'Offline access',
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [role, setRole] = useState<Role>('customer');
  const [purpose, setPurpose] = useState('');
  const [primaryDevice, setPrimaryDevice] = useState('Smartphone');
  const [interests, setInterests] = useState<string[]>([]);

  const purposeOptions = role === 'trader' ? traderPurposeOptions : customerPurposeOptions;
  const goalOptions = role === 'trader' ? traderGoals : customerGoals;
  const dashboardPath = role === 'trader' ? '/trader' : '/customer?tab=marketplace';

  const title = useMemo(() => {
    if (step === 1) return role === 'trader' ? 'What do you sell?' : 'How will you use Bwenge?';
    if (step === 2) return 'Main device';
    return 'Pick your goals';
  }, [role, step]);

  useEffect(() => {
    const load = async () => {
      const sessionUser = await getCurrentUser();
      if (!sessionUser) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const response = await apiGet<{ user: any }>(`/api/users/${sessionUser.id}`);
        const profile = response?.user || sessionUser;
        const profileRole: Role = profile.role === 'trader' ? 'trader' : 'customer';

        setUserData(profile);
        setRole(profileRole);
        setPrimaryDevice(profile.primaryDevice || 'Smartphone');
        setInterests(Array.isArray(profile.interests) ? profile.interests : []);
        setPurpose(profile.businessType || profile.shoppingHabit || '');
      } catch (err: any) {
        setUserData(sessionUser);
        setRole(sessionUser.role === 'trader' ? 'trader' : 'customer');
        setError(err.message || 'Could not load your profile, but you can still continue.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const toggleInterest = (goal: string) => {
    setInterests((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]
    );
  };

  const saveAndEnter = async (skip = false) => {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      navigate('/login', { replace: true });
      return;
    }

    setSaving(true);
    setError('');

    const payload: any = {
      onboardingComplete: true,
      dashboardPreference: 'classic',
      primaryDevice,
      interests,
      updatedAt: new Date().toISOString(),
    };

    if (!skip) {
      if (role === 'trader') payload.businessType = purpose;
      if (role === 'customer') payload.shoppingHabit = purpose;
    }

    try {
      await apiPut(`/api/users/${sessionUser.id}`, payload);

      void apiPost('/api/onboarding/research', {
        role,
        responses: {
          purpose,
          primaryDevice,
          interests,
          skipped: skip,
          completedAt: new Date().toISOString(),
        },
      }).catch((err) => console.error('Onboarding research save failed:', err));

      void apiPost('/api/notifications', {
        userId: sessionUser.id,
        message:
          role === 'trader'
            ? 'Your shop setup is ready. Upload one business proof later to get verified.'
            : 'Your market setup is ready. You can shop now and verify email for account recovery.',
        type: 'success',
        subType: 'system',
      }).catch((err) => console.error('Onboarding notification failed:', err));

      navigate(dashboardPath, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not save setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 1 && !purpose) {
      setError('Choose one option or skip setup.');
      return;
    }
    setError('');
    setStep((current) => (current < 3 ? ((current + 1) as Step) : current));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="animate-spin text-orange-600" size={42} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white px-4 py-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <Logo />
          <button
            type="button"
            onClick={() => saveAndEnter(true)}
            disabled={saving}
            className="text-xs font-black uppercase tracking-widest text-neutral-500 hover:text-white disabled:opacity-50"
          >
            Skip
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] p-5 md:p-8 shadow-2xl">
          <div className="mb-8">
            <div className="mb-5 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className={`h-1.5 rounded-full ${item <= step ? 'bg-orange-600' : 'bg-white/10'}`}
                />
              ))}
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-500">
              Step {step} of 3
            </p>
            <h1 className="mt-2 text-2xl md:text-4xl font-black tracking-tight">{title}</h1>
            <p className="mt-3 max-w-xl text-sm text-neutral-400">
              {role === 'trader'
                ? 'This only tunes your dashboard. Verification and business documents stay separate.'
                : 'This only tunes your market view. Email verification can happen after you enter.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {purposeOptions.map((option) => (
                <OptionButton
                  key={option}
                  active={purpose === option}
                  onClick={() => setPurpose(option)}
                >
                  {role === 'trader' ? <Store size={20} /> : <ShoppingBag size={20} />}
                  <span>{option}</span>
                </OptionButton>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <OptionButton
                active={primaryDevice === 'Smartphone'}
                onClick={() => setPrimaryDevice('Smartphone')}
              >
                <Smartphone size={22} />
                <span>Smartphone</span>
              </OptionButton>
              <OptionButton
                active={primaryDevice === 'Computer'}
                onClick={() => setPrimaryDevice('Computer')}
              >
                <Monitor size={22} />
                <span>Computer</span>
              </OptionButton>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {goalOptions.map((goal) => (
                <OptionButton
                  key={goal}
                  active={interests.includes(goal)}
                  onClick={() => toggleInterest(goal)}
                >
                  <CheckCircle2 size={20} />
                  <span>{goal}</span>
                </OptionButton>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                step === 1
                  ? navigate(dashboardPath, { replace: true })
                  : setStep((step - 1) as Step)
              }
              className="h-12 px-5 rounded-xl border border-white/10 text-sm font-black text-neutral-300 hover:bg-white/5 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} />
              Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="h-12 px-6 rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-orange-500 flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => saveAndEnter(false)}
                disabled={saving}
                className="h-12 px-6 rounded-xl bg-orange-600 text-sm font-black text-white hover:bg-orange-500 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Enter App
              </button>
            )}
          </div>
        </div>

        {userData?.name && (
          <p className="mt-5 text-center text-xs font-bold text-neutral-600">
            Signed in as {userData.name}
          </p>
        )}
      </motion.div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[76px] rounded-2xl border p-4 text-left font-black transition flex items-center gap-3 ${
        active
          ? 'border-orange-500 bg-orange-500/15 text-white'
          : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      <span
        className={`flex items-center gap-3 ${active ? 'text-orange-400' : 'text-neutral-500'}`}
      >
        {children}
      </span>
    </button>
  );
}
