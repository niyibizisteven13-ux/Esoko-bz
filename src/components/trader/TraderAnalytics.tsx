import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  Calendar,
  Sparkles,
  Loader2,
  Users,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { cn, formatCurrency } from '../../lib/utils';

interface AnalyticsData {
  monthlyRevenue: { month: string; revenue: number }[];
  dailySales: { date: string; sales: number }[];
  topProducts: { name: string; value: number }[];
  expenseBreakdown: { name: string; value: number }[];
  customerBehavior?: { date: string; new: number; returning: number }[];
  inventoryHealth?: { name: string; stock: number; sold: number }[];
  salesSummary: {
    totalSales: number;
    manualSales: number;
    walletSales: number;
  };
}

interface TraderAnalyticsProps {
  data?: AnalyticsData;
  purchases?: any[];
  products?: any[];
  onGenerateIntelligence?: () => Promise<string>;
}

const COLORS = ['#F97316', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444', '#F43F5E'];

export default function TraderAnalytics({ data, onGenerateIntelligence }: TraderAnalyticsProps) {
  const { t } = useLanguage();
  const [intelligence, setIntelligence] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async () => {
    if (!onGenerateIntelligence) return;
    setLoading(true);
    try {
      const res = await onGenerateIntelligence();
      setIntelligence(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for missing fields if not provided
  const customerBehavior = data?.customerBehavior || [
    { date: 'Mon', new: 12, returning: 45 },
    { date: 'Tue', new: 18, returning: 38 },
    { date: 'Wed', new: 25, returning: 52 },
    { date: 'Thu', new: 14, returning: 48 },
    { date: 'Fri', new: 32, returning: 65 },
    { date: 'Sat', new: 45, returning: 78 },
    { date: 'Sun', new: 38, returning: 72 },
  ];

  const inventoryHealth = data?.inventoryHealth || [
    { name: 'Produce', stock: 450, sold: 1200 },
    { name: 'Grains', stock: 850, sold: 940 },
    { name: 'Meats', stock: 120, sold: 340 },
    { name: 'Dairy', stock: 240, sold: 560 },
    { name: 'Hardware', stock: 320, sold: 45 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
            Commerce Intelligence
          </h2>
          <p className="text-neutral-500 font-medium text-sm tracking-tight">
            Advanced performance modeling and fiscal projection dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center gap-2 border border-emerald-500/20">
            <TrendingUp size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Growth Phase: Scaling
            </span>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory py-2 -mx-4 px-4">
        {[
          {
            label: 'Avg order Value',
            value: 'RWF 14,200',
            trend: '+12.5%',
            icon: <DollarSign />,
            color: 'orange',
          },
          {
            label: 'Customer Retention',
            value: '68%',
            trend: '+5.2%',
            icon: <Users />,
            color: 'blue',
          },
          {
            label: 'Inventory Turnover',
            value: '4.2x',
            trend: '+0.8x',
            icon: <Package />,
            color: 'emerald',
          },
          {
            label: 'Acquisition cost',
            value: 'RWF 450',
            trend: '-14%',
            icon: <TrendingUp />,
            color: 'purple',
            inverse: true,
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm snap-start min-w-[200px] md:min-w-0"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`}
              >
                {stat.icon}
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg',
                  stat.trend.startsWith('+')
                    ? stat.inverse
                      ? 'bg-red-50 text-red-600'
                      : 'bg-green-50 text-green-600'
                    : stat.inverse
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-600'
                )}
              >
                {stat.trend.startsWith('+') ? (
                  <ArrowUpRight size={10} />
                ) : (
                  <ArrowDownRight size={10} />
                )}
                {stat.trend}
              </div>
            </div>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
              {stat.label}
            </p>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</h4>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-xl"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400 mb-1">
                Growth Matrix
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-neutral-100 uppercase tracking-tight">
                Revenue Dynamics
              </h3>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                  className="dark:stroke-neutral-800"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '24px',
                    border: 'none',
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                    color: '#fff',
                    padding: '16px',
                  }}
                  itemStyle={{ color: '#fb923c', fontWeight: 900, fontSize: '14px' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] shadow-xl border border-neutral-100 dark:border-neutral-800"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                <PieChartIcon size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-neutral-100 uppercase tracking-tight">
                Catalog Strength
              </h3>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.topProducts || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(data?.topProducts || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-800 text-white"
          >
            <div className="flex items-center gap-3 mb-4">
              <Users size={20} className="text-orange-500" />
              <h3 className="text-xs font-black uppercase tracking-widest">Growth Tip</h3>
            </div>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              Your <span className="text-white font-black">Returning Customer</span> rate is up by
              5% this month. Consider launching a{' '}
              <span className="text-orange-500 font-bold">Bulk Discount</span> program to maximize
              this segment.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Behavior Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] shadow-xl border border-neutral-100 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400 mb-1">
                Retention Analysis
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-neutral-100 uppercase tracking-tight">
                Customer Cohorts
              </h3>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[9px] font-black uppercase text-neutral-400">Returning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[9px] font-black uppercase text-neutral-400">New</span>
              </div>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerBehavior}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                  className="dark:stroke-neutral-800"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    border: 'none',
                    color: '#fff',
                  }}
                />
                <Bar
                  dataKey="returning"
                  stackId="a"
                  fill="#f97316"
                  radius={[0, 0, 0, 0]}
                  barSize={32}
                />
                <Bar dataKey="new" stackId="a" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Inventory Velocity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] shadow-xl border border-neutral-100 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400 mb-1">
                Throughput Modeling
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-neutral-100 uppercase tracking-tight">
                Inventory Velocity
              </h3>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryHealth} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                  className="dark:stroke-neutral-800"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    border: 'none',
                    color: '#fff',
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    paddingTop: '20px',
                  }}
                />
                <Bar
                  dataKey="sold"
                  fill="#10B981"
                  radius={[0, 8, 8, 0]}
                  barSize={12}
                  name="Units Sold"
                />
                <Bar
                  dataKey="stock"
                  fill="#f97316"
                  radius={[0, 8, 8, 0]}
                  barSize={12}
                  name="Units in Stock"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-orange-600 p-8 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(234,88,12,0.3)] text-white relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/20 group-hover:rotate-12 transition-transform">
                <DollarSign size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">
                Sales Settlement
              </h3>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <p className="text-orange-100 font-bold text-[11px] uppercase tracking-[0.2em]">
                  Total sales
                </p>
                <p className="text-2xl font-black tabular-nums">
                  RWF {formatCurrency(data?.salesSummary.totalSales || 0)}
                </p>
              </div>
              <div className="flex justify-between items-end">
                <p className="text-orange-100 font-bold text-[11px] uppercase tracking-[0.2em]">
                  Manual sales
                </p>
                <p className="text-2xl font-black tabular-nums">
                  RWF {formatCurrency(data?.salesSummary.manualSales || 0)}
                </p>
              </div>
              <div className="pt-8 border-t border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-orange-100 font-black text-[10px] uppercase tracking-[0.4em] mb-1">
                    Wallet sales
                  </p>
                  <p className="text-4xl font-black tabular-nums tracking-tighter">
                    RWF {formatCurrency(data?.salesSummary.walletSales || 0)}
                  </p>
                </div>
                <button className="px-8 py-4 bg-white text-orange-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-50 transition-all shadow-xl active:scale-95 group-hover:-translate-y-1 transition-transform">
                  Open Sales Log
                </button>
              </div>
            </div>
          </div>
          <div className="absolute -right-32 -bottom-32 w-80 h-80 bg-white/10 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000"></div>
        </motion.div>

        {/* AI Analytical Insights - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group border border-slate-800"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-600/30">
                <Sparkles size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight uppercase tracking-tighter">
                  Advanced Forecasting
                </h3>
                <p className="text-neutral-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                  Multi-variable projection model
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-orange-500">
                    Projected Revenue (Q3)
                  </span>
                  <span className="text-xs font-black text-green-400">+24.5%</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-[78%]" />
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-4 bg-white text-neutral-900 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-orange-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <TrendingUp size={16} />
                )}
                Generate Intelligence Script
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
