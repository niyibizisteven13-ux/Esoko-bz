import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import { observeAuthState, registerWithEmail } from '../services/sessionService';
import { getUser } from '../services/userService';
import { apiPost, apiPut } from '../services/apiClient';
import { emailService } from '../services/emailService';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../components/Logo';

const passwordRequirements = [
  { label: '8+ characters', test: (value: string) => value.length >= 8 },
  { label: 'Uppercase', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Lowercase', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Number', test: (value: string) => /[0-9]/.test(value) },
  { label: 'Special', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function RegisterPage() {
  const { t, language: currentLang } = useLanguage();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [role, setRole] = useState<'customer' | 'trader'>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  const passwordChecks = passwordRequirements.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
  const passwordScore = passwordChecks.filter((requirement) => requirement.met).length;
  const isPasswordStrong = passwordScore === passwordRequirements.length;

  useEffect(() => {
    const unsubscribe = observeAuthState((firebaseUser) => {
      setAuthChecking(false);
      if (!firebaseUser) return;
      setUser(firebaseUser);
      getUser(firebaseUser.id)
        .then((response) => {
          const existingUser = response?.user;
          if (existingUser?.role && existingUser.role !== 'unregistered') {
            navigate(`/${existingUser.role}`, { replace: true });
          }
        })
        .catch(() => {});
    });
    return () => unsubscribe();
  }, [navigate]);

  const withRetry = async (fn: () => Promise<any>, maxRetries = 2) => {
    let lastErr: any;
    for (let i = 0; i <= maxRetries; i += 1) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        if (err.code !== 'auth/network-request-failed' || i === maxRetries) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw lastErr;
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      let currentUser = user;
      if (!currentUser) {
        if (!email || !password) throw new Error('Email and password are required.');
        if (!isPasswordStrong) {
          throw new Error('Use 8+ characters with uppercase, lowercase, number, and special character.');
        }
        const result = await withRetry(() => registerWithEmail(email, name, password, role));
        currentUser = result.user;
      }

      const userData = {
        phone: phone || currentUser.phoneNumber || '',
        email: currentUser.email || email,
        name,
        role,
        language: currentLang,
        referredBy: referralCode || null,
        onboardingComplete: true,
        updatedAt: new Date().toISOString(),
      };

      if (referralCode) {
        void apiPost('/api/referrals', {
          referrerCode: referralCode,
          newUserId: currentUser.id,
          pointsAwarded: 500,
        }).catch((err) => console.error('Referral award failed:', err));
      }

      await apiPut(`/api/users/${currentUser.id}`, userData);

      void apiPost('/api/notifications', {
        userId: currentUser.id,
        message:
          role === 'trader'
            ? 'Welcome to ESOKO. Your shop is ready. Upload one business proof when you want a verified badge.'
            : 'Welcome to ESOKO. You can start shopping and paying now.',
        type: 'success',
        subType: 'system',
      }).catch((notifErr) => console.error('Welcome notification failed:', notifErr));

      if (email) {
        void emailService.sendWelcomeEmail(email, name, role);
      }

      navigate(`/${role}`, { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please go to login.');
      } else {
        setError(err.message || 'Failed to create account.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="animate-spin text-orange-600" size={42} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#050505] py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-[#0a0a0a] p-7 md:p-9 rounded-[2rem] shadow-2xl border border-white/5"
      >
        <div className="text-center mb-8">
          <Logo className="justify-center mb-5" />
          <h2 className="text-3xl font-black text-white tracking-tight">Create Account</h2>
          <p className="text-neutral-500 mt-2 text-sm font-medium">Start now. Verify later when needed.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 text-red-400 rounded-2xl text-xs font-bold border border-red-500/20 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <RoleButton
              active={role === 'customer'}
              icon={<ShoppingBag size={22} />}
              label={t.common.customer}
              onClick={() => setRole('customer')}
            />
            <RoleButton
              active={role === 'trader'}
              icon={<Store size={22} />}
              label={t.common.trader}
              onClick={() => setRole('trader')}
            />
          </div>

          {!user && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputWithIcon
                id="register-email"
                icon={<Mail size={18} />}
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="name@example.com"
                required
              />
              <label className="block">
                <span className="mb-2 block text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                  Password
                </span>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            </div>
          )}

          {!user && (
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${
                    isPasswordStrong ? 'bg-emerald-500' : passwordScore >= 3 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(passwordScore / passwordRequirements.length) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {passwordChecks.map((requirement) => (
                  <span
                    key={requirement.label}
                    className={`text-[10px] font-bold ${requirement.met ? 'text-emerald-400' : 'text-neutral-600'}`}
                  >
                    {requirement.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputWithIcon
              id="register-name"
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Your name"
              required
            />
            <InputWithIcon
              id="register-phone"
              icon={<Phone size={18} />}
              label="Phone"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="078 XXX XXX"
              required
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              className="mt-1"
              required
            />
            <span className="text-sm text-neutral-400">
              I agree to the{' '}
              <Link to="/terms" className="text-orange-500 hover:underline" target="_blank">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-orange-500 hover:underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !acceptTerms || (!user && !isPasswordStrong)}
            className="w-full h-14 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl shadow-orange-900/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Create and Enter <ShieldCheck size={20} /></>}
          </button>

          <p className="text-center text-sm font-medium text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-500 font-bold hover:underline">
              {t.common.login}
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

function RoleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
        active
          ? 'border-orange-600 bg-orange-600/10 text-orange-500'
          : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'
      }`}
    >
      {icon}
      <span className="font-bold text-xs uppercase tracking-widest">{label}</span>
    </button>
  );
}

function InputWithIcon({
  id,
  icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  icon?: React.ReactNode;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black text-neutral-500 uppercase tracking-widest">
        {label}
      </span>
      <div className="relative">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600">{icon}</div>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full h-12 ${icon ? 'pl-12' : 'pl-4'} pr-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600`}
        />
      </div>
    </label>
  );
}
