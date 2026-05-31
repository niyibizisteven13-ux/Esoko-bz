import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  MoreVertical,
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Activity,
  User,
  UserCheck,
  CreditCard,
  Target,
  BarChart4,
  Zap,
  HandHelping,
  BrainCircuit,
  ShieldAlert,
  Fingerprint,
  Store,
  Truck,
  Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { cn, formatCurrency } from '../lib/utils';
import Logo from '../components/Logo';
import { emailService } from '../services/emailService';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { getUser, getAllUsers, updateUser } from '../services/userService';
import { getTickets, updateTicket } from '../services/ticketService';
import { createNotification } from '../services/notificationService';
import { createTransaction } from '../services/transactionService';
import { getCurrentUser } from '../services/sessionService';

function AgentNavItem({
  active,
  onClick,
  icon,
  label,
  agentMode,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  agentMode: 'standard' | 'terminal';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl font-bold text-[13px] transition-all',
        active
          ? agentMode === 'terminal'
            ? 'bg-[#00ff00] text-black shadow-[0_0_15px_#00ff0033]'
            : 'bg-orange-600 text-white shadow-lg shadow-orange-900/10'
          : agentMode === 'terminal'
            ? 'text-[#00ff00]/40 hover:text-[#00ff00] hover:bg-[#00ff00]/5'
            : 'text-neutral-500 hover:text-white hover:bg-white/5'
      )}
    >
      <div
        className={
          active
            ? 'text-inherit'
            : agentMode === 'terminal'
              ? 'text-[#00ff00]/50'
              : 'text-neutral-600'
        }
      >
        {icon}
      </div>
      {label}
    </button>
  );
}

export default function AgentPortal() {
  const [activeTab, setActiveTab] = useState<
    'verifications' | 'tickets' | 'traders' | 'tasks' | 'performance' | 'banking'
  >('tasks');
  const [pendingTraders, setPendingTraders] = useState<any[]>([]);
  const [allTraders, setAllTraders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [assignedTickets, setAssignedTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [activeTaskFilter, setActiveTaskFilter] = useState<'all' | 'tickets' | 'verifications'>(
    'all'
  );
  const [userData, setUserData] = useState<any>(null);

  // Banking Terminal State
  const [terminalSearch, setTerminalSearch] = useState('');
  const [terminalUser, setTerminalUser] = useState<any | null>(null);
  const [terminalRecipient, setTerminalRecipient] = useState<any | null>(null);
  const [terminalAmount, setTerminalAmount] = useState('');
  const [terminalProcessing, setTerminalProcessing] = useState(false);
  const [terminalMode, setTerminalMode] = useState<'service' | 'transfer'>('service');
  const [searchTarget, setSearchTarget] = useState<'sender' | 'recipient'>('sender');
  const [terminalMessage, setTerminalMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Derive agent ID from current user
  const agentId = auth.currentUser?.uid || userData?.id;

  useEffect(() => {
    const fetchData = async () => {
      const current = auth.currentUser || (await getCurrentUser());
      if (!current) {
        setLoading(false);
        return;
      }

      const userId = current.uid || current.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch current user data
        const userResponse = await getUser(userId);
        setUserData(userResponse?.user);

        // Fetch pending traders
        const pendingResponse = await getAllUsers({ status: 'pending', role: 'trader' });
        setPendingTraders(pendingResponse?.users || []);

        // Fetch all traders
        const tradersResponse = await getAllUsers({ role: 'trader', limit: 100 });
        setAllTraders(tradersResponse?.users || []);

        // Fetch unassigned open tickets
        const ticketsResponse = await getTickets({ status: 'open', limit: 50 });
        setTickets(ticketsResponse?.tickets || []);

        // Fetch assigned tickets
        const assignedResponse = await getTickets({ assignedTo: userId });
        setAssignedTickets(assignedResponse?.tickets || []);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching agent data:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleVerify = async (userId: string, approve: boolean) => {
    setProcessingId(userId);
    try {
      await updateUser(userId, {
        verificationStatus: approve ? 'active' : 'rejected',
        verifiedAt: new Date().toISOString(),
        verifiedBy: auth.currentUser?.uid || userData?.id,
      });

      // Create notification
      await createNotification({
        userId,
        message: approve
          ? 'Congratulations! Your trader account has been verified.'
          : 'Your trader verification request was declined.',
        type: approve ? 'success' : 'error',
        subType: 'system',
        read: false,
      });
    } catch (err) {
      console.error('Error verifying user:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleClaimTicket = async (ticketId: string) => {
    const agentId = auth.currentUser?.uid || userData?.id;
    if (!agentId) return;
    setProcessingId(ticketId);
    try {
      await updateTicket(ticketId, {
        assignedTo: agentId,
        assignedAt: new Date().toISOString(),
        status: 'open',
      });
    } catch (err) {
      console.error('Error claiming ticket:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    setProcessingId(ticketId);
    try {
      await updateTicket(ticketId, {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: agentId,
      });
    } catch (err) {
      console.error('Error closing ticket:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const [selectedTrader, setSelectedTrader] = useState<any>(null);

  const stats = [
    {
      label: 'Terminal Float',
      value: `RWF ${formatCurrency(userData?.walletBalance || 0)}`,
      icon: Wallet,
      color: 'text-orange-500',
    },
    {
      label: 'Active Tasks',
      value: assignedTickets.filter((t) => t.status === 'open').length + pendingTraders.length,
      icon: Target,
      color: 'text-blue-500',
    },
    {
      label: 'Global Tickets',
      value: tickets.filter((t) => !t.assignedTo).length,
      icon: MessageSquare,
      color: 'text-green-500',
    },
  ];

  const handleTerminalSearch = async () => {
    if (!terminalSearch.trim()) return;
    setTerminalProcessing(true);
    setTerminalMessage(null);
    try {
      const response = await getAllUsers({ status: 'active', limit: 50 });
      const users: any[] = response?.users || [];
      const found = users.find(
        (u: any) =>
          u.email?.toLowerCase() === terminalSearch.toLowerCase() ||
          u.phone === terminalSearch ||
          u.appNumber === terminalSearch
      );

      if (found) {
        if (searchTarget === 'sender') {
          setTerminalUser(found);
          if (terminalMode === 'service') setTerminalRecipient(null);
        } else {
          setTerminalRecipient(found);
        }
      } else {
        setTerminalMessage({ type: 'error', text: 'User not found or inactive' });
        if (searchTarget === 'sender') setTerminalUser(null);
        else setTerminalRecipient(null);
      }
    } catch (err) {
      console.error('Terminal search failed:', err);
      setTerminalMessage({ type: 'error', text: 'Search failed' });
    } finally {
      setTerminalProcessing(false);
    }
  };

  const handleTerminalTransaction = async (type: 'deposit' | 'withdraw' | 'transfer') => {
    if (!terminalUser || !terminalAmount || !agentId) return;
    if (type === 'transfer' && !terminalRecipient) return;

    const amount = parseFloat(terminalAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (type === 'deposit' && (userData?.walletBalance || 0) < amount) {
      setTerminalMessage({ type: 'error', text: 'Insufficient float (Agent balance too low)' });
      return;
    }

    if (
      (type === 'withdraw' || type === 'transfer') &&
      (terminalUser.walletBalance || 0) < amount
    ) {
      setTerminalMessage({ type: 'error', text: 'Insufficient sender balance' });
      return;
    }

    setTerminalProcessing(true);
    try {
      if (type === 'transfer') {
        const senderNewBalance = (terminalUser.walletBalance || 0) - amount;
        const recipientNewBalance = (terminalRecipient?.walletBalance || 0) + amount;

        await updateUser(terminalUser.id, { walletBalance: senderNewBalance });
        await updateUser(terminalRecipient!.id, { walletBalance: recipientNewBalance });

        await createTransaction({
          userId: terminalUser.id,
          recipientId: terminalRecipient!.id,
          agentId: agentId,
          amount,
          type: 'transfer',
          status: 'completed',
          description: `Transfer to ${terminalRecipient?.name} via Agent`,
          reference: `XFR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        });

        await createNotification({
          userId: terminalRecipient!.id,
          message: `You received RWF ${formatCurrency(amount)} from ${terminalUser.name} via Agent.`,
          type: 'success',
          read: false,
        });
      } else {
        const userNewBalance =
          type === 'deposit'
            ? (terminalUser.walletBalance || 0) + amount
            : (terminalUser.walletBalance || 0) - amount;

        const agentNewBalance =
          type === 'deposit'
            ? (userData?.walletBalance || 0) - amount
            : (userData?.walletBalance || 0) + amount;

        await updateUser(terminalUser.id, { walletBalance: userNewBalance });
        await updateUser(agentId, { walletBalance: agentNewBalance });

        await createTransaction({
          userId: terminalUser.id,
          agentId: agentId,
          amount,
          type: type === 'deposit' ? 'deposit' : 'withdrawal',
          status: 'completed',
          description: `${type === 'deposit' ? 'Cash In' : 'Cash Out'} via Nexus Agent`,
          reference: `AGT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        });
      }

      await createNotification({
        userId: terminalUser.id,
        message: `Transaction successful: ${type} of RWF ${formatCurrency(amount)}.`,
        type: 'success',
        read: false,
      });

      // Send Transaction Emails
      if (terminalUser.email) {
        emailService.sendTransactionReceipt({
          email: terminalUser.email,
          name: terminalUser.name || 'User',
          type: type === 'transfer' ? 'transfer' : type === 'deposit' ? 'deposit' : 'withdrawal',
          amount: amount,
          fee: 0, // Agents currently have 0 fee for terminal cash-in/out
          status: 'success',
          reference:
            type === 'transfer'
              ? `XFR-${terminalUser.id.slice(0, 4)}`
              : `AGT-${terminalUser.id.slice(0, 4)}`,
          recipientName: type === 'transfer' ? terminalRecipient?.name : undefined,
        });
      }

      if (type === 'transfer' && terminalRecipient?.email) {
        emailService.sendTransactionReceipt({
          email: terminalRecipient.email,
          name: terminalRecipient.name || 'User',
          type: 'deposit', // Recipient sees it as a deposit/inbound
          amount: amount,
          fee: 0,
          status: 'success',
          reference: `XFR-${terminalUser.id.slice(0, 4)}`,
        });
      }

      setTerminalMessage({ type: 'success', text: `Successfully completed ${type}` });
      setTerminalAmount('');

      // Update local state
      if (type === 'transfer') {
        setTerminalUser({
          ...terminalUser,
          walletBalance: (terminalUser.walletBalance || 0) - amount,
        });
        setTerminalRecipient({
          ...terminalRecipient,
          walletBalance: (terminalRecipient.walletBalance || 0) + amount,
        });
      } else {
        setTerminalUser({
          ...terminalUser,
          walletBalance:
            type === 'deposit'
              ? (terminalUser.walletBalance || 0) + amount
              : (terminalUser.walletBalance || 0) - amount,
        });
      }
    } catch (err) {
      console.error('Transaction failed:', err);
      if (terminalUser?.email) {
        emailService.sendTransactionReceipt({
          email: terminalUser.email,
          name: terminalUser.name || 'User',
          type: type === 'transfer' ? 'transfer' : type === 'deposit' ? 'deposit' : 'withdrawal',
          amount,
          fee: 0,
          status: 'failed',
          reference: 'ERR-TXN',
        });
      }
      setTerminalMessage({ type: 'error', text: 'Transaction failed' });
    } finally {
      setTerminalProcessing(false);
    }
  };

  const performanceData = [
    { day: 'Mon', resolved: 12, verifications: 5, kpi: 85 },
    { day: 'Tue', resolved: 19, verifications: 8, kpi: 92 },
    { day: 'Wed', resolved: 15, verifications: 12, kpi: 88 },
    { day: 'Thu', resolved: 22, verifications: 7, kpi: 95 },
    { day: 'Fri', resolved: 30, verifications: 15, kpi: 98 },
    { day: 'Sat', resolved: 10, verifications: 4, kpi: 90 },
    { day: 'Sun', resolved: 5, verifications: 2, kpi: 82 },
  ];

  const [agentMode, setAgentMode] = useState<'standard' | 'terminal'>('standard');

  const navigate = useNavigate();

  if (userData?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 bg-blue-600/10 text-blue-500 rounded-[2.5rem] flex items-center justify-center mx-auto border border-blue-600/20 animate-pulse">
            <ShieldCheck size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              Terminal Offline
            </h1>
            <p className="text-neutral-400 text-sm font-medium leading-relaxed">
              Your agent account is under review by our trust team. We will notify you once terminal
              access is granted.
            </p>
            <div className="p-4 bg-blue-600/5 border border-blue-600/10 rounded-2xl">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                Application Status: Pending Review
              </p>
            </div>
          </div>
          <button
            onClick={() => auth.signOut().then(() => navigate('/login'))}
            className="w-full py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:text-white transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-500 flex flex-col md:flex-row font-sans',
        agentMode === 'terminal' ? 'bg-black text-[#00ff00] font-mono' : 'bg-[#050505] text-white'
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          'w-full md:w-64 border-r p-6 flex flex-col transition-all duration-300 shrink-0',
          agentMode === 'terminal' ? 'bg-black border-[#00ff00]/20' : 'bg-[#0a0a0a] border-white/5'
        )}
      >
        <div className="flex items-center gap-3 mb-10 shrink-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg',
              agentMode === 'terminal' ? 'bg-[#00ff00] text-black' : 'bg-orange-600 text-white'
            )}
          >
            A
          </div>
          <div>
            <h2 className="text-lg font-black leading-none">
              {agentMode === 'terminal' ? 'NEXUS_AGT' : 'AGENT CORE'}
            </h2>
            <p
              className={cn(
                'text-[8px] font-black uppercase tracking-widest mt-1',
                agentMode === 'terminal' ? 'text-[#00ff00]/50' : 'text-orange-500'
              )}
            >
              Security Terminal
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
          <AgentNavItem
            active={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            icon={<Target size={18} />}
            label="My Tasks"
            agentMode={agentMode}
          />
          <AgentNavItem
            active={activeTab === 'banking'}
            onClick={() => setActiveTab('banking')}
            icon={<Wallet size={18} />}
            label="Banking Terminal"
            agentMode={agentMode}
          />
          <AgentNavItem
            active={activeTab === 'verifications'}
            onClick={() => setActiveTab('verifications')}
            icon={<UserCheck size={18} />}
            label="Verifications"
            agentMode={agentMode}
          />
          <AgentNavItem
            active={activeTab === 'tickets'}
            onClick={() => setActiveTab('tickets')}
            icon={<MessageSquare size={18} />}
            label="Ticket Queue"
            agentMode={agentMode}
          />
          <AgentNavItem
            active={activeTab === 'traders'}
            onClick={() => setActiveTab('traders')}
            icon={<Store size={18} />}
            label="Traders Dir"
            agentMode={agentMode}
          />
          <AgentNavItem
            active={activeTab === 'performance'}
            onClick={() => setActiveTab('performance')}
            icon={<BarChart4 size={18} />}
            label="KPI Metrics"
            agentMode={agentMode}
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">
              Terminal Float
            </p>
            <p className="text-lg font-black">RWF {formatCurrency(userData?.walletBalance || 0)}</p>
          </div>

          <button
            onClick={() => setAgentMode((prev) => (prev === 'standard' ? 'terminal' : 'standard'))}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-xs border',
              agentMode === 'terminal'
                ? 'bg-[#00ff00]/10 border-[#00ff00]/30 text-[#00ff00]'
                : 'bg-white/5 border-white/10 text-neutral-500 hover:text-white'
            )}
          >
            <Zap size={16} /> {agentMode === 'terminal' ? 'Standard_Mode' : 'Nexus_Terminal'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto no-scrollbar relative p-6 md:p-10">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div>
              <h1 className="text-4xl font-black tracking-tight mb-2 uppercase">
                {activeTab === 'tasks' && 'Command Center'}
                {activeTab === 'banking' && 'Banking System'}
                {activeTab === 'verifications' && 'Asset Verification'}
                {activeTab === 'tickets' && 'Support Grid'}
                {activeTab === 'traders' && 'Trader Network'}
                {activeTab === 'performance' && 'Operational KPI'}
              </h1>
              <p
                className={cn(
                  'font-medium',
                  agentMode === 'terminal' ? 'text-[#00ff00]/60' : 'text-neutral-500'
                )}
              >
                {agentMode === 'terminal'
                  ? '[AUTH_SECURED]: Execution layer active'
                  : 'Strategic administrative interface'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {userData?.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/20 flex items-center gap-2"
                >
                  <ShieldCheck size={16} /> Admin Portal
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="p-3 bg-white/5 text-neutral-400 hover:text-white rounded-2xl border border-white/10 transition-all"
              >
                <XCircle size={20} />
              </button>
            </div>
          </header>

          {/* Body Content */}
          <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
            {activeTab !== 'performance' && activeTab !== 'banking' && (
              <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Activity className="text-orange-500" size={18} />
                  <h3 className="text-sm font-black uppercase tracking-widest">
                    {activeTab === 'tasks'
                      ? 'Assigned Field Operations'
                      : activeTab === 'verifications'
                        ? 'Identity Verification Queue'
                        : activeTab === 'tickets'
                          ? 'Nexus Incident Log'
                          : 'Registered Merchant Index'}
                  </h3>
                </div>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                    size={14}
                  />
                  <input
                    type="text"
                    placeholder="Filter records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all w-full md:w-64"
                  />
                </div>
              </div>
            )}

            <div className="overflow-x-auto min-h-[400px]">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-orange-500" size={48} />
                  <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">
                    Connecting to Nexus...
                  </p>
                </div>
              ) : (
                <>
                  {activeTab === 'banking' ? (
                    <div className="p-8 max-w-5xl mx-auto space-y-8">
                      <div className="flex justify-center mb-6">
                        <div className="bg-white/5 p-1 rounded-2xl border border-white/10 flex">
                          <button
                            onClick={() => setTerminalMode('service')}
                            className={cn(
                              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                              terminalMode === 'service'
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                                : 'text-neutral-500 hover:text-neutral-300'
                            )}
                          >
                            Cash Services
                          </button>
                          <button
                            onClick={() => setTerminalMode('transfer')}
                            className={cn(
                              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                              terminalMode === 'transfer'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-neutral-500 hover:text-neutral-300'
                            )}
                          >
                            P2P Transfer
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col lg:flex-row gap-8">
                        {/* Search & Identity */}
                        <div className="flex-1 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500">
                                {terminalMode === 'transfer'
                                  ? 'Sender Identity'
                                  : 'Customer Identity'}
                              </h4>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                                    size={16}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Sender Phone/ID"
                                    value={searchTarget === 'sender' ? terminalSearch : ''}
                                    onFocus={() => setSearchTarget('sender')}
                                    onChange={(e) => {
                                      setSearchTarget('sender');
                                      setTerminalSearch(e.target.value);
                                    }}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-orange-500 transition-all font-bold text-sm"
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    setSearchTarget('sender');
                                    handleTerminalSearch();
                                  }}
                                  className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
                                >
                                  <Search size={20} className="text-white" />
                                </button>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setTerminalUser(userData);
                                    setTerminalRecipient(null);
                                  }}
                                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
                                >
                                  Use My Own Wallet
                                </button>
                              </div>

                              {terminalUser && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-black">
                                    {terminalUser.name?.[0]}
                                  </div>
                                  <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-white text-sm truncate">
                                      {terminalUser.name}
                                    </p>
                                    <p className="text-[9px] text-neutral-500 font-bold uppercase truncate tracking-widest">
                                      Bal: RWF {formatCurrency(terminalUser.walletBalance || 0)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setTerminalUser(null)}
                                    className="text-neutral-500 hover:text-red-500 transition-colors"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </motion.div>
                              )}
                            </div>

                            {terminalMode === 'transfer' && (
                              <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500">
                                  Recipient Identity
                                </h4>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <Search
                                      className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"
                                      size={16}
                                    />
                                    <input
                                      type="text"
                                      placeholder="Recipient Phone/ID"
                                      value={searchTarget === 'recipient' ? terminalSearch : ''}
                                      onFocus={() => setSearchTarget('recipient')}
                                      onChange={(e) => {
                                        setSearchTarget('recipient');
                                        setTerminalSearch(e.target.value);
                                      }}
                                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 transition-all font-bold text-sm"
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSearchTarget('recipient');
                                      handleTerminalSearch();
                                    }}
                                    className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
                                  >
                                    <Search size={20} className="text-white" />
                                  </button>
                                </div>

                                {terminalRecipient && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-blue-600/5 border border-blue-600/10 p-4 rounded-2xl flex items-center gap-4"
                                  >
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black">
                                      {terminalRecipient.name?.[0]}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                      <p className="font-bold text-white text-sm truncate">
                                        {terminalRecipient.name}
                                      </p>
                                      <p className="text-[9px] text-neutral-500 font-bold uppercase truncate tracking-widest">
                                        ID: {terminalRecipient.appNumber || '---'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setTerminalRecipient(null)}
                                      className="text-neutral-500 hover:text-red-500 transition-colors"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </motion.div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="w-full lg:w-80 space-y-6">
                          <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500">
                              Transaction Panel
                            </h4>
                            <div className="space-y-4">
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 font-black text-sm">
                                  RWF
                                </span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={terminalAmount}
                                  onChange={(e) => setTerminalAmount(e.target.value)}
                                  className="w-full pl-14 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-orange-500 transition-all font-black text-xl"
                                />
                              </div>

                              {terminalMode === 'service' ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    onClick={() => handleTerminalTransaction('deposit')}
                                    disabled={
                                      !terminalUser || !terminalAmount || terminalProcessing
                                    }
                                    className="py-4 bg-green-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-green-700 transition-all disabled:opacity-20 shadow-lg shadow-green-900/20"
                                  >
                                    Deposit
                                  </button>
                                  <button
                                    onClick={() => handleTerminalTransaction('withdraw')}
                                    disabled={
                                      !terminalUser || !terminalAmount || terminalProcessing
                                    }
                                    className="py-4 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all disabled:opacity-20 shadow-lg shadow-red-900/20"
                                  >
                                    Withdraw
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleTerminalTransaction('transfer')}
                                  disabled={
                                    !terminalUser ||
                                    !terminalRecipient ||
                                    !terminalAmount ||
                                    terminalProcessing
                                  }
                                  className="w-full py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-20 shadow-lg shadow-blue-900/20"
                                >
                                  Execute P2P Transfer
                                </button>
                              )}
                            </div>
                          </div>

                          {terminalMessage && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={cn(
                                'p-4 rounded-2xl flex items-center justify-center text-center text-[10px] font-black uppercase tracking-widest',
                                terminalMessage.type === 'success'
                                  ? 'bg-green-600/10 text-green-500 border border-green-600/20'
                                  : 'bg-red-600/10 text-red-500 border border-red-600/20'
                              )}
                            >
                              {terminalMessage.type === 'error' && (
                                <ShieldAlert size={14} className="mr-2" />
                              )}
                              {terminalMessage.type === 'success' && (
                                <CheckCircle2 size={14} className="mr-2" />
                              )}
                              {terminalMessage.text}
                            </motion.div>
                          )}

                          <div className="p-4 bg-orange-600/5 border border-orange-600/10 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="text-orange-500 shrink-0" size={14} />
                            <p className="text-[8px] text-neutral-500 font-black leading-relaxed uppercase">
                              Verify client ID and physical cash before committing transaction. All
                              agent operations are logged and audited in real-time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : activeTab === 'performance' ? (
                    <div className="p-8 space-y-10">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-[#050505] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-widest text-white">
                                Resolution Efficiency
                              </h4>
                              <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1">
                                Weekly support ticket closure rate
                              </p>
                            </div>
                            <div className="bg-orange-600/10 text-orange-500 p-2 rounded-lg">
                              <TrendingUp size={16} />
                            </div>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={performanceData}>
                                <defs>
                                  <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#ffffff05"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="day"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }}
                                />
                                <YAxis
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#111',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    color: '#fff',
                                  }}
                                  cursor={{ stroke: '#f97316', strokeWidth: 2 }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="resolved"
                                  stroke="#f97316"
                                  fillOpacity={1}
                                  fill="url(#colorRes)"
                                  strokeWidth={3}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="bg-[#050505] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-widest text-white">
                                Verification Volume
                              </h4>
                              <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1">
                                Trader business onboarding throughput
                              </p>
                            </div>
                            <div className="bg-purple-600/10 text-purple-500 p-2 rounded-lg">
                              <Zap size={16} />
                            </div>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={performanceData}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#ffffff05"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="day"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }}
                                />
                                <YAxis
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }}
                                />
                                <Tooltip
                                  cursor={{ fill: '#ffffff05' }}
                                  contentStyle={{
                                    backgroundColor: '#111',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    color: '#fff',
                                  }}
                                />
                                <Bar
                                  dataKey="verifications"
                                  fill="#a855f7"
                                  radius={[4, 4, 0, 0]}
                                  barSize={20}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Avg Feedback', value: '4.9/5.0', icon: TrendingUp },
                          { label: 'Resolution Time', value: '14m', icon: Clock },
                          { label: 'Uptime', value: '99.9%', icon: Activity },
                          { label: 'Bonuses Earned', value: 'RWF 45.3K', icon: CreditCard },
                        ].map((kpi, idx) => (
                          <div
                            key={idx}
                            className="bg-[#050505] p-6 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center gap-2"
                          >
                            <kpi.icon size={18} className="text-neutral-500" />
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                              {kpi.label}
                            </p>
                            <p className="text-xl font-black text-white">{kpi.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-[#050505] border-b border-white/5">
                        <tr>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Subject / Business
                          </th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Contact
                          </th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Status
                          </th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {activeTab === 'tasks' && (
                          <>
                            {(activeTaskFilter === 'all' || activeTaskFilter === 'verifications') &&
                              pendingTraders.map((trader) => (
                                <motion.tr
                                  key={trader.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  onClick={() => setSelectedTrader(trader)}
                                  className="hover:bg-white/5 transition-colors group cursor-pointer"
                                >
                                  <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 bg-orange-600/10 text-orange-500 rounded-xl flex items-center justify-center font-black">
                                        <Fingerprint size={18} />
                                      </div>
                                      <div>
                                        <p className="font-bold text-white text-sm">
                                          Verification: {trader.businessName || trader.name}
                                        </p>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                          Business Type: {trader.businessType || 'Merchant'}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-6">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">
                                      Manual Review Required
                                    </span>
                                  </td>
                                  <td className="px-8 py-6">
                                    <span
                                      className={cn(
                                        'px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border bg-orange-600/10 text-orange-500 border-orange-600/20'
                                      )}
                                    >
                                      Pending Review
                                    </span>
                                  </td>
                                  <td className="px-8 py-6">
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleVerify(trader.id, true)}
                                        className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                      <button
                                        onClick={() => handleVerify(trader.id, false)}
                                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}

                            {(activeTaskFilter === 'all' || activeTaskFilter === 'tickets') &&
                              assignedTickets.map((ticket) => (
                                <motion.tr
                                  key={ticket.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="hover:bg-white/5 transition-colors group"
                                >
                                  <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                      <div
                                        className={cn(
                                          'w-10 h-10 rounded-xl flex items-center justify-center font-black',
                                          ticket.priority === 'high'
                                            ? 'bg-red-600/10 text-red-500'
                                            : 'bg-blue-600/10 text-blue-500'
                                        )}
                                      >
                                        <MessageSquare size={18} />
                                      </div>
                                      <div>
                                        <p className="font-bold text-white text-sm">
                                          Ticket: {ticket.subject || 'Support Request'}
                                        </p>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                          Priority: {ticket.priority}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-6">
                                    <p className="text-xs font-bold text-neutral-300">
                                      {ticket.userEmail ||
                                        'Client ID: ' + ticket.userId.substring(0, 6)}
                                    </p>
                                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                                      Open Since:{' '}
                                      {new Date(
                                        ticket.createdAt?.toDate?.() || ticket.createdAt
                                      ).toLocaleDateString()}
                                    </p>
                                  </td>
                                  <td className="px-8 py-6">
                                    <span
                                      className={cn(
                                        'px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border',
                                        ticket.status === 'open'
                                          ? 'bg-blue-600/10 text-blue-500 border-blue-600/20'
                                          : 'bg-green-600/10 text-green-500 border-green-600/20'
                                      )}
                                    >
                                      {ticket.status}
                                    </span>
                                  </td>
                                  <td className="px-8 py-6">
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleCloseTicket(ticket.id)}
                                        className="px-3 py-1.5 bg-white/5 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-white hover:text-black transition-all"
                                      >
                                        Resolve
                                      </button>
                                      <button
                                        onClick={() => {
                                          /* handle transfer */
                                        }}
                                        className="p-1.5 text-neutral-500 hover:text-white border border-white/5 rounded-lg"
                                      >
                                        <ExternalLink size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}
                          </>
                        )}

                        {activeTab === 'verifications' &&
                          pendingTraders.map((trader) => (
                            <motion.tr
                              key={trader.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="hover:bg-white/5 transition-colors"
                            >
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center',
                                      trader.photoURL ? 'bg-transparent' : 'bg-orange-600/10'
                                    )}
                                  >
                                    {trader.photoURL ? (
                                      <img
                                        src={trader.photoURL}
                                        alt="avatar"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <User size={18} className="text-orange-500" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-white text-sm">
                                      {trader.businessName || trader.name}
                                    </p>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                      TIN: {trader.tin || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <p className="text-xs font-bold text-neutral-300">
                                  {trader.phone || trader.email}
                                </p>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                                  {trader.businessType || 'General Trade'}
                                </p>
                              </td>
                              <td className="px-8 py-6">
                                <span className="px-3 py-1 bg-orange-600/10 text-orange-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-orange-600/20">
                                  Pending
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleVerify(trader.id, true)}
                                    disabled={processingId === trader.id}
                                    className="p-2 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                                  >
                                    <CheckCircle2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleVerify(trader.id, false)}
                                    disabled={processingId === trader.id}
                                    className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          ))}

                        {activeTab === 'tickets' &&
                          tickets.map((ticket) => (
                            <motion.tr
                              key={ticket.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="hover:bg-white/5 transition-colors"
                            >
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-xl flex items-center justify-center font-black',
                                      ticket.priority === 'high'
                                        ? 'bg-red-600/10 text-red-500'
                                        : 'bg-blue-600/10 text-blue-500'
                                    )}
                                  >
                                    <FileText size={18} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-white text-sm">
                                      {ticket.subject || 'Support Request'}
                                    </p>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                      ID: {ticket.id.substring(0, 8)}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <p className="text-xs font-bold text-neutral-300">
                                  {ticket.userEmail || 'Anonymous'}
                                </p>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                                  {new Date(
                                    ticket.createdAt?.toDate?.() || ticket.createdAt
                                  ).toLocaleDateString()}
                                </p>
                              </td>
                              <td className="px-8 py-6">
                                <span
                                  className={cn(
                                    'px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border',
                                    ticket.status === 'open'
                                      ? 'bg-blue-600/10 text-blue-500 border-blue-600/20'
                                      : 'bg-green-600/10 text-green-500 border-green-600/20'
                                  )}
                                >
                                  {ticket.status || 'open'}
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                {ticket.assignedTo ? (
                                  <span className="text-[10px] font-black text-neutral-600 uppercase">
                                    Assigned
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleClaimTicket(ticket.id)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-orange-700 transition-all shadow-lg"
                                  >
                                    <HandHelping size={12} /> Claim Task
                                  </button>
                                )}
                              </td>
                            </motion.tr>
                          ))}

                        {activeTab === 'traders' &&
                          allTraders.map((trader) => (
                            <motion.tr
                              key={trader.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="hover:bg-white/5 transition-colors"
                            >
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center',
                                      trader.photoURL ? 'bg-transparent' : 'bg-white/5'
                                    )}
                                  >
                                    {trader.photoURL ? (
                                      <img
                                        src={trader.photoURL}
                                        alt="avatar"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <User size={18} className="text-neutral-400" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-white text-sm">
                                      {trader.businessName || trader.name}
                                    </p>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                      TIN: {trader.tin || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <p className="text-xs font-bold text-neutral-300">
                                  {trader.phone || trader.email}
                                </p>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                                  {trader.tier || 'Free'} Tier
                                </p>
                              </td>
                              <td className="px-8 py-6">
                                <span
                                  className={cn(
                                    'px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border',
                                    trader.status === 'active'
                                      ? 'bg-green-600/10 text-green-500 border-green-600/20'
                                      : 'bg-red-600/10 text-red-500 border-red-600/20'
                                  )}
                                >
                                  {trader.status}
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <button
                                  onClick={() => setSelectedTrader(trader)}
                                  className="text-orange-500 hover:underline text-[10px] font-black uppercase tracking-widest"
                                >
                                  Manage
                                </button>
                              </td>
                            </motion.tr>
                          ))}

                        {(activeTab === 'tasks' && assignedTickets.length === 0) ||
                        (activeTab === 'verifications' && pendingTraders.length === 0) ? (
                          <tr>
                            <td colSpan={4} className="px-8 py-20 text-center">
                              <div className="max-w-xs mx-auto space-y-4">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                                  <CheckCircle2 className="text-green-500" size={32} />
                                </div>
                                <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">
                                  {activeTab === 'tasks'
                                    ? 'All clear! No active tasks assigned.'
                                    : 'No pending verification requests.'}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Merchant Detail Modal */}
      <AnimatePresence>
        {selectedTrader && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrader(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-600/10 text-orange-500 rounded-2xl flex items-center justify-center border border-orange-600/20">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {selectedTrader.businessName || selectedTrader.name}
                    </h3>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                      Verification Dossier
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTrader(null)}
                  className="p-2 text-neutral-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] no-scrollbar">
                {/* AI Risk Summary */}

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                      Business Information
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-orange-500" />
                        <span className="text-sm font-bold text-white">
                          TIN: {selectedTrader.tin || 'Unidentified'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Truck size={16} className="text-orange-500" />
                        <span className="text-sm font-bold text-white">
                          {selectedTrader.businessType || 'General Merchant'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Activity size={16} className="text-orange-500" />
                        <span className="text-sm font-bold text-white">
                          Created:{' '}
                          {new Date(
                            selectedTrader.createdAt?.toDate?.() || selectedTrader.createdAt
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                      Contact Details
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-blue-500" />
                        <span className="text-sm font-bold text-white">{selectedTrader.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MessageSquare size={16} className="text-blue-500" />
                        <span className="text-sm font-bold text-white">{selectedTrader.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CreditCard size={16} className="text-blue-500" />
                        <span className="text-sm font-bold text-white">
                          {selectedTrader.phone || 'No phone'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Info / Documents Mock */}
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                      KYC Review Checks
                    </p>
                    <ShieldCheck size={16} className="text-neutral-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Identity Verified
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> TIN Database Match
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Address
                      Geoconfirmed
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" /> AML Check Pending
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-[#050505] border-t border-white/5 flex gap-4">
                <button
                  onClick={() => {
                    handleVerify(selectedTrader.id, false);
                    setSelectedTrader(null);
                  }}
                  disabled={processingId === selectedTrader.id}
                  className="flex-1 py-4 border border-red-600/30 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                >
                  Decline Access
                </button>
                <button
                  onClick={() => {
                    handleVerify(selectedTrader.id, true);
                    setSelectedTrader(null);
                  }}
                  disabled={processingId === selectedTrader.id}
                  className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-900/40 disabled:opacity-50"
                >
                  Approve Merchant
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
