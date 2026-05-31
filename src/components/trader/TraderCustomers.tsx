import React, { useMemo } from 'react';
import { Users, Search, ShoppingBag, Calendar, ArrowUpRight, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, toDate } from '../../lib/utils';

interface Purchase {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  timestamp: any;
  productName?: string;
}

interface TraderCustomersProps {
  purchases: Purchase[];
}

interface CustomerStats {
  id: string;
  name: string;
  totalSpent: number;
  orderCount: number;
  lastPurchase: any;
  recentProducts: string[];
}

export default function TraderCustomers({ purchases }: TraderCustomersProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = React.useState('');

  const customerStats = useMemo(() => {
    const stats: Record<string, CustomerStats> = {};

    purchases.forEach((p) => {
      if (!p.customerId) return;

      if (!stats[p.customerId]) {
        stats[p.customerId] = {
          id: p.customerId,
          name: p.customerName || 'Unknown Customer',
          totalSpent: 0,
          orderCount: 0,
          lastPurchase: p.timestamp,
          recentProducts: [],
        };
      }

      const current = stats[p.customerId];
      current.totalSpent += p.amount;
      current.orderCount += 1;

      const pDate = toDate(p.timestamp);
      const lastDate = toDate(current.lastPurchase);
      if (pDate > lastDate) {
        current.lastPurchase = p.timestamp;
      }

      if (p.productName && !current.recentProducts.includes(p.productName)) {
        current.recentProducts = [p.productName, ...current.recentProducts].slice(0, 3);
      }
    });

    return Object.values(stats).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [purchases]);

  const filteredCustomers = customerStats.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-neutral-100 tracking-tight">
            Customer Management
          </h3>
          <p className="text-neutral-400 dark:text-neutral-500 font-medium text-sm">
            Analyze and manage your customer relationships
          </p>
        </div>
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-medium dark:text-neutral-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={<Users className="text-blue-600" />}
          label="Total Customers"
          value={customerStats.length}
          subValue="Active this month"
        />
        <StatCard
          icon={<ShoppingBag className="text-orange-600" />}
          label="Avg. Customer Value"
          value={`RWF ${formatCurrency(customerStats.length ? Math.round(customerStats.reduce((acc, c) => acc + c.totalSpent, 0) / customerStats.length) : 0)}`}
          subValue="Per customer"
        />
        <StatCard
          icon={<ArrowUpRight className="text-green-600" />}
          label="Top Spender"
          value={customerStats[0]?.name || 'N/A'}
          subValue={
            customerStats[0] ? `RWF ${formatCurrency(customerStats[0].totalSpent)}` : 'No data'
          }
        />
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  Customer
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  Orders
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  Total Spent
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  Last Purchase
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  Recent Items
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                        <UserCircle size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-neutral-100 text-sm">
                          {customer.name}
                        </p>
                        <p className="text-[10px] text-neutral-400 font-medium">
                          ID: {customer.id.slice(-6).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-black text-slate-900 dark:text-neutral-100">
                      {customer.orderCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900 dark:text-neutral-100 text-sm">
                      RWF {formatCurrency(customer.totalSpent)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <Calendar size={14} />
                      <span className="text-xs font-medium">
                        {toDate(customer.lastPurchase).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {customer.recentProducts.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-md text-[9px] font-bold"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div className="p-12 text-center">
              <Users className="mx-auto text-neutral-200 dark:text-neutral-800 mb-4" size={48} />
              <p className="text-neutral-400 dark:text-neutral-600 font-medium">
                No customers found
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue: string;
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
        {label}
      </p>
      <h4 className="text-xl font-black text-slate-900 dark:text-neutral-100 mb-1">{value}</h4>
      <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500">{subValue}</p>
    </div>
  );
}
