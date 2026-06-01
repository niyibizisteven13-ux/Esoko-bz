import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost } from '../../services/apiClient';
import { isAccountVerified } from '../../lib/verification';

interface TrustVerificationPanelProps {
  userData: any;
  role: 'customer' | 'trader';
}

type ContactStatus = {
  emailVerified: boolean;
  whatsappVerified: boolean;
  verificationStatus: string;
};

export default function TrustVerificationPanel({ userData, role }: TrustVerificationPanelProps) {
  const [phone, setPhone] = useState(userData?.phone || '');
  const [emailOtp, setEmailOtp] = useState('');
  const [whatsappOtp, setWhatsappOtp] = useState('');
  const [status, setStatus] = useState<ContactStatus>({
    emailVerified: Boolean(userData?.emailVerified),
    whatsappVerified: false,
    verificationStatus: userData?.verificationStatus || 'pending',
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const verified = isAccountVerified({ ...userData, verificationStatus: status.verificationStatus });

  useEffect(() => {
    setPhone(userData?.phone || '');
  }, [userData?.phone]);

  useEffect(() => {
    let mounted = true;
    apiGet<ContactStatus & { success: boolean }>('/api/verification/contact-status')
      .then((res) => {
        if (!mounted) return;
        setStatus({
          emailVerified: Boolean(res.emailVerified),
          whatsappVerified: Boolean(res.whatsappVerified),
          verificationStatus: res.verificationStatus || userData?.verificationStatus || 'pending',
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [userData?.verificationStatus]);

  const requestEmailOtp = async () => {
    setLoading('email-request');
    setError('');
    setMessage('');
    try {
      await apiPost('/api/verification/email-otp/request', {});
      setMessage(`Email OTP sent to ${userData?.email}.`);
    } catch (err: any) {
      setError(err.message || 'Could not send email OTP.');
    } finally {
      setLoading(null);
    }
  };

  const requestWhatsAppOtp = async () => {
    if (!phone.trim()) {
      setError('Enter your WhatsApp number first.');
      return;
    }
    setLoading('whatsapp-request');
    setError('');
    setMessage('');
    try {
      const res = await apiPost<any>('/api/verification/whatsapp-otp/request', {
        phone: phone.trim(),
      });
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
      }
      setMessage(
        res.autoSent
          ? `WhatsApp OTP sent from ${res.sender || '+250795806631'} to ${phone}.`
          : 'WhatsApp OTP was created, but automatic sending needs a WhatsApp API provider. The owner handoff opened.'
      );
    } catch (err: any) {
      setError(err.message || 'Could not request WhatsApp OTP.');
    } finally {
      setLoading(null);
    }
  };

  const verifyOtp = async (channel: 'email' | 'whatsapp') => {
    const otp = channel === 'email' ? emailOtp.trim() : whatsappOtp.trim();
    const destination = channel === 'email' ? userData?.email : phone.trim();
    if (!otp) {
      setError('Enter the OTP first.');
      return;
    }
    setLoading(`${channel}-verify`);
    setError('');
    setMessage('');
    try {
      const res = await apiPost<any>('/api/verification/otp/verify', {
        channel,
        destination,
        otp,
      });
      setStatus((prev) => ({
        ...prev,
        emailVerified: channel === 'email' ? true : prev.emailVerified,
        whatsappVerified: channel === 'whatsapp' ? true : prev.whatsappVerified,
        verificationStatus: res.user?.verificationStatus || prev.verificationStatus,
      }));
      if (channel === 'email') setEmailOtp('');
      if (channel === 'whatsapp') setWhatsappOtp('');
      setMessage(
        res.verified
          ? 'Email and WhatsApp are verified. Your badge is now active.'
          : `${channel === 'email' ? 'Email' : 'WhatsApp'} verified. Complete the other OTP to activate your badge.`
      );
    } catch (err: any) {
      setError(err.message || 'Could not verify OTP.');
    } finally {
      setLoading(null);
    }
  };

  const StepBadge = ({ done }: { done: boolean }) => (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
        done
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
      }`}
    >
      <CheckCircle2 size={12} /> {done ? 'Verified' : 'OTP needed'}
    </span>
  );

  return (
    <div className="rounded-3xl border border-orange-200/60 bg-orange-50/80 p-5 dark:border-orange-900/30 dark:bg-orange-900/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-orange-600" size={20} />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Authentication verification
            </h3>
          </div>
          <p className="mt-1 text-xs font-bold text-neutral-600 dark:text-neutral-400">
            Verify email and WhatsApp by OTP. When both pass, your {role} badge activates.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
            verified
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300'
          }`}
        >
          {verified ? 'Badge active' : status.verificationStatus || 'Pending'}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/70 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
              <Mail size={18} className="text-orange-600" /> Email OTP
            </div>
            <StepBadge done={status.emailVerified} />
          </div>
          <p className="mb-3 text-xs font-bold text-neutral-500">{userData?.email}</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={emailOtp}
              onChange={(event) => setEmailOtp(event.target.value)}
              placeholder="6 digit OTP"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
            <button
              type="button"
              onClick={requestEmailOtp}
              disabled={Boolean(loading) || status.emailVerified}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {loading === 'email-request' ? <Loader2 className="animate-spin" size={16} /> : 'Send'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => verifyOtp('email')}
            disabled={Boolean(loading) || status.emailVerified}
            className="mt-3 w-full rounded-xl bg-orange-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40"
          >
            {loading === 'email-verify' ? 'Checking...' : 'Verify email'}
          </button>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
              <MessageCircle size={18} className="text-emerald-600" /> WhatsApp OTP
            </div>
            <StepBadge done={status.whatsappVerified} />
          </div>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+250..."
            className="mb-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={whatsappOtp}
              onChange={(event) => setWhatsappOtp(event.target.value)}
              placeholder="6 digit OTP"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
            <button
              type="button"
              onClick={requestWhatsAppOtp}
              disabled={Boolean(loading) || status.whatsappVerified}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40"
            >
              {loading === 'whatsapp-request' ? <Loader2 className="animate-spin" size={16} /> : 'Send'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => verifyOtp('whatsapp')}
            disabled={Boolean(loading) || status.whatsappVerified}
            className="mt-3 w-full rounded-xl bg-orange-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40"
          >
            {loading === 'whatsapp-verify' ? 'Checking...' : 'Verify WhatsApp'}
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-xs font-bold text-emerald-600">{message}</p>}
      {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
