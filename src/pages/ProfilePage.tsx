import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import CustomerProfile from '../components/customer/CustomerProfile';
import TraderProfile from '../components/trader/TraderProfile';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { getUser } from '../services/userService';
import { isAccountVerified } from '../lib/verification';

export default function ProfilePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    const loadUser = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const response = await getUser(uid);
        setUserData(response.user);
      } catch (err) {
        console.error('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="animate-spin text-orange-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 font-bold mb-8 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          {t.customer.back}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center">
              <User size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {userData?.businessName || userData?.name || 'User Profile'}
                </h1>
                {isAccountVerified(userData) && (
                  <VerifiedBadge
                    level="verified"
                    size="xs"
                    showLabel={false}
                    animated
                    className="!border-white/10"
                  />
                )}
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                Manage your personal identity on Bwenge
              </p>
            </div>
          </div>

          {userData?.role === 'trader' ? (
            <TraderProfile userData={userData} />
          ) : (
            <CustomerProfile userData={userData} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
