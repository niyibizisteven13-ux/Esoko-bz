import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { apiGet, apiPost } from '../services/apiClient';
import { getCurrentCoordinates } from '../lib/locationUtils';
import Logo from '../components/Logo';

const identityTypes = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'transport_license', label: 'Transport License' },
  { value: 'professional_license', label: 'Professional License' },
  { value: 'other', label: 'Other official document' },
];

export default function VerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = (searchParams.get('role') || 'customer').toLowerCase();
  const isTrader = role === 'trader';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [licenseTypes, setLicenseTypes] = useState<any[]>([]);
  const [requestData, setRequestData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [requiredLicenseIds, setRequiredLicenseIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    legalName: '',
    identityType: 'national_id',
    identityNumber: '',
    phone: '',
    businessName: '',
    businessCategory: '',
    businessAddress: '',
    district: '',
    sector: '',
    cell: '',
    tin: '',
    annualTurnoverRange: 'under_20m',
    hasVatRegistration: false,
    usesEbm: false,
    latitude: '',
    longitude: '',
    businessActivity: '',
    expectedMonthlySales: '',
    paymentMethods: '',
    deliveryNeeds: '',
    referralSource: '',
    licenseStatus: '',
  });
  const [upload, setUpload] = useState({
    file: null as File | null,
    licenseTypeId: isTrader ? 'patente' : 'other',
    expiryDate: '',
    documentText: '',
    licenseNumber: '',
  });

  const requiredLicenses = useMemo(
    () => licenseTypes.filter((license) => requiredLicenseIds.includes(license.id)),
    [licenseTypes, requiredLicenseIds]
  );
  const uploadedLicenseIds = useMemo(
    () => new Set(documents.map((doc) => doc.licenseTypeId || doc.type).filter(Boolean)),
    [documents]
  );
  const nextRequiredLicense = useMemo(
    () => requiredLicenses.find((license) => !uploadedLicenseIds.has(license.id)) || requiredLicenses[0],
    [requiredLicenses, uploadedLicenseIds]
  );
  const dashboardPath = `/${isTrader ? 'trader' : 'customer'}`;
  const verificationSuccessful = ['approved', 'auto_verified'].includes(
    String(requestData?.status || '').toLowerCase()
  );

  useEffect(() => {
    if (!nextRequiredLicense) return;
    setUpload((prev) =>
      prev.licenseTypeId === nextRequiredLicense.id || uploadedLicenseIds.has(prev.licenseTypeId)
        ? prev
        : { ...prev, licenseTypeId: nextRequiredLicense.id }
    );
  }, [nextRequiredLicense, uploadedLicenseIds]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [licenseRes, requestRes] = await Promise.all([
        apiGet<any>('/api/verification/license-types', { params: { role } }),
        apiGet<any>('/api/verification/my-request', { params: { role } }),
      ]);
      setLicenseTypes(licenseRes.licenseTypes || []);
      setRequestData(requestRes.request);
      setDocuments(requestRes.documents || []);
      setRiskFlags(requestRes.riskFlags || []);
      setRequiredLicenseIds(requestRes.requiredLicenseIds || []);
      const req = requestRes.request || {};
      setForm((prev) => ({
        ...prev,
        legalName: req.legalName || prev.legalName,
        identityType: req.identityType || prev.identityType,
        phone: req.phone || prev.phone,
        businessName: req.businessName || prev.businessName,
        businessCategory: req.businessCategory || prev.businessCategory,
        businessAddress: req.businessAddress || prev.businessAddress,
        district: req.district || prev.district,
        sector: req.sector || prev.sector,
        cell: req.cell || prev.cell,
        tin: req.tin || prev.tin,
        annualTurnoverRange: req.annualTurnoverRange || prev.annualTurnoverRange,
        hasVatRegistration: Boolean(req.hasVatRegistration),
        usesEbm: Boolean(req.usesEbm),
        latitude: req.latitude ? String(req.latitude) : prev.latitude,
        longitude: req.longitude ? String(req.longitude) : prev.longitude,
      }));
      return requestRes;
    } catch (err: any) {
      setError(err.message || 'Could not load verification form.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  useEffect(() => {
    if (!loading && window.location.hash === '#documents') {
      document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  const setCurrentLocation = async () => {
    try {
      const coords = await getCurrentCoordinates();
      setForm((prev) => ({
        ...prev,
        latitude: String(coords.lat),
        longitude: String(coords.lng),
      }));
    } catch (err: any) {
      setError(err.message || 'Could not get location.');
    }
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiPost<any>('/api/verification/request', {
        ...form,
        role,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        paymentMethods: form.paymentMethods
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setRequestData(response.request);
      setSuccess('Verification profile saved. Upload the required documents below.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Could not submit verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadDocument = async () => {
    if (!upload.file) {
      setError('Choose a file to upload.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', upload.file);
      const uploaded = await apiPost<any>('/api/upload', formData);
      await apiPost('/api/verification/documents', {
        verificationRequestId: requestData?.id,
        type: upload.licenseTypeId,
        licenseTypeId: upload.licenseTypeId,
        fileUrl: uploaded.url,
        expiryDate: upload.expiryDate || undefined,
        metadata: {
          documentText: upload.documentText,
          licenseNumber: upload.licenseNumber,
        },
      });
      setUpload((prev) => ({ ...prev, file: null, documentText: '', licenseNumber: '' }));
      const latest = await loadData();
      const latestStatus = String(latest?.request?.status || '').toLowerCase();
      if (['approved', 'auto_verified'].includes(latestStatus)) {
        setSuccess('Verification successful. Your badge is active and you are being sent to your dashboard.');
        window.setTimeout(() => navigate(dashboardPath, { replace: true }), 1200);
      } else {
        setSuccess('Document uploaded and auto-checked. We will keep reminding you until verification is complete.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not upload document.');
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Logo dark />
          <Link to={`/${isTrader ? 'trader' : 'customer'}`} className="text-sm font-bold text-orange-400">
            Back to dashboard
          </Link>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">
                Verification Center
              </p>
              <h1 className="mt-2 text-3xl font-black">
                {isTrader ? 'Trader trust verification' : 'Identity verification'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-neutral-500">
                {isTrader
                  ? 'Submit identity, business details, location, and Rwanda business licenses. ESOKO will auto-check the files and escalate risky cases.'
                  : 'Verify your identity with a national ID, passport, transport license, or professional document to protect your wallet.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-w-[220px]">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Current status
              </p>
              <p className="mt-2 text-xl font-black capitalize text-orange-300">
                {(requestData?.riskStatus || requestData?.status || 'pending').replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-neutral-500">
                Auto score: {Math.round(Number(requestData?.autoScore || 0))}/100
              </p>
            </div>
          </div>
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
        {verificationSuccessful && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-300 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} /> Verification complete. Your badge is active.
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

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <form onSubmit={submitRequest} className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 space-y-5">
            <h2 className="text-xl font-black flex items-center gap-2">
              <ShieldCheck className="text-orange-500" /> Verification details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full legal name" value={form.legalName} onChange={(value) => setForm({ ...form, legalName: value })} required />
              <SelectField label="Identity type" value={form.identityType} onChange={(value) => setForm({ ...form, identityType: value })} options={identityTypes} />
              <Field label="ID / passport / license number" value={form.identityNumber} onChange={(value) => setForm({ ...form, identityNumber: value })} required />
              <Field label="Phone number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} required />

              {isTrader && (
                <>
                  <Field label="Business name" value={form.businessName} onChange={(value) => setForm({ ...form, businessName: value })} required icon={<Building2 size={16} />} />
                  <Field label="Business category" value={form.businessCategory} onChange={(value) => setForm({ ...form, businessCategory: value })} required />
                  <Field label="Business address" value={form.businessAddress} onChange={(value) => setForm({ ...form, businessAddress: value })} required />
                  <Field label="TIN" value={form.tin} onChange={(value) => setForm({ ...form, tin: value })} />
                  <Field label="District" value={form.district} onChange={(value) => setForm({ ...form, district: value })} required />
                  <Field label="Sector" value={form.sector} onChange={(value) => setForm({ ...form, sector: value })} />
                  <Field label="Cell" value={form.cell} onChange={(value) => setForm({ ...form, cell: value })} />
                  <SelectField
                    label="Annual turnover range"
                    value={form.annualTurnoverRange}
                    onChange={(value) => setForm({ ...form, annualTurnoverRange: value })}
                    options={[
                      { value: 'under_20m', label: 'Under RWF 20M' },
                      { value: '20m_200m', label: 'RWF 20M - 200M' },
                      { value: '200m_plus', label: 'Above RWF 200M' },
                    ]}
                  />
                  <Field label="Products or services sold" value={form.businessActivity} onChange={(value) => setForm({ ...form, businessActivity: value })} />
                  <Field label="Expected monthly sales" value={form.expectedMonthlySales} onChange={(value) => setForm({ ...form, expectedMonthlySales: value })} />
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold">
                    <input type="checkbox" checked={form.hasVatRegistration} onChange={(e) => setForm({ ...form, hasVatRegistration: e.target.checked })} />
                    VAT registered
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold">
                    <input type="checkbox" checked={form.usesEbm} onChange={(e) => setForm({ ...form, usesEbm: e.target.checked })} />
                    Uses EBM
                  </label>
                  <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-black">Business map location</p>
                        <p className="text-xs text-neutral-500">
                          {form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : 'Not set yet'}
                        </p>
                      </div>
                      <button type="button" onClick={setCurrentLocation} className="rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white">
                        <MapPin size={14} className="inline mr-2" /> Use current location
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button disabled={submitting} className="w-full rounded-2xl bg-orange-600 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white disabled:opacity-50">
              {submitting ? <Loader2 className="mx-auto animate-spin" /> : 'Save verification details'}
            </button>
          </form>

          <div className="space-y-6">
            <div id="documents" className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 space-y-4 scroll-mt-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Upload className="text-orange-500" /> Upload documents
              </h2>
              {!requestData?.id && (
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm font-bold text-blue-100">
                  First save the verification details on the left. Then this upload button becomes active for ID, passport, Patente, VAT/EBM, or other license files.
                </div>
              )}
              {requiredLicenses.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    Required for your profile
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {requiredLicenses.map((license) => (
                      <span key={license.id} className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-amber-100">
                        {license.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <SelectField
                label="Document / license type"
                value={upload.licenseTypeId}
                onChange={(value) => setUpload({ ...upload, licenseTypeId: value })}
                options={licenseTypes.map((license) => ({ value: license.id, label: `${license.name} (${license.authority || 'Authority'})` }))}
              />
              <Field label="License / certificate number" value={upload.licenseNumber} onChange={(value) => setUpload({ ...upload, licenseNumber: value })} />
              <Field label="Expiry date if applicable" type="date" value={upload.expiryDate} onChange={(value) => setUpload({ ...upload, expiryDate: value })} />
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">Document file</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">Optional visible text from document</span>
                <textarea
                  value={upload.documentText}
                  onChange={(event) => setUpload({ ...upload, documentText: event.target.value })}
                  placeholder="Paste visible TIN, business name, authority, or QR text if available."
                  className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-white outline-none focus:border-orange-500"
                />
              </label>
              <button type="button" onClick={uploadDocument} disabled={submitting || !requestData?.id} className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white disabled:opacity-50">
                {submitting ? <Loader2 className="mx-auto animate-spin" /> : 'Upload and auto-check'}
              </button>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 space-y-3">
              <h2 className="text-xl font-black flex items-center gap-2">
                <FileText className="text-orange-500" /> Submitted documents
              </h2>
              {documents.length === 0 ? (
                <p className="text-sm font-bold text-neutral-500">No documents uploaded yet.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{doc.licenseTypeId || doc.type}</p>
                        <p className="text-xs font-bold text-neutral-500">
                          {doc.status} · score {Math.round(Number(doc.autoScore || 0))}/100
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

            {riskFlags.length > 0 && (
              <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 p-6 space-y-3">
                <h2 className="text-lg font-black flex items-center gap-2 text-red-200">
                  <AlertTriangle /> Items to fix
                </h2>
                {riskFlags.map((flag) => (
                  <p key={flag.id} className="text-sm font-bold text-red-100">
                    {flag.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
        {icon}
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
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
