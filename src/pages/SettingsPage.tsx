import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import {
  User,
  Phone,
  Globe,
  ShieldCheck,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Camera,
  Upload,
  LogOut,
  Trash2,
  BellRing,
  Copy,
  CreditCard,
  Fingerprint,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { getUser, updateUser } from '../services/userService';
import { createAccountRole } from '../services/accountService';
import { updateStoredAuthUser } from '../services/sessionService';
import { Language } from '../lib/i18n';
import { cn, formatCurrency } from '../lib/utils';

export default function SettingsPage() {
  const { t, language: currentLang, setLanguage } = useLanguage();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [creatingRole, setCreatingRole] = useState('');

  const sendTestNotification = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await sendNotification(
        uid,
        'This is a test notification from your settings!',
        'success',
        'system'
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to send test notification');
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    language: '' as Language,
    photoURL: '',
    tin: '',
    role: 'customer' as 'customer' | 'trader' | 'manager',
    tier: 'free' as 'free' | 'premium',
    category: 'individual' as 'individual' | 'organization' | 'business',
    lowStockThreshold: 10,
    notificationPrefs: {
      transactionAlerts: true,
      promotionalOffers: true,
      systemUpdates: true,
    },
  });

  const [pinData, setPinData] = useState({ pin: '', confirmPin: '' });
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdatePin = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (pinData.pin !== pinData.confirmPin) {
      setError(t.common.pinMismatch);
      return;
    }
    if (pinData.pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setSaving(true);
    try {
      const response = await updateUser(uid, {
        transactionPin: pinData.pin,
      });
      setSuccess(true);
      setPinData({ pin: '', confirmPin: '' });
      if (response?.user) {
        setUserData(response.user);
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to update PIN');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const response = await getUser(uid);
        if (response?.user) {
          const data = response.user;
          let updatedData = data;

          if (!data.appNumber) {
            const newAppNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
            const updateResponse = await updateUser(uid, { appNumber: newAppNumber });
            if (updateResponse?.user) {
              updatedData = updateResponse.user;
            }
          }

          setUserData(updatedData);
          setFormData({
            name: updatedData.name || '',
            phone: updatedData.phone || '',
            language: (updatedData.language as Language) || currentLang,
            photoURL: updatedData.photoURL || '',
            tin: updatedData.tin || '',
            role: (updatedData.role as 'customer' | 'trader' | 'manager') || 'customer',
            tier: (updatedData.tier as 'free' | 'premium') || 'free',
            category: updatedData.category || 'individual',
            lowStockThreshold: updatedData.lowStockThreshold || 10,
            notificationPrefs: updatedData.notificationPrefs || {
              transactionAlerts: true,
              promotionalOffers: true,
              systemUpdates: true,
            },
          });
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentLang]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const updates: any = {
        name: formData.name,
        phone: formData.phone,
        language: formData.language,
        photoURL: formData.photoURL,
        notificationPrefs: formData.notificationPrefs,
      };

      if (userData.role === 'trader') {
        updates.tin = formData.tin;
        updates.lowStockThreshold = Number(formData.lowStockThreshold);
      }

      if (userData.role === 'customer') {
        updates.category = formData.category;
      }

      const response = await updateUser(uid, updates);
      if (response?.user) {
        setUserData(response.user);
      }

      // Update local language context if changed
      if (formData.language !== currentLang) {
        setLanguage(formData.language);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (role: 'customer' | 'trader') => {
    setCreatingRole(role);
    setError('');
    setSuccess(false);
    try {
      const response = await createAccountRole({ role });
      if (response?.user) updateStoredAuthUser(response.user);
      window.location.href = response?.redirectTo || (role === 'trader' ? '/onboarding' : '/customer');
    } catch (err: any) {
      setError(err.message || `Failed to create ${role} account mode`);
    } finally {
      setCreatingRole('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        // 500KB limit for base64 in Firestore
        setError('Image size too large. Please choose an image under 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-orange-600" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 selection:bg-orange-100 selection:text-orange-900 dark:selection:bg-orange-900/30">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 font-bold mb-8 transition-colors"
      >
        <ArrowLeft size={20} /> {t.customer.back}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden transition-colors duration-300"
      >
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50">
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            {t.common.settings}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-1">
            Manage your account preferences and profile information
          </p>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-2xl text-sm font-bold border border-green-100 dark:border-green-900/30 flex items-center gap-2">
              <CheckCircle2 size={18} /> Settings saved successfully!
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-orange-600" /> Account Modes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['customer', 'trader'] as const).map((role) => {
                const exists = (userData?.accountModes || []).some(
                  (account: any) => account.role === role
                );
                const Icon = role === 'trader' ? Store : ShoppingBag;
                return (
                  <div
                    key={role}
                    className="rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 bg-neutral-50/50 dark:bg-neutral-800/40"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                          {role}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {exists ? 'Available on this login' : 'Create under this email'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={exists || Boolean(creatingRole)}
                      onClick={() => handleCreateRole(role)}
                      className={cn(
                        'w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                        exists
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      )}
                    >
                      {creatingRole === role ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : exists ? (
                        'Already Created'
                      ) : (
                        `Create ${role}`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Camera size={20} className="text-orange-600" /> {t.common.profilePicture}
            </h2>

            <div className="flex items-center gap-8">
              <div className="relative group">
                <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-3xl overflow-hidden border-2 border-neutral-100 dark:border-neutral-800 group-hover:border-orange-500 transition-all">
                  {formData.photoURL ? (
                    <img
                      src={formData.photoURL}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-600">
                      <User size={40} />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-600 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-lg hover:bg-orange-700 transition-all">
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
              <div className="flex-1">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t.common.uploadPhoto}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Recommended: Square image, max 500KB
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    <Upload size={16} /> {t.common.chooseImage}
                  </button>
                  {formData.photoURL && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, photoURL: '' })}
                      className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={16} /> {t.common.removePhoto}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <User size={20} className="text-orange-600" /> Personal Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                  {t.common.name}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-neutral-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                  {t.common.phone}
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
                    size={18}
                  />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-neutral-900 dark:text-white"
                    required
                  />
                </div>
              </div>
              {userData?.role === 'customer' && (
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                    {t.common.category}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-neutral-900 dark:text-white"
                  >
                    <option value="individual">{t.common.individual}</option>
                    <option value="organization">{t.common.organization}</option>
                    <option value="business">{t.common.business}</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-orange-600" /> {t.common.accountTier}
            </h2>
            <div className="p-6 bg-orange-50 dark:bg-orange-900/10 rounded-3xl border border-orange-100 dark:border-orange-900/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-orange-900 dark:text-orange-400 capitalize">
                    {formData.tier === 'premium' ? t.common.premium : t.common.standard} Plan
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-500/80">
                    {formData.tier === 'premium'
                      ? 'You are enjoying all premium features and zero transaction fees.'
                      : t.common.upgradeMessage}
                  </p>
                </div>
                <div
                  className={cn(
                    'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    formData.tier === 'premium'
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-200 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                  )}
                >
                  {formData.tier === 'premium' ? t.common.premium : t.common.standard}
                </div>
              </div>
              {formData.tier !== 'premium' && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(formData.role === 'trader' ? '/trader/wallet' : '/customer/wallet')
                  }
                  className="w-full py-3 bg-white dark:bg-neutral-800 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30 rounded-xl text-sm font-bold hover:bg-orange-600 dark:hover:bg-orange-600 hover:text-white dark:hover:text-white transition-all shadow-sm"
                >
                  {t.common.upgradeNow}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <CreditCard size={20} className="text-orange-600" /> Wallet Information
            </h2>

            <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                    {t.common.yourAppNumber}
                  </p>
                  <p className="text-2xl font-black text-neutral-900 dark:text-white font-mono tracking-wider">
                    {userData?.appNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(userData?.appNumber || '')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-orange-400 border border-neutral-200 dark:border-neutral-700 hover:border-orange-600 dark:hover:border-orange-500'
                  )}
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : t.common.copyAppNumber}
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-4 font-medium italic">
                This is your unique wallet identifier. Share this number to receive money from other
                Bwenge users.
              </p>
            </div>
          </div>

          <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-orange-600" /> {t.common.security}
            </h2>

            <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                  {t.common.walletPasscode}
                </label>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="password"
                        placeholder={
                          userData?.transactionPin
                            ? t.common.changeWalletPasscode
                            : t.common.setWalletPasscode
                        }
                        maxLength={6}
                        className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-mono text-center tracking-[0.5em] text-neutral-900 dark:text-white"
                        onChange={(e) => setPinData({ ...pinData, pin: e.target.value })}
                        value={pinData.pin}
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        placeholder={t.common.confirmWalletPasscode}
                        maxLength={6}
                        className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-mono text-center tracking-[0.5em] text-neutral-900 dark:text-white"
                        onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                        value={pinData.confirmPin}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUpdatePin}
                    disabled={
                      pinData.pin.length < 4 || pinData.pin !== pinData.confirmPin || saving
                    }
                    className="px-6 py-3 bg-slate-900 dark:bg-neutral-800 text-white rounded-xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                  >
                    {userData?.transactionPin ? t.common.change : t.common.save}{' '}
                    {t.common.walletPasscode}
                  </button>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    {t.common.enterPinToAuthorize}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-orange-600/5 dark:bg-orange-600/10 rounded-2xl border border-orange-600/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600/20 text-orange-600 rounded-xl flex items-center justify-center">
                    <Fingerprint size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">
                      Fingerprint Unlock
                    </p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      Use biometrics for quick wallet authorization
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={userData?.biometricEnabled || false}
                    onChange={async (e) => {
                      const uid = auth.currentUser?.uid;
                      if (!uid) return;
                      const response = await updateUser(uid, {
                        biometricEnabled: e.target.checked,
                      });
                      if (response?.user) {
                        setUserData(response.user);
                      } else {
                        setUserData({ ...userData, biometricEnabled: e.target.checked });
                      }
                    }}
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Globe size={20} className="text-blue-600" /> Preferences
            </h2>

            <div>
              <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                Language Preference
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value as Language })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-neutral-900 dark:text-white"
              >
                <option value="en">English</option>
                <option value="rw">Kinyarwanda</option>
                <option value="fr">FranÃ§ais</option>
              </select>
            </div>
          </div>

          {userData?.role === 'trader' && (
            <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={20} className="text-green-600" /> Trader Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                    {t.common.tin}
                  </label>
                  <input
                    type="text"
                    value={formData.tin}
                    onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-neutral-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1">
                    Low Stock Threshold <AlertTriangle size={14} className="text-orange-500" />
                  </label>
                  <input
                    type="number"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })
                    }
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-neutral-900 dark:text-white"
                    min="1"
                  />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                    Alert me when stock falls below this number
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <BellRing size={20} className="text-orange-600" /> Notification Preferences
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
                    Transaction Alerts
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Get notified about your money moves and payments
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.notificationPrefs.transactionAlerts}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notificationPrefs: {
                          ...formData.notificationPrefs,
                          transactionAlerts: e.target.checked,
                        },
                      })
                    }
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
                    Promotional Offers
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Stay updated on the latest deals and store discounts
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.notificationPrefs.promotionalOffers}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notificationPrefs: {
                          ...formData.notificationPrefs,
                          promotionalOffers: e.target.checked,
                        },
                      })
                    }
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
                    System Updates
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Important notices about your Nexus account security
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.notificationPrefs.systemUpdates}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notificationPrefs: {
                          ...formData.notificationPrefs,
                          systemUpdates: e.target.checked,
                        },
                      })
                    }
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-200 dark:shadow-none disabled:opacity-50 active:scale-95"
            >
              {saving ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <Save size={20} /> {t.common.saveSettings}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="p-8 bg-neutral-50/50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                Notifications Test
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Send a test notification to verify the system is working.
              </p>
            </div>
            <button
              type="button"
              onClick={sendTestNotification}
              className="px-6 py-3 bg-white dark:bg-neutral-800 text-orange-600 dark:text-orange-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold hover:bg-orange-50 dark:hover:bg-neutral-700 transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <BellRing size={18} /> Send Test
            </button>
          </div>
        </div>

        <div className="p-8 bg-red-50/50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-red-900 dark:text-red-400">Sign Out</p>
              <p className="text-xs text-red-600 dark:text-red-500/80">
                Finished for now? Securely log out of your account.
              </p>
            </div>
            <button
              onClick={() => navigate('/logout')}
              className="px-6 py-3 bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-neutral-700 transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <LogOut size={18} /> {t.common.logout}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
