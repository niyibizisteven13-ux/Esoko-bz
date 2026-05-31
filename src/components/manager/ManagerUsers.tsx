import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Phone,
  CreditCard,
  Star,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { formatCurrency } from '../../lib/utils';

export default function ManagerUsers({ users }: { users: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'customer' | 'trader' | 'manager' | 'agent'>(
    'all'
  );

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);

    const matchesRole = filterRole === 'all' || user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: currentStatus === 'active' ? 'suspended' : 'active',
      });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const toggleTier = async (userId: string, currentTier: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        tier: currentTier === 'premium' ? 'free' : 'premium',
      });
    } catch (error) {
      console.error('Error updating user tier:', error);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      const updates: any = { role: newRole };
      if (newRole === 'manager' || newRole === 'agent') {
        updates.onboardingComplete = true;
      }
      await updateDoc(doc(db, 'users', userId), updates);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search users by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['all', 'customer', 'trader', 'agent', 'manager'].map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role as any)}
              className={`px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                filterRole === role
                  ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                  : 'bg-white text-neutral-400 border border-neutral-100 hover:border-neutral-200'
              }`}
            >
              {role}s
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
                  User
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  Role & Tier
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  Wallet
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest">
                  Status
                </th>
                <th className="p-6 text-xs font-black text-neutral-400 uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="group hover:bg-neutral-50/50 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-600 font-black text-xl">
                        {user.name?.[0]?.toUpperCase() || <Users size={24} />}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900">{user.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold">
                            <Mail size={12} /> {user.email}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold">
                            <Phone size={12} /> {user.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={user.role}
                          onChange={(e) => changeRole(user.uid, e.target.value)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit border-none outline-none cursor-pointer appearance-none ${
                            user.role === 'manager'
                              ? 'bg-purple-100 text-purple-600'
                              : user.role === 'trader'
                                ? 'bg-blue-100 text-blue-600'
                                : user.role === 'agent'
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          <option value="customer">Customer</option>
                          <option value="trader">Trader</option>
                          <option value="agent">Agent</option>
                          <option value="manager">Manager</option>
                        </select>
                        {user.role === 'customer' && user.category && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-neutral-100 text-neutral-400 border border-neutral-200">
                            {user.category}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleTier(user.uid, user.tier)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit transition-all ${
                          user.tier === 'premium'
                            ? 'bg-orange-100 text-orange-600 border border-orange-200'
                            : 'bg-neutral-50 text-neutral-400 border border-neutral-100 hover:border-neutral-200'
                        }`}
                      >
                        <Star size={10} fill={user.tier === 'premium' ? 'currentColor' : 'none'} />
                        {user.tier || 'free'}
                      </button>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-neutral-400" />
                      <p className="font-bold text-neutral-900">
                        RWF {formatCurrency(user.walletBalance || 0)}
                      </p>
                    </div>
                  </td>
                  <td className="p-6">
                    <span
                      className={`flex items-center gap-1.5 text-xs font-bold ${
                        user.status === 'active' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggleUserStatus(user.uid, user.status || 'active')}
                        title={user.status === 'active' ? 'Suspend User' : 'Activate User'}
                        className={`p-2 rounded-xl border transition-all ${
                          user.status === 'active'
                            ? 'border-red-100 text-red-600 hover:bg-red-50'
                            : 'border-green-100 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {user.status === 'active' ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
              <Users className="text-neutral-200" size={40} />
            </div>
            <p className="text-neutral-400 font-medium">No users found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
