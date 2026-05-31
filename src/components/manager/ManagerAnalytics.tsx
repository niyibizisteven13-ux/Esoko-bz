import React from 'react';
import {
  TrendingUp,
  Users,
  ShoppingCart,
  Wallet,
  PieChart,
  BarChart,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  Globe,
} from 'lucide-react';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart as RePieChart,
  Pie,
} from 'recharts';
import { formatCurrency } from '../../lib/utils';

export default function ManagerAnalytics({
  transactions,
  users,
}: {
  transactions: any[];
  users: any[];
}) {
  const totalVolume = transactions.reduce((acc, t) => acc + t.amount, 0);
  const totalFees = transactions.reduce((acc, t) => acc + (t.fee || 0), 0);
  const traderCount = users.filter((u) => u.role === 'trader').length;
  const customerCount = users.filter((u) => u.role === 'customer').length;

  const data = [
    { name: 'Mon', volume: 4000, fees: 240 },
    { name: 'Tue', volume: 3000, fees: 139 },
    { name: 'Wed', volume: 2000, fees: 980 },
    { name: 'Thu', volume: 2780, fees: 390 },
    { name: 'Fri', volume: 1890, fees: 480 },
    { name: 'Sat', volume: 2390, fees: 380 },
    { name: 'Sun', volume: 3490, fees: 430 },
  ];

  const pieData = [
    { name: 'Traders', value: traderCount },
    { name: 'Customers', value: customerCount },
  ];

  const COLORS = ['#ea580c', '#10b981'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
              <Activity size={20} />
            </div>
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
              Total Volume
            </h4>
          </div>
          <p className="text-2xl font-black text-neutral-900">RWF {formatCurrency(totalVolume)}</p>
          <div className="flex items-center gap-1 mt-2 text-green-600 font-bold text-xs">
            <ArrowUpRight size={14} /> +12.5%
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
              Revenue (Fees)
            </h4>
          </div>
          <p className="text-2xl font-black text-neutral-900">RWF {formatCurrency(totalFees)}</p>
          <div className="flex items-center gap-1 mt-2 text-green-600 font-bold text-xs">
            <ArrowUpRight size={14} /> +8.2%
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
              Active Users
            </h4>
          </div>
          <p className="text-2xl font-black text-neutral-900">{users.length}</p>
          <div className="flex items-center gap-1 mt-2 text-neutral-400 font-bold text-xs">
            <Globe size={14} /> Across Rwanda
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
              Transactions
            </h4>
          </div>
          <p className="text-2xl font-black text-neutral-900">{transactions.length}</p>
          <div className="flex items-center gap-1 mt-2 text-orange-600 font-bold text-xs">
            <Activity size={14} /> Real-time
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <BarChart className="text-orange-600" size={20} /> Transaction Volume vs Fees
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 600 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="volume" fill="#ea580c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fees" fill="#10b981" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <PieChart className="text-blue-600" size={20} /> User Distribution
          </h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
            <div className="space-y-4 ml-8">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <div>
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                      {entry.name}
                    </p>
                    <p className="text-lg font-black text-neutral-900">{entry.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
