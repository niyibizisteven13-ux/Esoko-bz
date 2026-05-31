import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  CreditCard,
  Smartphone,
  Landmark,
  Zap,
  Globe,
  Users,
  Bus,
  Send,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDocs,
} from '../services/firestoreBridge';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';
import { Star, StarOff } from 'lucide-react';
import {
  RWANDAN_BANKS,
  MOBILE_MONEY_PROVIDERS,
  DIGITAL_WALLETS,
  GOV_UTILITY_PAYMENTS,
  REMITTANCE_SERVICES,
  CARD_SCHEMES,
} from '../constants/rwandaPayments';

interface LinkedAccount {
  id: string;
  userId: string;
  type: 'bank' | 'momo' | 'regional_momo' | 'wallet' | 'card' | 'utility' | 'remittance';
  provider: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: any;
}

interface LinkedAccountsProps {
  userId: string;
}

export default function LinkedAccounts({ userId }: LinkedAccountsProps) {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [step, setStep] = useState<'category' | 'details'>('category');
  const [selectedCategory, setSelectedCategory] = useState<LinkedAccount['type'] | null>(null);
  const [formData, setFormData] = useState({
    provider: '',
    accountNumber: '',
    accountName: '',
  });

  useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, 'linked_accounts'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const accs = snapshot.docs.map(
          (doc: any) => ({ id: doc.id, ...doc.data() }) as LinkedAccount
        );
        setAccounts(accs);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'linked_accounts');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'linked_accounts'), {
        userId,
        type: selectedCategory,
        ...formData,
        isDefault: accounts.length === 0,
        createdAt: serverTimestamp(),
      });
      setIsAdding(false);
      setStep('category');
      setSelectedCategory(null);
      setFormData({ provider: '', accountNumber: '', accountName: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'linked_accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);

      // Set all user's accounts to not default
      accounts.forEach((acc) => {
        const accRef = doc(db, 'linked_accounts', acc.id);
        batch.update(accRef, { isDefault: false });
      });

      // Set selected account to default
      const selectedRef = doc(db, 'linked_accounts', accountId);
      batch.update(selectedRef, { isDefault: true });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'linked_accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'linked_accounts', id));
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'linked_accounts');
    }
  };

  const getIcon = (type: LinkedAccount['type']) => {
    switch (type) {
      case 'bank':
        return <Landmark size={20} />;
      case 'momo':
        return <Smartphone size={20} />;
      case 'regional_momo':
        return <Globe size={20} />;
      case 'wallet':
        return <Zap size={20} />;
      case 'card':
        return <CreditCard size={20} />;
      case 'utility':
        return <Bus size={20} />;
      case 'remittance':
        return <Send size={20} />;
      default:
        return <CreditCard size={20} />;
    }
  };

  const categories = [
    {
      id: 'bank',
      label: t.wallet.bankAccount,
      icon: <Landmark size={24} />,
      desc: t.wallet.bankTransferDesc,
    },
    {
      id: 'momo',
      label: t.wallet.mobileMoney,
      icon: <Smartphone size={24} />,
      desc: t.wallet.mobileMoneyDesc,
    },
    {
      id: 'regional_momo',
      label: t.wallet.regionalMomo,
      icon: <Globe size={24} />,
      desc: t.wallet.regionalMomoDesc,
    },
    { id: 'card', label: t.common.card, icon: <CreditCard size={24} />, desc: t.wallet.cardsDesc },
    {
      id: 'wallet',
      label: 'Digital Wallets',
      icon: <Zap size={24} />,
      desc: t.wallet.digitalWalletsDesc,
    },
    { id: 'utility', label: 'Utilities', icon: <Bus size={24} />, desc: t.wallet.govServicesDesc },
    {
      id: 'remittance',
      label: 'Remittances',
      icon: <Send size={24} />,
      desc: 'WorldRemit, Western Union',
    },
  ];

  const getProviders = (cat: LinkedAccount['type']) => {
    switch (cat) {
      case 'bank':
        return RWANDAN_BANKS;
      case 'momo':
        return MOBILE_MONEY_PROVIDERS.filter((p) => !p.name.includes('Regional')).map(
          (p) => p.name
        );
      case 'regional_momo' as any:
        return MOBILE_MONEY_PROVIDERS.filter((p) => p.name.includes('Regional')).map((p) => p.name);
      case 'card':
        return CARD_SCHEMES.map((p) => p.name);
      case 'wallet':
        return DIGITAL_WALLETS.map((p) => p.name);
      case 'utility':
        return GOV_UTILITY_PAYMENTS.map((p) => p.name);
      case 'remittance':
        return REMITTANCE_SERVICES.map((p) => p.name);
      default:
        return [];
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const query = searchQuery.toLowerCase();
    return (
      (acc.provider?.toLowerCase() || '').includes(query) ||
      (acc.accountNumber?.toLowerCase() || '').includes(query) ||
      (acc.accountName?.toLowerCase() || '').includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Linked Accounts
          </h3>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-1">
            Manage your Rwandan payment ecosystem
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-12 pr-10 py-3 bg-neutral-100 dark:bg-neutral-800 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white dark:focus:bg-neutral-900 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAccounts.map((acc) => (
          <motion.div
            key={acc.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={cn(
              'card p-5 group transition-all relative overflow-hidden border-2',
              acc.isDefault
                ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-900/10'
                : 'border-transparent hover:border-orange-200 dark:hover:border-orange-900/30'
            )}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-colors',
                  acc.isDefault
                    ? 'bg-orange-600 text-white'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-slate-900 dark:text-white group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 group-hover:text-orange-600 dark:group-hover:text-orange-400'
                )}
              >
                {getIcon(acc.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-900 dark:text-white text-sm">
                    {acc.provider}
                  </p>
                  {acc.isDefault && (
                    <span className="px-2 py-0.5 bg-orange-600 text-white text-[8px] font-black rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                      <Star size={8} fill="currentColor" /> Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold mt-0.5">
                  {acc.accountNumber}
                </p>
                <p className="text-[10px] text-neutral-300 dark:text-neutral-600 font-medium uppercase tracking-wider mt-1">
                  {acc.accountName}
                </p>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!acc.isDefault && (
                  <button
                    onClick={() => handleSetDefault(acc.id)}
                    className="p-2 text-neutral-400 dark:text-neutral-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-100 dark:border-neutral-700"
                    title="Set as default"
                  >
                    <Star size={16} />
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(acc.id)}
                  className="p-2 text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-100 dark:border-neutral-700"
                  title="Remove account"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div
              className={cn(
                'absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-2xl transition-colors',
                acc.isDefault
                  ? 'bg-orange-200/50 dark:bg-orange-900/20'
                  : 'bg-neutral-50 dark:bg-neutral-800 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/10'
              )}
            ></div>
          </motion.div>
        ))}

        {filteredAccounts.length === 0 && !loading && (
          <div className="md:col-span-2 text-center py-12 bg-neutral-50 dark:bg-neutral-900/50 rounded-[2rem] border border-dashed border-neutral-200 dark:border-neutral-800">
            <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              {searchQuery ? (
                <Search className="text-neutral-200 dark:text-neutral-700" size={32} />
              ) : (
                <ShieldCheck className="text-neutral-200 dark:text-neutral-700" size={32} />
              )}
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 font-bold">
              {searchQuery ? `No accounts matching "${searchQuery}"` : 'No accounts linked yet'}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Link your bank, MoMo, or cards to start transacting'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsAdding(true)}
                className="mt-4 px-6 py-2 bg-white dark:bg-neutral-800 text-orange-600 dark:text-orange-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-orange-100 dark:border-orange-900/30 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
              >
                Link Now
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="md:col-span-2 flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-orange-600" size={32} />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl text-center border border-neutral-100 dark:border-neutral-800"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                Remove Account?
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium mb-8">
                Are you sure you want to remove this account? You will need to link it again to use
                it for transactions.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAccount(showDeleteConfirm)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-neutral-100 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Link New Account
                  </h3>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    {step === 'category'
                      ? 'Choose account type'
                      : `Enter ${selectedCategory} details`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setStep('category');
                    setSelectedCategory(null);
                  }}
                  className="p-2 text-neutral-400 dark:text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              {step === 'category' ? (
                <div className="grid grid-cols-2 gap-4">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id as any);
                        setStep('details');
                      }}
                      className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-[2rem] border-2 border-transparent hover:border-orange-500 hover:bg-white dark:hover:bg-neutral-800 transition-all text-left group"
                    >
                      <div className="w-12 h-12 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-all">
                        {cat.icon}
                      </div>
                      <p className="font-black text-slate-900 dark:text-white text-sm">
                        {cat.label}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold mt-1 leading-tight">
                        {cat.desc}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleAddAccount} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                      Select Provider
                    </label>
                    <select
                      required
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white dark:focus:bg-neutral-900 outline-none transition-all font-bold text-slate-900 dark:text-white"
                    >
                      <option value="">Choose a provider...</option>
                      {getProviders(selectedCategory!).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                      {selectedCategory === 'bank'
                        ? 'Account Number'
                        : selectedCategory === 'momo'
                          ? 'Phone Number'
                          : selectedCategory === 'card'
                            ? 'Card Number'
                            : 'Account Identifier'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="Enter details..."
                      className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white dark:focus:bg-neutral-900 outline-none transition-all font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      placeholder="Full name as on account"
                      className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white dark:focus:bg-neutral-900 outline-none transition-all font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('category')}
                      className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200 dark:shadow-none"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'Link Account'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
