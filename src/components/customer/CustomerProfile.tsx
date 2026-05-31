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
  Hash,
  Award,
  Mail,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';
import { emailService } from '../../services/emailService';
import { VerifiedBadge } from '../VerifiedBadge';
import { isAccountVerified } from '../../lib/verification';

interface CustomerProfileProps {
  userData: any;
}

export default function CustomerProfile({ userData }: CustomerProfileProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const accountVerified = isAccountVerified(userData);

  const getCustomerBadgeLevel = (category?: string) => {
    switch (category) {
      case 'organization':
        return 'customer-organization';
      case 'business':
        return 'customer-business';
      default:
        return 'customer-individual';
    }
  };
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const handleSendWelcomeGuide = async () => {
    if (!userData?.email || emailSending) return;
    setEmailSending(true);
    try {
      await emailService.sendWelcomeEmail(userData.email, userData.name || 'User');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to send guide email');
    } finally {
      setEmailSending(false);
    }
  };

  const [formData, setFormData] = useState({
    name: userData?.name || '',
    phone: userData?.phone || '',
    photoURL: userData?.photoURL || '',
    category: userData?.category || 'individual',
  });

  useEffect(() => {
    setFormData({
      name: userData?.name || '',
      phone: userData?.phone || '',
      photoURL: userData?.photoURL || '',
      category: userData?.category || 'individual',
    });
  }, [userData]);

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
        category: formData.category,
      };

      await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save profile');
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

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden bg-[#0a0a0a] border-white/5"
      >
        <div className="p-8 border-b border-white/5 bg-white/5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">My Profile</h2>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-lg font-black text-white tracking-tight">
                    {userData?.name || 'Customer'}
                  </p>
                  {accountVerified && (
                    <VerifiedBadge
                      level={getCustomerBadgeLevel(userData?.category)}
                      size="xs"
                      showLabel={false}
                      animated
                      className="!border-white/10"
                    />
                  )}
                </div>
              </div>
              {accountVerified ? (
                <VerifiedBadge
                  level={getCustomerBadgeLevel(userData?.category)}
                  size="sm"
                  showLabel={false}
                  animated
                  className="!border-white/10"
                />
              ) : (
                <span className="text-[10px] uppercase tracking-[0.2em] text-yellow-400 font-black">
                  Pending verification
                </span>
              )}
            </div>
            <p className="text-neutral-500 font-bold text-sm uppercase tracking-widest">
              Manage your personal information and account preferences
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-black">
              <span>{userData?.emailVerified ? 'Email confirmed' : 'Email not confirmed'}</span>
              <span className="text-neutral-600">•</span>
              <span>
                {userData?.category
                  ? `${userData.category.charAt(0).toUpperCase()}${userData.category.slice(1)}`
                  : 'Individual'}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-500/20">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 size={18} /> Profile updated successfully!
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left Column: Photo */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Camera size={14} className="text-orange-500" /> {t.common.profilePicture}
              </h3>

              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <div className="w-48 h-48 bg-[#111] rounded-[2.5rem] overflow-hidden border-4 border-white/5 shadow-xl group-hover:border-orange-500 transition-all">
                    {formData.photoURL ? (
                      <img
                        src={formData.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-800">
                        <User size={64} />
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-4 -right-4 w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-xl hover:bg-orange-700 transition-all hover:scale-110 active:scale-95 border border-white/10">
                    <Camera size={20} />
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">
                    {t.common.uploadPhoto}
                  </p>
                  <p className="text-[10px] text-neutral-500 font-bold mt-1">
                    Recommended: Square, max 500KB
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
                    >
                      <Upload size={14} /> {t.common.chooseImage}
                    </button>
                    {formData.photoURL && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoURL: '' })}
                        className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} /> {t.common.removePhoto}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Details */}
            <div className="lg:col-span-2 space-y-8">
              <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-orange-500/20 transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-3xl bg-orange-600 flex items-center justify-center shadow-xl shadow-orange-900/40 group-hover:scale-110 transition-transform">
                    <Mail className="text-white" size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-lg uppercase tracking-tight">
                      Need a Refresher?
                    </h4>
                    <p className="text-neutral-500 font-bold text-[10px] uppercase tracking-widest mt-1">
                      Get the Nexus Quick-Start Guide in your inbox
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendWelcomeGuide}
                  disabled={emailSending || !userData?.email}
                  className="px-8 py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all disabled:opacity-20 flex items-center gap-2"
                >
                  {emailSending ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Mail size={14} />
                  )}
                  {emailSending ? 'Dispatching...' : 'Email Guide'}
                </button>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <User size={14} className="text-orange-500" /> Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-2">
                      {t.common.name}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-2">
                      {t.common.phone}
                    </label>
                    <div className="relative">
                      <Phone
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                        size={18}
                      />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm text-white"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-2">
                      {t.common.category}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm text-white"
                    >
                      <option value="individual" className="bg-[#0a0a0a]">
                        {t.common.individual}
                      </option>
                      <option value="organization" className="bg-[#0a0a0a]">
                        {t.common.organization}
                      </option>
                      <option value="business" className="bg-[#0a0a0a]">
                        {t.common.business}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Hash size={14} className="text-blue-500" /> App Identity
                  </h3>
                  <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10">
                    <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mb-1">
                      Your App Number
                    </p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      {userData?.appNumber || 'Not Assigned'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Award size={14} className="text-purple-500" /> Loyalty Points
                  </h3>
                  <div className="p-6 bg-purple-500/5 rounded-3xl border border-purple-500/10">
                    <p className="text-[10px] font-black text-purple-500/60 uppercase tracking-widest mb-1">
                      Total Points
                    </p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      {userData?.points || 0} PTS
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-10 py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-900/40 disabled:opacity-50 min-w-[200px]"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Save size={18} /> {t.common.saveSettings}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
