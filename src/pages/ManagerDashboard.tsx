import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Wallet,
  Settings,
  LogOut,
  User,
  ChevronRight,
  Menu,
  X,
  Bell,
  Activity,
  ShieldCheck,
  TrendingUp,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Store,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { cn, formatCurrency, toDate } from '../lib/utils';
import { getUser } from '../services/userService';
import { getAllUsers } from '../services/userService';
import { getTransactions } from '../services/transactionService';
import { getPlatformConfig } from '../services/platformService';
import { doc, updateDoc } from '../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge

// Sub-components
import ManagerAnalytics from '../components/manager/ManagerAnalytics';
import ManagerUsers from '../components/manager/ManagerUsers';
import ManagerTransactions from '../components/manager/ManagerTransactions';
import { VerificationQueue } from '../components/manager/VerificationQueue';
import PlatformSettings from '../components/manager/PlatformSettings';
import NotificationsTab from '../components/NotificationsTab';

type Tab =
  | 'overview'
  | 'users'
  | 'transactions'
  | 'analytics'
  | 'settings'
  | 'verification'
  | 'notifications';

export default function ManagerDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [platformConfig, setPlatformConfig] = useState<any>(null);
  const { notifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // if (error) throw error;
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.uid) {
        try {
          // Fetch user data
          const userResponse = await getUser(user.uid);
          setUserData(userResponse?.user);

          // Fetch all users
          const usersResponse = await getAllUsers({ limit: 100 });
          setUsers(usersResponse?.users || []);

          // Fetch transactions
          const transactionsResponse = await getTransactions({
            limit: 50,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          });
          setTransactions(transactionsResponse?.transactions || []);

          // Fetch platform config
          const configResponse = await getPlatformConfig();
          setPlatformConfig(configResponse);

          setLoading(false);
        } catch (err) {
          console.error('Error fetching manager data:', err);
          setError(err as Error);
          setLoading(false);
        }
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const menuItems = [
    { id: 'overview', label: t.manager.overview, icon: LayoutDashboard },
    { id: 'users', label: t.manager.users, icon: Users },
    { id: 'transactions', label: t.manager.transactions, icon: ShoppingCart },
    { id: 'analytics', label: t.manager.analytics, icon: Activity },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'verification', label: t.manager.verificationQueue, icon: ShieldCheck },
    { id: 'settings', label: t.manager.settings, icon: Settings },
  ];

  const stats = [
    { label: t.manager.totalUsers, value: users.length, icon: Users, color: 'orange' },
    {
      label: t.manager.totalVolume,
      value: `RWF ${formatCurrency(transactions.reduce((acc, t) => acc + t.amount, 0))}`,
      icon: Wallet,
      color: 'green',
    },
    {
      label: t.manager.totalTransactions,
      value: transactions.length,
      icon: ShoppingCart,
      color: 'blue',
    },
    {
      label: t.manager.activeTraders,
      value: users.filter((u) => u.role === 'trader').length,
      icon: Store,
      color: 'purple',
    },
    {
      label: 'Active Agents',
      value: users.filter((u) => u.role === 'agent').length,
      icon: ShieldCheck,
      color: 'orange',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#050505]">
        <Loader2 className="animate-spin text-orange-600" size={48} />
        <p className="text-neutral-400 dark:text-neutral-600 font-medium animate-pulse">
          {t.common.loadingManager}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#050505] flex font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-white dark:bg-[#0a0a0a] border-r border-neutral-100 dark:border-white/5 transition-all duration-300 ease-in-out',
          isSidebarOpen ? 'w-72' : 'w-20'
        )}
      >
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 dark:shadow-orange-900/40">
              <ShieldCheck className="text-white" size={24} />
            </div>
            {isSidebarOpen && (
              <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tighter">
                ESOKO <span className="text-orange-600">MANAGER</span>
              </span>
            )}
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl transition-all group text-left',
                  activeTab === item.id
                    ? 'bg-orange-600 text-white shadow-xl shadow-orange-100 dark:shadow-orange-900/40'
                    : 'text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                )}
              >
                <item.icon
                  size={24}
                  className={cn(
                    'transition-transform group-hover:scale-110 shrink-0',
                    activeTab === item.id ? 'text-white' : 'text-neutral-400 dark:text-neutral-600'
                  )}
                />
                {isSidebarOpen && (
                  <span className="font-bold text-xs uppercase tracking-widest truncate">
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button
            onClick={() => auth.signOut()}
            className="flex items-center gap-4 p-4 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all group"
          >
            <LogOut size={24} className="group-hover:translate-x-1 transition-transform shrink-0" />
            {isSidebarOpen && (
              <span className="font-bold text-xs uppercase tracking-widest">{t.common.logout}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300 h-screen overflow-y-auto no-scrollbar',
          isSidebarOpen ? 'ml-72' : 'ml-20'
        )}
      >
        {/* Header */}
        <header className="h-24 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-100 dark:border-white/5 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">
              {menuItems.find((i) => i.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-neutral-100 dark:border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-neutral-900 dark:text-white leading-none uppercase tracking-widest">
                  {userData?.name}
                </p>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-1">
                  {t.manager.platformManager}
                </p>
              </div>
              <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 font-black text-xl border-2 border-white dark:border-white/10 shadow-sm">
                {userData?.name?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                      <StatCard
                        key={i}
                        title={stat.label}
                        value={stat.value}
                        icon={<stat.icon size={24} />}
                        color={stat.color}
                      />
                    ))}
                  </div>

                  {/* System Health & Broadcast */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-white/10 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                          Platform Broadcast
                        </h3>
                        <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <Activity size={12} /> Live
                        </div>
                      </div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 font-medium">
                        Send a global notification to all users on the platform. Use this for
                        maintenance alerts or important updates.
                      </p>
                      <div className="space-y-4">
                        <textarea
                          value={broadcastMessage}
                          onChange={(e) => setBroadcastMessage(e.target.value)}
                          placeholder="Type your message here..."
                          className="w-full h-32 p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm resize-none dark:text-white"
                        />
                        <div className="flex justify-end">
                          <button
                            disabled={!broadcastMessage || sendingBroadcast}
                            onClick={async () => {
                              setSendingBroadcast(true);
                              try {
                                await updateDoc(doc(db, 'platform', 'config'), {
                                  broadcast: {
                                    message: broadcastMessage,
                                    timestamp: new Date().toISOString(),
                                    sender: userData?.name,
                                  },
                                });
                                setBroadcastMessage('');
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setSendingBroadcast(false);
                              }
                            }}
                            className="px-8 py-3 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center gap-2"
                          >
                            {sendingBroadcast ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <>
                                <Bell size={16} /> Broadcast Message
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-white/10 shadow-sm">
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-6">
                          System Health
                        </h3>
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-900/30">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                                <ShieldCheck size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900 dark:text-white text-sm">
                                  Data Sync
                                </p>
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                                  {loading ? 'Checking' : 'Connected'}
                                </p>
                              </div>
                            </div>
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                <TrendingUp size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900 dark:text-white text-sm">
                                  Records Loaded
                                </p>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                                  {users.length + transactions.length} total
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-neutral-900 dark:bg-orange-600/10 p-8 rounded-[2.5rem] shadow-xl shadow-neutral-200 dark:shadow-none border dark:border-orange-500/20">
                        <h3 className="text-xl font-bold text-white mb-6">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white/50 uppercase tracking-widest transition-all flex flex-col items-center gap-2 cursor-not-allowed"
                          >
                            <Download size={20} className="text-orange-600" />
                            Reports Beta
                          </button>
                          <button
                            onClick={() => setActiveTab('verification')}
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all flex flex-col items-center gap-2"
                          >
                            <ShieldCheck size={20} className="text-blue-600" />
                            Verify
                          </button>
                          <button
                            onClick={() => setActiveTab('settings')}
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all flex flex-col items-center gap-2"
                          >
                            <Settings size={20} className="text-purple-600" />
                            Config
                          </button>
                          <button
                            type="button"
                            disabled
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white/50 uppercase tracking-widest transition-all flex flex-col items-center gap-2 cursor-not-allowed"
                          >
                            <Users size={20} className="text-green-600" />
                            Support Beta
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-neutral-900">
                          {t.manager.recentUsers}
                        </h3>
                        <button
                          onClick={() => setActiveTab('users')}
                          className="text-xs font-black text-orange-600 uppercase tracking-widest hover:underline"
                        >
                          {t.common.viewAll}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {users.slice(0, 5).map((user) => (
                          <div
                            key={user.uid}
                            className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-neutral-600 font-bold border border-neutral-100">
                                {user.name?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900">{user.name}</p>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                  {user.role}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                user.status === 'active'
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {user.status || 'active'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-neutral-900">
                          {t.manager.recentTransactions}
                        </h3>
                        <button
                          onClick={() => setActiveTab('transactions')}
                          className="text-xs font-black text-orange-600 uppercase tracking-widest hover:underline"
                        >
                          {t.common.viewAll}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {transactions.slice(0, 5).map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                  tx.type === 'deposit'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-orange-100 text-orange-600'
                                }`}
                              >
                                {tx.type === 'deposit' ? (
                                  <ArrowUpRight size={20} />
                                ) : (
                                  <ArrowDownLeft size={20} />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900 capitalize">{tx.type}</p>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                  {toDate(tx.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <p
                              className={`font-bold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {tx.type === 'deposit' ? '+' : '-'} RWF {formatCurrency(tx.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && <ManagerUsers users={users} />}

              {activeTab === 'transactions' && <ManagerTransactions transactions={transactions} />}

              {activeTab === 'analytics' && (
                <ManagerAnalytics transactions={transactions} users={users} />
              )}

              {activeTab === 'verification' && <VerificationQueue />}

              {activeTab === 'notifications' && <NotificationsTab notifications={notifications} />}

              {activeTab === 'settings' && <PlatformSettings config={platformConfig} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
      <div
        className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4', colors[color])}
      >
        {icon}
      </div>
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: any) {
  const styles: any = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    completed: 'bg-green-50 text-green-700 border-green-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border w-fit',
        styles[status]
      )}
    >
      {status === 'completed' && <CheckCircle2 size={12} />}
      {status === 'failed' && <XCircle size={12} />}
      {status === 'pending' && <Clock size={12} />}
      {status}
    </div>
  );
}
