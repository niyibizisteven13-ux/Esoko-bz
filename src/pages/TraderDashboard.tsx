import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  QrCode,
  TrendingUp,
  Settings,
  LogOut,
  User,
  Plus,
  MessageSquare,
  Menu,
  X,
  Bell,
  Book,
  FileText,
  Users,
  Gift,
  ShieldCheck as VerifiedIcon,
  CheckCircle2,
  AlertCircle,
  Truck,
  PlusCircle,
  Store,
  ChevronDown,
  Crown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useRealTimeSync } from '../context/RealTimeSyncContext';
import { cn, formatCurrency, toDate, getTimeAgo, getAccountAge } from '../lib/utils';
import { isAccountVerified } from '../lib/verification';
import { isToday } from 'date-fns';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import { ProfileImage, VerifiedBadge } from '../components/VerifiedBadge';
import { autoReceiptService } from '../services/autoReceiptService';
import { auth } from '../firebase';

// Services
import { getUser, updateUser } from '../services/userService';
import { getProducts, getProduct } from '../services/productService';
import { getPurchases } from '../services/purchaseService';
import { getTransactions } from '../services/transactionService';
import { getCurrentUser } from '../services/sessionService';

const TraderOverview = React.lazy(() => import('../components/trader/TraderOverview'));
const TraderProducts = React.lazy(() => import('../components/trader/TraderProducts'));
const TraderPurchases = React.lazy(() => import('../components/trader/TraderPurchases'));
const TraderAnalytics = React.lazy(() => import('../components/trader/TraderAnalytics'));
const TraderQRCodes = React.lazy(() => import('../components/trader/TraderQRCodes'));
const TraderWallet = React.lazy(() => import('../components/trader/TraderWallet'));
const TraderProfile = React.lazy(() => import('../components/trader/TraderProfile'));
const TraderAccounting = React.lazy(() => import('../components/trader/TraderAccounting'));
const TraderTeamManagement = React.lazy(() => import('../components/trader/TraderTeamManagement'));
const TraderIncentives = React.lazy(() => import('../components/trader/TraderIncentives'));
const TraderDeliveries = React.lazy(() => import('../components/trader/TraderDeliveries'));
const TraderCustomers = React.lazy(() => import('../components/trader/TraderCustomers'));
const TraderSuppliers = React.lazy(() => import('../components/trader/TraderSuppliers'));
const TraderChat = React.lazy(() => import('../components/trader/TraderChat'));
const TraderTaxChamber = React.lazy(() => import('../components/trader/TraderTaxChamber'));
const TraderPayroll = React.lazy(() => import('../components/trader/TraderPayroll'));
const TraderSubscriptionDashboard = React.lazy(
  () => import('../components/trader/TraderSubscriptionDashboard')
);
const QRScanner = React.lazy(() => import('../components/QRScanner'));
const QuickSaleModal = React.lazy(() => import('../components/trader/QuickSaleModal'));
const NotificationsTab = React.lazy(() => import('../components/NotificationsTab'));
const SupportTab = React.lazy(() => import('../components/SupportTab'));
const VerifiedReports = React.lazy(() => import('../components/VerifiedReports'));
const TraderPreferences = React.lazy(() =>
  import('../components/TraderPreferences').then((module) => ({
    default: module.TraderPreferences,
  }))
);

type Tab =
  | 'overview'
  | 'products'
  | 'purchases'
  | 'analytics'
  | 'qrcodes'
  | 'wallet'
  | 'premium'
  | 'ai'
  | 'profile'
  | 'accounting'
  | 'payroll'
  | 'team'
  | 'incentives'
  | 'deliveries'
  | 'customers'
  | 'suppliers'
  | 'chat'
  | 'tax'
  | 'notifications'
  | 'support'
  | 'reports';

function TabLoading() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a] text-neutral-500">
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-4 w-4 rounded-full border-2 border-white/10 border-t-orange-600"
        />
        Loading
      </div>
    </div>
  );
}

export default function TraderDashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const { notifications, sendNotification, unreadCount } = useNotifications();
  const {
    syncState,
    subscribeToPurchases,
    subscribeToTransactions,
    subscribeToProducts,
    subscribeToUserData,
  } = useRealTimeSync();
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [initialEditProductId, setInitialEditProductId] = useState<string | null>(null);
  const [initialStockFilter, setInitialStockFilter] = useState<
    'all' | 'low' | 'in-stock' | 'out-of-stock'
  >('all');
  const [upgradeStatus, setUpgradeStatus] = useState<'success' | 'cancel' | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const getDashboardAccent = () => {
    switch (userData?.role) {
      case 'manager':
        return {
          section: 'bg-slate-950 text-cyan-100',
          button: 'bg-blue-600 text-white hover:bg-blue-700',
          badge: 'bg-blue-600',
        };
      case 'customer':
        return {
          section: 'bg-slate-950 text-cyan-100',
          button: 'bg-cyan-600 text-white hover:bg-cyan-700',
          badge: 'bg-gradient-to-r from-blue-500 to-orange-500',
        };
      case 'agent':
        return {
          section: 'bg-[#050505] text-lime-200',
          button: 'bg-lime-600 text-slate-950 hover:bg-lime-700',
          badge: 'bg-lime-600',
        };
      default:
        return {
          section: 'bg-[#050505] text-neutral-100',
          button: 'bg-orange-600 text-white hover:bg-orange-700',
          badge: 'bg-blue-600',
        };
    }
  };

  const dashboardAccent = getDashboardAccent();
  const activeTeamContext = userData?.activeTeamContext || auth.currentUser?.activeTeamContext;
  const dashboardTraderId = activeTeamContext?.traderId || auth.currentUser?.uid || '';
  const actingUserId = auth.currentUser?.uid || '';

  const handleTabChange = (
    tab: Tab,
    filter: 'all' | 'low' | 'in-stock' | 'out-of-stock' = 'all'
  ) => {
    setInitialStockFilter(filter);
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const refreshUserData = async () => {
    try {
      const current = auth.currentUser || (await getCurrentUser());
      if (!current) return;
      const uid = current.activeTeamContext?.traderId || current.uid || current.id;
      if (!uid) return;
      const userResponse = await getUser(uid);
      setUserData(userResponse.user);
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    }
  };

  const refreshSalesLogData = async () => {
    const current = auth.currentUser || (await getCurrentUser());
    if (!current) return;
    const uid = current.activeTeamContext?.traderId || current.uid || current.id;
    if (!uid) return;
    const [userResponse, productsResponse, purchasesResponse, transactionsResponse] =
      await Promise.all([
        getUser(uid),
        getProducts({ traderId: uid }),
        getPurchases({ traderId: uid, limit: 100 }),
        getTransactions({ userId: uid, limit: 100 }),
      ]);
    setUserData(userResponse?.user);
    setProducts(productsResponse?.products || []);
    setPurchases(
      (purchasesResponse?.purchases || []).sort(
        (a: any, b: any) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
      )
    );
    setTransactions(
      (transactionsResponse?.transactions || []).sort(
        (a: any, b: any) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
      )
    );
  };

  // if (error) throw error;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const upgrade = params.get('upgrade');
    if (upgrade === 'success') {
      setUpgradeStatus('success');
      navigate('/trader', { replace: true });
    } else if (upgrade === 'cancel') {
      setUpgradeStatus('cancel');
      navigate('/trader', { replace: true });
    }
  }, [location, navigate]);

  // Real-time data subscriptions
  useEffect(() => {
    let unsubscribePurchases: (() => void) | undefined;
    let unsubscribeTransactions: (() => void) | undefined;
    let unsubscribeProducts: (() => void) | undefined;
    let unsubscribeUserData: (() => void) | undefined;

    const setupRealTimeListeners = async () => {
      const current = auth.currentUser || (await getCurrentUser());
      if (!current) {
        setLoading(false);
        return;
      }

      const uid = current.uid || current.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        // Initial data fetch
        const [userResponse, productsResponse, purchasesResponse, transactionsResponse] =
          await Promise.all([
            getUser(uid),
            getProducts({ traderId: uid }),
            getPurchases({ traderId: uid, limit: 100 }),
            getTransactions({ userId: uid, limit: 100 }),
          ]);

        const data = userResponse?.user;
        setUserData(data);

        if (data && !data.trialEndsAt) {
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 30);
          await updateUser(uid, {
            trialEndsAt: trialEndsAt.toISOString(),
          });
        }

        const productsData = productsResponse?.products || [];
        setProducts(productsData);

        const purchasesData = purchasesResponse?.purchases || [];
        const sortedPurchases = purchasesData.sort(
          (a: any, b: any) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
        );
        setPurchases(sortedPurchases);

        const transactionsData = transactionsResponse?.transactions || [];
        setTransactions(
          transactionsData.sort(
            (a: any, b: any) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
          )
        );

        // Set up real-time listeners
        unsubscribePurchases = subscribeToPurchases(uid, (newPurchases) => {
          setPurchases(newPurchases);

          // Process auto-receipts for approved purchases
          newPurchases.forEach((purchase) => {
            if (purchase.status === 'approved' && !purchase.receiptGenerated) {
              autoReceiptService
                .processApprovedPurchase({
                  id: purchase.id,
                  customerId: purchase.customerId,
                  traderId: purchase.traderId,
                  productName: purchase.productName,
                  amount: purchase.amount,
                  quantity: purchase.quantity,
                  timestamp: purchase.timestamp || purchase.createdAt,
                  status: purchase.status,
                  customerEmail: purchase.customerEmail,
                  customerName: purchase.customerName,
                  traderName: data?.businessName || data?.displayName,
                  traderEmail: data?.email,
                })
                .catch((error) => {
                  console.error('Failed to process auto-receipt:', error);
                });
            }
          });
        });

        unsubscribeTransactions = subscribeToTransactions(uid, (newTransactions) => {
          setTransactions(newTransactions);
        });

        unsubscribeProducts = subscribeToProducts(uid, (newProducts) => {
          setProducts(newProducts);
        });

        unsubscribeUserData = subscribeToUserData(uid, (newUserData) => {
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
      if (unsubscribePurchases) unsubscribePurchases();
      if (unsubscribeTransactions) unsubscribeTransactions();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeUserData) unsubscribeUserData();
    };
  }, [subscribeToPurchases, subscribeToTransactions, subscribeToProducts, subscribeToUserData]);

  if (loading)
    return (
      <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center z-[1000]">
        <div className="relative">
          {/* Outer Pulsing Ring */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-orange-600 rounded-full blur-[60px] -z-10"
          />

          <div className="flex flex-col items-center gap-8 text-center p-8">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-24 h-24 border-2 border-white/5 border-t-orange-600 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Logo dark className="scale-75 translate-x-1" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase">
                Syncing Nexus
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

            <p className="text-neutral-500 font-bold text-[10px] uppercase tracking-[0.3em] max-w-[200px]">
              Calibrating Market Core & Inventory Ledger
            </p>
          </div>
        </div>
      </div>
    );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = purchases
    .filter((p) => toDate(p.timestamp).getTime() >= today.getTime() && p.status === 'approved')
    .reduce((acc, p) => acc + (p.amount || 0), 0);
  const accountVerified = isAccountVerified(userData);

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col md:flex-row selection:bg-orange-500/30 selection:text-white transition-colors duration-300 overflow-hidden',
        dashboardAccent.section
      )}
    >
      {/* Sidebar - Desktop Only or Overlay on Mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-[#050505] text-white transform transition-all duration-500 ease-in-out md:relative md:translate-x-0 hidden md:flex flex-col border-r border-white/5',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          isSidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-8 shrink-0 px-2">
            {!isSidebarCollapsed && <Logo dark className="scale-90 origin-left" />}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
            >
              {isSidebarCollapsed ? (
                <Plus className="rotate-45" size={20} />
              ) : (
                <X className="rotate-45" size={20} />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            <nav className={cn('flex-1 space-y-5', isSidebarCollapsed && 'items-center')}>
              {/* The Pulse: Operations Core */}
              <div>
                {!isSidebarCollapsed && (
                  <div className="mb-3 px-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      The Pulse
                    </p>
                    <p className="text-[7px] text-white/20 uppercase tracking-[0.15em] mt-1.5 leading-tight">
                      Real-time telemetry & inventory command
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <SidebarItem
                    collapsed={isSidebarCollapsed}
                    active={activeTab === 'overview'}
                    onClick={() => handleTabChange('overview')}
                    icon={<LayoutDashboard size={20} />}
                    label={t.common.dashboard}
                    description="Today's sales, stock alerts & health"
                  />
                  <SidebarItem
                    collapsed={isSidebarCollapsed}
                    active={activeTab === 'products'}
                    onClick={() => handleTabChange('products')}
                    icon={<Package size={20} />}
                    label="Inventory"
                    description="Asset vault & stock management"
                  />
                  <SidebarItem
                    collapsed={isSidebarCollapsed}
                    active={activeTab === 'purchases'}
                    onClick={() => handleTabChange('purchases')}
                    icon={<ShoppingCart size={20} />}
                    label="Sales Log"
                    description="Living ledger of all transactions"
                  />
                  <SidebarItem
                    collapsed={isSidebarCollapsed}
                    active={activeTab === 'accounting'}
                    onClick={() => handleTabChange('accounting')}
                    icon={<Book size={20} />}
                    label={t.trader.accounting}
                    description="Financial records & formal ledger"
                  />
                </div>
              </div>

              {/* The Vault: Finance & Analytics */}
              <div>
                {!isSidebarCollapsed && (
                  <div className="mb-3 px-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      The Vault
                    </p>
                    <p className="text-[7px] text-white/20 uppercase tracking-[0.15em] mt-1.5 leading-tight">
                      Digital assets, insights & forecasting
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <SidebarItem
                    collapsed={isSidebarCollapsed}
                    active={activeTab === 'wallet'}
                    onClick={() => handleTabChange('wallet')}
                    icon={<Wallet size={20} />}
                    label="Wallet"
                    description="Balance, withdrawals & float"
                  />
                  <SidebarItem
                    collapsed={isSidebarCollapsed}
                    active={activeTab === 'premium'}
                    onClick={() => handleTabChange('premium')}
                    icon={<Crown size={20} />}
                    label="Premium"
                    description="Plans, upgrades & feature access"
                  />
                  {userData?.features?.includes('analytics_pro') && (
                    <SidebarItem
                      collapsed={isSidebarCollapsed}
                      active={activeTab === 'analytics'}
                      onClick={() => handleTabChange('analytics')}
                      icon={<TrendingUp size={20} />}
                      label="Insights"
                      description="Revenue forecasts & patterns"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <SidebarItem
                  collapsed={isSidebarCollapsed}
                  active={showMoreMenu}
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  icon={<ChevronDown size={20} />}
                  label="More"
                  description="Open additional tools"
                />
                {!isSidebarCollapsed && showMoreMenu && (
                  <div className="space-y-1 pl-2 pt-2 border-l border-white/10">
                    {(userData?.features?.includes('supply_chain') ||
                      userData?.features?.includes('delivery_management')) && (
                      <>
                        <SidebarItem
                          collapsed={false}
                          active={activeTab === 'deliveries'}
                          onClick={() => handleTabChange('deliveries')}
                          icon={<Truck size={20} />}
                          label="Deliveries"
                          description="Dispatch to doorstep tracking"
                        />
                        <SidebarItem
                          collapsed={false}
                          active={activeTab === 'suppliers'}
                          onClick={() => handleTabChange('suppliers')}
                          icon={<Store size={20} />}
                          label="Suppliers"
                          description="Upstream supply analysis"
                        />
                      </>
                    )}
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'payroll'}
                      onClick={() => handleTabChange('payroll')}
                      icon={<TrendingUp size={20} />}
                      label="Payroll"
                      description="Workforce compensation management"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'notifications'}
                      onClick={() => handleTabChange('notifications')}
                      icon={<Bell size={20} />}
                      label="Alerts"
                      description="System notifications & warnings"
                      badge={unreadCount ?? 0}
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'chat'}
                      onClick={() => handleTabChange('chat')}
                      icon={<MessageSquare size={20} />}
                      label="Messenger"
                      description="Direct customer communication"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'support'}
                      onClick={() => handleTabChange('support')}
                      icon={<AlertCircle size={20} />}
                      label="Agent Portal"
                      description="Support & coordination hub"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'reports'}
                      onClick={() => handleTabChange('reports')}
                      icon={<FileText size={20} />}
                      label="Reports"
                      description="Verified daily, weekly & annual PDFs"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'customers'}
                      onClick={() => handleTabChange('customers')}
                      icon={<Users size={20} />}
                      label="Client Base"
                      description="Loyalty data & behavior"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'incentives'}
                      onClick={() => handleTabChange('incentives')}
                      icon={<Gift size={20} />}
                      label="Programs"
                      description="Rewards & growth initiatives"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'team'}
                      onClick={() => handleTabChange('team')}
                      icon={<Users size={20} />}
                      label="Workforce"
                      description="Team management & oversight"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'tax'}
                      onClick={() => handleTabChange('tax')}
                      icon={<VerifiedIcon size={20} />}
                      label="Business Health"
                      description="Receipts, device health & business data"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={activeTab === 'qrcodes'}
                      onClick={() => handleTabChange('qrcodes')}
                      icon={<QrCode size={20} />}
                      label="QR Engine"
                      description="Dynamic code generation"
                    />
                    <SidebarItem
                      collapsed={false}
                      active={false}
                      onClick={() => setShowPreferences(true)}
                      icon={<Settings size={20} />}
                      label="Preferences"
                      description="App settings & features"
                    />
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="mt-auto pt-4 border-t border-white/10 shrink-0">
            {!isSidebarCollapsed && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 mb-2 p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                  <ProfileImage
                    src={userData?.photoURL}
                    alt={userData?.businessName || userData?.name || 'Trader'}
                    size="md"
                    verified={accountVerified}
                    verificationLevel={userData?.verificationLevel || 'basic'}
                    fallbackIcon={<User size={18} className="text-white" />}
                    showOnlineStatus={true}
                    isOnline={syncState.isConnected}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-black truncate leading-tight tracking-tight uppercase">
                        {userData?.businessName || userData?.name || 'Trader'}
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
                    <p className="text-[8px] text-white/50 font-black uppercase tracking-[0.2em] mt-0.5">
                      {userData?.appNumber || 'ID not set'}
                    </p>
                  </div>
                </div>

                {/* Live Sync Indicator */}

                {/* Phase 2: Account Status Card */}
                <div className="mt-3 p-3 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-600/20 rounded-2xl space-y-2 text-[8px]">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                      <AlertCircle size={10} className="text-white" />
                    </div>
                    <span className="font-black text-blue-300 uppercase tracking-widest">
                      Status
                    </span>
                  </div>

                  <div className="space-y-1 px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Email</span>
                      <span
                        className={
                          userData?.emailVerified
                            ? 'text-emerald-400 font-black'
                            : 'text-yellow-400 font-black'
                        }
                      >
                        {userData?.emailVerified ? 'OK' : 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Business</span>
                      <span
                        className={
                          accountVerified
                            ? 'text-emerald-400 font-black'
                            : 'text-yellow-400 font-black'
                        }
                      >
                        {accountVerified ? 'OK' : 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-blue-600/20 pt-1 mt-1">
                      <span className="text-white/50">Account Age</span>
                      <span className="text-white/80 font-black">
                        {getAccountAge(userData?.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phase 2: Sync Status */}
                <div className="mt-3 flex items-center justify-center gap-2 text-[7px] text-white/40 px-2 py-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span>Synced {getTimeAgo(lastSyncTime)}</span>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-black text-sm shadow-xl shadow-orange-900/40 mx-auto">
                {userData?.name?.[0] || 'T'}
              </div>
            )}
            <button
              onClick={() => auth.signOut().then(() => navigate('/login'))}
              className={cn(
                'w-full flex items-center transition-all font-bold text-xs rounded-xl mt-3',
                isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 py-3 px-4',
                'text-white/40 hover:text-red-500 hover:bg-red-500/10 active:scale-95'
              )}
              title={isSidebarCollapsed ? 'Logout' : undefined}
            >
              <LogOut size={20} /> {!isSidebarCollapsed && 'Sign Out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
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

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-4 left-4 z-[70] w-[280px] bg-[#050505] text-white rounded-[2.5rem] border border-white/5 shadow-2xl md:hidden overflow-hidden flex flex-col p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Logo dark />
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-3 bg-white/5 rounded-2xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center font-black text-xs shadow-lg shadow-orange-900/40">
                  {userData?.name?.[0] || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate leading-tight">
                    {userData?.businessName || userData?.name || 'Trader'}
                  </p>
                  <p className="text-[7px] text-white/40 font-black uppercase tracking-[0.15em] mt-0.5">
                    {userData?.appNumber || '---'}
                  </p>
                  <p className="text-[7px] text-orange-500 font-bold uppercase mt-1">Trader Mode</p>
                </div>
              </div>
              <p className="text-[7px] text-white/30 font-medium uppercase tracking-[0.1em] mt-3 leading-tight">
                Asset mastery & real-time commerce operations
              </p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
              <div>
                <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                  The Pulse
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MobileTabItem
                    active={activeTab === 'overview'}
                    onClick={() => {
                      handleTabChange('overview');
                      setIsSidebarOpen(false);
                    }}
                    icon={<LayoutDashboard size={20} />}
                    label="Dashboard"
                  />
                  <MobileTabItem
                    active={activeTab === 'notifications'}
                    onClick={() => {
                      handleTabChange('notifications');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Bell size={20} />}
                    label="Alerts"
                    badge={unreadCount ?? 0}
                  />
                  <MobileTabItem
                    active={activeTab === 'products'}
                    onClick={() => {
                      handleTabChange('products');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Package size={20} />}
                    label="Inventory"
                  />
                  <MobileTabItem
                    active={activeTab === 'purchases'}
                    onClick={() => {
                      handleTabChange('purchases');
                      setIsSidebarOpen(false);
                    }}
                    icon={<ShoppingCart size={20} />}
                    label="Sales"
                  />
                </div>
              </div>

              <div>
                <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                  The Vault
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MobileTabItem
                    active={activeTab === 'wallet'}
                    onClick={() => {
                      handleTabChange('wallet');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Wallet size={20} />}
                    label="Wallet"
                  />
                  <MobileTabItem
                    active={activeTab === 'premium'}
                    onClick={() => {
                      handleTabChange('premium');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Crown size={20} />}
                    label="Premium"
                  />
                  <MobileTabItem
                    active={activeTab === 'analytics'}
                    onClick={() => {
                      handleTabChange('analytics');
                      setIsSidebarOpen(false);
                    }}
                    icon={<TrendingUp size={20} />}
                    label="Insights"
                  />
                  <MobileTabItem
                    active={activeTab === 'accounting'}
                    onClick={() => {
                      handleTabChange('accounting');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Book size={20} />}
                    label="Accounts"
                  />
                  <MobileTabItem
                    active={activeTab === 'tax'}
                    onClick={() => {
                      handleTabChange('tax');
                      setIsSidebarOpen(false);
                    }}
                    icon={<VerifiedIcon size={20} />}
                    label="Health"
                  />
                </div>
              </div>

              <div>
                <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                  The Flow
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MobileTabItem
                    active={activeTab === 'deliveries'}
                    onClick={() => {
                      handleTabChange('deliveries');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Truck size={20} />}
                    label="Deliveries"
                  />
                  <MobileTabItem
                    active={activeTab === 'suppliers'}
                    onClick={() => {
                      handleTabChange('suppliers');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Store size={20} />}
                    label="Suppliers"
                  />
                  <MobileTabItem
                    active={activeTab === 'payroll'}
                    onClick={() => {
                      handleTabChange('payroll');
                      setIsSidebarOpen(false);
                    }}
                    icon={<TrendingUp size={20} />}
                    label="Payroll"
                  />
                </div>
              </div>

              <div>
                <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                  Relations
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MobileTabItem
                    active={activeTab === 'chat'}
                    onClick={() => {
                      handleTabChange('chat');
                      setIsSidebarOpen(false);
                    }}
                    icon={<MessageSquare size={20} />}
                    label="Messenger"
                  />
                  <MobileTabItem
                    active={activeTab === 'team'}
                    onClick={() => {
                      handleTabChange('team');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Users size={20} />}
                    label="Workforce"
                  />
                  <MobileTabItem
                    active={activeTab === 'incentives'}
                    onClick={() => {
                      handleTabChange('incentives');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Gift size={20} />}
                    label="Programs"
                  />
                  <MobileTabItem
                    active={activeTab === 'customers'}
                    onClick={() => {
                      handleTabChange('customers');
                      setIsSidebarOpen(false);
                    }}
                    icon={<Users size={20} />}
                    label="Clients"
                  />
                  <MobileTabItem
                    active={activeTab === 'qrcodes'}
                    onClick={() => {
                      handleTabChange('qrcodes');
                      setIsSidebarOpen(false);
                    }}
                    icon={<QrCode size={20} />}
                    label="QR Engine"
                  />
                  <MobileTabItem
                    active={activeTab === 'support'}
                    onClick={() => {
                      handleTabChange('support');
                      setIsSidebarOpen(false);
                    }}
                    icon={<AlertCircle size={20} />}
                    label="Support"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={() => auth.signOut().then(() => navigate('/login'))}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto no-scrollbar relative bg-[#050505] transition-colors">
        {/* Mobile Header */}
        <header className="md:hidden bg-[#050505] border-b border-white/5 px-4 py-4 sticky top-0 z-40 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Open navigation menu"
                title="Open menu"
              >
                <Menu size={20} className="text-neutral-400" />
              </button>
              <Logo dark className="scale-90" />
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="p-2.5 relative hover:bg-white/5 rounded-lg transition-colors"
              >
                <Bell size={18} className="text-neutral-400" />
                {(unreadCount ?? 0) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-600 rounded-full" />
                )}
              </Link>
              <ThemeToggle />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-white uppercase">Business Hub</p>
              <p className="text-[7px] text-white/40 font-medium uppercase tracking-[0.1em] mt-0.5">
                Commerce Command Center
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-orange-500 uppercase">Trader</p>
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-4 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 pb-40 sm:pb-32 md:pb-8">
          {/* Context Banner - Shows user type info and dashboard purpose */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden sm:grid md:hidden grid-cols-2 gap-3 mb-2"
          >
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-[7px] text-white/40 font-black uppercase tracking-[0.15em]">
                User Type
              </p>
              <p className="text-xs font-black text-orange-500 mt-1 uppercase">Trader</p>
              <p className="text-[7px] text-white/50 font-medium mt-1.5 leading-tight">
                Commerce & Inventory Command
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-[7px] text-white/40 font-black uppercase tracking-[0.15em]">
                Module
              </p>
              <p className="text-xs font-black text-white mt-1 uppercase">Dashboard</p>
              <p className="text-[7px] text-white/50 font-medium mt-1.5 leading-tight">
                Real-time telemetry & alerts
              </p>
            </div>
          </motion.div>

          <AnimatePresence>
            {upgradeStatus && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  'p-4 rounded-2xl flex items-center justify-between gap-4 shadow-lg',
                  upgradeStatus === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  {upgradeStatus === 'success' ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <AlertCircle size={24} />
                  )}
                  <div>
                    <p className="font-black text-sm uppercase tracking-widest">
                      {upgradeStatus === 'success'
                        ? t.common.upgradeSuccessful
                        : t.common.upgradeCancelled}
                    </p>
                    <p className="text-xs opacity-80 font-medium">
                      {upgradeStatus === 'success'
                        ? t.common.upgradeSuccessMessage
                        : t.common.upgradeCancelMessage}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUpgradeStatus(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
                >
                  <X size={20} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-x-auto no-scrollbar"
            >
              <div className="flex gap-2 sm:gap-3 pb-3 min-w-max sm:min-w-full">
                <StatCard
                  label="Today's Sales"
                  value={`${todaySales.toLocaleString()} RWF`}
                  trend="+12%"
                  description="Real-time revenue tracking"
                />
                <StatCard
                  label="Low Stock"
                  value={
                    products.filter((p) => (p.stock || 0) < (userData?.lowStockThreshold || 10))
                      .length
                  }
                  trend="Alert"
                  isAlert
                  description="Urgent inventory alerts"
                  onClick={() => handleTabChange('products', 'low')}
                />
                <StatCard
                  label="Loyalty Issued"
                  value={(userData?.loyaltyPointsIssued || 0).toLocaleString()}
                  trend="Points"
                  description="Customer rewards distributed"
                />
                <StatCard
                  label="Active Products"
                  value={products.length}
                  trend="In Vault"
                  description="Total market assets"
                />
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <React.Suspense fallback={<TabLoading />}>
                {activeTab === 'overview' && (
                  <TraderOverview
                    products={products}
                    purchases={purchases}
                    transactions={transactions}
                    userData={userData}
                    setActiveTab={handleTabChange}
                    onUpgradeSuccess={refreshUserData}
                  />
                )}
                {activeTab === 'products' && (
                  <TraderProducts
                    products={products}
                    traderId={dashboardTraderId}
                    traderName={userData?.businessName || userData?.name || t.common.trader}
                    traderTin={userData?.tin || '---'}
                    traderPhone={userData?.phone}
                    traderAddress={userData?.businessAddress || userData?.location}
                    traderData={userData}
                    lowStockThreshold={userData?.lowStockThreshold || 10}
                    initialStockFilter={initialStockFilter}
                    initialEditProductId={initialEditProductId}
                    setInitialEditProductId={setInitialEditProductId}
                  />
                )}
                {activeTab === 'purchases' && (
                  <TraderPurchases
                    purchases={purchases}
                    products={products}
                    traderName={userData?.businessName || userData?.name || t.common.trader}
                    traderTin={userData?.tin || '---'}
                    traderPhone={userData?.phone}
                    traderAddress={userData?.businessAddress || userData?.location}
                    traderEmail={userData?.email}
                    onSaleRecorded={refreshSalesLogData}
                  />
                )}
                {activeTab === 'analytics' && (
                  <TraderAnalytics
                    data={{
                      monthlyRevenue: Array.from({ length: 6 }).map((_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - (5 - i));
                        const monthName = d.toLocaleString('default', { month: 'short' });
                        const revenue = purchases
                          .filter((p) => {
                            const pDate = toDate(p.timestamp);
                            return (
                              pDate.getMonth() === d.getMonth() &&
                              pDate.getFullYear() === d.getFullYear() &&
                              p.status === 'approved'
                            );
                          })
                          .reduce((acc, p) => acc + (p.amount || 0), 0);
                        return { month: monthName, revenue };
                      }),
                      dailySales: Array.from({ length: 7 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        const dateStr = d.toLocaleDateString(undefined, { weekday: 'short' });
                        const sales = purchases
                          .filter((p) => {
                            const pDate = toDate(p.timestamp);
                            return (
                              pDate.toDateString() === d.toDateString() && p.status === 'approved'
                            );
                          })
                          .reduce((acc, p) => acc + (p.amount || 0), 0);
                        return { date: dateStr, sales };
                      }),
                      topProducts: Object.entries(
                        purchases
                          .filter((p) => p.status === 'approved')
                          .reduce((acc: any, p) => {
                            const name = p.productName || 'Unknown';
                            acc[name] = (acc[name] || 0) + (p.amount || 0);
                            return acc;
                          }, {})
                      )
                        .map(([name, value]) => ({ name, value: value as number }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5),
                      expenseBreakdown: [
                        { name: 'Inventory', value: 450000 },
                        { name: 'Logistics', value: 120000 },
                        { name: 'Marketing', value: 80000 },
                        { name: 'Staff', value: 300000 },
                        { name: 'Other', value: 50000 },
                      ],
                      salesSummary: {
                        totalSales: purchases
                          .filter((p) => p.status === 'approved')
                          .reduce((acc, p) => acc + (p.amount || 0), 0),
                        manualSales: purchases
                          .filter((p) => p.status === 'approved')
                          .filter((p) => p.recordedBy === 'trader')
                          .reduce((acc, p) => acc + (p.amount || 0), 0),
                        walletSales: purchases
                          .filter((p) => p.status === 'approved')
                          .filter((p) => p.paymentMethod === 'wallet')
                          .reduce((acc, p) => acc + (p.amount || 0), 0),
                      },
                      inventoryHealth: products
                        .map((p) => ({
                          name: p.name,
                          stock: p.stock || 0,
                          sold: purchases.filter(
                            (pur) => pur.productId === p.id && pur.status === 'approved'
                          ).length,
                        }))
                        .slice(0, 5),
                      customerBehavior: Array.from({ length: 7 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        const dateStr = d.toLocaleDateString(undefined, { weekday: 'short' });
                        const dayPurchases = purchases.filter(
                          (p) => toDate(p.timestamp).toDateString() === d.toDateString()
                        );
                        const returning = dayPurchases.filter((p) => (p as any).isReturning).length;
                        return {
                          date: dateStr,
                          new: Math.max(0, dayPurchases.length - returning),
                          returning,
                        };
                      }),
                    }}
                  />
                )}
                {activeTab === 'qrcodes' && (
                  <TraderQRCodes
                    products={products}
                    traderId={dashboardTraderId}
                    traderName={userData?.name || t.common.trader}
                    traderTin={userData?.tin || '---'}
                    traderPhone={userData?.phone}
                    traderAddress={userData?.businessAddress || userData?.location}
                  />
                )}
                {activeTab === 'wallet' && (
                  <TraderWallet
                    balance={userData?.walletBalance || 0}
                    userId={dashboardTraderId}
                    transactions={transactions}
                    tier={userData?.tier || 'free'}
                  />
                )}
                {activeTab === 'premium' && (
                  <TraderSubscriptionDashboard
                    traderId={dashboardTraderId}
                    userData={userData}
                    onUpgrade={() => window.location.reload()}
                  />
                )}
                {activeTab === 'notifications' && (
                  <NotificationsTab notifications={notifications} dark title="Alerts" />
                )}
                {activeTab === 'profile' && <TraderProfile userData={userData} />}
                {activeTab === 'accounting' && (
                  <TraderAccounting
                    traderId={dashboardTraderId}
                    tier={userData?.tier || 'standard'}
                  />
                )}
                {activeTab === 'team' && (
                  <TraderTeamManagement
                    traderId={dashboardTraderId}
                    tier={userData?.tier || 'standard'}
                  />
                )}
                {activeTab === 'payroll' && <TraderPayroll traderId={dashboardTraderId} />}
                {activeTab === 'incentives' && (
                  <TraderIncentives traderId={dashboardTraderId} />
                )}
                {activeTab === 'deliveries' && (
                  <TraderDeliveries traderId={dashboardTraderId} />
                )}
                {activeTab === 'customers' && <TraderCustomers purchases={purchases} />}
                {activeTab === 'suppliers' && <TraderSuppliers />}
                {activeTab === 'chat' && <TraderChat traderId={dashboardTraderId} />}
                {activeTab === 'support' && (
                  <SupportTab userId={actingUserId || dashboardTraderId} role="trader" />
                )}
                {activeTab === 'reports' && (
                  <VerifiedReports
                    userId={dashboardTraderId}
                    userName={userData?.businessName || userData?.name || t.common.trader}
                    role="trader"
                    transactions={transactions}
                    purchases={purchases}
                  />
                )}
                {activeTab === 'tax' && (
                  <TraderTaxChamber traderId={dashboardTraderId} userData={userData} />
                )}
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation - Mobile Only with Horizontal Scroll */}
        <nav className="fixed bottom-6 left-4 right-4 z-50 md:hidden">
          <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
            {/* Scroll Indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#050505] to-transparent pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="overflow-x-auto no-scrollbar flex items-center gap-0.5 px-3 py-2.5 scroll-smooth snap-x snap-mandatory">
              <BottomNavItem
                active={activeTab === 'overview'}
                onClick={() => handleTabChange('overview')}
                icon={<LayoutDashboard size={20} />}
                label="Home"
              />
              <BottomNavItem
                active={activeTab === 'products'}
                onClick={() => handleTabChange('products')}
                icon={<Package size={20} />}
                label="Stock"
              />
              <BottomNavItem
                active={activeTab === 'purchases'}
                onClick={() => handleTabChange('purchases')}
                icon={<ShoppingCart size={20} />}
                label="Sales"
              />
              <BottomNavItem
                active={activeTab === 'wallet'}
                onClick={() => handleTabChange('wallet')}
                icon={<Wallet size={20} />}
                label="Vault"
              />
              <BottomNavItem
                active={activeTab === 'premium'}
                onClick={() => handleTabChange('premium')}
                icon={<Crown size={20} />}
                label="Premium"
              />
              <BottomNavItem
                active={activeTab === 'notifications'}
                onClick={() => handleTabChange('notifications')}
                icon={<Bell size={20} />}
                label="Alerts"
                badge={unreadCount ?? 0}
              />

              {/* Center Action (Fixed in the scroll flow but distinct) */}
              <div className="px-1 snap-center">
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-14 h-14 bg-orange-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-orange-600/40 relative z-10 active:scale-95 transition-all hover:scale-110"
                >
                  <QrCode size={22} />
                </button>
              </div>

              <BottomNavItem
                active={activeTab === 'analytics'}
                onClick={() => handleTabChange('analytics')}
                icon={<TrendingUp size={20} />}
                label="Data"
              />
              <BottomNavItem
                active={activeTab === 'customers'}
                onClick={() => handleTabChange('customers')}
                icon={<Users size={20} />}
                label="Clients"
              />
              <BottomNavItem
                active={activeTab === 'deliveries'}
                onClick={() => handleTabChange('deliveries')}
                icon={<Truck size={20} />}
                label="Logistics"
              />
              <BottomNavItem
                active={activeTab === 'qrcodes'}
                onClick={() => handleTabChange('qrcodes')}
                icon={<QrCode size={20} />}
                label="Generator"
              />
              <BottomNavItem
                active={activeTab === 'reports'}
                onClick={() => handleTabChange('reports')}
                icon={<FileText size={20} />}
                label="Reports"
              />
              <BottomNavItem
                active={activeTab === 'tax'}
                onClick={() => handleTabChange('tax')}
                icon={<VerifiedIcon size={20} />}
                label="Health"
              />
            </div>
          </div>
        </nav>

        {/* Desktop Floating Action Buttons */}
        <div className="fixed bottom-8 right-8 hidden md:flex flex-col gap-4 z-50">
          <button
            onClick={() => setShowScanner(true)}
            className="w-16 h-16 bg-[#0a0a0a] text-orange-600 rounded-2xl shadow-2xl border border-white/5 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          >
            <QrCode size={32} className="group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className="w-16 h-16 bg-orange-600 text-white rounded-2xl shadow-2xl shadow-orange-600/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          >
            <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </main>

      <AnimatePresence>
        {showScanner && (
          <React.Suspense fallback={null}>
            <QRScanner
              onScan={async (data) => {
                setShowScanner(false);
                setLoading(true);
                try {
                  let productId = '';
                  let productCode = data;

                  // Try to parse as JSON first
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed?.id) productId = parsed.id;
                    if (parsed?.code) productCode = parsed.code;
                  } catch (e) {}

                  let foundProduct = null;
                  if (productId) {
                    const response = await getProduct(productId);
                    foundProduct = response?.product;
                  }

                  if (!foundProduct && productCode) {
                    foundProduct = products.find(
                      (product) => product.code === productCode || product.id === productCode
                    );
                  }

                  if (!foundProduct && data) {
                    const response = await getProduct(data);
                    foundProduct = response?.product;
                  }

                  if (foundProduct) {
                    setScannedProduct(foundProduct);
                  } else {
                    alert('Product not found in your inventory.');
                  }
                } catch (err) {
                  console.error('Scan error:', err);
                } finally {
                  setLoading(false);
                }
              }}
              onClose={() => setShowScanner(false)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannedProduct && (
          <React.Suspense fallback={null}>
            <QuickSaleModal
              product={scannedProduct}
              traderId={dashboardTraderId}
              traderName={userData?.businessName || userData?.name || 'Trader'}
              onClose={() => setScannedProduct(null)}
              onSuccess={() => {
                setScannedProduct(null);
              }}
            />
          </React.Suspense>
        )}
      </AnimatePresence>

      {/* Trader Preferences Modal */}
      <AnimatePresence>
        {showPreferences && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPreferences(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <React.Suspense fallback={null}>
                <TraderPreferences
                  traderId={dashboardTraderId}
                  onClose={() => setShowPreferences(false)}
                />
              </React.Suspense>
            </motion.div>
          </motion.div>
        )}
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
          'shrink-0',
          active ? 'text-white' : 'text-white/20 group-hover:text-white/60 transition-colors'
        )}
      >
        {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })}
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="truncate uppercase tracking-tight">{label}</div>
          {description && (
            <div
              className={cn(
                'text-[7px] uppercase tracking-[0.1em] leading-tight mt-0.5 truncate',
                active ? 'text-white/80' : 'text-white/30 group-hover:text-white/50'
              )}
            >
              {description}
            </div>
          )}
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

function StatCard({
  label,
  value,
  trend,
  isAlert,
  onClick,
  description,
}: {
  label: string;
  value: string | number;
  trend: string;
  isAlert?: boolean;
  onClick?: () => void;
  description?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'stat-card min-w-[135px] sm:min-w-[160px] md:min-w-[180px] transition-all',
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-95'
      )}
    >
      <p className="micro-label">{label}</p>
      <div className="flex items-baseline justify-between gap-2 mt-2">
        <h4 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tabular-nums">
          {value}
        </h4>
        <span
          className={cn(
            'text-[7px] sm:text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-tighter shrink-0',
            isAlert
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
          )}
        >
          {trend}
        </span>
      </div>
      {description && (
        <p className="text-[7px] text-white/40 font-medium uppercase tracking-[0.1em] mt-2 leading-tight">
          {description}
        </p>
      )}
    </div>
  );
}

function FeatureTile({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[2rem] border border-white/10 bg-white/5 p-5 text-left transition-all hover:border-orange-400/30 hover:bg-white/10"
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 text-orange-300 mb-4">
        {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })}
      </div>
      <p className="text-sm font-black text-white tracking-tight">{label}</p>
      <p className="mt-2 text-xs text-white/60 leading-snug">{description}</p>
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
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-3 py-2 transition-all rounded-2xl snap-center min-w-[65px] relative',
        active ? 'text-orange-500 bg-white/5' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
      )}
    >
      {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 18 })}
      <span className="text-[6.5px] font-black uppercase tracking-widest">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-0.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-orange-600 text-[7px] font-black text-white shadow-lg ring-1 ring-[#050505]">
          {badge > 9 ? '9+' : badge}
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
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] border-2 transition-all text-center relative',
        active
          ? 'bg-orange-600 border-orange-600 text-white shadow-lg'
          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
      )}
    >
      <div className={active ? 'text-white' : 'text-white/40 text-orange-500'}>{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-orange-600 shadow-lg">
          {badge}
        </span>
      )}
    </button>
  );
}
