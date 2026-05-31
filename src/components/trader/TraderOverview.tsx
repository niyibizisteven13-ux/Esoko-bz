import React, { useState } from 'react';
import {
  ShoppingBag,
  TrendingUp,
  Users,
  AlertTriangle,
  Wallet,
  Zap,
  UserCircle,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Loader2,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { doc, updateDoc } from '../../services/firestoreBridge';
import TraderUpgrade from './TraderUpgrade';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, cn, toDate } from '../../lib/utils';
const db = undefined; // Used by firestoreBridge

interface Stats {
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  lowStockCount: number;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  code?: string;
}

interface TraderOverviewProps {
  products: Product[];
  purchases: any[];
  transactions: any[];
  userData: any;
  setActiveTab: (tab: any, filter?: any) => void;
  onUpgradeSuccess: () => void;
}

const CONTAINER_VARIANTS: any = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const ITEM_VARIANTS: any = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 400 } },
};

const Logo = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-2', className)}>
    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg">
      <TrendingUp size={24} />
    </div>
    <span className="font-black text-xl tracking-tight uppercase">
      ESO<span className="text-orange-600">KO</span>
    </span>
  </div>
);

function CompactStatCard({ label, value, trend, icon, color, className }: any) {
  return (
    <motion.div
      variants={ITEM_VARIANTS}
      className={cn(
        'group bg-[#0a0a0a] p-3 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all shadow-sm hover:shadow-md',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            'p-1.5 rounded-lg bg-white/5 group-hover:scale-110 transition-transform',
            color
          )}
        >
          {icon}
        </div>
        <span className="micro-label text-neutral-500">{label}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-base font-black text-white tabular-nums">{value}</span>
        <span className="text-[8px] font-bold text-green-400 flex items-center gap-0.5">
          <ArrowUpRight size={8} /> {trend}
        </span>
      </div>
    </motion.div>
  );
}

function VisualStatCard({ title, value, icon, color }: any) {
  return (
    <motion.div
      variants={ITEM_VARIANTS}
      className={cn('p-6 rounded-3xl text-white relative overflow-hidden group shadow-xl', color)}
    >
      <div className="relative z-10">
        <div className="mb-4 bg-white/10 w-fit p-3 rounded-2xl backdrop-blur-md opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700">
          {icon}
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">
          {title}
        </p>
        <h4 className="text-2xl font-black tracking-tight">{value}</h4>
      </div>
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/15 group-hover:scale-150 transition-all duration-1000"></div>
    </motion.div>
  );
}

export default function TraderOverview({
  products,
  purchases,
  transactions,
  userData,
  setActiveTab,
  onUpgradeSuccess,
}: TraderOverviewProps) {
  const { t } = useLanguage();
  const preference = userData?.dashboardPreference || 'classic';
  const lowStockThreshold = userData?.lowStockThreshold || 10;
  const lowStockProducts = products.filter((p) => p.stock < lowStockThreshold);

  const handlePreferenceChange = async (newPref: string) => {
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        dashboardPreference: newPref,
      });
    } catch (err) {
      console.error('Failed to update preference:', err);
    }
  };

  const ViewSwitcher = () => (
    <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-xl w-fit mb-6 border border-white/5">
      {[
        { id: 'classic', label: 'Classic' },
        { id: 'compact', label: 'Compact' },
        { id: 'visual', label: 'Visual' },
      ].map((view) => (
        <button
          key={view.id}
          onClick={() => handlePreferenceChange(view.id)}
          className={cn(
            'px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
            preference === view.id
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );

  const renderClassic = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <ViewSwitcher />
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-0.5">
              Vault Sync
            </p>
            <p className="text-base font-black text-white leading-none tabular-nums">
              {formatCurrency(userData?.walletBalance || 0)} RWF
            </p>
          </div>
          <div className="w-9 h-9 bg-[#0a0a0a] border border-white/5 text-orange-500 rounded-xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
            <Wallet size={18} />
          </div>
        </div>
      </div>

      <motion.div variants={ITEM_VARIANTS}>
        <h2 className="text-xl font-black text-white tracking-tight leading-none mb-0.5">
          Shop Insights
        </h2>
        <p className="text-neutral-500 font-medium text-[11px]">
          Synchronized performance metrics for your local distribution Hub
        </p>
      </motion.div>

      {userData && userData.role === 'trader' && (
        <motion.div variants={ITEM_VARIANTS} className="mb-6">
          <TraderUpgrade
            traderId={userData.uid}
            currentTier={userData?.tier || 'free'}
            isTrialActive={Boolean(
              userData?.trialEndsAt && new Date(userData.trialEndsAt) > new Date()
            )}
            onUpgrade={onUpgradeSuccess}
            traderEmail={userData?.email}
            traderName={userData?.name}
          />
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {userData?.features?.includes('analytics_pro') && (
          <motion.div
            variants={ITEM_VARIANTS}
            className="group relative bento-item md:col-span-2 lg:col-span-2 bg-[#0a0a0a] text-white border border-white/5 p-6 md:p-10 overflow-hidden shadow-2xl"
          >
            <div className="relative z-10 flex flex-col h-full justify-between gap-6 md:gap-0">
              <div>
                <p className="micro-label text-white/30 mb-2">Revenue Growth</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl md:text-5xl font-black tracking-tight">+24.8%</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center gap-0.5">
                    <ArrowUpRight size={14} /> 12%
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                      Velocity Target
                    </p>
                    <p className="text-sm font-bold text-white/80">Goal Reach: 85%</p>
                  </div>
                  <TrendingUp className="text-orange-500 animate-pulse" size={32} />
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '85%' }}
                    className="h-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div
          className={cn(
            'grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory py-2 -mx-4 px-4',
            userData?.features?.includes('analytics_pro')
              ? 'md:col-span-2 lg:col-span-2'
              : 'md:grid-cols-4 lg:col-span-4'
          )}
        >
          <CompactStatCard
            label="Gross Sales"
            value={`${formatCurrency(purchases.reduce((acc, p) => acc + p.amount, 0))} RWF`}
            trend="+12%"
            icon={<ShoppingBag size={14} />}
            color="text-emerald-500 bg-emerald-500/10"
            className="snap-start min-w-[160px] md:min-w-0"
          />
          <CompactStatCard
            label="Active Stock"
            value={products.length}
            trend={`Low: ${lowStockProducts.length}`}
            icon={<Package size={14} />}
            color="text-orange-500 bg-orange-500/10"
            className="snap-start min-w-[160px] md:min-w-0"
          />
          <CompactStatCard
            label="Clients Hub"
            value={new Set(purchases.map((p) => p.customerId)).size}
            trend="+5"
            icon={<Users size={14} />}
            color="text-blue-500 bg-blue-500/10"
            className="snap-start min-w-[160px] md:min-w-0"
          />
          <CompactStatCard
            label="Vault Balance"
            value={`${formatCurrency(userData?.walletBalance || 0)} RWF`}
            trend="Active"
            icon={<Wallet size={14} />}
            color="text-purple-500 bg-purple-500/10"
            className="snap-start min-w-[160px] md:min-w-0"
          />
        </div>

        <motion.div
          variants={ITEM_VARIANTS}
          className="bento-item sm:col-span-2 md:col-span-1 lg:col-span-3 bg-[#0a0a0a] border border-white/5 p-6 overflow-hidden relative group/pulse"
        >
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <p className="micro-label text-neutral-500 mb-1 uppercase tracking-[0.2em]">
                Live Pulse
              </p>
              <h3 className="text-xl font-black text-white tracking-tight">
                Recent Activity Stream
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('purchases')}
              className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-neutral-500 group-hover/pulse:text-orange-600 transition-colors border border-white/5"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
            {purchases.slice(0, 3).map((sale, i) => (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3 group/sale hover:border-orange-500/30 transition-all hover:bg-white/[0.07]"
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-xl bg-white/5 shadow-sm text-neutral-500 group-hover/sale:text-orange-500 transition-colors">
                    <ShoppingBag size={16} />
                  </div>
                  <p className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    Success
                  </p>
                </div>
                <div>
                  <p className="font-black text-white text-sm tabular-nums mb-0.5">
                    {formatCurrency(sale.amount)} RWF
                  </p>
                  <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                    {sale.customerName || 'Standard Merchant'}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.2em]">
                    {sale.id.slice(-6).toUpperCase()}
                  </span>
                  <span className="text-[8px] font-bold text-neutral-500">
                    {toDate(sale.timestamp)
                      ? formatCurrency(
                          Math.floor((Date.now() - toDate(sale.timestamp).getTime()) / 3600000)
                        ) + 'h ago'
                      : 'Now'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
        </motion.div>

        <motion.div
          variants={ITEM_VARIANTS}
          className="bento-item bg-slate-900 dark:bg-black/50 text-white border-none p-10 overflow-hidden shadow-2xl"
        >
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <p className="micro-label text-white/30 mb-8 uppercase tracking-[0.3em]">
                Management
              </p>
              <div className="space-y-6">
                {[
                  { icon: ShoppingBag, label: 'Record Terminal', action: 'Sale' },
                  { icon: Zap, label: 'Asset Pipeline', action: 'Restock' },
                  { icon: Users, label: 'Team Console', action: 'Access' },
                ].map((act, i) => (
                  <button key={i} className="flex items-center gap-4 w-full group/btn">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center transition-all group-hover/btn:bg-orange-600 group-hover/btn:shadow-lg group-hover/btn:shadow-orange-600/30">
                      <act.icon size={20} />
                    </div>
                    <div className="text-left font-black">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">
                        {act.label}
                      </p>
                      <p className="text-sm tracking-tight">{act.action}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -right-16 -top-16 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
          <Logo className="absolute -left-8 -bottom-8 w-40 h-40 opacity-5 rotate-12" />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
        <motion.div
          variants={ITEM_VARIANTS}
          className="bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/10">
              <Sparkles size={20} />
            </div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none">
              Market Sentiment
            </h4>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-neutral-500">
              <span>Supply Velocity</span>
              <span className="text-emerald-500">Accelerating</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '75%' }}
                className="h-full bg-blue-500"
              />
            </div>
            <p className="text-[10px] text-neutral-500 font-medium leading-relaxed">
              Your distribution speed is 15% higher than the local cluster average. Optimization
              recommended for Tier-2 logistics.
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={ITEM_VARIANTS}
          className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                <ShieldCheck size={20} />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight leading-none">
                Fiscal Integrity
              </h4>
            </div>
            <p className="text-emerald-50 text-xs font-medium mb-6">
              All tax documents have been synchronized with the RRA Tax Chamber. No pending
              discrepancies detected for this cycle.
            </p>
            <div className="flex gap-4">
              <div className="flex-1 px-4 py-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Status</p>
                <p className="font-black text-sm">Verified</p>
              </div>
              <div className="flex-1 px-4 py-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-60">
                  Standing
                </p>
                <p className="font-black text-sm">100%</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </motion.div>
      </div>
    </div>
  );

  const renderCompact = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ViewSwitcher />
        <p className="text-[8px] font-black text-neutral-300 dark:text-neutral-700 uppercase tracking-[0.3em]">
          Quick Hub
        </p>
      </div>
      <motion.div
        variants={ITEM_VARIANTS}
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm relative overflow-hidden group"
      >
        <div className="absolute left-0 top-0 w-1 h-full bg-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-slate-900 dark:text-white group-hover:bg-orange-50 dark:group-hover:bg-orange-900/10 transition-colors">
            <UserCircle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-neutral-100 tracking-tight">
              Dashboard
            </h2>
            <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">
              {userData?.businessName || 'Merchant Console'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:border-l border-neutral-100 dark:border-neutral-800 md:pl-4">
          <div className="text-right">
            <p className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-0.5">
              Balance
            </p>
            <p className="text-base font-black text-slate-900 dark:text-neutral-100 tabular-nums">
              {formatCurrency(userData?.walletBalance || 0)}{' '}
              <span className="text-[9px] opacity-40">RWF</span>
            </p>
          </div>
          <button className="w-8 h-8 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-600/20 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
            <ArrowUpRight size={16} />
          </button>
        </div>
      </motion.div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CompactStatCard
          label="Revenue"
          value={formatCurrency(purchases.reduce((acc, p) => acc + p.amount, 0))}
          trend="+12%"
          icon={<TrendingUp size={16} />}
          color="text-blue-600"
        />
        <CompactStatCard
          label="Items"
          value={products.length}
          trend={`${lowStockProducts.length}`}
          icon={<Package size={16} />}
          color="text-orange-600"
        />
        <CompactStatCard
          label="Customers"
          value={new Set(purchases.map((p) => p.customerId)).size}
          trend="+8%"
          icon={<Users size={16} />}
          color="text-indigo-600"
        />
        <CompactStatCard
          label="Trust"
          value="98%"
          trend="High"
          icon={<ShieldCheck size={16} />}
          color="text-emerald-600"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          variants={ITEM_VARIANTS}
          className="lg:col-span-2 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
              Live Stream
            </h3>
            <button
              onClick={() => setActiveTab('purchases')}
              className="text-[10px] text-orange-600 font-black uppercase tracking-widest hover:underline transition-all group flex items-center gap-1"
            >
              Full History <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-1">
            {purchases.slice(0, 6).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between py-3 px-2 rounded-xl group hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-[10px] font-black text-neutral-400">
                    {sale.id.slice(-2).toUpperCase()}
                  </span>
                  <span className="text-sm font-bold truncate max-w-[140px]">
                    {sale.customerName || 'Anonymous User'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black tabular-nums">
                    {formatCurrency(sale.amount)} RWF
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div
          variants={ITEM_VARIANTS}
          className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm h-fit"
        >
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-6 font-mono">
            Operations
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Record Sale', icon: ShoppingBag, color: 'emerald' },
              { label: 'Add Stock', icon: Zap, color: 'blue' },
            ].map((act, i) => (
              <button
                key={i}
                className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl flex flex-col items-center gap-2 hover:bg-white dark:hover:bg-neutral-700 border border-transparent hover:border-neutral-100 dark:hover:border-neutral-600 transition-all active:scale-95"
              >
                <div
                  className={cn(
                    'p-2 rounded-lg bg-white dark:bg-neutral-900',
                    `text-${act.color}-600`
                  )}
                >
                  <act.icon size={18} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider">{act.label}</span>
              </button>
            ))}
          </div>
          <button className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-colors">
            System Health: Optimal
          </button>
        </motion.div>
      </div>
    </div>
  );

  const renderVisual = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <ViewSwitcher />
        <motion.div
          variants={ITEM_VARIANTS}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-600/20"
        >
          <Sparkles size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Premium Insights</span>
        </motion.div>
      </div>
      <motion.div
        variants={ITEM_VARIANTS}
        className="relative h-64 rounded-[3.5rem] overflow-hidden bg-slate-900 flex items-center px-6 md:px-12 shadow-2xl"
      >
        <div className="absolute inset-0 opacity-40">
          <img
            src="https://picsum.photos/seed/executive/1200/600"
            alt="Banner"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
        <div className="relative z-10 space-y-4 max-w-xl">
          <div className="w-fit px-4 py-1.5 bg-orange-600/20 backdrop-blur-md rounded-full border border-orange-600/30 text-orange-400 text-[10px] font-black uppercase tracking-[0.3em]">
            Merchant Authority
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
            Welcome back, <br />
            <span className="text-orange-500">{userData?.name?.split(' ')[0]}</span>
          </h2>
        </div>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <VisualStatCard
          title="Revenue"
          value={`RWF ${formatCurrency(purchases.reduce((acc, p) => acc + p.amount, 0))}`}
          icon={<TrendingUp size={40} />}
          color="bg-gradient-to-br from-blue-600 to-indigo-700"
        />
        <VisualStatCard
          title="Inventory"
          value={`${products.length} Active SKUs`}
          icon={<Package size={40} />}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
        <VisualStatCard
          title="Community"
          value={`${new Set(purchases.map((p) => p.customerId)).size} Traders`}
          icon={<Users size={40} />}
          color="bg-gradient-to-br from-purple-600 to-fuchsia-700"
        />
      </div>
    </div>
  );

  return (
    <motion.div variants={CONTAINER_VARIANTS} initial="initial" animate="animate">
      {preference === 'compact'
        ? renderCompact()
        : preference === 'visual'
          ? renderVisual()
          : renderClassic()}
    </motion.div>
  );
}
