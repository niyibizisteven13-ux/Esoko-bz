import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { observeAuthState, registerWithEmail } from '../services/sessionService';
import { getUser } from '../services/userService';
import { apiPost, apiPut } from '../services/apiClient';
import {
  UserPlus,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Store,
  ShoppingBag,
  Mail,
  Lock,
  Globe,
  Truck,
  Eye,
  EyeOff,
  Phone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailService } from '../services/emailService';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../lib/i18n';
import Logo from '../components/Logo';

const passwordRequirements = [
  { label: '8+ characters', test: (value: string) => value.length >= 8 },
  { label: 'Uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Number', test: (value: string) => /[0-9]/.test(value) },
  { label: 'Special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function RegisterPage() {
  const { t, language: currentLang, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [role, setRole] = useState<'trader' | 'customer' | 'admin' | 'agent'>('customer');
  const [category, setCategory] = useState<'individual' | 'organization' | 'business'>(
    'individual'
  );
  const [tin, setTin] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [systemConfig, setSystemConfig] = useState<any>({ registrationOpen: true });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const navigate = useNavigate();
  const passwordChecks = passwordRequirements.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
  const passwordScore = passwordChecks.filter((requirement) => requirement.met).length;
  const isPasswordStrong = passwordScore === passwordRequirements.length;
  const passwordStrengthLabel =
    passwordScore <= 2 ? 'Weak' : passwordScore <= 4 ? 'Almost strong' : 'Strong';
  const passwordStrengthColor = isPasswordStrong
    ? 'bg-emerald-500'
    : passwordScore >= 3
      ? 'bg-amber-500'
      : 'bg-red-500';

  useEffect(() => {
    const unsubscribe = observeAuthState((firebaseUser) => {
      setAuthChecking(false);
      if (firebaseUser) {
        setUser(firebaseUser);
        getUser(firebaseUser.id)
          .then((response) => {
            const existingUser = response?.user;
            if (existingUser && existingUser.onboardingComplete !== false) {
              navigate(`/${existingUser.role}`);
            }
          })
          .catch(() => {
            // Continue registration flow if user record is not found yet.
          });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  /* retry helper for auth calls */
  const withRetry = async (fn: () => Promise<any>, maxRetries = 2) => {
    let lastErr: any;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        if (err.code !== 'auth/network-request-failed' || i === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw lastErr;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let currentUser = user;

      // If not authenticated, create account with email/password first
      if (!currentUser) {
        if (!email || !password) throw new Error('Email and password are required');
        if (!isPasswordStrong) {
          throw new Error(
            'Use a stronger password with 8+ characters, uppercase, lowercase, a number, and a special character.'
          );
        }
        const result = await withRetry(() => registerWithEmail(email, name, password, role));
        currentUser = result.user;
      }

      // Generate unique 8-digit number
      const appNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

      const userData = {
        phone: phone || currentUser.phoneNumber || '',
        email: currentUser.email || email,
        role,
        name,
        walletBalance: 0,
        loyaltyPoints: referralCode ? 100 : 0, // Bonus for new user if referred
        tier: 'free',
        status: role === 'agent' ? 'pending' : 'active',
        language: currentLang,
        appNumber,
        referredBy: referralCode || null,
        onboardingComplete: role === 'agent' ? true : false,
        features: role === 'agent' ? ['banking_terminal', 'support_tools'] : [],
        createdAt: new Date().toISOString(),
      };

      if (referralCode) {
        // Award points to referrer
        try {
          await apiPost('/api/referrals', {
            referrerCode: referralCode,
            newUserId: currentUser.id,
            pointsAwarded: 500,
          });
        } catch (err) {
          console.error('Referral award failed:', err);
        }
      }

      if (role === 'trader') {
        if (!tin) throw new Error('TIN is required');
        (userData as any).tin = tin.toUpperCase().trim();
      } else if (role === 'customer') {
        (userData as any).category = category;
      }

      // Update user data
      await apiPut(`/api/users/${currentUser.id}`, userData);

      // Send Welcome Email
      if (email) {
        emailService.sendWelcomeEmail(email, name, role);
      }

      // Send welcome notification
      try {
        await apiPost('/api/notifications', {
          userId: currentUser.id,
          message: `Welcome to ESOKO, ${name}! Your professional commerce account is now active. Explore the marketplace and start your journey.`,
          type: 'success',
          subType: 'system',
          read: false,
          timestamp: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.error('Welcome notification failed:', notifErr);
      }

      // Send welcome email via server
      try {
        await fetch('/api/welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email, name: userData.name }),
        });
      } catch (emailErr) {
        console.error('Failed to trigger welcome email:', emailErr);
      }

      // Always go to onboarding first for new registrations
      navigate('/onboarding');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/network-request-failed') {
        setError('Network error: Please check your connection.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please go to the login page instead.');
      } else {
        setError(err.message || 'Failed to complete registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="animate-spin text-orange-600" size={48} />
      </div>
    );
  }

  if (systemConfig && systemConfig.registrationOpen === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#050505]">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-orange-600/10 text-orange-600 rounded-3xl flex items-center justify-center mx-auto border border-orange-600/20">
            <UserPlus size={40} />
          </div>
          <h2 className="text-3xl font-black text-white">Registrations Closed</h2>
          <p className="text-neutral-500">
            New account registrations are currently disabled by the administrator. Please try again
            later or contact support.
          </p>
          <Link
            to="/login"
            className="inline-block text-orange-600 font-bold hover:underline uppercase text-xs tracking-widest"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#050505] py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-[#0a0a0a] p-10 rounded-[2.5rem] shadow-2xl border border-white/5"
      >
        <div className="text-center mb-10">
          <Logo className="justify-center mb-6" />
          <h2 className="text-4xl font-black text-white tracking-tighter">{t.common.signup}</h2>
          <p className="text-neutral-500 mt-2 font-medium">Join the ESOKO ecosystem today</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 text-red-500 rounded-2xl text-xs font-bold border border-red-500/20 text-center uppercase tracking-widest">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-neutral-600" />
              <label htmlFor="language-select" className="sr-only">
                Select Language
              </label>
              <select
                id="language-select"
                value={currentLang}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="text-xs font-black text-neutral-400 bg-white/5 border border-white/5 rounded-xl px-4 py-2 outline-none focus:border-orange-500 transition-all"
              >
                <option value="en">English</option>
                <option value="rw">Kinyarwanda</option>
                <option value="fr">FranÃ§ais</option>
              </select>
            </div>
          </div>

          {!user && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label
                    htmlFor="register-email"
                    className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                  >
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-orange-500 transition-colors"
                      size={18}
                    />
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600 transition-all"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="register-password"
                    className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                  >
                    Password
                  </label>
                  <div className="relative group">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-orange-500 transition-colors"
                      size={18}
                    />
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        Password strength
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${isPasswordStrong ? 'text-emerald-400' : passwordScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}
                      >
                        {passwordStrengthLabel}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${passwordStrengthColor}`}
                        style={{ width: `${(passwordScore / passwordRequirements.length) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {passwordChecks.map((requirement) => (
                        <div
                          key={requirement.label}
                          className={`flex items-center gap-2 text-[11px] font-bold ${requirement.met ? 'text-emerald-400' : 'text-neutral-500'}`}
                        >
                          <ShieldCheck size={13} />
                          <span>{requirement.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-4">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] text-center mb-2">
              Select your role
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${role === 'customer' ? 'border-orange-600 bg-orange-600/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'}`}
              >
                <ShoppingBag size={24} />
                <span className="font-bold text-xs uppercase tracking-widest">
                  {t.common.customer}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRole('trader')}
                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${role === 'trader' ? 'border-orange-600 bg-orange-600/10 text-orange-500' : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'}`}
              >
                <Store size={24} />
                <span className="font-bold text-xs uppercase tracking-widest">
                  {t.common.trader}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRole('agent')}
                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 col-span-2 ${role === 'agent' ? 'border-blue-600 bg-blue-600/10 text-blue-500' : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'}`}
              >
                <ShieldCheck size={24} />
                <span className="font-bold text-xs uppercase tracking-widest">Nexus Agent</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="register-name"
                className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
              >
                {t.common.name}
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full h-12 px-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="register-phone"
                className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
              >
                Phone Number
              </label>
              <div className="relative group">
                <Phone
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                  size={18}
                />
                <input
                  id="register-phone"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="078 XXX XXX"
                  className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600 transition-all"
                  required
                />
              </div>
            </div>

            {role === 'customer' && (
              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="register-category"
                  className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                >
                  {t.common.category}
                </label>
                <select
                  id="register-category"
                  name="category"
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full h-12 px-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600 transition-all"
                >
                  <option value="individual">{t.common.individual}</option>
                  <option value="organization">{t.common.organization}</option>
                  <option value="business">{t.common.business}</option>
                </select>
              </div>
            )}

            {role === 'trader' && (
              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="register-tin"
                  className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                >
                  {t.common.tin}
                </label>
                <input
                  id="register-tin"
                  name="tin"
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder="Enter your TIN"
                  className="w-full h-12 px-4 bg-white/5 border border-white/5 rounded-xl font-bold text-sm text-white outline-none focus:border-orange-600 transition-all"
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="accept-terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1"
                required
              />
              <label htmlFor="accept-terms" className="text-sm text-neutral-700">
                I agree to the{' '}
                <Link to="/terms" className="text-orange-600 hover:underline" target="_blank">
                  Terms of Service
                </Link>
              </label>
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="accept-privacy"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-1"
                required
              />
              <label htmlFor="accept-privacy" className="text-sm text-neutral-700">
                I agree to the{' '}
                <Link to="/privacy" className="text-orange-600 hover:underline" target="_blank">
                  Privacy Policy
                </Link>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptTerms || !acceptPrivacy || (!user && !isPasswordStrong)}
            className="w-full h-14 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl shadow-orange-900/20 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                {user ? 'Complete Registration' : t.common.signup} <ShieldCheck size={20} />
              </>
            )}
          </button>

          <div className="text-center">
            <p className="text-sm font-medium text-neutral-500">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-orange-500 font-bold hover:underline transition-all"
              >
                {t.common.login}
              </Link>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
