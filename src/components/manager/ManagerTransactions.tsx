import React, { useState } from 'react';
import {
  ShoppingCart,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, toDate } from '../../lib/utils';

export default function ManagerTransactions({ transactions }: { transactions: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'payment'>('all');

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.recipientId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || tx.type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search by ID, User ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['all', 'deposit', 'withdrawal', 'payment'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={`px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                filterType === type
                  ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                  : 'bg-white text-neutral-400 border border-neutral-100 hover:border-neutral-200'
              }`}
            >
              {type}s
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-neutral-100 bg-neutral-50/50">
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  Transaction ID
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  User & Type
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  Amount & Fee
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  Status
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest text-right">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="group hover:bg-neutral-50/50 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.type === 'deposit'
                            ? 'bg-green-100 text-green-600'
                            : tx.type === 'payment'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {tx.type === 'deposit' ? (
                          <ArrowUpRight size={20} />
                        ) : (
                          <ArrowDownLeft size={20} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                          ID: {tx.id?.slice(0, 8)}...
                        </p>
                        <p className="text-[10px] font-bold text-neutral-400 mt-1 uppercase tracking-widest">
                          {tx.method?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div>
                      <p className="font-bold text-neutral-900 capitalize">{tx.type}</p>
                      <p className="text-[10px] text-neutral-400 font-bold mt-1">
                        User: {tx.userId?.slice(0, 12)}...
                      </p>
                    </div>
                  </td>
                  <td className="p-6">
                    <div>
                      <p
                        className={`font-bold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {tx.type === 'deposit' ? '+' : '-'} RWF {formatCurrency(tx.amount)}
                      </p>
                      {tx.fee > 0 && (
                        <p className="text-[10px] text-neutral-400 font-bold mt-1 uppercase tracking-widest">
                          Fee: RWF {formatCurrency(tx.fee)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-6">
                    <span
                      className={`flex items-center gap-1.5 text-xs font-bold ${
                        tx.status === 'completed'
                          ? 'text-green-600'
                          : tx.status === 'pending'
                            ? 'text-orange-600'
                            : 'text-red-600'
                      }`}
                    >
                      {tx.status === 'completed' ? (
                        <CheckCircle2 size={14} />
                      ) : tx.status === 'pending' ? (
                        <Clock size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {tx.status || 'completed'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-sm font-bold text-neutral-900">
                        {toDate(tx.timestamp).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                        {toDate(tx.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length === 0 && (
          <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="text-neutral-200" size={40} />
            </div>
            <p className="text-neutral-400 font-medium">
              No transactions found matching your search.
            </p>
          </div>
        )}
      </div>

      <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white text-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h4 className="font-bold text-neutral-900">Fraud Detection Active</h4>
            <p className="text-sm text-neutral-500">
              Real-time monitoring of all transactions for suspicious activity.
            </p>
          </div>
        </div>
        <button className="px-6 py-3 bg-white text-neutral-900 rounded-xl font-bold text-sm border border-neutral-200 hover:bg-neutral-50 transition-all">
          View Security Logs
        </button>
      </div>
    </div>
  );
}
