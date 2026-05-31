import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginWithEmail } from '../services/sessionService';
import { motion, AnimatePresence } from 'framer-motion';
import { emailService } from '../services/emailService';
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
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../lib/i18n';
import Logo from '../components/Logo';
import { cn } from '../lib/utils';

/* â”€â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
type Method = 'email';
type PhoneStep = 'input';

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'rw', label: 'RW' },
];

/* â”€â”€â”€ main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function LoginPage() {
  const { t, language: currentLang, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [method, setMethod] = useState<Method>('email');
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
        navigate(`/${role}`);
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
          navigate(r.redirectTo, { replace: true });
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

  return (
    <div className="min-h-screen flex bg-[#050505] font-sans selection:bg-orange-500/20 selection:text-white">
      {/* â”€â”€ left panel (decorative) â”€â”€ */}
      <div className="hidden md:flex flex-col justify-between w-[46%] bg-gradient-to-br from-[#0a0a0a] via-[#050505] to-[#0a0a0a] p-12 relative overflow-hidden border-r border-white/5">
        {/* decorative rings */}
        {[340, 520, 700].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-orange-600/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: s, height: s, opacity: 0.12 - i * 0.03 }}
          />
        ))}
        {/* glow */}
        <div className="absolute w-80 h-80 rounded-full bg-orange-600/10 top-[40%] left-[40%] -translate-x-1/2 -translate-y-1/2 pointer-events-none blur-3xl opacity-50" />

        {/* logo */}
        <div className="relative z-10">
          <Logo className="text-white" />
        </div>

        {/* center content */}
        <div className="relative z-10">
          <p className="text-neutral-500 text-[11px] font-black uppercase tracking-[0.15em] mb-4">
            Rwanda's Unified Digital Wallet
          </p>
          <h1 className="text-white text-4xl lg:text-5xl font-black leading-[1.15] tracking-tight mb-8">
            Trade smarter.
            <br />
            <span className="text-orange-600">Pay faster.</span>
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
              className="px-3 py-1.5 rounded-full border border-white/10 text-neutral-500 text-[10px] font-bold uppercase tracking-wider"
            >
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ right panel (form) â”€â”€ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative border-l border-white/5">
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
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-[10px] font-black hover:bg-orange-700 transition-all shadow-xl shadow-orange-900/20 uppercase tracking-widest active:scale-95"
          >
            {t.common.createAccount}
          </Link>
        </div>

        {/* form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px]"
        >
          <div className="mb-10 text-center md:text-left">
            <Logo className="md:hidden justify-center mb-10" />
            <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
              {t.common.welcomeBackUser}
            </h2>
            <p className="text-sm text-neutral-500 font-medium tracking-wide">
              {t.common.signInToAccount}
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
            {method === 'email' && (
              <motion.form
                key="email"
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
                      className="w-full h-14 pl-12 pr-4 rounded-2xl border border-white/5 bg-white/5 text-sm font-bold text-white outline-none focus:border-orange-600 focus:bg-white/10 transition-all placeholder:text-neutral-700"
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
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      required
                      autoComplete="current-password"
                      className="w-full h-14 pl-12 pr-12 rounded-2xl border border-white/5 bg-white/5 text-sm font-bold text-white outline-none focus:border-orange-600 focus:bg-white/10 transition-all placeholder:text-neutral-700"
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
                  className="w-full h-14 rounded-2xl bg-orange-600 text-white text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-orange-700 transition-all disabled:opacity-50 shadow-2xl shadow-orange-900/20 active:scale-[0.98]"
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
