import React, { useEffect, useMemo, useRef, useState } from 'react';
import ActionModal from '../ui/ActionModal';
import { User, Camera, Mail, Building, CheckCircle2 } from 'lucide-react';
import { apiPost } from '../../services/apiClient';
import { updateUser } from '../../services/userService';
import { auth } from '../../firebase';
import { ProfileImage } from '../VerifiedBadge';
import { cn } from '../../lib/utils';
import { isAccountVerified } from '../../lib/verification';

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
  userData: any;
  onSaved: () => void;
}

export default function ProfileEditModal({ open, onClose, userData, onSaved }: ProfileEditModalProps) {
  const [formData, setFormData] = useState({
    name: userData?.name || '',
    appNumber: userData?.appNumber || '',
    photoURL: userData?.photoURL || '',
    email: userData?.email || '',
    businessName: userData?.businessName || '',
    businessAddress: userData?.businessAddress || '',
    tin: userData?.tin || '',
  });
  const [emailOtp, setEmailOtp] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(Boolean(userData?.emailVerified));
  const [verificationStatus, setVerificationStatus] = useState(
    userData?.verificationStatus || 'pending'
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({
      name: userData?.name || '',
      appNumber: userData?.appNumber || '',
      photoURL: userData?.photoURL || '',
      email: userData?.email || '',
      businessName: userData?.businessName || '',
      businessAddress: userData?.businessAddress || '',
      tin: userData?.tin || '',
    });
    setIsEmailVerified(Boolean(userData?.emailVerified));
    setVerificationStatus(userData?.verificationStatus || 'pending');
    setStatusMessage('');
    setErrorMessage('');
    setEmailOtp('');
  }, [userData, open]);

  const accountVerified = useMemo(
    () => isAccountVerified({ ...userData, verificationStatus }),
    [userData, verificationStatus]
  );

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    if (file.size > 1024 * 1024) {
      setErrorMessage('Choose an image smaller than 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, photoURL: reader.result as string }));
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the selected image.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!auth.currentUser && !userData?.uid) return;
    setErrorMessage('');
    setStatusMessage('');
    setSaving(true);
    try {
      const uid = userData?.uid || auth.currentUser?.uid;
      if (!uid) throw new Error('Unable to resolve current user.');

      const payload: any = {
        name: formData.name,
        appNumber: formData.appNumber || undefined,
        photoURL: formData.photoURL || undefined,
        email: formData.email,
        businessName: formData.businessName || undefined,
        businessAddress: formData.businessAddress || undefined,
        tin: formData.tin || undefined,
      };

      if (formData.email !== userData?.email) {
        payload.emailVerified = false;
      }

      const result = await updateUser(uid, payload);
      if (result?.user) {
        setStatusMessage('Profile saved.');
        setIsEmailVerified(Boolean(result.user.emailVerified));
        setVerificationStatus(result.user.verificationStatus || verificationStatus);
      } else {
        setStatusMessage('Profile saved successfully.');
      }

      onSaved();
    } catch (err: any) {
      console.error('Profile save failed', err);
      setErrorMessage(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const requestEmailOtp = async () => {
    if (!formData.email?.trim()) {
      setErrorMessage('Enter a valid email address first.');
      return;
    }
    setErrorMessage('');
    setStatusMessage('');
    setEmailLoading(true);
    try {
      await apiPost('/api/verification/email-otp/request', {
        destination: formData.email.trim(),
      });
      setStatusMessage(`OTP sent to ${formData.email.trim()}.`);
    } catch (err: any) {
      console.error('Email OTP request failed', err);
      setErrorMessage(err.message || 'Could not send email OTP.');
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!emailOtp.trim()) {
      setErrorMessage('Enter the email OTP first.');
      return;
    }
    setErrorMessage('');
    setStatusMessage('');
    setEmailVerifying(true);
    try {
      const response = await apiPost<any>('/api/verification/otp/verify', {
        channel: 'email',
        destination: formData.email.trim() || undefined,
        otp: emailOtp.trim(),
      });
      setIsEmailVerified(true);
      setEmailOtp('');
      setStatusMessage('Email verified successfully.');
      if (response?.user?.verificationStatus) {
        setVerificationStatus(response.user.verificationStatus);
      }
      onSaved();
    } catch (err: any) {
      console.error('Email OTP verification failed', err);
      setErrorMessage(err.message || 'Could not verify email OTP.');
    } finally {
      setEmailVerifying(false);
    }
  };

  const requestBusinessVerification = async () => {
    setErrorMessage('');
    setStatusMessage('');
    setBusinessSubmitting(true);
    try {
      await apiPost('/api/verification/request', {
        role: 'trader',
        legalName: formData.name || formData.businessName,
        businessName: formData.businessName || formData.name,
        businessAddress: formData.businessAddress,
        tin: formData.tin,
        businessActivity: 'profile_update',
      });
      setStatusMessage('Business verification request sent.');
    } catch (err: any) {
      console.error('Business verification request failed', err);
      setErrorMessage(err.message || 'Could not request business verification.');
    } finally {
      setBusinessSubmitting(false);
    }
  };

  return (
    <ActionModal
      open={open}
      title="Edit profile"
      description="Update your display info, ID number, photo, email, and business details."
      confirmLabel="Save profile"
      cancelLabel="Close"
      loading={saving}
      onClose={onClose}
      onConfirm={handleSave}
      disabled={saving}
    >
      <div className="space-y-4 text-sm text-white/80">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-4">
            <ProfileImage
              src={formData.photoURL}
              alt={formData.name || userData?.businessName || 'Profile'}
              size="lg"
              fallbackIcon={<User size={18} className="text-white" />}
              showOnlineStatus={false}
              verified={accountVerified}
              verificationLevel={userData?.verificationLevel || 'basic'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Current status</p>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest',
                    accountVerified
                      ? 'bg-emerald-600 text-white'
                      : 'bg-yellow-500 text-slate-950'
                  )}
                >
                  <CheckCircle2 size={12} />
                  {accountVerified ? 'Verified' : 'Pending'}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/60">
                  {formData.email ? (isEmailVerified ? 'Email verified' : 'Email pending') : 'Email missing'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Display name</span>
            <input
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0e0e] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              placeholder="Your name"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/50">ID number</span>
            <input
              value={formData.appNumber}
              onChange={(event) => updateField('appNumber', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0e0e0e] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              placeholder="Enter your ID number"
            />
          </label>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0e0e0e] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <Mail size={16} />
              <span className="text-sm font-black uppercase tracking-[0.2em]">Email verification</span>
            </div>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]',
                isEmailVerified ? 'bg-emerald-600 text-white' : 'bg-yellow-500 text-slate-950'
              )}
            >
              {isEmailVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <div className="grid gap-3">
            <input
              value={formData.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              placeholder="you@example.com"
            />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={requestEmailOtp}
                disabled={emailLoading || !formData.email.trim()}
                className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {emailLoading ? 'Sending…' : 'Send OTP'}
              </button>
              <button
                type="button"
                onClick={verifyEmailOtp}
                disabled={emailVerifying || isEmailVerified || !emailOtp.trim()}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {emailVerifying ? 'Verifying…' : 'Verify OTP'}
              </button>
            </div>
            <input
              value={emailOtp}
              onChange={(event) => setEmailOtp(event.target.value)}
              placeholder="Enter OTP"
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0e0e0e] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <Building size={16} />
              <span className="text-sm font-black uppercase tracking-[0.2em]">Business details</span>
            </div>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]',
                accountVerified ? 'bg-emerald-600 text-white' : 'bg-yellow-500 text-slate-950'
              )}
            >
              {accountVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <div className="space-y-3">
            <input
              value={formData.businessName}
              onChange={(event) => updateField('businessName', event.target.value)}
              placeholder="Business name"
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
            <input
              value={formData.businessAddress}
              onChange={(event) => updateField('businessAddress', event.target.value)}
              placeholder="Business address"
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
            <input
              value={formData.tin}
              onChange={(event) => updateField('tin', event.target.value)}
              placeholder="TIN / registration number"
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
            <button
              type="button"
              onClick={requestBusinessVerification}
              disabled={businessSubmitting}
              className="w-full rounded-2xl bg-orange-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {businessSubmitting ? 'Requesting…' : 'Request business verification'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0e0e0e] p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white/10">
              {formData.photoURL ? (
                <img src={formData.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/60">
                  <Camera size={24} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">Profile photo</p>
              <p className="text-xs text-white/50">Upload or replace your profile image.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-white/20"
            >
              Upload photo
            </button>
            {formData.photoURL && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, photoURL: '' }))}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-widest text-white"
              >
                Remove photo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        {statusMessage && <p className="text-sm font-black text-emerald-400">{statusMessage}</p>}
        {errorMessage && <p className="text-sm font-black text-red-500">{errorMessage}</p>}
      </div>
    </ActionModal>
  );
}
