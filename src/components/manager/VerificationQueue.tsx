import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from '../../services/firestoreBridge';
import { useLanguage } from '../../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  XCircle,
  User,
  Building2,
  Hash,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function VerificationQueue() {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const [pendingTraders, setPendingTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'trader'),
      where('verificationStatus', '==', 'pending')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const traders = snapshot.docs.map((doc: any) => ({
          uid: doc.id,
          ...doc.data(),
        }));
        setPendingTraders(traders);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching pending traders:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleVerify = async (uid: string, status: 'verified' | 'rejected') => {
    setProcessingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), {
        verificationStatus: status,
        verifiedAt: status === 'verified' ? serverTimestamp() : null,
        status: status === 'verified' ? 'active' : 'inactive',
      });
    } catch (err) {
      console.error('Verification error:', err);
      alert('Failed to update trader status.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white">
            {t.manager.pendingTraders}
          </h2>
          <p className="text-neutral-500 font-medium">
            {pendingTraders.length} traders awaiting verification
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {pendingTraders.map((trader) => (
            <motion.div
              key={trader.uid}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400 shrink-0">
                    {trader.photoURL ? (
                      <img
                        src={trader.photoURL}
                        alt={trader.name}
                        className="w-full h-full object-cover rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      {trader.name}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400">
                        <Mail size={14} /> {trader.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400">
                        <Phone size={14} /> {trader.phone || 'No phone'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 lg:max-w-md">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                      {t.manager.businessName}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
                      <Building2 size={16} className="text-orange-600" />
                      {trader.businessName || '---'}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                      {t.manager.tin}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
                      <Hash size={16} className="text-blue-600" />
                      {trader.tin || '---'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerify(trader.uid, 'rejected')}
                    disabled={processingId === trader.uid}
                    className="flex-1 lg:flex-none px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    {processingId === trader.uid ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        <XCircle size={16} /> {t.manager.reject}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleVerify(trader.uid, 'verified')}
                    disabled={processingId === trader.uid}
                    className="flex-1 lg:flex-none px-6 py-3 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
                  >
                    {processingId === trader.uid ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        <ShieldCheck size={16} /> {t.manager.approve}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {trader.businessAddress && (
                <div className="mt-4 pt-4 border-t border-neutral-50 dark:border-neutral-800 flex items-center gap-2 text-xs font-bold text-neutral-400">
                  <MapPin size={14} /> {trader.businessAddress}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {pendingTraders.length === 0 && (
          <div className="text-center py-24 bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-100 dark:border-neutral-800">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">
              {t.manager.noPendingTraders}
            </h3>
            <p className="text-neutral-500 font-medium">All traders have been processed.</p>
          </div>
        )}
      </div>
    </div>
  );
}
