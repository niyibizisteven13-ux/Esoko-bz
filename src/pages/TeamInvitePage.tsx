import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck, Store, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  acceptTeamInvitation,
  denyTeamInvitation,
  getTeamInvitation,
} from '../services/teamService';

export default function TeamInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const decision = params.get('decision') || '';
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    phone: '',
    location: '',
    nationalId: '',
    password: '',
    consentAccepted: false,
  });

  const expired = useMemo(() => {
    if (!invitation?.expiresAt) return false;
    return new Date(invitation.expiresAt).getTime() < Date.now();
  }, [invitation]);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setError('Invitation link is missing a token.');
        setLoading(false);
        return;
      }
      try {
        const response = await getTeamInvitation(token);
        setInvitation(response.invitation);
      } catch (err: any) {
        setError(err.message || 'Invitation was not found.');
      } finally {
        setLoading(false);
      }
    };
    loadInvitation();
  }, [token]);

  useEffect(() => {
    if (decision !== 'deny' || !token || !invitation || invitation.status !== 'pending') return;
    handleDeny();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, token, invitation?.id]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const response = await acceptTeamInvitation(token, formData);
      setMessage(response.message || 'Invitation accepted. You can now log in.');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    setError('');
    setSubmitting(true);
    try {
      await denyTeamInvitation(token);
      setMessage('Invitation denied. No team access was created.');
    } catch (err: any) {
      setError(err.message || 'Failed to deny invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-600" size={34} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-white text-neutral-950 rounded-[2rem] p-8 md:p-10 shadow-2xl"
      >
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Store size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Trader Team Invitation</h1>
            <p className="text-neutral-500 font-medium">
              Review the shop access request before you accept.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700 flex items-center gap-3">
            <CheckCircle2 size={20} /> {message}
          </div>
        )}

        {invitation && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Info label="Shop" value={invitation.trader?.businessName || invitation.trader?.name} />
              <Info label="Role" value={invitation.role} />
              <Info label="Branch" value={invitation.branch?.name || 'Main shop'} />
              <Info label="Status" value={expired ? 'Expired' : invitation.status} />
            </div>

            <div className="mb-8 rounded-2xl bg-neutral-50 border border-neutral-100 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
                Permissions Requested
              </p>
              <div className="flex flex-wrap gap-2">
                {(invitation.permissions || ['General shop access']).map((permission: string) => (
                  <span
                    key={permission}
                    className="px-3 py-1 rounded-lg bg-white border border-neutral-100 text-xs font-black uppercase tracking-widest text-neutral-600"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>

            {invitation.status === 'pending' && !expired && !message && (
              <form onSubmit={handleAccept} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Phone Number"
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    required
                  />
                  <Input
                    label="Location"
                    value={formData.location}
                    onChange={(value) => setFormData({ ...formData, location: value })}
                    required
                  />
                </div>
                <Input
                  label="National ID or Verification ID"
                  value={formData.nationalId}
                  onChange={(value) => setFormData({ ...formData, nationalId: value })}
                />
                <Input
                  label="Password for new account"
                  type="password"
                  value={formData.password}
                  onChange={(value) => setFormData({ ...formData, password: value })}
                  placeholder="Only needed if this email is not registered yet"
                />
                <label className="flex items-start gap-3 rounded-2xl border border-neutral-100 p-4 text-sm font-bold text-neutral-600">
                  <input
                    type="checkbox"
                    checked={formData.consentAccepted}
                    onChange={(e) =>
                      setFormData({ ...formData, consentAccepted: e.target.checked })
                    }
                    className="mt-1"
                    required
                  />
                  I consent to join this trader team and allow the shop owner to see my team work
                  activity inside their dashboard.
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-14 rounded-2xl bg-orange-600 text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                    Accept Access
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleDeny}
                    className="h-14 rounded-2xl bg-neutral-100 text-neutral-700 font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <XCircle size={20} /> Deny
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
        {label}
      </p>
      <p className="font-black text-neutral-900">{value || 'N/A'}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-14 rounded-2xl bg-neutral-100 border border-neutral-200 px-4 text-sm font-bold outline-none focus:border-orange-600"
      />
    </label>
  );
}
