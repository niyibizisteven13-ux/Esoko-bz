import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';
import { cn } from '../lib/utils';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const verificationStarted = useRef(false);
  const email = searchParams.get('email');

  useEffect(() => {
    const verifyEmail = async () => {
      if (verificationStarted.current) return;
      verificationStarted.current = true;
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Verification token is missing. Please check your email link.');
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ token, email }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(
            'Your email has been successfully verified. Your account is ready. You can upload documents later if you want a verified badge.'
          );
          setUserRole(data.user?.role || null);
          setRedirectTo(data.redirectTo || null);
          // Do not redirect automatically - let user click login
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. The link may be expired or invalid.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('Network error. Please check your connection and try again.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <Logo dark className="scale-110" />
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'p-8 rounded-[2.5rem] border backdrop-blur-xl shadow-2xl',
            status === 'verifying' && 'bg-white/5 border-white/10',
            status === 'success' && 'bg-green-600/10 border-green-600/20',
            status === 'error' && 'bg-red-600/10 border-red-600/20'
          )}
        >
          <div className="flex justify-center mb-6">
            {status === 'verifying' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 bg-orange-600/20 text-orange-600 rounded-full flex items-center justify-center"
              >
                <Loader2 size={32} />
              </motion.div>
            )}
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center"
              >
                <CheckCircle size={32} />
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center"
              >
                <XCircle size={32} />
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <h1
              className={cn(
                'text-2xl font-black tracking-tight uppercase',
                status === 'verifying' && 'text-white',
                status === 'success' && 'text-green-400',
                status === 'error' && 'text-red-400'
              )}
            >
              {status === 'verifying' && 'Verifying Email'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
            </h1>

            <p className="text-neutral-400 text-sm font-medium leading-relaxed">{message}</p>

            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 text-orange-500 text-sm font-bold uppercase tracking-widest">
                  <ShieldCheck size={16} />
                  Nexus Access Granted
                </div>
                <button
                  onClick={() => navigate(redirectTo || `/${userRole || 'customer'}`)}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-900/40"
                >
                  Continue to Account
                </button>
                <button
                  onClick={() => navigate(`/verify-account?role=${userRole || 'customer'}#documents`)}
                  className="w-full py-3 bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Get Verified Later
                </button>
              </motion.div>
            )}

            {status === 'error' && (
              <div className="space-y-3 pt-4">
                <p className="text-neutral-500 text-xs">
                  Your verification link is invalid or expired. Please sign in again to request a
                  new link for {email || 'your account'}.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 bg-white/10 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center space-y-2"
        >
          <p className="text-neutral-600 text-xs font-medium">
            Welcome to the Nexus Commerce Platform
          </p>
          <div className="flex items-center justify-center gap-1 text-neutral-700">
            <Mail size={12} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Secure • Verified • Trusted
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
