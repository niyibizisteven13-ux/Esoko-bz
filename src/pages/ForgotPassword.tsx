import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { requestPasswordReset } from '../services/authService';
import Logo from '../components/Logo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-neutral-50 dark:bg-black selection:bg-orange-100 selection:text-orange-900 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full card p-6 md:p-10 shadow-2xl relative overflow-hidden"
      >
        <div className="text-center mb-10">
          <Logo className="justify-center mb-8 scale-110" />
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Reset Password
          </h2>
          <p className="text-neutral-400 font-medium mt-1">We'll send you a link to get back in</p>
        </div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded-2xl flex items-center justify-center mx-auto border border-green-100 dark:border-green-500/10">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Check your email
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                We've sent a password reset link to <br />
                <span className="font-bold text-slate-900 dark:text-white">{email}</span>
              </p>
            </div>
            <Link
              to="/login"
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              Back to Login <ArrowLeft size={20} />
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2 ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400"
                  size={20}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="input-field pl-14 shadow-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-5 flex items-center justify-center gap-3 group shadow-2xl shadow-orange-900/20"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Send Reset Link{' '}
                  <ChevronRight
                    size={20}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-neutral-400 hover:text-orange-600 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </form>
        )}
      </motion.div>
    </div>
  );
}
