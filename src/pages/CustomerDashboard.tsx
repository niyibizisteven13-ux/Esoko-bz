import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import {
  History,
  QrCode,
  LayoutDashboard,
  CreditCard,
  ShoppingBag,
  Wallet,
  Smartphone,
  User,
  Eye,
  EyeOff,
  Send,
  TrendingUp,
  X,
  Search,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  PlusCircle,
  Bell,
  MapPin,
  MessageSquare,
  Store,
  Sparkles,
  ChevronRight,
  FileText,
  Nfc,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import WalletComponent from '../components/WalletComponent';
import { Marketplace } from '../components/customer/Marketplace';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useRealTimeSync } from '../context/RealTimeSyncContext';
import { cn, getTimeAgo, getAccountAge } from '../lib/utils';
import { isAccountVerified } from '../lib/verification';
import { generateReceipt } from '../lib/pdfGenerator';
import { Download } from 'lucide-react';
import { auth } from '../firebase';
import { getCurrentUser } from '../services/sessionService';

// Services
import { getUser, updateUser } from '../services/userService';
import { getTransactions } from '../services/transactionService';

// Sub-components
import PurchaseHistory from '../components/customer/PurchaseHistory';
import CustomerProfile from '../components/customer/CustomerProfile';
import QRScanner from '../components/customer/QRScanner';
import PayCodeForm from '../components/customer/PayCodeForm';
import NearPayDirectoryModal from '../components/customer/NearPayDirectoryModal';
import NotificationsTab from '../components/NotificationsTab';
import SupportTab from '../components/SupportTab';
const VerifiedReports = React.lazy(() => import('../components/VerifiedReports'));

import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { VerifiedBadge } from '../components/VerifiedBadge';

const STAGGER_CHILDREN = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const FADE_IN_UP = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

function SlitLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-xl"
    >
      <div className="relative w-64 h-[2px] bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500 to-transparent"
        />
      </div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-orange-600 animate-pulse"
      >
        Initializing Nexus...
      </motion.p>
    </motion.div>
  );
}

type Tab =
  | 'overview'
  | 'purchases'
  | 'wallet'
  | 'marketplace'
  | 'profile'
  | 'notifications'
  | 'support'
  | 'reports';

export default function CustomerDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialTab = (): Tab => {
    const tab = new URLSearchParams(location.search).get('tab');
    return tab === 'overview' ||
      tab === 'purchases' ||
      tab === 'wallet' ||
      tab === 'marketplace' ||
      tab === 'profile' ||
      tab === 'notifications' ||
      tab === 'support' ||
      tab === 'reports'
      ? tab
      : 'marketplace';
  };

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [isChangingTab, setIsChangingTab] = useState(false);
  const [marketplaceConfig, setMarketplaceConfig] = useState<{
    mode: 'products' | 'shops';
    nearby: boolean;
    map: boolean;
  }>({ mode: 'products', nearby: false, map: false });
  const [currentUser, setCurrentUser] = useState<any>(auth.currentUser || null);
  const [userData, setUserData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // if (error) throw error;

  const [showBalance, setShowBalance] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showPayCode, setShowPayCode] = useState(false);
  const [showNearPay, setShowNearPay] = useState(false);
  const { notifications, unreadCount, showToast } = useNotifications();
  const { syncState, subscribeToTransactions, subscribeToUserData } = useRealTimeSync();

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

  useEffect(() => {
    let unsubscribeTransactions: (() => void) | undefined;
    let unsubscribeUserData: (() => void) | undefined;

    const setupRealTimeListeners = async () => {
      const current = auth.currentUser || (await getCurrentUser());
      if (!current) {
        setLoading(false);
        return;
      }
      setCurrentUser(current);

      try {
        const userId = current.uid || current.id;

        // Initial data fetch
        const [userResponse, transactionsResponse] = await Promise.all([
          getUser(userId),
          getTransactions({ userId, limit: 100 }),
        ]);

        setUserData(userResponse?.user);

        const transactionsData = transactionsResponse?.transactions || [];
        setTransactions(
          transactionsData.sort((a: any, b: any) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          })
        );

        // Set up real-time listeners
        unsubscribeTransactions = subscribeToTransactions(userId, (newTransactions) => {
          setTransactions(newTransactions);
        });

        unsubscribeUserData = subscribeToUserData(userId, (newUserData) => {
          setUserData(newUserData);
        });

        setLoading(false);
      } catch (err) {
        console.error('Error setting up real-time listeners:', err);
        setError(err as Error);
        setLoading(false);
      }
    };

    setupRealTimeListeners();

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeTransactions) unsubscribeTransactions();
      if (unsubscribeUserData) unsubscribeUserData();
    };
  }, [subscribeToTransactions, subscribeToUserData]);

  if (loading)
    return (
      <div className="fixed inset-0 bg-white dark:bg-[#050505] flex flex-col items-center justify-center z-[1000]">
        <div className="relative">
          {/* Outer Pulsing Ring */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-orange-600 rounded-full blur-[60px] -z-10"
          />

          <div className="flex flex-col items-center gap-8 text-center p-8">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                className="w-24 h-24 border-2 border-orange-100 dark:border-white/5 border-t-orange-600 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Logo className="scale-75 translate-x-1" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-[0.2em] uppercase">
                Connecting Marketplace
              </h2>
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-1 h-1 bg-orange-600 rounded-full"
                  />
                ))}
              </div>
            </div>

            <p className="text-neutral-400 dark:text-neutral-500 font-bold text-[10px] uppercase tracking-[0.3em] max-w-[200px]">
              {t.common.loadingWallet}
            </p>
          </div>
        </div>
      </div>
    );

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return;
    // Instant tab change for better UX
    setActiveTab(tab);
    setIsSidebarOpen(false);
    // Smooth scroll to top after state update
    setTimeout(() => {
      const mainEl = document.getElementById('main-scroll-container');
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  const preference = userData?.dashboardPreference || 'full';
  const accountVerified = isAccountVerified(userData);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row selection:bg-orange-500/30 selection:text-white transition-colors duration-300 overflow-hidden text-neutral-100">
      <AnimatePresence>{isChangingTab && <SlitLoader />}</AnimatePresence>

      {/* Sidebar - Desktop Only */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-[#050505] text-white transform transition-all duration-500 ease-in-out md:relative md:translate-x-0 hidden md:flex flex-col border-r border-white/5',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          isSidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="h-full flex flex-col p-4 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-8 shrink-0 px-2">
            {!isSidebarCollapsed && <Logo dark className="scale-90 origin-left" />}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
            >
              {isSidebarCollapsed ? (
                <PlusCircle className="rotate-45" size={20} />
              ) : (
                <X className="rotate-45" size={20} />
              )}
            </button>
          </div>

          <nav className={cn('flex-1 space-y-6', isSidebarCollapsed && 'items-center')}>
            <div>
              {!isSidebarCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                  Shop
                </p>
              )}
              <div className="space-y-1">
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'overview'}
                  onClick={() => handleTabChange('overview')}
                  icon={<LayoutDashboard size={20} />}
                  label="Home"
                  description="Dashboard & transactions"
                />
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'notifications'}
                  onClick={() => handleTabChange('notifications')}
                  icon={<Bell size={20} />}
                  label="Alerts"
                  badge={unreadCount ?? 0}
                  description="Messages & updates"
                />
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'marketplace'}
                  onClick={() => {
                    setMarketplaceConfig({ mode: 'products', nearby: false, map: false });
                    handleTabChange('marketplace');
                  }}
                  icon={<Package size={20} />}
                  label={t.common.marketplace}
                  description="Browse & shop"
                />
              </div>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                  Money
                </p>
              )}
              <div className="space-y-1">
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'wallet'}
                  onClick={() => handleTabChange('wallet')}
                  icon={<CreditCard size={20} />}
                  label={t.common.wallet}
                  description="Cash & transfers"
                />
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'purchases'}
                  onClick={() => handleTabChange('purchases')}
                  icon={<History size={20} />}
                  label={t.common.history}
                  description="Past transactions"
                />
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'reports'}
                  onClick={() => handleTabChange('reports')}
                  icon={<FileText size={20} />}
                  label="Reports"
                  description="Verified PDFs"
                />
              </div>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                  Account
                </p>
              )}
              <div className="space-y-1">
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'profile'}
                  onClick={() => handleTabChange('profile' as any)}
                  icon={<User size={20} />}
                  label={t.common.profile}
                  description="Account settings"
                />
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={activeTab === 'support'}
                  onClick={() => handleTabChange('support')}
                  icon={<MessageSquare size={20} />}
                  label="Help"
                  description="Support & FAQs"
                />
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={false}
                  onClick={() => setShowScanner(true)}
                  icon={<QrCode size={20} />}
                  label="Pay & Scan"
                  description="Quick payments"
                />
              </div>
            </div>
          </nav>

          <div className="mt-auto pt-4 border-t border-white/10 shrink-0">
            {!isSidebarCollapsed && (
              <>
                <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-black text-sm shadow-xl shadow-orange-900/40">
                    {userData?.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-black truncate leading-tight tracking-tight uppercase">
                        {userData?.name || 'User'}
                      </p>
                      {accountVerified ? (
                        <VerifiedBadge
                          level={getCustomerBadgeLevel(userData?.category)}
                          size="sm"
                          showLabel={false}
                          animated
                          className="!border-white/10"
                        />
                      ) : (
                        <span className="text-[8px] uppercase tracking-[0.2em] text-yellow-400 font-black">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] text-white/40 font-black uppercase tracking-[0.2em] mt-0.5">
                      {userData?.tier || 'Standard'}
                    </p>
                  </div>
                </div>

                {/* Phase 2: Account Status Card */}
                <div className="mb-3 p-2.5 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-600/20 rounded-xl space-y-1.5 text-[7px]">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={10} className="text-blue-400" />
                    <span className="font-black text-blue-300 uppercase tracking-widest">
                      Status
                    </span>
                  </div>

                  <div className="space-y-0.5 px-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Email</span>
                      <span
                        className={
                          userData?.emailVerified
                            ? 'text-emerald-400 font-black'
                            : 'text-yellow-400 font-black'
                        }
                      >
                        {userData?.emailVerified ? '✓' : '⏳'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Account</span>
                      <span
                        className={
                          accountVerified
                            ? 'text-emerald-400 font-black'
                            : 'text-yellow-400 font-black'
                        }
                      >
                        {accountVerified ? '✓' : '⏳'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-blue-600/20 pt-0.5 mt-0.5">
                      <span className="text-white/50">Member Since</span>
                      <span className="text-white/70 font-black">
                        {getAccountAge(userData?.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phase 2: Sync Status */}
                <div className="flex items-center justify-center gap-1.5 text-[7px] text-white/40 px-2 py-1 mb-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                  <span>Synced {getTimeAgo(lastSyncTime)}</span>
                </div>
              </>
            )}
            <button
              onClick={() => auth.signOut().then(() => navigate('/login'))}
              className={cn(
                'w-full flex items-center transition-all font-bold text-xs rounded-xl',
                isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 py-3 px-4',
                'text-white/40 hover:text-white hover:bg-white/5 active:scale-95'
              )}
            >
              <History className="rotate-180" size={20} /> {!isSidebarCollapsed && t.common.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-4 left-4 z-[70] w-[280px] bg-[#050505] text-white rounded-[2.5rem] border border-white/5 shadow-2xl md:hidden overflow-hidden flex flex-col p-6"
          >
            <div className="flex items-center justify-between mb-8">
              <Logo dark />
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-3 bg-white/5 rounded-2xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
              <div>
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  Intelligence
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MobileTabItem
                    active={activeTab === 'overview'}
                    onClick={() => handleTabChange('overview')}
                    icon={<LayoutDashboard size={20} />}
                    label="Overview"
                  />
                  <MobileTabItem
                    active={activeTab === 'notifications'}
                    onClick={() => handleTabChange('notifications')}
                    icon={<Bell size={20} />}
                    label="Alerts"
                  />
                  <MobileTabItem
                    active={activeTab === 'marketplace'}
                    onClick={() => {
                      setMarketplaceConfig({ mode: 'products', nearby: false, map: false });
                      handleTabChange('marketplace');
                    }}
                    icon={<ShoppingBag size={20} />}
                    label="Market"
                  />
                </div>
              </div>

              <div>
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  Financials
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MobileTabItem
                    active={activeTab === 'wallet'}
                    onClick={() => handleTabChange('wallet')}
                    icon={<Wallet size={20} />}
                    label="Wallet"
                  />
                  <MobileTabItem
                    active={activeTab === 'support'}
                    onClick={() => handleTabChange('support')}
                    icon={<MessageSquare size={20} />}
                    label="Support"
                  />
                  <MobileTabItem
                    active={activeTab === 'purchases'}
                    onClick={() => handleTabChange('purchases')}
                    icon={<History size={20} />}
                    label="History"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={() => auth.signOut().then(() => navigate('/login'))}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <History className="rotate-180" size={16} /> Sign Out
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        id="main-scroll-container"
        className="flex-1 h-screen overflow-y-auto relative bg-[#050505] transition-colors"
      >
        {/* Mobile Header */}
        <header className="md:hidden bg-[#050505] border-b border-white/5 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-white/5 rounded-xl">
              <PlusCircle size={20} className="text-neutral-400" />
            </button>
            <Logo dark className="scale-90" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-32 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Activity Page Header */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
                        Customer Hub
                      </h2>
                      <p className="text-neutral-500 font-medium text-sm tracking-tight text-balance">
                        Real-time intelligence on your transactions, social growth, and financial
                        velocity.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-sm shrink-0">
                      <TrendingUp size={16} className="text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        Velocity: +12.4%
                      </span>
                    </div>
                  </div>

                  {/* Phase 3: First-Time User Banner */}
                  {userData?.firstTime && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 md:p-6 bg-gradient-to-r from-orange-600/20 to-amber-600/20 border border-orange-600/30 rounded-2xl"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="text-orange-400" size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black text-white mb-2 text-lg">
                            Welcome to Nexus! 👋
                          </h3>
                          <p className="text-[12px] text-neutral-300 mb-4">
                            Here's how to get started and make the most of your account:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            <div className="flex items-start gap-2.5 p-3 bg-white/5 rounded-xl border border-white/10">
                              <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black text-white">
                                1
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-white uppercase">
                                  Add Funds
                                </p>
                                <p className="text-[9px] text-neutral-400">
                                  Top up your wallet to start paying
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-3 bg-white/5 rounded-xl border border-white/10">
                              <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black text-white">
                                2
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-white uppercase">
                                  Find Shops
                                </p>
                                <p className="text-[9px] text-neutral-400">
                                  Browse the marketplace for great deals
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-3 bg-white/5 rounded-xl border border-white/10">
                              <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black text-white">
                                3
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-white uppercase">
                                  Scan & Pay
                                </p>
                                <p className="text-[9px] text-neutral-400">
                                  Use QR codes for instant transactions
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const current = auth.currentUser;
                                if (current) {
                                  try {
                                    await updateUser(current.uid || current.id, {
                                      firstTime: false,
                                    });
                                    setUserData({ ...userData, firstTime: false });
                                  } catch (err) {
                                    console.error('Error updating user:', err);
                                  }
                                }
                              }}
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black rounded-xl transition-all active:scale-95"
                            >
                              Got It!
                            </button>
                            <button
                              onClick={() => handleTabChange('wallet')}
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black rounded-xl transition-all"
                            >
                              Add Funds Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Wallet & Quick Actions in Overview */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                      <motion.div
                        variants={FADE_IN_UP}
                        initial="initial"
                        animate="animate"
                        className="group relative w-full p-8 rounded-[2.5rem] overflow-hidden transition-all duration-500 bg-[#0a0a0a] text-white shadow-2xl border border-white/5"
                      >
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-12">
                            <div>
                              <h2 className="text-4xl font-black tracking-tighter sm:text-5xl">
                                {showBalance
                                  ? `${(userData?.walletBalance || 0).toLocaleString()}`
                                  : 'â€¢â€¢â€¢â€¢â€¢'}
                                <span className="text-sm font-bold ml-1 opacity-40">RWF</span>
                              </h2>
                              <div className="flex items-center gap-2 mt-2">
                                <p className="text-orange-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                  {t.common.totalBalance}
                                </p>
                                <button
                                  onClick={() => setShowBalance(!showBalance)}
                                  className="p-1 hover:bg-white/10 rounded-full"
                                >
                                  {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>
                            <div className="bg-white/10 p-4 rounded-3xl border border-white/10 transition-all">
                              <CreditCard size={28} />
                            </div>
                          </div>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                                Nexus ID
                              </p>
                              <p className="font-mono font-bold tracking-[0.2em] text-sm bg-white/5 p-2 rounded-xl border border-white/5">
                                {userData?.appNumber || '--- ---'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                                Loyalty
                              </p>
                              <p className="font-black text-2xl">{userData?.loyaltyPoints || 0}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={FADE_IN_UP}
                        initial="initial"
                        animate="animate"
                        className="group relative w-full p-6 rounded-[2.5rem] overflow-hidden transition-all duration-500 bg-[#0a0a0a] text-white shadow-2xl border border-white/5"
                      >
                        <div className="relative z-10">
                          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                                Profile Summary
                              </p>
                              <h3 className="text-2xl font-black tracking-tight">
                                {userData?.name || 'My Profile'}
                              </h3>
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
                                Pending
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-black">
                                Email
                              </p>
                              <p className="text-sm font-bold text-white truncate">
                                {currentUser?.email || 'Not set'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-black">
                                Phone
                              </p>
                              <p className="text-sm font-bold text-white truncate">
                                {userData?.phone || 'Not set'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-black">
                                Account Type
                              </p>
                              <p className="text-sm font-bold text-white truncate">
                                {userData?.category
                                  ? `${userData.category.charAt(0).toUpperCase()}${userData.category.slice(1)}`
                                  : 'Individual'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-black">
                                Tier
                              </p>
                              <p className="text-sm font-bold text-white truncate">
                                {userData?.tier || 'Standard'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-6">
                            <button
                              onClick={() => handleTabChange('profile')}
                              className="w-full px-4 py-3 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all"
                            >
                              Edit Profile
                            </button>
                            <button
                              onClick={() => handleTabChange('profile')}
                              className="w-full px-4 py-3 bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all"
                            >
                              Manage Details
                            </button>
                          </div>
                        </div>
                      </motion.div>

                      <div className="grid grid-cols-2 gap-4">
                        <QuickAction
                          icon={<QrCode size={24} />}
                          label="Nexus Pay"
                          onClick={() => setShowScanner(true)}
                          color="text-orange-500 font-black"
                        />
                        <QuickAction
                          icon={<Nfc size={24} />}
                          label="Near Pay"
                          onClick={() => setShowNearPay(true)}
                          color="text-emerald-400"
                        />
                        <QuickAction
                          icon={<Send size={24} />}
                          label="Send Cash"
                          onClick={() => handleTabChange('wallet')}
                          color="text-blue-400"
                        />
                      </div>

                      {/* Motivation: Rewards Card */}
                      <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-6 rounded-[2.5rem] text-white shadow-xl shadow-orange-900/20 relative overflow-hidden group">
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                              <Sparkles size={20} />
                            </div>
                            <h4 className="text-sm font-black uppercase tracking-widest">
                              Rewards
                            </h4>
                          </div>
                          <p className="text-xl font-bold mb-4 leading-tight">
                            Refer a friend & get{' '}
                            <span className="text-white underline">500 Points</span>
                          </p>
                          <button
                            onClick={() => {
                              const referralLink = `${window.location.origin}/register?ref=${userData?.appNumber}`;
                              navigator.clipboard.writeText(referralLink);
                              showToast('Referral link copied to clipboard', 'success');
                            }}
                            className="w-full py-3 bg-white text-orange-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-50 transition-all active:scale-95"
                          >
                            Copy Link <Download size={14} className="rotate-270" />
                          </button>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
                      </div>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                      <div className="flex justify-between items-center px-1">
                        <h3 className="micro-label font-black text-neutral-400 uppercase tracking-[0.2em]">
                          {t.common.recentTransactions}
                        </h3>
                        <button
                          onClick={() => handleTabChange('purchases')}
                          className="text-orange-600 text-[10px] font-black uppercase tracking-widest hover:underline"
                        >
                          Explore Log
                        </button>
                      </div>
                      <div className="space-y-3">
                        {transactions.length > 0 ? (
                          transactions
                            .slice(0, 5)
                            .map((tx) => <TransactionItem key={tx.id} tx={tx} />)
                        ) : (
                          // Phase 3: Better empty state
                          <div className="p-8 border-2 border-dashed border-white/10 rounded-[2rem] text-center bg-white/2.5">
                            <div className="w-12 h-12 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                              <History className="text-neutral-400" size={24} />
                            </div>
                            <h3 className="font-black text-sm text-white mb-2">
                              No transactions yet
                            </h3>
                            <p className="text-[12px] text-neutral-400 mb-4 max-w-sm mx-auto leading-relaxed">
                              Start by adding funds to your wallet and making your first payment.
                              Your transaction history will appear here.
                            </p>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleTabChange('wallet')}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-lg transition-all active:scale-95"
                              >
                                Add Funds
                              </button>
                              <button
                                onClick={() => handleTabChange('marketplace')}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-lg transition-all"
                              >
                                Browse Shops
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'marketplace' && (
                <motion.div
                  key="marketplace"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pb-24"
                >
                  <Marketplace
                    initialSearchMode={marketplaceConfig.mode}
                    initialNearby={marketplaceConfig.nearby}
                    initialMapView={marketplaceConfig.map}
                  />
                </motion.div>
              )}

              {activeTab === 'wallet' && (
                <motion.div
                  key="wallet"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
                        Vault & Assets
                      </h2>
                      <p className="text-neutral-500 font-medium text-sm tracking-tight text-balance">
                        Manage your liquidity, digital credentials, and peer-to-peer distribution
                        networks.
                      </p>
                    </div>
                  </div>
                  <WalletComponent
                    balance={userData?.walletBalance || 0}
                    userId={currentUser?.uid || currentUser?.id || ''}
                    transactions={transactions}
                    tier={userData?.tier || 'free'}
                    loyaltyPoints={userData?.loyaltyPoints || 0}
                    onNearPay={() => setShowNearPay(true)}
                  />
                </motion.div>
              )}

              {activeTab === 'purchases' && <PurchaseHistory />}
              {activeTab === 'notifications' && (
                <NotificationsTab notifications={notifications} dark title="Alerts" />
              )}
              {activeTab === 'profile' && <CustomerProfile userData={userData} />}
              {activeTab === 'support' && (
                <SupportTab userId={currentUser?.uid || currentUser?.id || ''} role="customer" />
              )}
              {activeTab === 'reports' && (
                <React.Suspense
                  fallback={<div className="p-8 text-neutral-500">Loading reports...</div>}
                >
                  <VerifiedReports
                    userId={currentUser?.uid || currentUser?.id || ''}
                    userName={userData?.name || 'Customer'}
                    role="customer"
                    transactions={transactions}
                  />
                </React.Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation for Mobile - Phase 4: Improved */}
        <nav className="fixed bottom-6 left-6 right-6 z-50 md:hidden">
          <div className="bg-[#050505]/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl relative group">
            <div
              className="overflow-x-auto no-scrollbar flex items-center gap-1 px-4 py-2 scroll-smooth snap-x snap-mandatory"
              onKeyDown={(e) => {
                // Phase 4: Keyboard navigation
                if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
                  e.preventDefault();
                  const tabs: Tab[] = [
                    'overview',
                    'marketplace',
                    'notifications',
                    'wallet',
                    'purchases',
                    'reports',
                  ];
                  const index = parseInt(e.key) - 1;
                  if (tabs[index]) handleTabChange(tabs[index]);
                }
              }}
            >
              <BottomNavItem
                active={activeTab === 'overview'}
                onClick={() => handleTabChange('overview')}
                icon={<LayoutDashboard size={22} />}
                label="Home"
              />
              <BottomNavItem
                active={activeTab === 'marketplace'}
                onClick={() => {
                  setMarketplaceConfig({ mode: 'products', nearby: false, map: false });
                  handleTabChange('marketplace');
                }}
                icon={<ShoppingBag size={22} />}
                label="Market"
              />
              <BottomNavItem
                active={activeTab === 'notifications'}
                onClick={() => handleTabChange('notifications')}
                icon={<Bell size={22} />}
                label="Alerts"
                badge={unreadCount ?? 0}
              />
              <div className="px-2 snap-center">
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-14 h-14 bg-orange-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg active:scale-95 transition-all hover:shadow-orange-500/50 hover:shadow-lg"
                  title="Pay with QR code (Ctrl+0)"
                  aria-label="Scan QR code to pay"
                >
                  <QrCode size={24} />
                </button>
              </div>
              <BottomNavItem
                active={activeTab === 'wallet'}
                onClick={() => handleTabChange('wallet')}
                icon={<Wallet size={22} />}
                label="Vault"
              />
              <BottomNavItem
                active={activeTab === 'purchases'}
                onClick={() => handleTabChange('purchases')}
                icon={<History size={22} />}
                label="History"
              />
              <BottomNavItem
                active={activeTab === 'reports'}
                onClick={() => handleTabChange('reports')}
                icon={<FileText size={22} />}
                label="Reports"
              />
            </div>
          </div>
        </nav>

        {/* Desktop Quick Actions */}
        <div className="fixed bottom-8 right-8 hidden md:flex flex-col gap-4 z-50">
          <button
            onClick={() => setShowNearPay(true)}
            className="w-16 h-16 bg-[#0a0a0a] text-emerald-400 rounded-2xl shadow-2xl border border-white/5 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
            title="Near Pay"
          >
            <Nfc size={32} className="group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="w-16 h-16 bg-[#0a0a0a] text-orange-600 rounded-2xl shadow-2xl border border-white/5 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          >
            <QrCode size={32} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </main>

      <AnimatePresence>
        {showScanner && (
          <QRScanner
            onClose={() => setShowScanner(false)}
            tier={userData?.tier || 'free'}
            onSuccess={() => setActiveTab('overview')}
          />
        )}
        {showPayCode && (
          <PayCodeForm
            onClose={() => setShowPayCode(false)}
            userBalance={userData?.walletBalance || 0}
            tier={userData?.tier || 'free'}
            onSuccess={() => setActiveTab('overview')}
          />
        )}
        {showNearPay && <NearPayDirectoryModal onClose={() => setShowNearPay(false)} />}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  collapsed,
  badge,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  badge?: number;
  description?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? `${label}${description ? ': ' + description : ''}` : undefined}
      className={cn(
        'w-full flex items-center transition-all font-bold text-[11px] rounded-xl relative group text-left',
        collapsed ? 'justify-center p-3' : 'gap-3 py-2.5 px-4',
        active
          ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/40'
          : 'text-white/40 hover:text-white hover:bg-white/5 active:scale-95'
      )}
    >
      <div
        className={cn(
          'shrink-0 relative',
          active ? 'text-white' : 'text-white/20 group-hover:text-white/60 transition-colors'
        )}
      >
        {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })}
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-[#050505]" />
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="truncate uppercase tracking-tight">{label}</div>
        </div>
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black leading-none text-white shadow-sm ring-2 ring-[#050505] shrink-0',
            active ? 'bg-[#050505]' : 'bg-orange-600'
          )}
        >
          {badge}
        </span>
      )}
      {collapsed && active && (
        <motion.div
          layoutId="active-pill"
          className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
        />
      )}
    </button>
  );
}

function BottomNavItem({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      onKeyDown={(e) => {
        // Phase 4: Better keyboard support
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="tab"
      aria-selected={active}
      aria-label={`${label}${badge ? ` (${badge} new)` : ''}`}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all rounded-2xl snap-center min-w-[70px] relative',
        active ? 'text-orange-500' : 'text-white/40 hover:text-white/60'
      )}
    >
      {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })}
      <span className="text-[7px] font-black uppercase tracking-widest">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-1 right-3 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-600 text-[8px] font-black text-white shadow-lg ring-2 ring-[#050505]"
          aria-hidden="true"
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MobileTabItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] border-2 transition-all text-center',
        active
          ? 'bg-orange-600 border-orange-600 text-white shadow-lg'
          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
      )}
    >
      <div className={active ? 'text-white' : 'text-white/40'}>{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <motion.button
      variants={FADE_IN_UP}
      onClick={onClick}
      className="flex flex-col items-center gap-3 group"
    >
      <div
        className={cn(
          'w-full aspect-square rounded-[2rem] flex items-center justify-center transition-all duration-300',
          'bg-[#0a0a0a] border border-white/5 shadow-2xl',
          'group-hover:-translate-y-2 group-hover:border-orange-500/50',
          'group-active:scale-90',
          color.includes('text-') ? color : 'text-neutral-400'
        )}
      >
        {icon}
      </div>
      <span className="text-[10px] font-black text-neutral-500 group-hover:text-white uppercase tracking-[0.2em] transition-colors">
        {label}
      </span>
    </motion.button>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all',
        active
          ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
          : 'text-neutral-500 hover:text-neutral-300'
      )}
    >
      {label}
    </button>
  );
}

function TransactionItem({ tx }: { tx: any }) {
  const { t } = useLanguage();
  const isDeposit = tx.type === 'deposit';
  return (
    <motion.div
      variants={FADE_IN_UP}
      className="group relative p-4 bg-[#0a0a0a] border border-white/5 rounded-2xl flex items-center justify-between hover:border-orange-500/30 transition-all cursor-pointer overflow-hidden"
    >
      <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10 flex items-center gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110',
            isDeposit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
          )}
        >
          {isDeposit ? <TrendingUp size={24} /> : <History size={24} />}
        </div>
        <div>
          <p className="font-bold text-neutral-100 text-sm capitalize truncate max-w-[120px]">
            {tx.productName || tx.traderName || tx.customerName || tx.method || tx.type}
          </p>
          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mt-0.5">
            {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'HH:mm') : 'Just now'} â€¢{' '}
            {tx.method || 'Internal'}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-4">
        <div className="text-right">
          <p
            className={cn(
              'font-black text-sm tabular-nums',
              isDeposit ? 'text-emerald-500' : 'text-neutral-100'
            )}
          >
            {isDeposit ? '+' : '-'}
            {tx.amount.toLocaleString()}
          </p>
          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">RWF</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            generateReceipt({
              transactionId: tx.id,
              date: tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'PPP p') : 'Just now',
              amount: tx.amount,
              type: tx.type,
              method: tx.method || 'wallet',
              status: tx.status || 'completed',
              senderName: tx.senderName,
              recipientName: tx.recipientName || tx.traderName,
              productName: tx.productName,
            });
          }}
          className="p-2.5 text-neutral-600 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"
          title={t.common.downloadReceipt}
        >
          <Download size={16} />
        </button>
      </div>
    </motion.div>
  );
}
