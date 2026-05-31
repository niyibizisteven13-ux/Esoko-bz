import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';
import { verifyResetToken } from '../services/authService';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!token) throw new Error('Invalid or expired reset token');
      await verifyResetToken(token, newPassword);

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!email || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-neutral-50">
        <div className="text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-red-500" />
          <h2 className="text-2xl font-bold text-slate-900">Invalid Reset Link</h2>
          <p className="text-neutral-500">This password reset link is invalid or has expired.</p>
          <button
            onClick={() => navigate('/login')}
            className="text-orange-600 font-bold hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

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
            New Password
          </h2>
          <p className="text-neutral-400 font-medium mt-1">Set a secure password for {email}</p>
        </div>

        {success ? (
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
                Password Updated!
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                Your password has been successfully reset. <br />
                Redirecting you to login...
              </p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2 ml-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400"
                    size={20}
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    className="input-field pl-14 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2 ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400"
                    size={20}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    className="input-field pl-14 shadow-sm"
                    required
                  />
                </div>
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
                  Update Password{' '}
                  <ChevronRight
                    size={20}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
