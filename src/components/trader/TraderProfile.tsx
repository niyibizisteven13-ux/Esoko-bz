import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../../firebase';
import { doc, updateDoc } from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import {
  User,
  Phone,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  Camera,
  Upload,
  Trash2,
  AlertTriangle,
  Building2,
  MapPin,
  Mail,
  Hash,
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import {
  handleFirestoreError,
  OperationType,
  safeStringify,
} from '../../lib/firestoreErrorHandler';
import { cn } from '../../lib/utils';
import { getCurrentCoordinates } from '../../lib/locationUtils';
import { VerifiedBadge } from '../VerifiedBadge';
import { isAccountVerified } from '../../lib/verification';
import { apiPost } from '../../services/apiClient';

interface TraderProfileProps {
  userData: any;
}

export default function TraderProfile({ userData }: TraderProfileProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const accountVerified = isAccountVerified(userData);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [businessProof, setBusinessProof] = useState<File | null>(null);
  const [businessProofType, setBusinessProofType] = useState('rdb_certificate');

  const [formData, setFormData] = useState({
    name: userData?.name || '',
    phone: userData?.phone || '',
    photoURL: userData?.photoURL || '',
    tin: userData?.tin || '',
    businessName: userData?.businessName || '',
    businessAddress: userData?.businessAddress || '',
    businessCategory: userData?.businessCategory || '',
    lowStockThreshold: userData?.lowStockThreshold || 10,
    coordinates: userData?.coordinates || null,
  });

  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    if (userData) {
      setFormData((prev) => ({
        ...prev,
        name: userData.name || prev.name,
        phone: userData.phone || prev.phone,
        photoURL: userData.photoURL || prev.photoURL,
        tin: userData.tin || prev.tin,
        businessName: userData.businessName || prev.businessName,
        businessAddress: userData.businessAddress || prev.businessAddress,
        businessCategory: userData.businessCategory || prev.businessCategory,
        lowStockThreshold: userData.lowStockThreshold || prev.lowStockThreshold,
        coordinates: userData.coordinates || prev.coordinates,
      }));
    }
  }, [userData]);

  const handleSetLocation = async () => {
    setGettingLocation(true);
    try {
      const coords = await getCurrentCoordinates();
      setFormData((prev) => ({ ...prev, coordinates: coords }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError('Failed to get location: ' + err.message);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const updates: any = {
        name: formData.name,
        phone: formData.phone,
        photoURL: formData.photoURL,
        tin: formData.tin.toUpperCase().trim(),
        businessName: formData.businessName,
        businessAddress: formData.businessAddress,
        businessCategory: formData.businessCategory,
        lowStockThreshold: Number(formData.lowStockThreshold),
        coordinates: formData.coordinates,
      };

      await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(t.profile.error);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError('');
    if (file) {
      if (file.size > 1024 * 1024) {
        setError('Image size too large. Please choose an image under 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.onerror = () => {
        setError('Could not read the selected image. Please try a different file.');
      };
      reader.readAsDataURL(file);
    }
  };

  const submitBusinessProof = async () => {
    setVerificationError('');
    setVerificationSuccess('');

    if (accountVerified) {
      setVerificationSuccess('Your trader badge is already active.');
      return;
    }

    if (!businessProof) {
      setVerificationError('Choose one business proof document first.');
      return;
    }

    setVerificationSubmitting(true);
    try {
      const request = await apiPost<any>('/api/verification/request', {
        role: 'trader',
        legalName: formData.businessName || formData.name || undefined,
        businessName: formData.businessName || undefined,
        businessCategory: formData.businessCategory || undefined,
        businessAddress: formData.businessAddress || undefined,
        tin: formData.tin || undefined,
        businessActivity: formData.businessCategory || undefined,
      });

      const uploadData = new FormData();
      uploadData.append('file', businessProof);
      uploadData.append('purpose', 'verification_document');
      const uploaded = await apiPost<any>('/api/upload', uploadData);

      await apiPost('/api/verification/documents', {
        verificationRequestId: request.request?.id,
        type: businessProofType,
        licenseTypeId: businessProofType,
        fileUrl: uploaded.url,
        metadata: {
          businessName: formData.businessName,
          licenseNumber: formData.tin,
          authority: businessProofType === 'rdb_certificate' ? 'RDB' : undefined,
          source: 'trader_profile',
        },
      });

      setBusinessProof(null);
      if (proofInputRef.current) proofInputRef.current.value = '';
      setVerificationSuccess('Business proof sent. Admin can now approve your trader badge.');
    } catch (err: any) {
      setVerificationError(err.message || 'Could not send business proof.');
    } finally {
      setVerificationSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 flex-shrink-0">
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
            {t.profile.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-lg font-black text-neutral-900 dark:text-white tracking-tight truncate">
              {formData.businessName || formData.name || t.common.trader}
            </p>
            {accountVerified && (
              <VerifiedBadge
                level="verified"
                size="xs"
                showLabel={false}
                animated
                className="!border-white/10"
              />
            )}
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-1 text-sm">
            {t.profile.subtitle}
          </p>
        </div>

        <div className="px-6 pt-6 pb-0 flex-shrink-0 overflow-y-auto">
          <div className="rounded-[2rem] border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-900/10 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center flex-shrink-0">
                    {accountVerified ? <ShieldCheck size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Trader Verification
                    </h3>
                    <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mt-1">
                      {accountVerified
                        ? 'Your business proof is approved and your badge is active.'
                        : 'Upload one business proof. Admin reviews it and gives the badge.'}
                    </p>
                  </div>
                </div>
                {verificationError && (
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">
                    {verificationError}
                  </p>
                )}
                {verificationSuccess && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {verificationSuccess}
                  </p>
                )}
              </div>

              {!accountVerified && (
                <div className="w-full space-y-2">
                  <select
                    value={businessProofType}
                    onChange={(event) => setBusinessProofType(event.target.value)}
                    className="w-full rounded-xl border border-orange-200 dark:border-orange-900/30 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-neutral-900 dark:text-white outline-none"
                  >
                    <option value="rdb_certificate">RDB certificate</option>
                    <option value="patente">Patente</option>
                    <option value="tax_clearance">Tax certificate</option>
                    <option value="business_license">Business license</option>
                    <option value="other_business_proof">Other business proof</option>
                  </select>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button
                      type="button"
                      onClick={() => proofInputRef.current?.click()}
                      className="rounded-xl border border-orange-200 dark:border-orange-900/30 bg-white dark:bg-neutral-900 px-3 py-2 text-left text-xs font-black text-neutral-600 dark:text-neutral-300 truncate"
                    >
                      {businessProof ? businessProof.name : 'Choose document'}
                    </button>
                    <button
                      type="button"
                      onClick={submitBusinessProof}
                      disabled={verificationSubmitting}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {verificationSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                      Send
                    </button>
                  </div>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(event) => setBusinessProof(event.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-xs font-bold border border-green-100 dark:border-green-900/30 flex items-center gap-2">
              <CheckCircle2 size={16} /> {t.profile.success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Photo */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Camera size={18} className="text-orange-600" /> {t.common.profilePicture}
              </h3>

              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-32 h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden border-4 border-white dark:border-neutral-700 shadow-lg group-hover:border-orange-500 transition-all">
                    {formData.photoURL ? (
                      <img
                        src={formData.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        <User size={48} />
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-lg hover:bg-orange-700 transition-all hover:scale-110 active:scale-95">
                    <Camera size={16} />
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                <div className="text-center text-sm">
                  <p className="font-bold text-neutral-900 dark:text-white">
                    {t.common.uploadPhoto}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Max 500KB, square recommended
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      <Upload size={14} /> {t.common.chooseImage}
                    </button>
                    {formData.photoURL && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoURL: '' })}
                        className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 size={14} /> {t.common.removePhoto}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-orange-600" /> {t.profile.businessInfo}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {t.profile.fullName}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white placeholder:text-neutral-400"
                    required
                    placeholder={t.profile.fullNamePlaceholder}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {t.profile.emailReadOnly}
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                      size={16}
                    />
                    <input
                      type="email"
                      value={userData?.email || ''}
                      readOnly
                      className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-500 dark:text-neutral-400 cursor-not-allowed font-medium text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {t.profile.businessName}
                  </label>
                  <div className="relative">
                    <Building2
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                      size={16}
                    />
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white placeholder:text-neutral-400"
                      required
                      placeholder={t.profile.businessNamePlaceholder}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {t.profile.businessAddress}
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                      size={16}
                    />
                    <input
                      type="text"
                      value={formData.businessAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, businessAddress: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white placeholder:text-neutral-400"
                      required
                      placeholder={t.profile.businessAddressPlaceholder}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {t.profile.businessCategory}
                  </label>
                  <select
                    value={formData.businessCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, businessCategory: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">{t.profile.selectCategory}</option>
                    <option value="Retail">{t.profile.categories.retail}</option>
                    <option value="Wholesale">{t.profile.categories.wholesale}</option>
                    <option value="Manufacturing">{t.profile.categories.manufacturing}</option>
                    <option value="Service">{t.profile.categories.service}</option>
                    <option value="Other">{t.profile.categories.other}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.common.phone}
                    </label>
                    <div className="relative">
                      <Phone
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        size={16}
                      />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white placeholder:text-neutral-400"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t.common.tin}
                    </label>
                    <input
                      type="text"
                      value={formData.tin}
                      onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                      className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white placeholder:text-neutral-400"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1">
                    {t.profile.lowStockThreshold}{' '}
                    <AlertTriangle size={12} className="text-orange-500" />
                  </label>
                  <input
                    type="number"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-sm text-slate-900 dark:text-white placeholder:text-neutral-400"
                    min="1"
                  />
                  <p className="text-[9px] text-neutral-400 mt-1">
                    {t.profile.lowStockThresholdDesc}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-orange-600" /> Precise Business Location
                </label>
                <div className="space-y-3">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {formData.coordinates
                          ? `Lat: ${formData.coordinates.lat.toFixed(4)}, Lng: ${formData.coordinates.lng.toFixed(4)}`
                          : 'Location not set'}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Required for nearby searches.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSetLocation}
                      disabled={gettingLocation}
                      className="px-4 py-2 bg-white dark:bg-neutral-800 text-orange-600 border border-orange-200 dark:border-orange-900/30 rounded-lg font-bold text-xs hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all flex items-center gap-2 shadow-sm flex-shrink-0"
                    >
                      {gettingLocation ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <MapPin size={14} />
                      )}
                      {formData.coordinates ? 'Update' : 'Set Location'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.coordinates?.lat || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coordinates: {
                              lat: parseFloat(e.target.value) || 0,
                              lng: formData.coordinates?.lng || 0,
                            },
                          })
                        }
                        placeholder="-1.9441"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all text-xs font-medium text-slate-900 dark:text-white placeholder:text-neutral-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.coordinates?.lng || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coordinates: {
                              lat: formData.coordinates?.lat || 0,
                              lng: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        placeholder="30.0619"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all text-xs font-medium text-slate-900 dark:text-white placeholder:text-neutral-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Sections */}
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Mail size={18} className="text-orange-600" /> {t.profile.emailTesting}
              </h3>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-bold text-orange-900 dark:text-orange-200">
                    {t.profile.testWelcomeEmail}
                  </p>
                  <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-1">
                    {t.profile.testWelcomeEmailDesc.replace('{email}', userData?.email)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/welcome-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: safeStringify({ email: userData.email, name: userData.name }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert(t.profile.emailSentSuccess);
                      } else {
                        throw new Error(data.error || 'Failed to send');
                      }
                    } catch (err: any) {
                      console.error(err);
                      alert(t.profile.emailSentError + err.message);
                    }
                  }}
                  className="w-full py-2 bg-white dark:bg-neutral-800 text-orange-600 border border-orange-200 dark:border-orange-900/30 rounded-lg font-bold text-xs hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={14} /> {t.profile.sendTestEmail}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Hash size={18} className="text-blue-600" /> {t.profile.appIdentity}
              </h3>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">
                    {t.profile.yourAppNumber}
                  </p>
                  <p className="text-lg font-black text-blue-900 dark:text-blue-200 tracking-tighter">
                    {userData?.appNumber || t.profile.notAssigned}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                  <ShieldCheck size={20} />
                </div>
              </div>
              <p className="text-xs text-neutral-500 italic">{t.profile.appIdentityDesc}</p>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="submit"
                disabled={saving}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl font-bold text-base hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200 dark:shadow-none disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Save size={18} /> {t.common.saveSettings}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
