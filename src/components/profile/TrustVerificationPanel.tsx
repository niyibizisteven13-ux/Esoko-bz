import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Mail, MessageCircle, ShieldCheck, Upload } from 'lucide-react';
import { auth } from '../../firebase';
import { apiGet, apiPost, apiPut } from '../../services/apiClient';
import { isAccountVerified } from '../../lib/verification';

interface TrustVerificationPanelProps {
  userData: any;
  role: 'customer' | 'trader';
}

const supportWhatsApp =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || '+250795806631';

function normalizeWhatsApp(phone: string) {
  return phone.replace(/[^\d]/g, '');
}

function buildCheckCode(userData: any) {
  const seed = String(userData?.appNumber || userData?.id || userData?.uid || 'ESOKO').slice(-6);
  return `ESOKO-${seed.toUpperCase()}`;
}

export default function TrustVerificationPanel({ userData, role }: TrustVerificationPanelProps) {
  const [phone, setPhone] = useState(userData?.phone || '');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const verified = isAccountVerified(userData);
  const isTrader = role === 'trader';
  const checkCode = useMemo(() => buildCheckCode(userData), [userData]);

  useEffect(() => {
    setPhone(userData?.phone || '');
  }, [userData?.phone]);

  useEffect(() => {
    let mounted = true;
    apiGet<any>('/api/verification/my-request', { params: { role } })
      .then((res) => {
        if (!mounted) return;
        setRequestData(res.request || null);
        setDocuments(res.documents || []);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [role]);

  const openWhatsAppCheck = () => {
    const target = normalizeWhatsApp(supportWhatsApp);
    const text = [
      'ESOKO WhatsApp verification request',
      `Code: ${checkCode}`,
      `Name: ${userData?.name || userData?.businessName || 'User'}`,
      `Email: ${userData?.email || 'not provided'}`,
      `WhatsApp: ${phone || 'not provided'}`,
      `Role: ${role}`,
    ].join('\n');
    if (target) {
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const submitVerification = async () => {
    const userId = auth.currentUser?.uid || userData?.id || userData?.uid;
    if (!userId) {
      setError('Please sign in again before requesting verification.');
      return;
    }
    if (!phone.trim()) {
      setError('Add your WhatsApp number first.');
      return;
    }
    if (isTrader && !proofFile && documents.length === 0) {
      setError('Upload one business proof file so admin can review your trader badge.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await apiPut(`/api/users/${userId}`, {
        phone: phone.trim(),
        whatsappNumber: phone.trim(),
        whatsappCheckCode: checkCode,
      });

      const requestRes = await apiPost<any>('/api/verification/request', {
        role,
        legalName: userData?.name || userData?.businessName || '',
        phone: phone.trim(),
        whatsappNumber: phone.trim(),
        whatsappCheckCode: checkCode,
        businessName: userData?.businessName || '',
        businessCategory: userData?.businessCategory || '',
        businessAddress: userData?.businessAddress || userData?.location || '',
        tin: userData?.tin || '',
        contactVerification: {
          emailVerified: Boolean(userData?.emailVerified),
          whatsappCheckCode: checkCode,
          source: 'profile_trust_panel',
        },
      });

      let latestDocuments = documents;
      if (isTrader && proofFile) {
        const body = new FormData();
        body.append('file', proofFile);
        const uploaded = await apiPost<any>('/api/upload', body);
        await apiPost('/api/verification/documents', {
          verificationRequestId: requestRes.request?.id,
          type: 'business_proof',
          licenseTypeId: 'business_proof',
          fileUrl: uploaded.url,
          metadata: {
            businessName: userData?.businessName || '',
            tin: userData?.tin || '',
            whatsappNumber: phone.trim(),
            whatsappCheckCode: checkCode,
            source: 'profile_trust_panel',
          },
        });
        latestDocuments = [...documents, { fileUrl: uploaded.url, type: 'business_proof' }];
        setProofFile(null);
      }

      setRequestData(requestRes.request || null);
      setDocuments(latestDocuments);
      setMessage(
        isTrader
          ? 'Verification sent to admin. You will get your badge after review.'
          : 'Contact verification saved. Admin can review it from the control center.'
      );
    } catch (err: any) {
      setError(err.message || 'Could not submit verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-orange-200/60 bg-orange-50/80 p-5 dark:border-orange-900/30 dark:bg-orange-900/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-orange-600" size={20} />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Trust verification
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className={userData?.emailVerified ? 'text-emerald-600' : 'text-orange-600'}>
              <Mail size={12} className="mr-1 inline" />
              {userData?.emailVerified ? 'Email verified' : 'Email pending'}
            </span>
            <span className={verified ? 'text-emerald-600' : 'text-neutral-500'}>
              <CheckCircle2 size={12} className="mr-1 inline" />
              {verified ? 'Badge active' : requestData?.status || 'Not reviewed'}
            </span>
            {documents.length > 0 && (
              <span className="text-blue-600">
                <FileText size={12} className="mr-1 inline" />
                {documents.length} proof file{documents.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={openWhatsAppCheck}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700"
        >
          <MessageCircle size={16} /> WhatsApp check
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+250..."
          className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-orange-900/30 dark:bg-neutral-900 dark:text-white"
        />
        {isTrader && (
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-orange-700 hover:bg-orange-100 dark:border-orange-900/30 dark:bg-neutral-900 dark:text-orange-300">
            <Upload size={16} />
            {proofFile ? 'File ready' : 'One proof file'}
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={(event) => setProofFile(event.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
          Code {checkCode}. Questions are light; terms and real contact ownership still matter.
        </p>
        <button
          type="button"
          onClick={submitVerification}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          Send to admin
        </button>
      </div>

      {message && <p className="mt-3 text-xs font-bold text-emerald-600">{message}</p>}
      {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
