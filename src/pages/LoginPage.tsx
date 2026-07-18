import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithEmail, registerWithEmail } from '../services/sessionService';
import { apiPost, apiPut } from '../services/apiClient';
import { emailService } from '../services/emailService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Globe,
  TrendingUp,
  Package,
  Store,
  Truck,
  Zap,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../lib/i18n';
import Logo from '../components/Logo';
import CircleShowcase from '../components/CircleShowcase';
import { cn } from '../lib/utils';

/* â”€â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
type Method = 'email';
type PhoneStep = 'input';

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'rw', label: 'RW' },
];

const passwordRequirements = [
  {
    label: '8+ chars',
    test: (value: string) => value.length >= 8,
  },
  {
    label: 'Uppercase',
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: 'Lowercase',
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: 'Number',
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    label: 'Special',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

/* â”€â”€â”€ main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function LoginPage() {
  const { t, language: currentLang, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'customer' | 'trader'>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [langOpen, setLangOpen] = useState(false);

  /* recaptcha */
  /* navigate by role */
  const routeByRole = async (uid: string, userFromLogin: any) => {
    // Use user data from login response - no need for extra API call
    if (userFromLogin) {
      // Login alert emails are sent securely from the server-side login endpoint.

      if (userFromLogin.status === 'suspended') {
        setError('Account suspended. Contact support to restore access.');
        return;
      }

      if (userFromLogin.onboardingComplete === false) {
        navigate('/onboarding');
      } else {
        const role = userFromLogin.role || 'customer';
        console.log(`Routing user to /${role} dashboard`, {
          id: uid,
          role,
          email: userFromLogin.email,
        });
        navigate(role === 'customer' ? '/customer?tab=marketplace' : `/${role}`);
      }
    } else {
      console.warn('No user data available, routing to onboarding');
      navigate('/onboarding');
    }
  };

  /* retry helper for auth calls */
  const withRetry = async (fn: () => Promise<any>, maxRetries = 2) => {
    let lastErr: any;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        if (err.code !== 'auth/network-request-failed' || i === maxRetries) throw err;
        // Wait before retry
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw lastErr;
  };

  /* email login */
  const passwordChecks = passwordRequirements.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
  const passwordScore = passwordChecks.filter((requirement) => requirement.met).length;
  const isPasswordStrong = passwordScore === passwordRequirements.length;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await withRetry(() => loginWithEmail(email, password));
      if (r.redirectTo) {
        if ((r.user?.teamAccessOptions || []).length > 0) {
          navigate('/access-choice', { replace: true });
        } else {
          navigate(
            r.user?.role === 'customer' && r.redirectTo === '/customer'
              ? '/customer?tab=marketplace'
              : r.redirectTo,
            { replace: true }
          );
        }
      } else {
        await routeByRole(r.user.id, r.user);
      }
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network error: Please check your internet connection.');
      } else {
        setError(
          err.code === 'auth/invalid-credential'
            ? 'Invalid email or password. Please try again.'
            : err.message || 'Sign in failed.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }
      if (!isPasswordStrong) {
        throw new Error('Use 8+ characters with uppercase, lowercase, number, and special character.');
      }

      const result = await withRetry(() => registerWithEmail(email, name, password, role));
      const currentUser = result.user;

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
            ? 'Welcome to Makasi. Your shop is ready. Upload one business proof when you want a verified badge.'
            : 'Welcome to Makasi. You can start shopping and paying now.',
        type: 'success',
        subType: 'system',
      }).catch((notifErr) => console.error('Welcome notification failed:', notifErr));

      if (email) {
        void emailService.sendWelcomeEmail(email, name, role);
      }

      navigate(`/${role}`, { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network error: Please check your connection.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please go to login.');
      } else {
        setError(err.message || 'Failed to create account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#050505] font-sans selection:bg-orange-500/20 selection:text-white">
      {/* â”€â”€ left panel (decorative) â”€â”€ */}
      <div className="hidden md:flex flex-col justify-between w-[46%] bg-gradient-to-br from-[#0a0a0a] via-[#050505] to-[#0a0a0a] p-12 relative overflow-hidden border-r border-white/5">
        {/* decorative circles */}
        <div
          className="absolute rounded-full top-8 right-8 pointer-events-none"
          style={{ width: 420, height: 420, border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <CircleShowcase />
        </div>
        <div
          className="absolute rounded-full bottom-10 left-10 pointer-events-none"
          style={{ width: 520, height: 520, border: '1px solid rgba(0,0,0,0.12)' }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.06)', left: '12%', top: '48%' }}
        />
        {/* glow */}
        <div className="absolute w-80 h-80 rounded-full bg-orange-600/10 top-[40%] left-[40%] -translate-x-1/2 -translate-y-1/2 pointer-events-none blur-3xl opacity-50" />

        {/* logo */}
        <div className="relative z-10">
          <Logo className="text-white" />
        </div>

        {/* center content */}
        <div className="relative z-10">
          <p
            className="text-white/90 text-[12px] font-black uppercase tracking-[0.15em] mb-4 inline-flex items-center rounded-full px-3 py-2"
            style={{ border: '0.5px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.2)' }}
          >
            Rwanda's Unified Digital Wallet
          </p>
          <h1 className="text-white text-4xl lg:text-5xl font-black leading-[1.15] tracking-tight mb-8">
            Trade smarter.
            <br />
            <span
              className="text-orange-600"
              style={{ color: 'rgba(255,255,255,1)', textShadow: '0 0 40px rgba(255,255,255,0.15)' }}
            >
              Pay faster.
            </span>
            <br />
            Grow together.
          </h1>
          <div className="flex flex-col gap-4">
            {[
              { icon: <Zap size={16} />, text: 'Instant QR & USSD payments' },
              { icon: <Package size={16} />, text: 'Inventory & sales management' },
              { icon: <Globe size={16} />, text: 'Works on any phone, anywhere' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-100/90 flex-shrink-0" />
                <div className="w-8 h-8 rounded-lg bg-orange-600/15 flex items-center justify-center text-orange-600">
                  {item.icon}
                </div>
                <span className="text-neutral-400 text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* trust badges */}
        <div className="flex gap-4 flex-wrap relative z-10">
          {['Bank-grade Security', 'RIB Regulated', 'ISO 27001'].map((b) => (
            <div
              key={b}
              className="px-3 py-[4px] rounded-[20px] border border-[#FDDCC8] bg-[#FFF3ED] text-[#C94E00] text-[11px] font-semibold uppercase tracking-[0.15em]"
            >
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ right panel (form) â”€â”€ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative border-l border-white/5 bg-[#FAFAFA]">
        {/* top-right controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          {/* language picker */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 bg-white/5 text-xs font-black text-neutral-400 hover:border-orange-500 transition-colors uppercase tracking-widest"
            >
              <Globe size={14} /> {currentLang.toUpperCase()}
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute top-12 right-0 bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden z-50 min-w-[120px] shadow-2xl"
                >
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLanguage(l.code);
                        setLangOpen(false);
                      }}
                      className={cn(
                        'block w-full px-5 py-3 text-xs font-black text-left transition-colors uppercase tracking-widest',
                        currentLang === l.code
                          ? 'bg-orange-600/10 text-orange-500'
                          : 'text-neutral-500 hover:bg-white/5'
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-[10px] font-black hover:bg-orange-700 transition-all shadow-xl shadow-orange-900/20 uppercase tracking-widest active:scale-95"
          >
            {mode === 'login' ? t.common.createAccount : t.common.login}
          </button>
        </div>

        {/* form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'w-full max-w-[440px]',
            mode === 'register' && 'overflow-y-auto max-h-[calc(100vh-5rem)] pb-8'
          )}
          style={
            mode === 'register'
              ? { scrollbarWidth: 'thin', scrollbarColor: '#E05A00 transparent' }
              : undefined
          }
        >
          <div className="mb-10 text-center md:text-left">
            <Logo className="md:hidden justify-center mb-10" />
            <h2 className="text-[32px] font-semibold text-slate-950 tracking-tighter mb-2">
              {mode === 'login' ? t.common.welcomeBackUser : 'Create Account'}
            </h2>
            <p className="text-sm text-slate-600 font-medium tracking-wide">
              {mode === 'login' ? t.common.signInToAccount : 'Start now. Verify later when needed.'}
            </p>
          </div>

          {/* error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold mb-8 overflow-hidden text-center uppercase tracking-widest"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* â”€â”€ email form â”€â”€ */}
          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onSubmit={handleEmailLogin}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="email-login"
                    className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                  >
                    {t.common.emailAddress}
                  </label>
                  <div className="relative group">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-orange-500 transition-colors"
                      size={18}
                    />
                    <input
                      id="email-login"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      className="w-full min-h-[52px] pl-[48px] pr-4 rounded-[10px] border border-[#E8E8E8] bg-[#F5F5F5] text-sm font-bold text-slate-950 outline-none focus:border-[#E05A00] transition-colors duration-200 ease-in-out placeholder:text-neutral-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password-login"
                    className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                  >
                    {t.common.password}
                  </label>
                  <div className="relative group">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-orange-500 transition-colors"
                      size={18}
                    />
                    <input
                      id="password-login"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full min-h-[52px] pl-[48px] pr-12 rounded-[10px] border border-[#E8E8E8] bg-[#F5F5F5] text-sm font-bold text-slate-950 outline-none focus:border-[#E05A00] transition-colors duration-200 ease-in-out placeholder:text-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    title="Forgot Password"
                    className="text-[10px] font-black text-neutral-600 uppercase tracking-widest hover:text-orange-500 transition-colors"
                  >
                    {t.common.forgotPassword}
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] rounded-[10px] bg-orange-600 text-white text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#C94E00] transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{ boxShadow: '0 4px 16px rgba(224,90,0,0.3)' }}
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      {t.common.login} <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      role === 'customer'
                        ? 'border-orange-600 bg-orange-600/10 text-orange-500'
                        : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'
                    }`}
                  >
                    <ShoppingBag size={22} />
                    <span className="font-bold text-xs uppercase tracking-widest">{t.common.customer}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('trader')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      role === 'trader'
                        ? 'border-orange-600 bg-orange-600/10 text-orange-500'
                        : 'border-white/5 bg-white/5 text-neutral-500 hover:border-white/20'
                    }`}
                  >
                    <Store size={22} />
                    <span className="font-bold text-xs uppercase tracking-widest">{t.common.trader}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-email"
                      className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                    >
                      Email
                    </label>
                    <div className="relative group">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                        size={18}
                      />
                      <input
                        id="register-email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                        autoComplete="email"
                        className="w-full min-h-[52px] pl-[48px] pr-4 rounded-[10px] border border-[#E8E8E8] bg-[#F5F5F5] text-sm font-bold text-slate-950 outline-none focus:border-[#E05A00] transition-colors duration-200 ease-in-out placeholder:text-neutral-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-password"
                      className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                    >
                      Password
                    </label>
                    <div className="relative group">
                      <Lock
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                        size={18}
                      />
                      <input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        autoComplete="new-password"
                        className="w-full min-h-[52px] pl-[48px] pr-12 rounded-[10px] border border-[#E8E8E8] bg-[#F5F5F5] text-sm font-bold text-slate-950 outline-none focus:border-[#E05A00] transition-colors duration-200 ease-in-out placeholder:text-neutral-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-name"
                      className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                    >
                      Name
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      className="w-full min-h-[52px] pl-4 pr-4 rounded-[10px] border border-[#E8E8E8] bg-[#F5F5F5] text-sm font-bold text-slate-950 outline-none focus:border-[#E05A00] transition-colors duration-200 ease-in-out placeholder:text-neutral-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-phone"
                      className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1"
                    >
                      Phone
                    </label>
                    <div className="relative group">
                      <Phone
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                        size={18}
                      />
                      <input
                        id="register-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="078 XXX XXX"
                        required
                        className="w-full min-h-[52px] pl-[48px] pr-4 rounded-[10px] border border-[#E8E8E8] bg-[#F5F5F5] text-sm font-bold text-slate-950 outline-none focus:border-[#E05A00] transition-colors duration-200 ease-in-out placeholder:text-neutral-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/5 bg-white/[0.03] p-2">
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
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

                <label className="flex items-start gap-3 rounded-[10px] border border-white/5 bg-white/[0.03] p-4">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(event) => setAcceptTerms(event.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span className="text-sm text-neutral-500">
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
                  disabled={loading || !acceptTerms || !isPasswordStrong}
                  className="w-full h-[52px] rounded-[10px] bg-orange-600 text-white text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#C94E00] transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{ boxShadow: '0 4px 16px rgba(224,90,0,0.3)' }}
                >
                  {loading ? <Loader2 className="animate-spin" /> : <>Create and Enter <ShieldCheck size={20} /></>}
                </button>

                <p className="text-center text-sm font-medium text-neutral-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-orange-500 font-bold hover:underline"
                  >
                    {t.common.login}
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* bottom footer */}
        <p className="absolute bottom-10 text-[10px] text-neutral-700 font-black uppercase tracking-[0.4em] text-center w-full px-12 pointer-events-none">
          Â© 2026 ESOKO Â· Secure Digital Trade Ecosystem
        </p>
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}
