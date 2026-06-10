import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { apiGet, apiPost } from '../services/apiClient';
import Logo from '../components/Logo';

const businessProofOptions = [
  { value: 'rdb_certificate', label: 'RDB certificate' },
  { value: 'patente', label: 'Patente' },
  { value: 'tax_clearance', label: 'Tax certificate' },
  { value: 'business_license', label: 'Business license' },
  { value: 'other_business_proof', label: 'Other business proof' },
];

export default function VerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = (searchParams.get('role') || 'customer').toLowerCase();
  const isTrader = role === 'trader';
  const dashboardPath = `/${isTrader ? 'trader' : 'customer'}`;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestData, setRequestData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [contactStatus, setContactStatus] = useState<any>(null);
  const [otpDestination, setOtpDestination] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    businessCategory: '',
    documentType: 'rdb_certificate',
    documentNumber: '',
    documentText: '',
    file: null as File | null,
  });

  const verified = useMemo(
    () =>
      ['verified', 'business_verified', 'basic_verified', 'auto_verified', 'approved'].includes(
        String(contactStatus?.verificationStatus || requestData?.riskStatus || requestData?.status || '')
      ) || Boolean(contactStatus?.emailVerified && !isTrader),
    [contactStatus, requestData, isTrader]
  );

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [contactRes, requestRes] = await Promise.all([
        apiGet<any>('/api/verification/contact-status'),
        apiGet<any>('/api/verification/my-request', { params: { role } }),
      ]);
      setContactStatus(contactRes);
      setOtpDestination(contactRes.email || '');
      setRequestData(requestRes.request);
      setDocuments(requestRes.documents || []);
      setRiskFlags(requestRes.riskFlags || []);
      const req = requestRes.request || {};
      setForm((prev) => ({
        ...prev,
        businessName: req.businessName || prev.businessName,
        businessCategory: req.businessCategory || prev.businessCategory,
      }));
      return { contactRes, requestRes };
    } catch (err: any) {
      setError(err.message || 'Could not load verification.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const requestEmailOtp = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiPost<any>('/api/verification/email-otp/request', {});
      setOtpDestination(response.destination || otpDestination);
      setOtpSent(true);
      setSuccess(`OTP sent to ${response.destination || 'your email'}.`);
    } catch (err: any) {
      setError(err.message || 'Could not send email OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!otp.trim()) {
      setError('Enter the OTP from your email.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const destination = otpDestination || contactStatus?.email || '';
      await apiPost('/api/verification/otp/verify', {
        channel: 'email',
        destination,
        otp: otp.trim(),
      });
      setSuccess('Email verified. Your customer account is verified.');
      setOtp('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Could not verify OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTraderProof = async () => {
    if (!form.file) {
      setError('Choose one business proof document to upload.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const request = await apiPost<any>('/api/verification/request', {
        role: 'trader',
        legalName: form.businessName || undefined,
        businessName: form.businessName || undefined,
        businessCategory: form.businessCategory || undefined,
        businessActivity: form.businessCategory || undefined,
      });

      const formData = new FormData();
      formData.append('file', form.file);
      formData.append('purpose', 'verification_document');
      const uploaded = await apiPost<any>('/api/upload', formData);

      await apiPost('/api/verification/documents', {
        verificationRequestId: request.request?.id || requestData?.id,
        type: form.documentType,
        licenseTypeId: form.documentType,
        fileUrl: uploaded.url,
        metadata: {
          documentText: form.documentText,
          licenseNumber: form.documentNumber,
          businessName: form.businessName,
          authority: form.documentType === 'rdb_certificate' ? 'RDB' : undefined,
        },
      });

      setSuccess('Business proof sent to admin verification. You will receive your badge after approval.');
      setForm((prev) => ({ ...prev, file: null, documentText: '', documentNumber: '' }));
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Could not submit business proof.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
        <Loader2 className="animate-spin text-orange-500" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Logo dark />
          <Link to={dashboardPath} className="text-sm font-bold text-orange-400">
            Back to dashboard
          </Link>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">
            Verification
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {isTrader ? 'Trader business proof' : 'Customer email verification'}
          </h1>
          <p className="mt-2 text-sm font-medium text-neutral-500">
            {isTrader
              ? 'Upload one document that proves the business exists. RDB certificate is best, but Patente, tax certificate, license, or other official proof is accepted.'
              : 'Customers verify with an OTP sent to their email. No document upload is needed.'}
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={18} /> {success}
          </div>
        )}

        {verified && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-300 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} /> Verification complete.
            </span>
            <button
              type="button"
              onClick={() => navigate(dashboardPath, { replace: true })}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black"
            >
              Dashboard
            </button>
          </div>
        )}

        {!isTrader ? (
          <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Mail size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black">Email OTP</h2>
                <p className="text-xs font-bold text-neutral-500">
                  {contactStatus?.emailVerified ? 'Email already verified' : 'Send a code to your email'}
                </p>
              </div>
            </div>

            {!contactStatus?.emailVerified && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder={otpSent ? 'Enter email OTP' : 'Request OTP first'}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-500"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={requestEmailOtp}
                    disabled={submitting}
                    className="rounded-2xl bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    {otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                  <button
                    type="button"
                    onClick={verifyEmailOtp}
                    disabled={submitting || !otp.trim()}
                    className="rounded-2xl bg-orange-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 space-y-5">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Upload className="text-orange-500" /> One document upload
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Business name"
                value={form.businessName}
                onChange={(value) => setForm({ ...form, businessName: value })}
              />
              <Field
                label="Business activity"
                value={form.businessCategory}
                onChange={(value) => setForm({ ...form, businessCategory: value })}
              />
              <SelectField
                label="Document type"
                value={form.documentType}
                onChange={(value) => setForm({ ...form, documentType: value })}
                options={businessProofOptions}
              />
              <Field
                label="Document number if visible"
                value={form.documentNumber}
                onChange={(value) => setForm({ ...form, documentNumber: value })}
              />
            </div>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Business proof file
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Optional text from document
              </span>
              <textarea
                value={form.documentText}
                onChange={(event) => setForm({ ...form, documentText: event.target.value })}
                placeholder="Paste visible RDB number, TIN, business name, or certificate text if available."
                className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-white outline-none focus:border-orange-500"
              />
            </label>
            <button
              type="button"
              onClick={submitTraderProof}
              disabled={submitting || !form.file}
              className="w-full rounded-2xl bg-orange-600 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="mx-auto animate-spin" /> : 'Send to admin'}
            </button>
          </div>
        )}

        {isTrader && (
          <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 space-y-3">
            <h2 className="text-xl font-black flex items-center gap-2">
              <FileText className="text-orange-500" /> Submitted proof
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm font-bold text-neutral-500">No document sent yet.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {doc.licenseTypeId || doc.type}
                      </p>
                      <p className="text-xs font-bold text-neutral-500">
                        {doc.status} - score {Math.round(Number(doc.autoScore || 0))}/100
                      </p>
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-orange-400">
                      Open
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {riskFlags.length > 0 && (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-6 space-y-3">
            <h2 className="text-lg font-black flex items-center gap-2 text-amber-100">
              <AlertTriangle /> Admin review notes
            </h2>
            {riskFlags.map((flag) => (
              <p key={flag.id} className="text-sm font-bold text-amber-100">
                {flag.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
