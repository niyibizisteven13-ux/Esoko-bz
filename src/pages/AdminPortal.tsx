import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Users,
  Store,
  Activity,
  Settings,
  Database,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  XCircle,
  BarChart3,
  ArrowDownLeft,
  ChevronDown,
  Globe,
  Zap,
  Layers,
  LifeBuoy,
  Send,
  Trash2,
  Loader2,
  Edit2,
  Bell,
  MessageSquare,
  Wallet,
  Award,
  Fingerprint,
  RefreshCw,
  Terminal,
  TrendingUp,
  TrendingDown,
  Clock,
  Server,
  Mail,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  MemoryStick,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  AlertOctagon,
  CheckSquare,
  XSquare,
  DollarSign,
  ShoppingCart,
  Package,
  UserCheck,
  UserX,
  Calendar,
  Timer,
  Zap as Lightning,
  Key,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '../lib/utils';
import ThemeToggle from '../components/ThemeToggle';
import { subscribeToLiveUpdates } from '../services/liveSyncService';
import {
  fetchSubscriptionPlans as fetchSubscriptionPlansService,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
  fetchBusinessModel as fetchBusinessModelService,
  fetchPlatformWallet,
  sendPlatformWalletMoney,
  fetchLoanPolicy,
  updateLoanPolicy,
  fetchLoyaltyPolicy,
  updateLoyaltyPolicy,
  addDynamicFeeRule,
  updateSubscriptionPricing,
  fetchTradersList as fetchTradersListService,
  fetchTraderAnalytics,
  fetchBusinessAnalysts,
  createBusinessAnalyst,
  assignAnalystToTrader,
  fetchAnalystAssignments,
  fetchTraderSubscription,
  updateTraderSubscription,
  generateTraderActivationKey,
} from '../services/adminService';

interface SystemHealth {
  status: 'operational' | 'maintenance' | 'degraded';
  timestamp: string;
  uptime: number;
  database: {
    status: 'healthy' | 'unhealthy';
    responseTime: 'fast' | 'slow';
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  transactions: {
    lastHourCount: number;
    lastHourVolume: number;
  };
  users: {
    recentActive: number;
  };
  email: {
    totalSent: number;
    totalFailed: number;
    successRate: number;
  };
}

interface QuickStats {
  todayTransactions: number;
  todayRevenue: number;
  pendingLoginAlerts: number;
  openTickets: number;
  newUsersToday: number;
  failedTransactions: number;
}

interface TransactionFeed {
  id: string;
  userId: string;
  senderId?: string;
  recipientId?: string;
  customerId?: string;
  traderId?: string;
  type: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  grossAmount?: number;
  status: string;
  description: string;
  transactionCode?: string;
  reference?: string;
  createdAt: string;
  name: string;
  email: string;
  role: string;
  senderName?: string;
  senderEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  traderName?: string;
  traderEmail?: string;
  feeStatus?: string;
  feeEntries?: number;
  feeTotal?: number;
}

interface LoginAlert {
  id: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'denied' | 'expired';
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  role: string;
  createdAt: string;
  email: string;
  name: string;
  phone: string;
  walletBalance: number;
}

interface ControlCenterData {
  generatedAt: string;
  totals: {
    users: number;
    traders: number;
    customers: number;
    products: number;
    transactions: number;
    completedVolume: number;
    feeRevenue30d: number;
    projectedMonthlyRevenue: number;
    activeSubscriptionMrr: number;
    walletBalance: number;
    suspendedUsers: number;
  };
  today: {
    transactions: number;
    volume: number;
    revenue: number;
    newUsers: number;
  };
  queues: {
    pendingAlerts: number;
    openTickets: number;
    pendingPurchases: number;
    pendingDeliveries: number;
    pendingVerifications: number;
  };
  verification?: {
    pending: number;
    autoVerified: number;
    approved: number;
    rejected: number;
    openRiskFlags: number;
    missingLicenses: number;
  };
  research?: {
    businessCategories: Array<{ label: string; count: number }>;
    districts: Array<{ label: string; count: number }>;
    identityTypes: Array<{ label: string; count: number }>;
    riskPatterns: Array<{ code: string; severity: string; count: number }>;
  };
  dailyActivity: Array<{
    day: string;
    transactions: number;
    volume: number;
    revenue: number;
    newUsers: number;
  }>;
  revenue: {
    streams: Array<{
      id: string;
      label: string;
      amount: number;
      count: number;
      collectionMethod: string;
    }>;
    feeRevenueByType: Array<{ feeType: string; amount: number; count: number }>;
    subscriptions: {
      active: number;
      mrr: number;
      averagePlanPrice: number;
    };
    paymentPipeline: Array<{ status: string; count: number; amount: number }>;
    agentCommissions: {
      payable: number;
      paid: number;
      platformNet: number;
      count: number;
    };
    ledgerTotals: Array<{ accountType: string; balance: number; entries: number }>;
    revenueAccounts: Array<{
      code: string;
      name: string;
      accountType: string;
      balance: number;
      description?: string;
    }>;
  };
  roleDistribution: Array<{ role: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  riskItems: Array<{
    id: string;
    label: string;
    severity: 'low' | 'medium' | 'high';
    count: number;
    action: string;
  }>;
  recentLogs: SystemLog[];
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  verificationStatus: string;
  tier: string;
  walletBalance: number;
  createdAt: string;
  updatedAt: string;
}

interface SystemLog {
  id: string;
  message: string;
  level: string;
  source: string;
  userId: string;
  metadata?: string;
  createdAt: string;
  adminName?: string;
}

type DatabaseStats = Record<string, number>;

export default function AdminPortal() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'health'
    | 'users'
    | 'traders'
    | 'analysts'
    | 'subscriptions'
    | 'fees'
    | 'transactions'
    | 'screening'
    | 'security'
    | 'verification'
    | 'support'
    | 'email'
    | 'database'
    | 'logs'
    | 'surveys'
  >('dashboard');

  // Real-time data states
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [controlCenter, setControlCenter] = useState<ControlCenterData | null>(null);
  const [transactionFeed, setTransactionFeed] = useState<TransactionFeed[]>([]);
  const [loginAlerts, setLoginAlerts] = useState<LoginAlert[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [transactionsList, setTransactionsList] = useState<TransactionFeed[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats>({});
  const [selectedDbTable, setSelectedDbTable] = useState('users');
  const [dbDocuments, setDbDocuments] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilterLevel, setLogFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [logFilterSource, setLogFilterSource] = useState('all');
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [systemConfigLoading, setSystemConfigLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState({ to: '', subject: '', body: '' });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketReplySending, setTicketReplySending] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [adminEmail, setAdminEmail] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState<
    'all' | 'customer' | 'trader' | 'agent' | 'manager' | 'admin'
  >('all');
  const [usersStatusFilter, setUsersStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [usersFromDate, setUsersFromDate] = useState('');
  const [usersToDate, setUsersToDate] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [transactionsSearch, setTransactionsSearch] = useState('');
  const [transactionsStatusFilter, setTransactionsStatusFilter] = useState<
    'all' | 'completed' | 'pending' | 'failed' | 'refunded'
  >('all');
  const [transactionsFromDate, setTransactionsFromDate] = useState('');
  const [transactionsToDate, setTransactionsToDate] = useState('');
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [traders, setTraders] = useState<any[]>([]);
  const [tradersLoading, setTradersLoading] = useState(false);
  const [tradersPage, setTradersPage] = useState(1);
  const [tradersTotal, setTradersTotal] = useState(0);
  const [tradersStatusFilter, setTradersStatusFilter] = useState<'all' | 'active' | 'suspended'>(
    'all'
  );
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [businessModel, setBusinessModel] = useState<any | null>(null);
  const [businessModelLoading, setBusinessModelLoading] = useState(false);
  const [loanPolicy, setLoanPolicy] = useState<any | null>(null);
  const [loyaltyPolicy, setLoyaltyPolicy] = useState<any | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [platformWallet, setPlatformWallet] = useState<any | null>(null);
  const [platformWalletHistory, setPlatformWalletHistory] = useState<any[]>([]);
  const [platformSendForm, setPlatformSendForm] = useState({
    recipientId: '',
    amount: '',
    description: 'Platform wallet payout',
  });
  const [platformSendLoading, setPlatformSendLoading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalMode, setSubscriptionModalMode] = useState<'create' | 'edit'>('create');
  const [subscriptionModalLoading, setSubscriptionModalLoading] = useState(false);
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyResponsesLoading, setSurveyResponsesLoading] = useState(false);
  const [surveyPage, setSurveyPage] = useState(1);
  const [surveyTotal, setSurveyTotal] = useState(0);
  const [showSurveyQuestionModal, setShowSurveyQuestionModal] = useState(false);
  const [surveyQuestionModalMode, setSurveyQuestionModalMode] = useState<'create' | 'edit'>(
    'create'
  );
  const [surveyQuestionForm, setSurveyQuestionForm] = useState({
    question: '',
    questionType: 'text',
    options: [] as string[],
    required: false,
    orderIndex: 0,
  });
  const [editingSurveyQuestion, setEditingSurveyQuestion] = useState<any | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<any>(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    name: '',
    description: '',
    price: '',
    features: '',
    limits: '{}',
    is_active: true,
  });
  const [showFeeRuleModal, setShowFeeRuleModal] = useState(false);
  const [feeRuleModalLoading, setFeeRuleModalLoading] = useState(false);
  const [feeRuleForm, setFeeRuleForm] = useState({
    feeType: 'transaction',
    percentage: '',
    fixedAmount: '',
    conditions: '{"minAmount":1000}',
  });
  const [showTraderDetailModal, setShowTraderDetailModal] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);
  const [traderAnalytics, setTraderAnalytics] = useState<any>(null);
  const [traderSubscription, setTraderSubscription] = useState<any>(null);
  const [traderAssignments, setTraderAssignments] = useState<any[]>([]);
  const [analystList, setAnalystList] = useState<any[]>([]);
  const [traderDetailLoading, setTraderDetailLoading] = useState(false);
  const [traderSubscriptionForm, setTraderSubscriptionForm] = useState({
    subscriptionId: '',
    autoRenew: false,
  });
  const [showAssignAnalystModal, setShowAssignAnalystModal] = useState(false);
  const [assignAnalystForm, setAssignAnalystForm] = useState({
    analystId: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    requirements: '',
  });
  const [showActivationKeyModal, setShowActivationKeyModal] = useState(false);
  const [activationKeyForm, setActivationKeyForm] = useState({
    feature: '',
    expiresInDays: 30,
  });
  const [analysts, setAnalysts] = useState<any[]>([]);
  const [analystsLoading, setAnalystsLoading] = useState(false);
  const [showCreateAnalystModal, setShowCreateAnalystModal] = useState(false);
  const [createAnalystForm, setCreateAnalystForm] = useState({
    userId: '',
    specialization: '',
    experienceYears: 0,
    certifications: '',
  });
  const usersPageSize = 50;
  const transactionsPageSize = 50;
  const tradersPageSize = 50;

  const apiBaseUrl = import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')
    : '';
  const roleChartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

  const formatShortDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const memoryLabel = (value?: number) => {
    return typeof value === 'number' ? `${value} MB` : 'N/A';
  };

  const transactionTone = (type?: string) => {
    if (['deposit', 'payment_in', 'sale', 'refund', 'transfer_in'].includes(String(type))) {
      return 'text-green-400 bg-green-500/10';
    }
    if (['withdrawal', 'payment_out', 'purchase', 'transfer_out'].includes(String(type))) {
      return 'text-orange-400 bg-orange-500/10';
    }
    if (String(type).includes('fee')) return 'text-blue-400 bg-blue-500/10';
    return 'text-neutral-300 bg-white/5';
  };

  const statusTone = (status?: string) => {
    if (status === 'completed') return 'text-green-400 bg-green-500/10';
    if (status === 'failed') return 'text-red-400 bg-red-500/10';
    if (status === 'refunded') return 'text-blue-400 bg-blue-500/10';
    return 'text-yellow-400 bg-yellow-500/10';
  };

  const severityClass = (severity?: string) => {
    if (severity === 'high') return 'bg-red-500/10 text-red-300 border-red-500/20';
    if (severity === 'medium') return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
    return 'bg-green-500/10 text-green-300 border-green-500/20';
  };

  const screeningChecks = [
    { label: 'TypeScript check', result: 'Pass', note: 'tsc --noEmit completed successfully.' },
    { label: 'Production build', result: 'Pass', note: 'Vite build completed successfully.' },
    { label: 'API smoke test', result: 'Pass', note: '7 passed, 0 failed.' },
    { label: 'Secrets template', result: 'Caution', note: 'Placeholders are used, production values still need review.' },
  ];

  const screeningFindings = [
    {
      title: 'Persist admin OTP requests',
      severity: 'high',
      detail: 'Move OTP state from process memory into SQLite with expiry and consumed-at fields.',
    },
    {
      title: 'Harden demo credentials',
      severity: 'high',
      detail: 'Prevent production startup with seeded demo passwords and force rotation.',
    },
    {
      title: 'Validate financial/admin payloads',
      severity: 'medium',
      detail: 'Add Zod schemas around wallet, purchase, role, OTP, and subscription flows.',
    },
    {
      title: 'Inspect uploaded content',
      severity: 'medium',
      detail: 'Add magic-byte checks and safer upload serving headers before public launch.',
    },
    {
      title: 'Adopt formal migrations',
      severity: 'medium',
      detail: 'Replace ad hoc schema evolution with numbered migrations and applied-state tracking.',
    },
  ];

  const screeningReadiness = [
    'Good for controlled demo or internal pilot.',
    'Not ready for public production handling real funds.',
    'Critical security fixes for collection ownership, transaction email auth, system logs, JWT secrets, and origin checks are already implemented.',
  ];

  const buildQueryParams = (
    params: Record<string, string | number | boolean | null | undefined>
  ) => {
    return Object.entries(params)
      .filter(([_key, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
  };

  const safeJsonParse = (value: any, fallback: any = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const normalizeOptions = (value: any): string[] => {
    const parsed = safeJsonParse(value, value);
    if (Array.isArray(parsed)) return parsed.map((option) => String(option));
    if (typeof parsed === 'string') {
      return parsed
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean);
    }
    return [];
  };

  const normalizeSurveyQuestion = (question: any) => ({
    ...question,
    options: normalizeOptions(question.options),
    required: Boolean(Number(question.required ?? question.isRequired ?? 0)),
    orderIndex: Number(question.orderIndex ?? 0),
  });

  const normalizeSurveyResponse = (response: any) => {
    const parsed = safeJsonParse(response.response, response.response);
    return {
      ...response,
      response: parsed,
      responseLabel: Array.isArray(parsed)
        ? parsed.join(', ')
        : typeof parsed === 'object' && parsed
          ? JSON.stringify(parsed)
          : String(parsed ?? ''),
      question: response.question || 'Unknown question',
      userName: response.userName || 'Unknown',
      userEmail: response.userEmail || '',
    };
  };

  const normalizeTicket = (ticket: any) => {
    const subject = String(ticket?.subject || ticket?.title || 'Untitled ticket').trim();
    const message = String(ticket?.message || ticket?.description || '').trim();
    return {
      ...ticket,
      subject,
      title: subject,
      message,
      description: message,
      status: ticket?.status || 'open',
    };
  };

  const makeIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const requireAdminOtpConfirmation = async (message: string) => {
    if (!confirm(message)) {
      return false;
    }

    if (!adminEmail) {
      return true;
    }

    const otpCode = prompt('Enter the admin verification code to confirm this action:');
    if (!otpCode) {
      alert('OTP verification is required for this high-risk action.');
      return false;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: adminEmail, otp: otpCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`OTP verification failed: ${data.error || 'Invalid code'}`);
        return false;
      }
      setIsAuthorized(true);
      setIsAdmin(true);
      return true;
    } catch (err) {
      console.error('OTP confirmation failed:', err);
      alert('OTP confirmation failed. Please try again.');
      return false;
    }
  };

  const downloadCsv = (filename: string, rows: Record<string, any>[]) => {
    if (!rows.length) {
      alert('No data is available for export.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportUsersCsv = () => {
    downloadCsv(
      'admin-users.csv',
      users.map((user) => ({
        Name: user.name,
        Email: user.email,
        Role: user.role,
        Status: user.status || 'active',
        Wallet: formatCurrency(user.walletBalance || 0),
        Joined: new Date(user.createdAt).toLocaleString(),
      }))
    );
  };

  const exportTransactionsCsv = () => {
    downloadCsv(
      'admin-transactions.csv',
      transactionsList.map((tx) => ({
        User: tx.name || tx.email || tx.userId,
        Type: tx.type,
        Amount: formatCurrency(tx.amount),
        Status: tx.status,
        Description: tx.description,
        CreatedAt: new Date(tx.createdAt).toLocaleString(),
      }))
    );
  };

  const changeSelectedUsers = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, userId]));
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const handleBulkUserStatus = async (status: 'active' | 'suspended') => {
    if (!selectedUserIds.length) {
      alert('Select at least one user before performing a bulk action.');
      return;
    }

    if (
      !(await requireAdminOtpConfirmation(
        `Confirm bulk status change to ${status.toUpperCase()} for ${selectedUserIds.length} users?`
      ))
    ) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users/batch-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: selectedUserIds, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Bulk action failed: ${data.error || 'Unknown error'}`);
        return;
      }
      setSelectedUserIds([]);
      await fetchUsers();
      refreshData();
    } catch (err) {
      console.error('Bulk user status update failed:', err);
      alert('Bulk user action failed.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleWalletAdjustment = async (userId: string, userName: string) => {
    const amountStr = prompt(
      `Enter amount to adjust for ${userName}. Use negative values to debit, positive to credit.`,
      '0'
    );
    if (!amountStr) return;

    const amount = Number(amountStr);
    if (Number.isNaN(amount) || amount === 0) {
      alert('Enter a valid non-zero amount.');
      return;
    }

    const description = prompt(
      'Enter a description for the wallet adjustment:',
      'Admin adjustment'
    );
    if (!description) return;

    if (
      !(await requireAdminOtpConfirmation(
        `Confirm wallet adjustment of ${formatCurrency(amount)} for ${userName}?`
      ))
    ) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/wallet-adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount, type: 'admin-adjustment', description }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Wallet adjustment failed: ${data.error || 'Unknown error'}`);
        return;
      }
      await fetchUsers();
      alert('Wallet adjustment completed successfully.');
    } catch (err) {
      console.error('Wallet adjustment failed:', err);
      alert('Wallet adjustment failed.');
    }
  };

  const handleChangeUserRole = async (userId: string, currentRole: string) => {
    const role = prompt('Enter new role (customer, trader, agent, manager, admin):', currentRole);
    if (!role) return;
    const normalized = role.trim().toLowerCase();
    if (!['customer', 'trader', 'agent', 'manager', 'admin'].includes(normalized)) {
      alert('Role must be one of customer, trader, agent, manager, or admin.');
      return;
    }

    const tier = prompt('Enter tier (optional, e.g. premium, gold):', '');
    if (
      !(await requireAdminOtpConfirmation(
        `Confirm role change for this user to ${normalized.toUpperCase()}?`
      ))
    ) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/change-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: normalized, tier: tier?.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Role change failed: ${data.error || 'Unknown error'}`);
        return;
      }
      await fetchUsers();
      alert('User role updated successfully.');
    } catch (err) {
      console.error('Role update failed:', err);
      alert('Role update failed.');
    }
  };

  const handleExportUsers = () => exportUsersCsv();
  const handleExportTransactions = () => exportTransactionsCsv();

  const handleVerificationDecision = async (
    requestId: string,
    decision: 'approve' | 'reject'
  ) => {
    const reason =
      decision === 'reject' ? window.prompt('Reason for rejection or more information request?') : '';
    if (decision === 'reject' && !reason) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/admin/verification-requests/${requestId}/${decision}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      await refreshData();
    } catch (err) {
      console.error('Verification decision failed:', err);
      alert('Could not update verification request.');
    }
  };

  // Auto-refresh functionality
  const refreshData = useCallback(async () => {
    if (!isAuthorized || !isAdmin) return;

    setIsRefreshing(true);
    try {
      const [controlRes, healthRes, statsRes, feedRes, alertsRes, verificationRes] =
        await Promise.allSettled([
        fetch(`${apiBaseUrl}/api/admin/control-center`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/api/admin/health/check`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/api/admin/dashboard/quick-stats`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/api/admin/transactions/feed?limit=20`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/api/admin/login-alerts/pending?limit=10`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/api/admin/verification-requests?limit=20`, {
          credentials: 'include',
        }),
      ]);

      if (controlRes.status === 'fulfilled' && controlRes.value.ok) {
        const data = await controlRes.value.json();
        setControlCenter(data.controlCenter || null);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const health = await healthRes.value.json();
        setSystemHealth(health.health);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const stats = await statsRes.value.json();
        setQuickStats(stats.stats);
      }

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const feed = await feedRes.value.json();
        setTransactionFeed(feed.transactions || []);
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const alerts = await alertsRes.value.json();
        setLoginAlerts(alerts.alerts || []);
      }

      if (verificationRes.status === 'fulfilled' && verificationRes.value.ok) {
        const verification = await verificationRes.value.json();
        setVerificationRequests(verification.requests || []);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthorized, isAdmin, apiBaseUrl]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled || !isAuthorized || !isAdmin) return;

    const interval = setInterval(refreshData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refreshInterval, refreshData, isAuthorized, isAdmin]);

  // Initial data load
  useEffect(() => {
    if (isAuthorized && isAdmin) {
      refreshData();
    }
  }, [isAuthorized, isAdmin, refreshData]);

  useEffect(() => {
    if (!isAuthorized || !isAdmin) return;

    const unsubscribe = subscribeToLiveUpdates((event) => {
      const path = String(event.path || '');
      if (
        path.includes('/api/wallet') ||
        path.includes('/api/transactions') ||
        path.includes('/api/purchases') ||
        path.includes('/api/admin/transactions')
      ) {
        refreshData();
        if (activeTab === 'transactions') {
          fetchTransactionsList();
        }
      }
    });

    return unsubscribe;
  }, [isAuthorized, isAdmin, activeTab, refreshData]);

  const fetchUsers = async () => {
    if (!isAuthorized || !isAdmin) return;
    setUsersLoading(true);
    try {
      const query = buildQueryParams({
        limit: usersPageSize,
        offset: (usersPage - 1) * usersPageSize,
        search: usersSearch,
        role: usersRoleFilter !== 'all' ? usersRoleFilter : undefined,
        status: usersStatusFilter !== 'all' ? usersStatusFilter : undefined,
        from: usersFromDate || undefined,
        to: usersToDate || undefined,
      });
      const res = await fetch(`${apiBaseUrl}/api/admin/users?${query}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUsersTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchTransactionsList = async () => {
    if (!isAuthorized || !isAdmin) return;
    setTransactionsLoading(true);
    try {
      const query = buildQueryParams({
        limit: transactionsPageSize,
        offset: (transactionsPage - 1) * transactionsPageSize,
        search: transactionsSearch,
        status: transactionsStatusFilter !== 'all' ? transactionsStatusFilter : undefined,
        from: transactionsFromDate || undefined,
        to: transactionsToDate || undefined,
      });
      const res = await fetch(`${apiBaseUrl}/api/admin/transactions/feed?${query}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTransactionsList(data.transactions || []);
        setTransactionsTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchDatabaseStats = async () => {
    if (!isAuthorized || !isAdmin) return;
    setDbLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/database/stats`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDatabaseStats(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to fetch database stats:', err);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchTraders = async () => {
    if (!isAuthorized || !isAdmin) return;
    setTradersLoading(true);
    try {
      const { traders, total } = await fetchTradersListService(
        tradersPageSize,
        (tradersPage - 1) * tradersPageSize,
        tradersStatusFilter !== 'all' ? tradersStatusFilter : undefined
      );
      setTraders(traders || []);
      setTradersTotal(total || 0);
    } catch (err) {
      console.error('Failed to fetch traders:', err);
    } finally {
      setTradersLoading(false);
    }
  };

  const fetchSubscriptionPlans = async () => {
    if (!isAuthorized || !isAdmin) return;
    setSubscriptionsLoading(true);
    try {
      const { subscriptions } = await fetchSubscriptionPlansService();
      setSubscriptionPlans(subscriptions || []);
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  const fetchBusinessModel = async () => {
    if (!isAuthorized || !isAdmin) return;
    setBusinessModelLoading(true);
    try {
      const [{ businessModel }, loanPolicyResponse, loyaltyPolicyResponse] = await Promise.all([
        fetchBusinessModelService(),
        fetchLoanPolicy(),
        fetchLoyaltyPolicy(),
      ]);
      setBusinessModel(businessModel || null);
      setLoanPolicy(loanPolicyResponse.policy || null);
      setLoyaltyPolicy(loyaltyPolicyResponse.policy || null);
      setPlatformWallet(businessModel?.platformWallet || null);
      setPlatformWalletHistory(businessModel?.platformWalletHistory || []);
    } catch (err) {
      console.error('Failed to fetch business model data:', err);
    } finally {
      setBusinessModelLoading(false);
    }
  };

  const refreshPlatformWallet = async () => {
    if (!isAuthorized || !isAdmin) return;
    try {
      const { wallet, history } = await fetchPlatformWallet();
      setPlatformWallet(wallet || null);
      setPlatformWalletHistory(history || []);
    } catch (err) {
      console.error('Failed to fetch platform wallet:', err);
    }
  };

  const handleSendPlatformMoney = async () => {
    const amount = Number(platformSendForm.amount);
    if (!platformSendForm.recipientId.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Recipient ID and positive amount are required.');
      return;
    }
    setPlatformSendLoading(true);
    try {
      const result = await sendPlatformWalletMoney({
        recipientId: platformSendForm.recipientId.trim(),
        amount,
        description: platformSendForm.description.trim() || 'Platform wallet payout',
      });
      setPlatformWallet(result.wallet || null);
      setPlatformSendForm({
        recipientId: '',
        amount: '',
        description: 'Platform wallet payout',
      });
      await refreshPlatformWallet();
    } catch (err: any) {
      setError(err?.message || 'Failed to send platform money.');
    } finally {
      setPlatformSendLoading(false);
    }
  };

  const saveLoanPolicy = async () => {
    if (!loanPolicy) return;
    setPolicySaving(true);
    try {
      const { policy } = await updateLoanPolicy(loanPolicy);
      setLoanPolicy(policy);
      await fetchBusinessModel();
    } catch (err: any) {
      setError(err?.message || 'Failed to save loan policy.');
    } finally {
      setPolicySaving(false);
    }
  };

  const saveLoyaltyPolicy = async () => {
    if (!loyaltyPolicy) return;
    setPolicySaving(true);
    try {
      const { policy } = await updateLoyaltyPolicy(loyaltyPolicy);
      setLoyaltyPolicy(policy);
      await fetchBusinessModel();
    } catch (err: any) {
      setError(err?.message || 'Failed to save loyalty policy.');
    } finally {
      setPolicySaving(false);
    }
  };

  const resetSubscriptionForm = () => {
    setSubscriptionForm({
      name: '',
      description: '',
      price: '',
      features: '',
      limits: '{}',
      is_active: true,
    });
    setEditingSubscription(null);
  };

  const openCreateSubscriptionModal = () => {
    resetSubscriptionForm();
    setSubscriptionModalMode('create');
    setShowSubscriptionModal(true);
  };

  const openEditSubscriptionModal = (subscription: any) => {
    setEditingSubscription(subscription);
    setSubscriptionModalMode('edit');
    setSubscriptionForm({
      name: subscription.name || '',
      description: subscription.description || '',
      price: String(subscription.price || ''),
      features: Array.isArray(subscription.features)
        ? subscription.features.join(', ')
        : String(subscription.features || ''),
      limits:
        typeof subscription.limits === 'string'
          ? subscription.limits
          : JSON.stringify(subscription.limits || {}, null, 2),
      is_active: subscription.is_active ?? true,
    });
    setShowSubscriptionModal(true);
  };

  const closeSubscriptionModal = () => {
    setShowSubscriptionModal(false);
    resetSubscriptionForm();
  };

  const submitSubscriptionModal = async () => {
    const price = Number(subscriptionForm.price);
    if (!subscriptionForm.name.trim() || Number.isNaN(price) || price <= 0) {
      alert('A valid name and price are required.');
      return;
    }

    const features = subscriptionForm.features
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    let limits: any = {};
    try {
      limits = JSON.parse(subscriptionForm.limits);
    } catch (error) {
      alert('Limits must be valid JSON.');
      return;
    }

    setSubscriptionModalLoading(true);
    try {
      if (subscriptionModalMode === 'create') {
        await createSubscriptionPlan({
          name: subscriptionForm.name.trim(),
          description: subscriptionForm.description.trim(),
          price,
          features,
          limits,
        });
      } else if (editingSubscription) {
        await updateSubscriptionPlan(editingSubscription.id, {
          name: subscriptionForm.name.trim(),
          description: subscriptionForm.description.trim(),
          price,
          features,
          limits,
          is_active: subscriptionForm.is_active,
        });
      }
      await fetchSubscriptionPlans();
      await fetchBusinessModel();
      closeSubscriptionModal();
      alert(
        `Subscription ${subscriptionModalMode === 'create' ? 'created' : 'updated'} successfully.`
      );
    } catch (err: any) {
      console.error('Failed to save subscription:', err);
      alert(`Failed to save subscription: ${err?.message || 'Unknown error'}`);
    } finally {
      setSubscriptionModalLoading(false);
    }
  };

  const handleCreateSubscription = () => {
    openCreateSubscriptionModal();
  };

  const handleUpdateSubscription = (subscription: any) => {
    openEditSubscriptionModal(subscription);
  };

  const handleDeactivateSubscription = async (subscriptionId: string) => {
    if (!confirm('Deactivate this subscription plan?')) return;
    try {
      await deactivateSubscriptionPlan(subscriptionId);
      await fetchSubscriptionPlans();
      await fetchBusinessModel();
      alert('Subscription deactivated successfully.');
    } catch (err: any) {
      console.error('Failed to deactivate subscription:', err);
      alert(`Failed to deactivate subscription: ${err?.message || 'Unknown error'}`);
    }
  };

  const openFeeRuleModal = () => {
    setFeeRuleForm({
      feeType: 'transaction',
      percentage: '',
      fixedAmount: '',
      conditions: '{"minAmount":1000}',
    });
    setShowFeeRuleModal(true);
  };

  const closeFeeRuleModal = () => {
    setShowFeeRuleModal(false);
  };

  const submitFeeRuleModal = async () => {
    const percentage = Number(feeRuleForm.percentage);
    const fixedAmount = Number(feeRuleForm.fixedAmount);
    if (
      !feeRuleForm.feeType.trim() ||
      Number.isNaN(percentage) ||
      percentage < 0 ||
      Number.isNaN(fixedAmount) ||
      fixedAmount < 0
    ) {
      alert('Please provide valid fee type, percentage, and fixed amount.');
      return;
    }

    let conditions: any = {};
    try {
      conditions = JSON.parse(feeRuleForm.conditions);
    } catch (error) {
      alert('Conditions must be valid JSON.');
      return;
    }

    setFeeRuleModalLoading(true);
    try {
      await addDynamicFeeRule({
        feeType: feeRuleForm.feeType.trim(),
        percentage,
        fixedAmount,
        conditions,
      });
      await fetchBusinessModel();
      closeFeeRuleModal();
      alert('Dynamic fee rule added successfully.');
    } catch (err: any) {
      console.error('Failed to add dynamic fee:', err);
      alert(`Failed to add fee rule: ${err?.message || 'Unknown error'}`);
    } finally {
      setFeeRuleModalLoading(false);
    }
  };

  const handleAddDynamicFee = () => {
    openFeeRuleModal();
  };

  const handleUpdateFeePricing = async (subscription: any) => {
    const price = Number(prompt('New subscription price in RWF:', String(subscription.price || 0)));
    if (Number.isNaN(price) || price <= 0) {
      alert('Enter a valid price.');
      return;
    }
    try {
      await updateSubscriptionPricing(
        subscription.id,
        price,
        subscription.features || [],
        subscription.limits || {}
      );
      await fetchBusinessModel();
      await fetchSubscriptionPlans();
      alert('Subscription pricing updated successfully.');
    } catch (err: any) {
      console.error('Failed to update subscription pricing:', err);
      alert(`Failed to update pricing: ${err?.message || 'Unknown error'}`);
    }
  };

  const openTraderDetailModal = async (trader: any) => {
    setSelectedTrader(trader);
    setTraderDetailLoading(true);
    setShowTraderDetailModal(true);

    try {
      // Fetch trader analytics, subscription, assignments, and analyst list in parallel
      const [analyticsRes, subscriptionRes, assignmentsRes, analystsRes, subscriptionsRes] =
        await Promise.all([
          fetchTraderAnalytics(trader.id),
          fetchTraderSubscription(trader.id),
          fetchAnalystAssignments(),
          fetchBusinessAnalysts(),
          fetchSubscriptionPlansService(),
        ]);

      setTraderAnalytics(analyticsRes.analytics);
      setTraderSubscription(subscriptionRes.subscription);
      setTraderSubscriptionForm({
        subscriptionId: subscriptionRes.subscription?.id || '',
        autoRenew: Boolean(subscriptionRes.subscription?.autoRenew),
      });
      setTraderAssignments(assignmentsRes.assignments.filter((a: any) => a.traderId === trader.id));
      setAnalystList(analystsRes.analysts);
      setSubscriptionPlans(subscriptionsRes.subscriptions || []);
    } catch (err: any) {
      console.error('Failed to fetch trader details:', err);
      alert(`Failed to load trader details: ${err?.message || 'Unknown error'}`);
    } finally {
      setTraderDetailLoading(false);
    }
  };

  const closeTraderDetailModal = () => {
    setShowTraderDetailModal(false);
    setSelectedTrader(null);
    setTraderAnalytics(null);
    setTraderSubscription(null);
    setTraderAssignments([]);
    setTraderSubscriptionForm({ subscriptionId: '', autoRenew: false });
  };

  const openAssignAnalystModal = () => {
    setAssignAnalystForm({
      analystId: '',
      priority: 'medium',
      requirements: '',
    });
    setShowAssignAnalystModal(true);
  };

  const closeAssignAnalystModal = () => {
    setShowAssignAnalystModal(false);
  };

  const submitAssignAnalyst = async () => {
    if (
      !selectedTrader ||
      !assignAnalystForm.analystId.trim() ||
      !assignAnalystForm.requirements.trim()
    ) {
      alert('Please select an analyst and provide requirements.');
      return;
    }

    try {
      await assignAnalystToTrader(
        selectedTrader.id,
        assignAnalystForm.analystId,
        assignAnalystForm.priority,
        assignAnalystForm.requirements
      );
      closeAssignAnalystModal();
      // Refresh trader details
      await openTraderDetailModal(selectedTrader);
      alert('Analyst assigned successfully.');
    } catch (err: any) {
      console.error('Failed to assign analyst:', err);
      alert(`Failed to assign analyst: ${err?.message || 'Unknown error'}`);
    }
  };

  const openActivationKeyModal = () => {
    setActivationKeyForm({
      feature: '',
      expiresInDays: 30,
    });
    setShowActivationKeyModal(true);
  };

  const closeActivationKeyModal = () => {
    setShowActivationKeyModal(false);
  };

  const submitActivationKey = async () => {
    if (!selectedTrader || !activationKeyForm.feature.trim()) {
      alert('Please provide a feature name.');
      return;
    }

    try {
      const result = await generateTraderActivationKey(
        selectedTrader.id,
        activationKeyForm.feature,
        activationKeyForm.expiresInDays
      );
      alert(
        `Activation key generated: ${result.activationKey}\nExpires: ${new Date(result.expiresAt).toLocaleDateString()}`
      );
      closeActivationKeyModal();
    } catch (err: any) {
      console.error('Failed to generate activation key:', err);
      alert(`Failed to generate activation key: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleUpdateTraderSubscription = async (subscriptionId: string, autoRenew = false) => {
    if (!selectedTrader) return;
    if (!subscriptionId) {
      alert('Select a subscription plan before updating this trader.');
      return;
    }

    try {
      await updateTraderSubscription(selectedTrader.id, subscriptionId, autoRenew);
      // Refresh trader details
      await openTraderDetailModal(selectedTrader);
      alert('Trader subscription updated successfully.');
    } catch (err: any) {
      console.error('Failed to update trader subscription:', err);
      alert(`Failed to update subscription: ${err?.message || 'Unknown error'}`);
    }
  };

  const fetchAnalysts = async () => {
    if (!isAuthorized || !isAdmin) return;
    setAnalystsLoading(true);
    try {
      const res = await fetchBusinessAnalysts();
      setAnalysts(res.analysts || []);
    } catch (err: any) {
      console.error('Failed to fetch analysts:', err);
      alert(`Failed to fetch analysts: ${err?.message || 'Unknown error'}`);
    } finally {
      setAnalystsLoading(false);
    }
  };

  const openCreateAnalystModal = () => {
    setCreateAnalystForm({
      userId: '',
      specialization: '',
      experienceYears: 0,
      certifications: '',
    });
    setShowCreateAnalystModal(true);
  };

  const closeCreateAnalystModal = () => {
    setShowCreateAnalystModal(false);
  };

  const submitCreateAnalyst = async () => {
    if (!createAnalystForm.userId.trim() || !createAnalystForm.specialization.trim()) {
      alert('Please provide user ID and specialization.');
      return;
    }

    try {
      const certifications = createAnalystForm.certifications
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);
      await createBusinessAnalyst({
        userId: createAnalystForm.userId.trim(),
        specialization: createAnalystForm.specialization.trim(),
        experienceYears: createAnalystForm.experienceYears,
        certifications,
      });
      closeCreateAnalystModal();
      await fetchAnalysts();
      alert('Business analyst created successfully.');
    } catch (err: any) {
      console.error('Failed to create analyst:', err);
      alert(`Failed to create analyst: ${err?.message || 'Unknown error'}`);
    }
  };

  const fetchDatabaseDocuments = async (table = selectedDbTable) => {
    if (!isAuthorized || !isAdmin) return;
    setDbLoading(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/admin/database/documents?name=${encodeURIComponent(table)}&limit=25`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setDbDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch database documents:', err);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchSystemConfig = async () => {
    if (!isAuthorized || !isAdmin) return;
    setSystemConfigLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/config`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSystemConfig(data.config || null);
      }
    } catch (err) {
      console.error('Failed to fetch system config:', err);
    } finally {
      setSystemConfigLoading(false);
    }
  };

  const fetchSystemLogs = async () => {
    if (!isAuthorized || !isAdmin) return;
    setLogsLoading(true);
    try {
      const query = buildQueryParams({
        limit: 50,
        level: logFilterLevel !== 'all' ? logFilterLevel : undefined,
        source: logFilterSource !== 'all' ? logFilterSource : undefined,
      });
      const res = await fetch(`${apiBaseUrl}/api/admin/system-logs?${query}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSystemLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const refreshSystemTabData = async () => {
    await Promise.all([
      fetchDatabaseStats(),
      fetchDatabaseDocuments(selectedDbTable),
      fetchSystemConfig(),
    ]);
  };

  // Survey management functions
  const fetchSurveyQuestions = async () => {
    if (!isAuthorized || !isAdmin) return;
    setSurveyLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/survey-questions`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSurveyQuestions((data.questions || []).map(normalizeSurveyQuestion));
      }
    } catch (err) {
      console.error('Failed to fetch survey questions:', err);
    } finally {
      setSurveyLoading(false);
    }
  };

  const fetchSurveyResponses = async () => {
    if (!isAuthorized || !isAdmin) return;
    setSurveyResponsesLoading(true);
    try {
      const query = buildQueryParams({
        limit: 25,
        offset: (surveyPage - 1) * 25,
      });
      const res = await fetch(`${apiBaseUrl}/api/admin/survey-responses?${query}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSurveyResponses((data.responses || []).map(normalizeSurveyResponse));
        setSurveyTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch survey responses:', err);
    } finally {
      setSurveyResponsesLoading(false);
    }
  };

  const openSurveyQuestionModal = (mode: 'create' | 'edit', question?: any) => {
    setSurveyQuestionModalMode(mode);
    if (mode === 'edit' && question) {
      setEditingSurveyQuestion(question);
      setSurveyQuestionForm({
        question: question.question || '',
        questionType: question.questionType || 'text',
        options: Array.isArray(question.options) ? question.options : [],
        required: Boolean(question.required),
        orderIndex: question.orderIndex || 0,
      });
    } else {
      setEditingSurveyQuestion(null);
      setSurveyQuestionForm({
        question: '',
        questionType: 'text',
        options: [],
        required: false,
        orderIndex: 0,
      });
    }
    setShowSurveyQuestionModal(true);
  };

  const closeSurveyQuestionModal = () => {
    setShowSurveyQuestionModal(false);
    setEditingSurveyQuestion(null);
    setSurveyQuestionForm({
      question: '',
      questionType: 'text',
      options: [],
      required: false,
      orderIndex: 0,
    });
  };

  const submitSurveyQuestionModal = async () => {
    if (!surveyQuestionForm.question.trim()) {
      alert('Question text is required.');
      return;
    }

    if (
      surveyQuestionForm.questionType === 'multiple_choice' &&
      surveyQuestionForm.options.length === 0
    ) {
      alert('Multiple choice questions require at least one option.');
      return;
    }

    try {
      const payload = {
        question: surveyQuestionForm.question.trim(),
        questionType: surveyQuestionForm.questionType,
        options:
          surveyQuestionForm.questionType === 'multiple_choice' ? surveyQuestionForm.options : null,
        required: surveyQuestionForm.required,
        orderIndex: surveyQuestionForm.orderIndex,
      };

      let res;
      if (surveyQuestionModalMode === 'create') {
        res = await fetch(`${apiBaseUrl}/api/admin/survey-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else if (editingSurveyQuestion) {
        res = await fetch(`${apiBaseUrl}/api/admin/survey-questions/${editingSurveyQuestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      if (res && res.ok) {
        await fetchSurveyQuestions();
        closeSurveyQuestionModal();
        alert(
          `Survey question ${surveyQuestionModalMode === 'create' ? 'created' : 'updated'} successfully.`
        );
      } else {
        const data = await res?.json();
        alert(
          `Failed to ${surveyQuestionModalMode} survey question: ${data?.error || 'Unknown error'}`
        );
      }
    } catch (err) {
      console.error('Failed to submit survey question:', err);
      alert('Failed to save survey question.');
    }
  };

  const handleDeleteSurveyQuestion = async (questionId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this survey question? This will also delete all associated responses.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/survey-questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        await fetchSurveyQuestions();
        alert('Survey question deleted successfully.');
      } else {
        const data = await res.json();
        alert(`Failed to delete survey question: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete survey question:', err);
      alert('Failed to delete survey question.');
    }
  };

  const handleExportSurveyResponses = () => {
    const csvContent = [
      ['Question', 'Response', 'User Name', 'User Email', 'Submitted At'].join(','),
      ...surveyResponses.map((response) => {
        const csvEscape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        return [
          csvEscape(response.question),
          csvEscape(response.responseLabel ?? response.response),
          csvEscape(response.userName),
          csvEscape(response.userEmail),
          csvEscape(response.createdAt),
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `survey_responses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUserStatusChange = async (userId: string, status: string) => {
    const confirmMessage = `Confirm ${status === 'suspended' ? 'suspension' : 'activation'} of this user account?`;
    if (!(await requireAdminOtpConfirmation(confirmMessage))) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchUsers();
        refreshData();
      } else {
        const data = await res.json();
        alert(`Failed to update status: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to update user status:', err);
      alert('Failed to update user status.');
    }
  };

  const handleCorrectTransaction = async (transactionId: string) => {
    const newAmount = prompt('Enter corrected amount:');
    const newStatus = prompt('Enter new status (completed/failed/pending):');
    if (!newAmount || !newStatus) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/transactions/${transactionId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: Number(newAmount), status: newStatus }),
      });
      if (res.ok) {
        await fetchTransactionsList();
        refreshData();
        alert('Transaction corrected successfully');
      } else {
        const data = await res.json();
        alert(`Failed to correct transaction: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to correct transaction:', err);
      alert('Failed to correct transaction.');
    }
  };

  const handleRefundTransaction = async (transactionId: string) => {
    const reason = prompt('Enter refund reason:', 'Admin refund');
    if (!reason) return;

    if (!(await requireAdminOtpConfirmation('Confirm this transaction refund?'))) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/transactions/${transactionId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeIdempotencyKey(),
        },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTransactionsList();
        refreshData();
        alert('Transaction refunded successfully.');
      } else {
        alert(`Failed to refund transaction: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to refund transaction:', err);
      alert('Failed to refund transaction.');
    }
  };

  const handleMaintenanceToggle = async (enabled: boolean) => {
    const actionText = enabled ? 'enter maintenance mode' : 'exit maintenance mode';
    if (!(await requireAdminOtpConfirmation(`Confirm that you want to ${actionText}?`))) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/system/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled, broadcast: systemConfig?.broadcast || '' }),
      });
      if (res.ok) {
        await fetchSystemConfig();
        refreshData();
      } else {
        const data = await res.json();
        alert(`Failed to toggle maintenance mode: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to toggle maintenance mode:', err);
      alert('Failed to update maintenance mode.');
    }
  };

  const handleDownloadDatabaseBackup = () => {
    window.open(`${apiBaseUrl}/api/admin/export-db`, '_blank', 'noopener,noreferrer');
  };

  const handleReconcileRevenueFees = async () => {
    if (!(await requireAdminOtpConfirmation('Reconcile missing fee records from transactions?'))) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/revenue/reconcile`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Fee reconciliation failed: ${data.error || 'Unknown error'}`);
        return;
      }
      await refreshData();
      if (activeTab === 'fees') {
        await fetchBusinessModel();
      }
      alert(
        `${data.message}\nBackfilled: ${data.backfilled || 0}\nTotal fees: ${formatCurrency(data.totalFees || 0)}`
      );
    } catch (err) {
      console.error('Fee reconciliation failed:', err);
      alert('Fee reconciliation failed.');
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
    if (activeTab === 'transactions') {
      fetchTransactionsList();
    }
    if (activeTab === 'database') {
      refreshSystemTabData();
    }
    if (activeTab === 'logs') {
      fetchSystemLogs();
    }
    if (activeTab === 'traders') {
      fetchTraders();
    }
    if (activeTab === 'analysts') {
      fetchAnalysts();
    }
    if (activeTab === 'subscriptions') {
      fetchSubscriptionPlans();
    }
    if (activeTab === 'fees') {
      fetchBusinessModel();
      fetchSubscriptionPlans();
    }
    if (activeTab === 'surveys') {
      fetchSurveyQuestions();
      fetchSurveyResponses();
    }
  }, [
    activeTab,
    isAuthorized,
    isAdmin,
    usersSearch,
    usersRoleFilter,
    usersStatusFilter,
    usersFromDate,
    usersToDate,
    usersPage,
    transactionsSearch,
    transactionsStatusFilter,
    transactionsFromDate,
    transactionsToDate,
    transactionsPage,
    selectedDbTable,
    tradersPage,
    tradersStatusFilter,
    surveyPage,
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const user = await res.json();
          if (user.role === 'admin') {
            setIsAdmin(true);
            setIsAuthorized(true);
            setAdminEmail(user.email || '');
          } else {
            setIsAuthorized(false);
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [apiBaseUrl]);

  const handleOtpRequest = async () => {
    if (!email || !email.includes('@')) {
      setError('Valid email is required');
      return;
    }

    setIsSendingOtp(true);
    setError('');

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      if (res.ok) {
        setAuthStep('otp');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!otp) {
      setError('OTP is required');
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
        credentials: 'include',
      });

      if (res.ok) {
        setIsAdmin(true);
        setIsAuthorized(true);
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Failed to verify OTP. Please try again.');
    }
  };

  const handleSmtpTest = async (testEmail?: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/smtp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail }),
        credentials: 'include',
      });

      if (res.ok) {
        const result = await res.json();
        alert(
          `SMTP Test Successful!\n\nHost: ${result.details.host}\nResponse Time: ${result.details.responseTime}\nTo: ${result.details.to}`
        );
      } else {
        const error = await res.json();
        alert(`SMTP Test Failed: ${error.error}\n\n${error.details?.join('\n')}`);
      }
    } catch (err) {
      alert('Failed to test SMTP configuration');
    }
  };

  const handleLoginAlertAction = async (alertId: string, action: 'confirm' | 'deny') => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/login-alerts/${alertId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include',
      });

      if (res.ok) {
        // Refresh alerts
        const alertsRes = await fetch(`${apiBaseUrl}/api/admin/login-alerts/pending?limit=10`, {
          credentials: 'include',
        });
        if (alertsRes.ok) {
          const alerts = await alertsRes.json();
          setLoginAlerts(alerts.alerts || []);
        }
      } else {
        const error = await res.json();
        alert(`Failed to ${action} alert: ${error.error}`);
      }
    } catch (err) {
      alert(`Failed to ${action} login alert`);
    }
  };

  const fetchEmailLogs = async () => {
    if (!isAuthorized || !isAdmin) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/email-logs?limit=20`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load email logs:', err);
    }
  };

  const fetchSupportTickets = async () => {
    if (!isAuthorized || !isAdmin) return;
    setTicketLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tickets?limit=50`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const tickets = (data.tickets || []).map(normalizeTicket);
        setSupportTickets(tickets);
        if (selectedTicket?.id) {
          const refreshedTicket = tickets.find((ticket: any) => ticket.id === selectedTicket.id);
          if (refreshedTicket) setSelectedTicket(refreshedTicket);
        }
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setTicketLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    if (!ticketId || !isAuthorized || !isAdmin) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tickets/${ticketId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(normalizeTicket(data.ticket));
        setTicketMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  };

  const handleSendEmail = async (broadcast = false) => {
    if (!emailDraft.subject || !emailDraft.body) {
      alert('Subject and body are required.');
      return;
    }

    if (!broadcast && !emailDraft.to) {
      alert('Recipient email is required for direct send.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: emailDraft.to,
          subject: emailDraft.subject,
          html: `<div style="font-family: Inter, system-ui, sans-serif; color: #0f172a;">${emailDraft.body.replace(/\n/g, '<br/>')}</div>`,
          text: emailDraft.body,
          broadcast,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Email sent ${broadcast ? 'to all users' : 'to recipient'}.`);
        setEmailDraft({ to: '', subject: '', body: '' });
        fetchEmailLogs();
      } else {
        alert(`Failed to send email: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to send admin email:', err);
      alert('Failed to send email.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    if (!ticketReply.trim()) {
      alert('Reply message cannot be empty.');
      return;
    }
    setTicketReplySending(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: ticketReply, status: 'closed' }),
      });
      const data = await res.json();
      if (res.ok) {
        setTicketReply('');
        fetchSupportTickets();
        if (selectedTicket) {
          setSelectedTicket({ ...selectedTicket, status: 'closed' });
        }
        alert('Reply sent and ticket marked closed.');
      } else {
        alert(`Failed to send reply: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to reply to ticket:', err);
      alert('Failed to send ticket reply.');
    } finally {
      setTicketReplySending(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized || !isAdmin) return;
    if (activeTab === 'email') {
      fetchEmailLogs();
    }
    if (activeTab === 'support') {
      fetchSupportTickets();
    }
  }, [activeTab, isAuthorized, isAdmin]);

  useEffect(() => {
    if (selectedTicket?.id) {
      fetchTicketDetails(selectedTicket.id);
    }
  }, [selectedTicket?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/5 border-t-orange-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#111] rounded-3xl p-8 border border-white/5"
        >
          <div className="text-center mb-8">
            <ShieldCheck className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-white mb-2">Admin Control Center</h1>
            <p className="text-neutral-500 text-sm">
              System operations, monitoring, and security oversight
            </p>
          </div>

          {authStep === 'email' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/5 rounded-xl text-white placeholder:text-neutral-600 focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="admin@esoko.com"
                />
              </div>
              <button
                onClick={handleOtpRequest}
                disabled={isSendingOtp}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSendingOtp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Verification Code
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/5 rounded-xl text-white placeholder:text-neutral-600 focus:ring-2 focus:ring-orange-500 outline-none text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAuthStep('email')}
                  className="flex-1 py-3 border border-white/5 text-neutral-400 hover:text-white font-bold rounded-xl transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleOtpVerify}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all"
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Control Center', icon: BarChart3 },
    { id: 'health', label: 'System Health', icon: Server },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'traders', label: 'Trader Oversight', icon: Store },
    { id: 'analysts', label: 'Business Analysts', icon: UserCheck },
    { id: 'subscriptions', label: 'Subscriptions', icon: Zap },
    { id: 'fees', label: 'Fee Collection', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: DollarSign },
    { id: 'screening', label: 'Screening', icon: ShieldCheck },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'verification', label: 'Verification', icon: UserCheck },
    { id: 'support', label: 'Support Center', icon: LifeBuoy },
    { id: 'email', label: 'Email Center', icon: Mail },
    { id: 'surveys', label: 'Survey Analytics', icon: BarChart3 },
    { id: 'database', label: 'Database Control', icon: Database },
    { id: 'logs', label: 'Logs', icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#111] sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-xl font-black text-white">Admin Control Center</h1>
              <p className="text-xs text-neutral-500 font-medium">
                Operations, monitoring and security oversight
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Auto-refresh controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  autoRefreshEnabled
                    ? 'bg-green-600/10 text-green-500'
                    : 'bg-neutral-600/10 text-neutral-500'
                )}
                title={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                {autoRefreshEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white transition-all disabled:opacity-50"
                title="Refresh data"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
              </button>

              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-1 bg-[#0a0a0a] border border-white/5 rounded-lg text-xs text-neutral-300"
              >
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={300000}>5m</option>
              </select>
            </div>

            <ThemeToggle />

            <div className="text-right">
              <p className="text-xs text-neutral-500">Last updated</p>
              <p className="text-xs text-neutral-300 font-mono">
                {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6 pb-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2',
                    activeTab === tab.id
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-600/10 rounded-xl">
                    <DollarSign className="w-6 h-6 text-blue-500" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-white">
                    {controlCenter?.today.transactions ?? quickStats?.todayTransactions ?? 0}
                  </p>
                  <p className="text-sm text-neutral-500 font-medium">Today's Transactions</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-600/10 rounded-xl">
                    <Wallet className="w-6 h-6 text-green-500" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-white">
                    {formatCurrency(controlCenter?.today.revenue ?? quickStats?.todayRevenue ?? 0)}
                  </p>
                  <p className="text-sm text-neutral-500 font-medium">Today's Revenue</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-yellow-600/10 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                  </div>
                  <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
                    {loginAlerts.length}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-white">
                    {controlCenter?.queues.pendingAlerts ?? quickStats?.pendingLoginAlerts ?? 0}
                  </p>
                  <p className="text-sm text-neutral-500 font-medium">Pending Alerts</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-600/10 rounded-xl">
                    <LifeBuoy className="w-6 h-6 text-purple-500" />
                  </div>
                  <span className="text-xs font-bold text-purple-500 bg-purple-500/10 px-2 py-1 rounded-full">
                    {quickStats?.openTickets || 0}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-white">
                    {controlCenter?.queues.openTickets ?? quickStats?.openTickets ?? 0}
                  </p>
                  <p className="text-sm text-neutral-500 font-medium">Open Tickets</p>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Revenue Control Center</h3>
                    <p className="text-sm text-neutral-500">
                      How the platform earns and collects money across fees, subscriptions, agents,
                      and services.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('fees')}
                    className="px-4 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold"
                  >
                    Manage Revenue Rules
                  </button>
                  <button
                    onClick={handleReconcileRevenueFees}
                    className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                  >
                    Reconcile Fees
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">30d Fee Revenue</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {formatCurrency(controlCenter?.totals.feeRevenue30d || 0)}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Subscription MRR</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {formatCurrency(controlCenter?.totals.activeSubscriptionMrr || 0)}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Projected Monthly</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {formatCurrency(controlCenter?.totals.projectedMonthlyRevenue || 0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(controlCenter?.revenue.streams || []).map((stream) => (
                    <div
                      key={stream.id}
                      className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{stream.label}</p>
                          <p className="text-xs text-neutral-500 mt-1">{stream.collectionMethod}</p>
                        </div>
                        <span className="text-[10px] rounded-full bg-white/5 px-2 py-1 text-neutral-400">
                          {stream.count} events
                        </span>
                      </div>
                      <p className="mt-4 text-xl font-black text-green-400">
                        {formatCurrency(stream.amount || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Collection & Ledger</h3>
                    <p className="text-sm text-neutral-500">
                      Settlement pipeline and account exposure.
                    </p>
                  </div>
                  <Database className="w-5 h-5 text-blue-500" />
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">
                      Payment Intents
                    </p>
                    {(controlCenter?.revenue.paymentPipeline || []).length > 0 ? (
                      <div className="space-y-2">
                        {(controlCenter?.revenue.paymentPipeline || []).map((item) => (
                          <div
                            key={item.status}
                            className="flex items-center justify-between bg-[#0a0a0a] rounded-xl px-4 py-3 border border-white/5"
                          >
                            <span className="text-sm text-white capitalize">{item.status}</span>
                            <span className="text-sm font-bold text-neutral-300">
                              {item.count} / {formatCurrency(item.amount || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 bg-[#0a0a0a] rounded-xl px-4 py-3 border border-white/5">
                        No payment intents recorded yet.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">
                      Agent Commissions
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-neutral-500">Payable</p>
                        <p className="text-sm font-black text-white">
                          {formatCurrency(controlCenter?.revenue.agentCommissions.payable || 0)}
                        </p>
                      </div>
                      <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-neutral-500">Paid</p>
                        <p className="text-sm font-black text-white">
                          {formatCurrency(controlCenter?.revenue.agentCommissions.paid || 0)}
                        </p>
                      </div>
                      <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-neutral-500">Net</p>
                        <p className="text-sm font-black text-white">
                          {formatCurrency(controlCenter?.revenue.agentCommissions.platformNet || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">
                      Ledger Totals
                    </p>
                    {(controlCenter?.revenue.ledgerTotals || []).length > 0 ? (
                      <div className="space-y-2">
                        {(controlCenter?.revenue.ledgerTotals || []).map((item) => (
                          <div
                            key={item.accountType}
                            className="flex items-center justify-between bg-[#0a0a0a] rounded-xl px-4 py-3 border border-white/5"
                          >
                            <span className="text-sm text-white capitalize">
                              {item.accountType}
                            </span>
                            <span className="text-sm font-bold text-neutral-300">
                              {formatCurrency(item.balance || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 bg-[#0a0a0a] rounded-xl px-4 py-3 border border-white/5">
                        Ledger entries will appear after ledger posting is enabled.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Operations Command</h3>
                    <p className="text-sm text-neutral-500">
                      Seven-day transaction, revenue, and onboarding pulse.
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                    {controlCenter
                      ? `Synced ${new Date(controlCenter.generatedAt).toLocaleTimeString()}`
                      : 'Waiting for live data'}
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Total Users</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {controlCenter?.totals.users ?? '--'}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Completed Volume</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {controlCenter ? formatCurrency(controlCenter.totals.completedVolume) : '--'}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Wallet Exposure</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {controlCenter ? formatCurrency(controlCenter.totals.walletBalance) : '--'}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Pending Work</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {controlCenter
                        ? controlCenter.queues.pendingPurchases +
                          controlCenter.queues.pendingDeliveries
                        : '--'}
                    </p>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={controlCenter?.dailyActivity || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={formatShortDate}
                        stroke="#737373"
                        fontSize={12}
                      />
                      <YAxis stroke="#737373" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: '#0a0a0a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          color: '#fff',
                        }}
                        labelFormatter={(label: any) => formatShortDate(String(label || ''))}
                        formatter={(value: any, name: any) =>
                          name === 'volume' || name === 'revenue'
                            ? formatCurrency(Number(value || 0))
                            : value
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        name="volume"
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.16}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="revenue"
                        stroke="#16a34a"
                        fill="#16a34a"
                        fillOpacity={0.18}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-white">Risk Queue</h3>
                  <AlertOctagon className="w-5 h-5 text-orange-500" />
                </div>
                <div className="space-y-3">
                  {(controlCenter?.riskItems || []).map((item) => (
                    <div
                      key={item.id}
                      className={cn('rounded-2xl border p-4', severityClass(item.severity))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{item.label}</p>
                          <p className="text-xs opacity-80 mt-1">{item.action}</p>
                        </div>
                        <span className="text-lg font-black">{item.count}</span>
                      </div>
                    </div>
                  ))}
                  {!controlCenter?.riskItems?.length && (
                    <div className="text-sm text-neutral-500 py-10 text-center">
                      Live risk data will appear after the first refresh.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <h3 className="text-lg font-black text-white mb-6">Users by Role</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={controlCenter?.roleDistribution || []}
                        dataKey="count"
                        nameKey="role"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {(controlCenter?.roleDistribution || []).map((entry, index) => (
                          <Cell
                            key={entry.role}
                            fill={roleChartColors[index % roleChartColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0a0a0a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <h3 className="text-lg font-black text-white mb-6">Transaction Status</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={controlCenter?.statusDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="status" stroke="#737373" fontSize={12} />
                      <YAxis stroke="#737373" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: '#0a0a0a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* System Health Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white">System Health</h3>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full',
                      systemHealth?.status === 'operational'
                        ? 'bg-green-500'
                        : systemHealth?.status === 'maintenance'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    )}
                  />
                  <span className="text-sm font-bold capitalize text-neutral-300">
                    {systemHealth?.status || 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Server className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-xs text-neutral-500 font-medium">Database</p>
                  <p
                    className={cn(
                      'text-sm font-bold',
                      systemHealth?.database.status === 'healthy'
                        ? 'text-green-500'
                        : 'text-red-500'
                    )}
                  >
                    {systemHealth?.database.status || 'Unknown'}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <MemoryStick className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="text-xs text-neutral-500 font-medium">Memory</p>
                  <p className="text-sm font-bold text-white">
                    {memoryLabel(systemHealth?.memory.heapUsed)}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className="text-xs text-neutral-500 font-medium">Uptime</p>
                  <p className="text-sm font-bold text-white">
                    {systemHealth ? `${Math.floor(systemHealth.uptime / 3600)}h` : 'N/A'}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Mail className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-xs text-neutral-500 font-medium">Email Rate</p>
                  <p className="text-sm font-bold text-white">
                    {systemHealth ? `${systemHealth.email.successRate}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Transaction Feed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Live Transaction Feed</h3>
                  <p className="text-sm text-neutral-500">
                    Deposits, payments, transfers, fees, net settlement, and references.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={refreshData}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white"
                  >
                    Refresh
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-500 font-bold">LIVE</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactionFeed.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <p className="text-neutral-500 font-medium">No recent transactions</p>
                  </div>
                ) : (
                  transactionFeed.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-[#0a0a0a] rounded-xl border border-white/5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 bg-orange-600/10 rounded-lg">
                            <DollarSign className="w-4 h-4 text-orange-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-white">
                                {tx.name || tx.email || tx.userId}
                              </p>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest',
                                  transactionTone(tx.type)
                                )}
                              >
                                {tx.type}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest',
                                  statusTone(tx.status)
                                )}
                              >
                                {tx.status}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400 truncate">
                              {tx.description || 'No description'}
                            </p>
                            <p className="mt-1 text-[11px] text-neutral-600">
                              {tx.transactionCode || tx.reference || tx.id}
                              {tx.recipientName ? ` -> ${tx.recipientName}` : ''}
                              {tx.traderName ? ` -> Trader: ${tx.traderName}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:min-w-[520px]">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                              Gross
                            </p>
                            <p className="text-sm font-black text-white">
                              {formatCurrency(tx.grossAmount ?? tx.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                              Fee
                            </p>
                            <p className="text-sm font-black text-blue-300">
                              {formatCurrency(tx.feeAmount ?? tx.feeTotal ?? 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                              Net
                            </p>
                            <p className="text-sm font-black text-green-300">
                              {formatCurrency(tx.netAmount ?? tx.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                              Time
                            </p>
                            <p className="text-sm font-bold text-neutral-300">
                              {new Date(tx.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                ['Pending', controlCenter?.verification?.pending || 0, 'text-amber-300'],
                ['Auto verified', controlCenter?.verification?.autoVerified || 0, 'text-emerald-300'],
                ['Approved', controlCenter?.verification?.approved || 0, 'text-blue-300'],
                ['Rejected', controlCenter?.verification?.rejected || 0, 'text-red-300'],
                ['Open risks', controlCenter?.verification?.openRiskFlags || 0, 'text-orange-300'],
                ['Missing licenses', controlCenter?.verification?.missingLicenses || 0, 'text-purple-300'],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-2xl border border-white/5 bg-[#111] p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {label}
                  </p>
                  <p className={cn('mt-2 text-2xl font-black', tone as string)}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="rounded-2xl border border-white/5 bg-[#111] p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-lg font-black text-white">Verification Queue</h3>
                    <p className="text-sm text-neutral-500">
                      Auto-scored identity, trader, and license submissions.
                    </p>
                  </div>
                  <button
                    onClick={refreshData}
                    className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
                  >
                    Refresh
                  </button>
                </div>
                <div className="space-y-3">
                  {verificationRequests.length === 0 ? (
                    <p className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-5 text-sm text-neutral-500">
                      No verification requests yet.
                    </p>
                  ) : (
                    verificationRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-white">
                                {request.businessName || request.legalName || request.name}
                              </p>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                {request.role}
                              </span>
                              <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-orange-300">
                                {(request.status || 'pending').replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">
                              {request.email} · {request.businessCategory || request.identityType || 'Identity'}
                            </p>
                            <p className="mt-2 text-xs font-bold text-neutral-400">
                              Score {Math.round(Number(request.autoScore || 0))}/100 ·{' '}
                              {request.documentCount || 0} docs · {request.openRiskFlags || 0} open risks
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVerificationDecision(request.id, 'approve')}
                              className="rounded-xl bg-emerald-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerificationDecision(request.id, 'reject')}
                              className="rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/5 bg-[#111] p-6">
                  <h3 className="text-lg font-black text-white mb-4">Research Signals</h3>
                  <div className="space-y-4">
                    {[
                      ['Trader categories', controlCenter?.research?.businessCategories || []],
                      ['District demand', controlCenter?.research?.districts || []],
                      ['Identity types', controlCenter?.research?.identityTypes || []],
                    ].map(([label, rows]) => (
                      <div key={label as string}>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                          {label as string}
                        </p>
                        <div className="space-y-2">
                          {(rows as any[]).slice(0, 5).map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center justify-between rounded-xl bg-[#0a0a0a] px-4 py-3 text-sm"
                            >
                              <span className="text-neutral-300">{row.label}</span>
                              <span className="font-black text-white">{row.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[#111] p-6">
                  <h3 className="text-lg font-black text-white mb-4">Risk Patterns</h3>
                  <div className="space-y-2">
                    {(controlCenter?.research?.riskPatterns || []).map((risk) => (
                      <div
                        key={`${risk.code}-${risk.severity}`}
                        className="flex items-center justify-between rounded-xl bg-[#0a0a0a] px-4 py-3 text-sm"
                      >
                        <span className="text-neutral-300">{risk.code.replace(/_/g, ' ')}</span>
                        <span className="font-black text-orange-300">{risk.count}</span>
                      </div>
                    ))}
                    {!controlCenter?.research?.riskPatterns?.length && (
                      <p className="text-sm text-neutral-500">No open risk patterns yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-6">
            {/* System Health Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white">System Health Monitor</h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleSmtpTest()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Test SMTP
                  </button>
                  <div
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2',
                      systemHealth?.status === 'operational'
                        ? 'bg-green-600/10 text-green-500'
                        : systemHealth?.status === 'maintenance'
                          ? 'bg-yellow-600/10 text-yellow-500'
                          : 'bg-red-600/10 text-red-500'
                    )}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        systemHealth?.status === 'operational'
                          ? 'bg-green-500'
                          : systemHealth?.status === 'maintenance'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      )}
                    />
                    {systemHealth?.status || 'Unknown'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Database Health */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-bold text-white">Database</span>
                    </div>
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full',
                        systemHealth?.database.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Status</span>
                      <span className="text-white font-bold capitalize">
                        {systemHealth?.database.status || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Response Time</span>
                      <span className="text-white font-bold">
                        {systemHealth?.database.responseTime || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <MemoryStick className="w-5 h-5 text-purple-500" />
                      <span className="text-sm font-bold text-white">Memory</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Heap Used</span>
                      <span className="text-white font-bold">
                        {memoryLabel(systemHealth?.memory.heapUsed)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Heap Total</span>
                      <span className="text-white font-bold">
                        {memoryLabel(systemHealth?.memory.heapTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">External</span>
                      <span className="text-white font-bold">
                        {memoryLabel(systemHealth?.memory.external)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email Service */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-bold text-white">Email Service</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Success Rate</span>
                      <span className="text-white font-bold">
                        {systemHealth ? `${systemHealth.email.successRate}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Sent (24h)</span>
                      <span className="text-white font-bold">
                        {systemHealth?.email.totalSent || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Failed (24h)</span>
                      <span className="text-red-400 font-bold">
                        {systemHealth?.email.totalFailed || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Activity */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-orange-500" />
                      <span className="text-sm font-bold text-white">Transactions</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Last Hour</span>
                      <span className="text-white font-bold">
                        {systemHealth?.transactions.lastHourCount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Volume</span>
                      <span className="text-white font-bold">
                        {formatCurrency(systemHealth?.transactions.lastHourVolume || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Activity */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-cyan-500" />
                      <span className="text-sm font-bold text-white">User Activity</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Active (24h)</span>
                      <span className="text-white font-bold">
                        {systemHealth?.users.recentActive || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Uptime */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm font-bold text-white">System Uptime</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Hours</span>
                      <span className="text-white font-bold">
                        {systemHealth ? Math.floor(systemHealth.uptime / 3600) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Last Check</span>
                      <span className="text-white font-bold text-xs">
                        {systemHealth
                          ? new Date(systemHealth.timestamp).toLocaleTimeString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'screening' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-orange-500">
                      Application Screening
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-white">Pilot Ready</h3>
                    <p className="mt-3 text-sm text-neutral-500">
                      Static screening snapshot from the latest local review of the React,
                      Express, and SQLite commerce platform.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-white">7.5</p>
                    <p className="text-xs font-bold text-neutral-500">out of 10</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Screened</p>
                    <p className="mt-2 text-sm font-black text-white">May 14, 2026</p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Build</p>
                    <p className="mt-2 text-sm font-black text-green-400">Passing</p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-neutral-500">Launch Gate</p>
                    <p className="mt-2 text-sm font-black text-yellow-400">Internal Pilot</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {screeningReadiness.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 bg-[#0a0a0a] rounded-xl p-4 border border-white/5"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-neutral-300">{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#111] rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Verified Checks</h3>
                    <p className="text-sm text-neutral-500">
                      Build, test, and configuration signals from the screening pass.
                    </p>
                  </div>
                  <CheckSquare className="w-5 h-5 text-green-500" />
                </div>

                <div className="space-y-3">
                  {screeningChecks.map((check) => (
                    <div
                      key={check.label}
                      className="flex flex-col gap-3 rounded-xl bg-[#0a0a0a] p-4 border border-white/5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-black text-white">{check.label}</p>
                        <p className="mt-1 text-xs text-neutral-500">{check.note}</p>
                      </div>
                      <span
                        className={cn(
                          'w-fit rounded-full px-3 py-1 text-xs font-black',
                          check.result === 'Pass'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                        )}
                      >
                        {check.result}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">Production Readiness Actions</h3>
                  <p className="text-sm text-neutral-500">
                    Remaining hardening work before handling public users and real funds.
                  </p>
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-neutral-500">
                  5 open actions
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {screeningFindings.map((finding) => (
                  <div
                    key={finding.title}
                    className={cn('rounded-2xl border p-5', severityClass(finding.severity))}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-black">{finding.title}</p>
                        <p className="mt-2 text-xs opacity-80">{finding.detail}</p>
                      </div>
                      <AlertOctagon className="w-5 h-5 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Pending Login Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white">Pending Login Alerts</h3>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-bold text-yellow-500">
                    {loginAlerts.length} pending
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {loginAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-neutral-500 font-medium">No pending login alerts</p>
                  </div>
                ) : (
                  loginAlerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[#0a0a0a] rounded-xl p-4 border border-yellow-500/20"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-600/10 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{alert.name}</p>
                            <p className="text-xs text-neutral-500">{alert.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-neutral-500">Expires</p>
                          <p className="text-xs text-yellow-400 font-mono">
                            {new Date(alert.expiresAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs">
                        <div>
                          <p className="text-neutral-500">IP Address</p>
                          <p className="text-white font-mono">{alert.ipAddress}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500">Device</p>
                          <p className="text-white truncate" title={alert.userAgent}>
                            {alert.userAgent?.split(' ')[0] || 'Unknown'}...
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-500">Location</p>
                          <p className="text-white">{alert.location}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500">Balance</p>
                          <p className="text-white">{formatCurrency(alert.walletBalance)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoginAlertAction(alert.id, 'confirm')}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Login
                        </button>
                        <button
                          onClick={() => handleLoginAlertAction(alert.id, 'deny')}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Block Access
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Support Center</h3>
                  <p className="text-sm text-neutral-500">
                    Review open tickets, respond to inquiries, and close issues.
                  </p>
                </div>
                <button
                  onClick={fetchSupportTickets}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh Tickets
                </button>
              </div>

              {ticketLoading ? (
                <div className="text-center py-16">
                  <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-500" />
                  <p className="text-neutral-500 mt-4">Loading support tickets...</p>
                </div>
              ) : supportTickets.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">
                  No support tickets are active right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="space-y-4">
                    {supportTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={cn(
                          'w-full text-left p-4 rounded-2xl border transition-all',
                          selectedTicket?.id === ticket.id
                            ? 'border-blue-500 bg-[#0e1726]'
                            : 'border-white/5 bg-[#0a0a0a] hover:border-white/10'
                        )}
                      >
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <p className="text-sm font-bold text-white">{ticket.subject}</p>
                            <p className="text-xs text-neutral-500">
                              {ticket.createdByName || 'Unknown user'}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full',
                              ticket.status === 'open'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-green-500/10 text-emerald-400'
                            )}
                          >
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 line-clamp-2">
                          {ticket.message || ticket.description || 'No message provided.'}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/5 min-h-[320px]">
                    {selectedTicket ? (
                      <>
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div>
                            <h4 className="text-lg font-black text-white">
                              {selectedTicket.subject}
                            </h4>
                            <p className="text-xs text-neutral-500">
                              Ticket ID: {selectedTicket.id}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full',
                              selectedTicket.status === 'open'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-green-500/10 text-emerald-400'
                            )}
                          >
                            {selectedTicket.status}
                          </span>
                        </div>

                        <div className="space-y-4 mb-6">
                          <div className="space-y-2">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                              Customer
                            </p>
                            <p className="text-sm text-white">
                              {selectedTicket.createdByName || selectedTicket.userName || 'Unknown'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                              Category
                            </p>
                            <p className="text-sm text-white">
                              {selectedTicket.category || 'General'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 mb-6 max-h-[260px] overflow-y-auto pr-2">
                          {ticketMessages.length === 0 ? (
                            <div className="text-neutral-500 text-sm">
                              No conversation history yet.
                            </div>
                          ) : (
                            ticketMessages.map((message) => (
                              <div
                                key={message.id}
                                className="bg-[#111] p-4 rounded-2xl border border-white/5"
                              >
                                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">
                                  {message.senderName || 'Support'} •{' '}
                                  {new Date(message.createdAt).toLocaleString()}
                                </p>
                                <p className="text-sm text-white">{message.message}</p>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-3">
                          <textarea
                            value={ticketReply}
                            onChange={(e) => setTicketReply(e.target.value)}
                            rows={4}
                            placeholder="Write a response to the user..."
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500"
                          />
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => handleReplyTicket(selectedTicket.id)}
                              disabled={ticketReplySending}
                              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50"
                            >
                              {ticketReplySending ? 'Sending...' : 'Send Response & Close Ticket'}
                            </button>
                            <button
                              onClick={() => setSelectedTicket(null)}
                              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-neutral-300 font-bold rounded-2xl transition-all"
                            >
                              Deselect Ticket
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-neutral-500 text-sm">
                        Select a ticket to see details and respond.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Email Center</h3>
                  <p className="text-sm text-neutral-500">
                    Send direct messages, broadcast updates, and audit email activity.
                  </p>
                </div>
                <button
                  onClick={fetchEmailLogs}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh Email Audit
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-neutral-500">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      value={emailDraft.to}
                      onChange={(e) => setEmailDraft({ ...emailDraft, to: e.target.value })}
                      placeholder="recipient@example.com"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-neutral-500">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={emailDraft.subject}
                      onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                      placeholder="Important platform update"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-neutral-500">
                      Message Body
                    </label>
                    <textarea
                      value={emailDraft.body}
                      onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                      rows={8}
                      placeholder="Write your announcement or support note here..."
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 text-sm text-white outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleSendEmail(false)}
                      disabled={isSendingEmail}
                      className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50"
                    >
                      {isSendingEmail ? 'Sending...' : 'Send Email'}
                    </button>
                    <button
                      onClick={() => handleSendEmail(true)}
                      disabled={isSendingEmail}
                      className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50"
                    >
                      {isSendingEmail ? 'Broadcasting...' : 'Broadcast to All'}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 min-h-[420px]">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-white">Recent Email Activity</h4>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                      Audit
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                    {emailLogs.length === 0 ? (
                      <div className="text-neutral-500 text-sm">
                        No email activity has been recorded yet.
                      </div>
                    ) : (
                      emailLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-[#111] rounded-2xl p-4 border border-white/5"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-sm font-bold text-white">{log.subject}</p>
                            <span
                              className={cn(
                                'text-[10px] uppercase tracking-widest px-2 py-1 rounded-full',
                                log.status === 'sent'
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-red-500/10 text-red-400'
                              )}
                            >
                              {log.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500">To: {log.recipient}</p>
                          <p className="text-xs text-neutral-500 mt-2">
                            By: {log.adminName || 'Admin'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">Users Registry</h3>
                  <p className="text-sm text-neutral-500">
                    Browse registered users directly from SQLite and manage status, roles, and
                    wallet balances.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={fetchUsers}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={handleExportUsers}
                    className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleBulkUserStatus('suspended')}
                    disabled={bulkActionLoading || !selectedUserIds.length}
                    className="px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Suspend Selected
                  </button>
                  <button
                    onClick={() => handleBulkUserStatus('active')}
                    disabled={bulkActionLoading || !selectedUserIds.length}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Activate Selected
                  </button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr] mb-6">
                <input
                  type="search"
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  placeholder="Search by name, email, or business"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none focus:border-blue-500"
                />
                <select
                  value={usersRoleFilter}
                  onChange={(e) => {
                    setUsersRoleFilter(e.target.value as any);
                    setUsersPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                >
                  <option value="all">All Roles</option>
                  <option value="customer">Customer</option>
                  <option value="trader">Trader</option>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={usersStatusFilter}
                  onChange={(e) => {
                    setUsersStatusFilter(e.target.value as any);
                    setUsersPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <input
                  type="date"
                  value={usersFromDate}
                  onChange={(e) => {
                    setUsersFromDate(e.target.value);
                    setUsersPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={usersToDate}
                  onChange={(e) => {
                    setUsersToDate(e.target.value);
                    setUsersPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                  placeholder="To"
                />
              </div>

              {usersLoading ? (
                <div className="text-center py-16 text-neutral-500">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">No users found.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-neutral-200">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                          <th className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={
                                selectedUserIds.length > 0 &&
                                selectedUserIds.length === users.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds(users.map((user) => user.id));
                                } else {
                                  setSelectedUserIds([]);
                                }
                              }}
                            />
                          </th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Wallet</th>
                          <th className="px-4 py-3">Joined</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={(e) => changeSelectedUsers(user.id, e.target.checked)}
                                className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-white/10 rounded"
                              />
                            </td>
                            <td className="px-4 py-4">{user.name}</td>
                            <td className="px-4 py-4">{user.email}</td>
                            <td className="px-4 py-4 capitalize">{user.role}</td>
                            <td className="px-4 py-4 capitalize">{user.status || 'active'}</td>
                            <td className="px-4 py-4">{formatCurrency(user.walletBalance || 0)}</td>
                            <td className="px-4 py-4">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 space-x-2">
                              <button
                                onClick={() =>
                                  handleUserStatusChange(
                                    user.id,
                                    user.status === 'suspended' ? 'active' : 'suspended'
                                  )
                                }
                                className={cn(
                                  'px-3 py-2 rounded-2xl text-xs font-bold transition-all',
                                  user.status === 'suspended'
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                )}
                              >
                                {user.status === 'suspended' ? 'Activate' : 'Suspend'}
                              </button>
                              <button
                                onClick={() => handleWalletAdjustment(user.id, user.name)}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all"
                              >
                                Wallet
                              </button>
                              <button
                                onClick={() => handleChangeUserRole(user.id, user.role)}
                                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl text-xs font-bold transition-all"
                              >
                                Role
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-4">
                    <p className="text-sm text-neutral-400">
                      Showing {users.length} of {usersTotal} users
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUsersPage((page) => Math.max(page - 1, 1))}
                        disabled={usersPage === 1}
                        className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-neutral-300">
                        Page {usersPage} of {Math.max(1, Math.ceil(usersTotal / usersPageSize))}
                      </span>
                      <button
                        onClick={() => setUsersPage((page) => page + 1)}
                        disabled={usersPage * usersPageSize >= usersTotal}
                        className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}

        {activeTab === 'traders' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Trader Oversight Dashboard</h3>
                  <p className="text-sm text-neutral-500">
                    Monitor trader performance, analytics, and active business engagement.
                  </p>
                </div>
                <button
                  onClick={fetchTraders}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                >
                  Refresh Data
                </button>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <div className="flex flex-wrap gap-3 items-center">
                  <label className="text-sm text-neutral-400">Status</label>
                  <select
                    value={tradersStatusFilter}
                    onChange={(event) => {
                      setTradersStatusFilter(event.target.value as 'all' | 'active' | 'suspended');
                      setTradersPage(1);
                    }}
                    className="bg-[#0a0a0a] border border-white/10 rounded-2xl px-4 py-2 text-white text-sm"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-neutral-400">
                    Showing {traders.length} of {tradersTotal}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Active Traders</span>
                    <Store className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-black text-white">{tradersTotal}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Average Volume</span>
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {traders.length > 0
                      ? formatCurrency(
                          Math.round(
                            traders.reduce(
                              (sum, trader) => sum + (trader.stats?.totalVolume || 0),
                              0
                            ) / traders.length
                          )
                        )
                      : '--'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Total Transactions</span>
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {traders.reduce(
                      (sum, trader) => sum + (trader.stats?.totalTransactions || 0),
                      0
                    )}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Total Fees Collected</span>
                    <DollarSign className="w-4 h-4 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {formatCurrency(
                      traders.reduce((sum, trader) => sum + (trader.fees?.totalCollected || 0), 0)
                    )}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-sm uppercase tracking-[0.25em] text-neutral-500">
                      <th className="pb-3">Trader</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Transactions</th>
                      <th className="pb-3">Volume</th>
                      <th className="pb-3">Customers</th>
                      <th className="pb-3">Fees</th>
                      <th className="pb-3">Verif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traders.map((trader) => (
                      <tr
                        key={trader.id}
                        className="rounded-3xl bg-[#0f0f0f] border border-white/5 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                        onClick={() => openTraderDetailModal(trader)}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">
                            {trader.name || trader.businessName || trader.email}
                          </div>
                          <div className="text-xs text-neutral-500">{trader.email}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-3 py-1 text-[11px] font-semibold',
                              trader.status === 'active'
                                ? 'bg-green-500/10 text-green-300'
                                : 'bg-red-500/10 text-red-300'
                            )}
                          >
                            {trader.status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {trader.stats?.totalTransactions || 0}
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {formatCurrency(trader.stats?.totalVolume || 0)}
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {trader.stats?.totalCustomers || 0}
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {formatCurrency(trader.fees?.totalCollected || 0)}
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-400">
                          {trader.verification?.status || 'unknown'}
                        </td>
                      </tr>
                    ))}
                    {traders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
                          No traders found for the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-4">
                <p className="text-sm text-neutral-400">
                  Showing {traders.length} of {tradersTotal} traders
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTradersPage((page) => Math.max(page - 1, 1))}
                    disabled={tradersPage === 1}
                    className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-neutral-300">
                    Page {tradersPage} of {Math.max(1, Math.ceil(tradersTotal / tradersPageSize))}
                  </span>
                  <button
                    onClick={() => setTradersPage((page) => page + 1)}
                    disabled={tradersPage * tradersPageSize >= tradersTotal}
                    className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'analysts' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Business Analyst Management</h3>
                  <p className="text-sm text-neutral-500">
                    Manage business analysts and their assignments.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={fetchAnalysts}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Refresh Data
                  </button>
                  <button
                    onClick={openCreateAnalystModal}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Create Analyst
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Total Analysts</span>
                    <UserCheck className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-black text-white">{analysts.length}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Active Assignments</span>
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {analysts.reduce((sum, analyst) => sum + (analyst.activeAssignments || 0), 0)}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Avg Experience</span>
                    <Award className="w-4 h-4 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {analysts.length > 0
                      ? Math.round(
                          analysts.reduce(
                            (sum, analyst) => sum + (analyst.experienceYears || 0),
                            0
                          ) / analysts.length
                        )
                      : 0}{' '}
                    years
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">High Priority</span>
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {analysts.reduce(
                      (sum, analyst) => sum + (analyst.highPriorityAssignments || 0),
                      0
                    )}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-sm uppercase tracking-[0.25em] text-neutral-500">
                      <th className="pb-3">Analyst</th>
                      <th className="pb-3">Specialization</th>
                      <th className="pb-3">Experience</th>
                      <th className="pb-3">Active Assignments</th>
                      <th className="pb-3">Certifications</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysts.map((analyst) => (
                      <tr
                        key={analyst.id}
                        className="rounded-3xl bg-[#0f0f0f] border border-white/5"
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{analyst.name}</div>
                          <div className="text-xs text-neutral-500">{analyst.email}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-white">{analyst.specialization}</td>
                        <td className="px-4 py-4 text-sm text-white">
                          {analyst.experienceYears} years
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {analyst.activeAssignments || 0}
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {analyst.certifications?.length > 0
                            ? analyst.certifications.join(', ')
                            : 'None'}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold bg-green-500/10 text-green-300">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                    {analysts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                          {analystsLoading ? 'Loading analysts...' : 'No analysts found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Subscription Management</h3>
                  <p className="text-sm text-neutral-500">
                    Manage trader subscription plans, activation keys, and feature access control.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={fetchSubscriptionPlans}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Refresh Data
                  </button>
                  <button
                    onClick={handleCreateSubscription}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Create Plan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Active Plans</span>
                  <p className="mt-3 text-2xl font-black text-white">{subscriptionPlans.length}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Average Price</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {subscriptionPlans.length > 0
                      ? formatCurrency(
                          Math.round(
                            subscriptionPlans.reduce((sum, plan) => sum + (plan.price || 0), 0) /
                              subscriptionPlans.length
                          )
                        )
                      : '--'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Total Plan Value</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {formatCurrency(
                      subscriptionPlans.reduce((sum, plan) => sum + (plan.price || 0), 0)
                    )}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Last Updated</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {subscriptionPlans.length ? 'Live' : 'None'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-sm uppercase tracking-[0.25em] text-neutral-500">
                      <th className="pb-3">Plan</th>
                      <th className="pb-3">Price</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Features</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionPlans.map((plan) => (
                      <tr key={plan.id} className="rounded-3xl bg-[#0f0f0f] border border-white/5">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{plan.name}</div>
                          <div className="text-xs text-neutral-500">{plan.description}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {formatCurrency(plan.price || 0)}
                        </td>
                        <td className="px-4 py-4 text-sm text-white">
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-400">
                          {Array.isArray(plan.features) ? plan.features.join(', ') : ''}
                        </td>
                        <td className="px-4 py-4 text-sm text-white space-x-2">
                          <button
                            onClick={() => handleUpdateSubscription(plan)}
                            className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => handleDeactivateSubscription(plan.id)}
                            className="px-3 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subscriptionPlans.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                          No subscription plans available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Business Model Control</h3>
                  <p className="text-sm text-neutral-500">
                    Configure dynamic fee structures, subscription pricing, and revenue optimization
                    settings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={fetchBusinessModel}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Refresh Data
                  </button>
                  <button
                    onClick={handleAddDynamicFee}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Add Fee Rule
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-base font-semibold text-white">Platform Wallet</h4>
                      <p className="text-xs text-neutral-500">
                        Money collected by the app from subscriptions, fees and services.
                      </p>
                    </div>
                    <button
                      onClick={refreshPlatformWallet}
                      className="px-3 py-2 rounded-xl bg-white/5 text-neutral-300 text-xs font-bold"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="p-4 rounded-2xl bg-[#111] border border-white/10">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                        Balance
                      </p>
                      <p className="text-xl font-black text-white">
                        {formatCurrency(platformWallet?.balance || 0)}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#111] border border-white/10">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                        Collected
                      </p>
                      <p className="text-xl font-black text-green-400">
                        {formatCurrency(platformWallet?.totalIn || 0)}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#111] border border-white/10">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                        Sent out
                      </p>
                      <p className="text-xl font-black text-orange-400">
                        {formatCurrency(platformWallet?.totalOut || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      value={platformSendForm.recipientId}
                      onChange={(e) =>
                        setPlatformSendForm((prev) => ({ ...prev, recipientId: e.target.value }))
                      }
                      placeholder="Recipient user ID"
                      className="w-full px-3 py-3 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-orange-500"
                    />
                    <input
                      type="number"
                      value={platformSendForm.amount}
                      onChange={(e) =>
                        setPlatformSendForm((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      placeholder="Amount RWF"
                      className="w-full px-3 py-3 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-orange-500"
                    />
                    <input
                      value={platformSendForm.description}
                      onChange={(e) =>
                        setPlatformSendForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Reason"
                      className="w-full px-3 py-3 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={handleSendPlatformMoney}
                      disabled={platformSendLoading}
                      className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold disabled:opacity-50"
                    >
                      {platformSendLoading ? 'Sending...' : 'Send Platform Money'}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <h4 className="text-base font-semibold text-white mb-4">
                    App Collection History
                  </h4>
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {(platformWalletHistory || []).map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-2xl bg-[#111] border border-white/10 p-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{item.description}</p>
                          <p className="text-[10px] text-neutral-500">
                            {item.type} • {item.userName || item.userId || 'Platform'} •{' '}
                            {new Date(item.updatedAt || item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p
                          className={cn(
                            'text-sm font-black whitespace-nowrap',
                            item.direction === 'in' ? 'text-green-400' : 'text-orange-400'
                          )}
                        >
                          {item.direction === 'in' ? '+' : '-'}
                          {formatCurrency(item.amount || 0)}
                        </p>
                      </div>
                    ))}
                    {(platformWalletHistory || []).length === 0 && (
                      <p className="text-sm text-neutral-500">No platform collections yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">30d Fee Total</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {businessModel ? formatCurrency(businessModel.feeStats?.totalFees || 0) : '--'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Transaction Count</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {businessModel ? businessModel.feeStats?.transactionCount || 0 : '--'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Average Fee</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {businessModel
                      ? formatCurrency(Math.round(businessModel.feeStats?.averageFee || 0))
                      : '--'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Revenue Projection</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {businessModel
                      ? formatCurrency(businessModel.revenueProjection?.monthly || 0)
                      : '--'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Loan Interest 30d</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {formatCurrency(businessModel?.loanStats?.interestIncome30d || 0)}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Principal Disbursed</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {formatCurrency(businessModel?.loanStats?.principalDisbursed || 0)}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Loyalty Liability</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {formatCurrency(businessModel?.loyaltyLiability?.value || 0)}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <span className="text-sm text-neutral-500">Referral Cost 30d</span>
                  <p className="mt-3 text-2xl font-black text-white">
                    {formatCurrency(businessModel?.referralCost30d || 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-base font-semibold text-white">Loan Policy</h4>
                      <p className="text-xs text-neutral-500">
                        Autoloan limits, APR, scoring thresholds and repayment risk controls.
                      </p>
                    </div>
                    <span className="text-xs text-neutral-500">v{loanPolicy?.version || 0}</span>
                  </div>
                  {loanPolicy && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        ['minLoanAmount', 'Minimum loan'],
                        ['maxLoanAmount', 'Maximum loan'],
                        ['autoApprovalMaxAmount', 'Auto max'],
                        ['dailyDisbursementLimit', 'Daily limit'],
                        ['userExposureLimit', 'User exposure'],
                        ['baseApr', 'Base APR'],
                        ['premiumApr', 'Premium APR'],
                        ['autoApproveScore', 'Approve score'],
                        ['manualReviewScore', 'Review score'],
                        ['graceDays', 'Grace days'],
                        ['processingFeePercent', 'Processing %'],
                        ['processingFeeMax', 'Processing cap'],
                      ].map(([key, label]) => (
                        <label key={key} className="space-y-1">
                          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                            {label}
                          </span>
                          <input
                            type="number"
                            value={loanPolicy[key] ?? ''}
                            onChange={(e) =>
                              setLoanPolicy({ ...loanPolicy, [key]: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-orange-500"
                          />
                        </label>
                      ))}
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-white/10">
                        <input
                          type="checkbox"
                          checked={Boolean(loanPolicy.autoDisbursementEnabled)}
                          onChange={(e) =>
                            setLoanPolicy({
                              ...loanPolicy,
                              autoDisbursementEnabled: e.target.checked,
                            })
                          }
                        />
                        <span className="text-sm text-white">Auto disbursement</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-white/10">
                        <input
                          type="checkbox"
                          checked={Boolean(loanPolicy.overdueLoanLockEnabled)}
                          onChange={(e) =>
                            setLoanPolicy({ ...loanPolicy, overdueLoanLockEnabled: e.target.checked })
                          }
                        />
                        <span className="text-sm text-white">Overdue loan lock</span>
                      </label>
                    </div>
                  )}
                  <button
                    onClick={saveLoanPolicy}
                    disabled={policySaving || !loanPolicy}
                    className="mt-4 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-sm font-bold disabled:opacity-50"
                  >
                    Save Loan Policy
                  </button>
                </div>

                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-base font-semibold text-white">Loyalty Policy</h4>
                      <p className="text-xs text-neutral-500">
                        Point value, earn rates, referral rewards and fee-only redemption.
                      </p>
                    </div>
                    <span className="text-xs text-neutral-500">v{loyaltyPolicy?.version || 0}</span>
                  </div>
                  {loyaltyPolicy && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        ['pointValueRwf', 'Point value RWF'],
                        ['purchaseEarnPerRwf', 'Earn per RWF'],
                        ['premiumMultiplier', 'Premium multiplier'],
                        ['referredUserBonus', 'Referred bonus'],
                        ['referrerQualifiedBonus', 'Referrer bonus'],
                        ['onTimeLoanRepaymentMin', 'Repay bonus min'],
                        ['onTimeLoanRepaymentMax', 'Repay bonus max'],
                        ['minRedeemPoints', 'Minimum redeem'],
                        ['expiryDays', 'Expiry days'],
                      ].map(([key, label]) => (
                        <label key={key} className="space-y-1">
                          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                            {label}
                          </span>
                          <input
                            type="number"
                            value={loyaltyPolicy[key] ?? ''}
                            onChange={(e) =>
                              setLoyaltyPolicy({
                                ...loyaltyPolicy,
                                [key]: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-orange-500"
                          />
                        </label>
                      ))}
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-white/10">
                        <input
                          type="checkbox"
                          checked={Boolean(loyaltyPolicy.allowFeePaymentWithPoints)}
                          onChange={(e) =>
                            setLoyaltyPolicy({
                              ...loyaltyPolicy,
                              allowFeePaymentWithPoints: e.target.checked,
                            })
                          }
                        />
                        <span className="text-sm text-white">Points pay fees only</span>
                      </label>
                    </div>
                  )}
                  <button
                    onClick={saveLoyaltyPolicy}
                    disabled={policySaving || !loyaltyPolicy}
                    className="mt-4 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-sm font-bold disabled:opacity-50"
                  >
                    Save Loyalty Policy
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <h4 className="text-base font-semibold text-white mb-4">Revenue by Fee Type</h4>
                  <div className="space-y-3">
                    {(businessModel?.feeBreakdown || []).map((item: any) => (
                      <div key={item.feeType} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{item.feeType}</p>
                          <p className="text-xs text-neutral-500">{item.count} collections</p>
                        </div>
                        <p className="text-sm font-black text-green-400">
                          {formatCurrency(item.totalFees || 0)}
                        </p>
                      </div>
                    ))}
                    {(businessModel?.feeBreakdown || []).length === 0 && (
                      <p className="text-sm text-neutral-500">
                        No fee revenue recorded in the last 30 days.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <h4 className="text-base font-semibold text-white mb-4">Collection Pipeline</h4>
                  <div className="space-y-3">
                    {(businessModel?.collectionPipeline || []).map((item: any) => (
                      <div key={item.status} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white capitalize">{item.status}</p>
                          <p className="text-xs text-neutral-500">{item.count} payment intents</p>
                        </div>
                        <p className="text-sm font-black text-blue-400">
                          {formatCurrency(item.amount || 0)}
                        </p>
                      </div>
                    ))}
                    {(businessModel?.collectionPipeline || []).length === 0 && (
                      <p className="text-sm text-neutral-500">
                        No external payment intents recorded yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <h4 className="text-base font-semibold text-white mb-4">Revenue Accounts</h4>
                  <div className="space-y-3">
                    {(businessModel?.revenueAccounts || []).map((account: any) => (
                      <div key={account.code} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{account.name}</p>
                          <p className="text-xs text-neutral-500 capitalize">
                            {account.accountType}
                          </p>
                        </div>
                        <p className="text-sm font-black text-neutral-300">
                          {formatCurrency(account.balance || 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="overflow-x-auto bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <h4 className="text-base font-semibold text-white mb-4">Dynamic Fees</h4>
                  <table className="min-w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-sm uppercase tracking-[0.25em] text-neutral-500">
                        <th className="pb-3">Type</th>
                        <th className="pb-3">%</th>
                        <th className="pb-3">Fixed</th>
                        <th className="pb-3">Conditions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessModel?.dynamicFees?.map((rule: any) => (
                        <tr
                          key={rule.id}
                          className="rounded-3xl bg-[#0f0f0f] border border-white/5"
                        >
                          <td className="px-4 py-4 text-sm text-white">{rule.fee_type}</td>
                          <td className="px-4 py-4 text-sm text-white">{rule.percentage}%</td>
                          <td className="px-4 py-4 text-sm text-white">
                            {formatCurrency(rule.fixed_amount || 0)}
                          </td>
                          <td className="px-4 py-4 text-sm text-neutral-400">
                            {rule.conditions ? JSON.stringify(rule.conditions) : '-'}
                          </td>
                        </tr>
                      ))}
                      {businessModel?.dynamicFees?.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-10 text-center text-sm text-neutral-500"
                          >
                            No active dynamic fee rules found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto bg-[#0a0a0a] rounded-3xl border border-white/5 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <h4 className="text-base font-semibold text-white">
                      Active Subscription Pricing
                    </h4>
                    <span className="text-sm text-neutral-400">
                      Update prices directly from this list.
                    </span>
                  </div>
                  <table className="min-w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-sm uppercase tracking-[0.25em] text-neutral-500">
                        <th className="pb-3">Plan</th>
                        <th className="pb-3">Price</th>
                        <th className="pb-3">Details</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessModel?.subscriptions?.map((plan: any) => (
                        <tr
                          key={plan.id}
                          className="rounded-3xl bg-[#0f0f0f] border border-white/5"
                        >
                          <td className="px-4 py-4 text-sm text-white">{plan.name}</td>
                          <td className="px-4 py-4 text-sm text-white">
                            {formatCurrency(plan.price || 0)}
                          </td>
                          <td className="px-4 py-4 text-sm text-neutral-400">
                            {plan.description
                              ? plan.description
                              : Array.isArray(plan.features)
                                ? plan.features.join(', ')
                                : '-'}
                          </td>
                          <td className="px-4 py-4 space-x-2">
                            <button
                              onClick={() => handleUpdateFeePricing(plan)}
                              className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs"
                            >
                              Update Price
                            </button>
                          </td>
                        </tr>
                      ))}
                      {businessModel?.subscriptions?.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-10 text-center text-sm text-neutral-500"
                          >
                            No active subscription pricing found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">Transactions Feed</h3>
                  <p className="text-sm text-neutral-500">
                    Review recent transactions from SQLite and perform corrections.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={fetchTransactionsList}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Refresh Feed
                  </button>
                  <button
                    onClick={handleExportTransactions}
                    className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr] mb-6">
                <input
                  type="search"
                  value={transactionsSearch}
                  onChange={(e) => setTransactionsSearch(e.target.value)}
                  placeholder="Search by user, description, or ID"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none focus:border-blue-500"
                />
                <select
                  value={transactionsStatusFilter}
                  onChange={(e) => {
                    setTransactionsStatusFilter(e.target.value as any);
                    setTransactionsPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                <input
                  type="date"
                  value={transactionsFromDate}
                  onChange={(e) => {
                    setTransactionsFromDate(e.target.value);
                    setTransactionsPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                />
                <input
                  type="date"
                  value={transactionsToDate}
                  onChange={(e) => {
                    setTransactionsToDate(e.target.value);
                    setTransactionsPage(1);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white"
                />
              </div>

              {transactionsLoading ? (
                <div className="text-center py-16 text-neutral-500">Loading transactions...</div>
              ) : transactionsList.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">No transactions available.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-neutral-200">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionsList.map((tx) => (
                          <tr key={tx.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-4">{tx.name || tx.email || tx.userId}</td>
                            <td className="px-4 py-4 capitalize">{tx.type}</td>
                            <td className="px-4 py-4">{formatCurrency(tx.amount)}</td>
                            <td className="px-4 py-4 capitalize">{tx.status}</td>
                            <td className="px-4 py-4">{new Date(tx.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => handleCorrectTransaction(tx.id)}
                                className="mr-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-bold transition-all"
                              >
                                Correct
                              </button>
                              {tx.status !== 'refunded' && (
                                <button
                                  onClick={() => handleRefundTransaction(tx.id)}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all"
                                >
                                  Refund
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-4">
                    <p className="text-sm text-neutral-400">
                      Showing {transactionsList.length} of {transactionsTotal} transactions
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTransactionsPage((page) => Math.max(page - 1, 1))}
                        disabled={transactionsPage === 1}
                        className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-neutral-300">
                        Page {transactionsPage} of{' '}
                        {Math.max(1, Math.ceil(transactionsTotal / transactionsPageSize))}
                      </span>
                      <button
                        onClick={() => setTransactionsPage((page) => page + 1)}
                        disabled={transactionsPage * transactionsPageSize >= transactionsTotal}
                        className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col xl:flex-row justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Database Control</h3>
                  <p className="text-sm text-neutral-500">
                    Inspect table counts, view rows, and manage system config directly from SQLite.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={refreshSystemTabData}
                    className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh Database
                  </button>
                  <button
                    onClick={handleDownloadDatabaseBackup}
                    className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    <Database className="w-4 h-4" /> Download Backup
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_0.6fr] gap-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(databaseStats).map(([name, count]) => (
                      <div
                        key={name}
                        className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-neutral-500">
                              {name}
                            </p>
                            <p className="text-2xl font-black text-white">{count}</p>
                          </div>
                          <span className="text-xs text-neutral-400">Rows</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/10">
                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                      <div>
                        <h4 className="text-base font-black text-white">Table Audit</h4>
                        <p className="text-sm text-neutral-500">
                          Select a SQLite table to inspect recent rows.
                        </p>
                      </div>
                      <select
                        value={selectedDbTable}
                        onChange={(e) => setSelectedDbTable(e.target.value)}
                        className="bg-[#070707] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                      >
                        <option value="users">users</option>
                        <option value="transactions">transactions</option>
                        <option value="transaction_fees">transaction_fees</option>
                        <option value="revenue_accounts">revenue_accounts</option>
                        <option value="ledger_entries">ledger_entries</option>
                        <option value="payment_intents">payment_intents</option>
                        <option value="agent_commissions">agent_commissions</option>
                        <option value="agent_settlements">agent_settlements</option>
                        <option value="subscriptions">subscriptions</option>
                        <option value="trader_subscriptions">trader_subscriptions</option>
                        <option value="tickets">tickets</option>
                        <option value="ticket_messages">ticket_messages</option>
                        <option value="system_logs">system_logs</option>
                        <option value="email_logs">email_logs</option>
                        <option value="system_config">system_config</option>
                      </select>
                    </div>

                    {dbLoading ? (
                      <div className="text-center py-12 text-neutral-500">
                        Loading table rows...
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                        <table className="min-w-full text-left text-sm text-neutral-200">
                          <thead>
                            <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                              {dbDocuments[0] &&
                                Object.keys(dbDocuments[0])
                                  .slice(0, 6)
                                  .map((column) => (
                                    <th key={column} className="px-4 py-3">
                                      {column}
                                    </th>
                                  ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dbDocuments.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-neutral-500">
                                  No documents found for this table.
                                </td>
                              </tr>
                            ) : (
                              dbDocuments.map((row, index) => (
                                <tr
                                  key={`${row.id || index}-${index}`}
                                  className="border-b border-white/10 hover:bg-white/5"
                                >
                                  {Object.values(row)
                                    .slice(0, 6)
                                    .map((value, cellIndex) => (
                                      <td
                                        key={`${index}-${cellIndex}`}
                                        className="px-4 py-3 max-w-[200px] truncate"
                                      >
                                        {typeof value === 'object'
                                          ? JSON.stringify(value)
                                          : String(value ?? '')}
                                      </td>
                                    ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-base font-black text-white">System Config</h4>
                        <p className="text-sm text-neutral-500">
                          Current platform settings stored in SQLite.
                        </p>
                      </div>
                      <button
                        onClick={fetchSystemConfig}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all"
                      >
                        Refresh
                      </button>
                    </div>
                    {systemConfigLoading ? (
                      <div className="text-center py-8 text-neutral-500">Loading config...</div>
                    ) : !systemConfig ? (
                      <div className="text-neutral-500 text-sm">No config loaded.</div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-neutral-400">
                          <span>Maintenance Mode</span>
                          <span className="font-semibold text-white">
                            {systemConfig.maintenanceMode ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Registration Open</span>
                          <span className="font-semibold text-white">
                            {systemConfig.registrationOpen ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Free Fee</span>
                          <span className="font-semibold text-white">
                            {systemConfig.globalFees?.free ?? 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Premium Fee</span>
                          <span className="font-semibold text-white">
                            {systemConfig.globalFees?.premium ?? 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Broadcast Message</span>
                          <span className="max-w-[180px] truncate font-semibold text-white">
                            {systemConfig.broadcast || 'None'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleMaintenanceToggle(!systemConfig.maintenanceMode)}
                          className={cn(
                            'w-full py-3 rounded-2xl font-bold transition-all',
                            systemConfig.maintenanceMode
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-orange-600 hover:bg-orange-700 text-white'
                          )}
                        >
                          {systemConfig.maintenanceMode
                            ? 'Disable Maintenance Mode'
                            : 'Enable Maintenance Mode'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">System Logs</h3>
                  <p className="text-sm text-neutral-500">
                    Review audit and system events in real time from SQLite.
                  </p>
                </div>
                <button
                  onClick={fetchSystemLogs}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh Logs
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <label className="text-xs uppercase tracking-widest text-neutral-500">
                    Level
                  </label>
                  <select
                    value={logFilterLevel}
                    onChange={(e) => setLogFilterLevel(e.target.value as any)}
                    className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  >
                    <option value="all">All</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs uppercase tracking-widest text-neutral-500">
                    Source
                  </label>
                  <input
                    type="text"
                    value={logFilterSource}
                    onChange={(e) => setLogFilterSource(e.target.value)}
                    placeholder="e.g. api, email, admin-action"
                    className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-neutral-200">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-neutral-500">
                          Loading logs...
                        </td>
                      </tr>
                    ) : systemLogs.filter((log) => {
                        const levelMatches =
                          logFilterLevel === 'all' || log.level === logFilterLevel;
                        const sourceMatches =
                          logFilterSource === 'all' || log.source?.includes(logFilterSource);
                        return levelMatches && sourceMatches;
                      }).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-neutral-500">
                          No logs match the current filters.
                        </td>
                      </tr>
                    ) : (
                      systemLogs
                        .filter((log) => {
                          const levelMatches =
                            logFilterLevel === 'all' || log.level === logFilterLevel;
                          const sourceMatches =
                            logFilterSource === 'all' || log.source?.includes(logFilterSource);
                          return levelMatches && sourceMatches;
                        })
                        .map((log) => (
                          <tr key={log.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-4">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-4 capitalize">{log.level}</td>
                            <td className="px-4 py-4 capitalize">{log.source}</td>
                            <td className="px-4 py-4 max-w-[420px] truncate">{log.message}</td>
                            <td className="px-4 py-4">{log.adminName || log.userId || 'system'}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'surveys' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl p-6 border border-white/5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Survey Analytics & Management</h3>
                  <p className="text-sm text-neutral-500">
                    Monitor onboarding survey responses, manage questions, and analyze user
                    preferences for platform growth insights.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setSurveyPage(1);
                      fetchSurveyQuestions();
                      fetchSurveyResponses();
                    }}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Refresh Data
                  </button>
                  <button
                    onClick={() => openSurveyQuestionModal('create')}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Add Question
                  </button>
                  <button
                    onClick={handleExportSurveyResponses}
                    className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Active Questions</span>
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-black text-white">{surveyQuestions.length}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Total Responses</span>
                    <Users className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-black text-white">{surveyTotal}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">Response Rate</span>
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-black text-white">
                    {surveyQuestions.length > 0
                      ? Math.round((surveyTotal / surveyQuestions.length) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10">
                    <h4 className="text-base font-semibold text-white">Survey Questions</h4>
                    <p className="text-sm text-neutral-500">
                      Manage onboarding survey questions and their configurations.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-neutral-200">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                          <th className="px-4 py-3">Question</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Required</th>
                          <th className="px-4 py-3">Order</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveyLoading ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                              Loading questions...
                            </td>
                          </tr>
                        ) : surveyQuestions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                              No survey questions found.
                            </td>
                          </tr>
                        ) : (
                          surveyQuestions.map((question) => (
                            <tr
                              key={question.id}
                              className="border-b border-white/10 hover:bg-white/5"
                            >
                              <td className="px-4 py-4 max-w-xs truncate">{question.question}</td>
                              <td className="px-4 py-4 capitalize">
                                {question.questionType.replace('_', ' ')}
                              </td>
                              <td className="px-4 py-4">{question.required ? 'Yes' : 'No'}</td>
                              <td className="px-4 py-4">{question.orderIndex}</td>
                              <td className="px-4 py-4 space-x-2">
                                <button
                                  onClick={() => openSurveyQuestionModal('edit', question)}
                                  className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteSurveyQuestion(question.id)}
                                  className="px-3 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10">
                    <h4 className="text-base font-semibold text-white">Recent Responses</h4>
                    <p className="text-sm text-neutral-500">
                      Latest survey responses from users during onboarding.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-neutral-200">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                          <th className="px-4 py-3">Question</th>
                          <th className="px-4 py-3">Response</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveyResponsesLoading ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                              Loading responses...
                            </td>
                          </tr>
                        ) : surveyResponses.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                              No survey responses found.
                            </td>
                          </tr>
                        ) : (
                          surveyResponses.slice(0, 10).map((response) => (
                            <tr
                              key={response.id}
                              className="border-b border-white/10 hover:bg-white/5"
                            >
                              <td className="px-4 py-4 max-w-xs truncate">{response.question}</td>
                              <td className="px-4 py-4 max-w-xs truncate">
                                {response.responseLabel}
                              </td>
                              <td className="px-4 py-4">
                                {response.userName || response.userEmail}
                              </td>
                              <td className="px-4 py-4">
                                {new Date(response.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-6 py-4 border-t border-white/10">
                    <p className="text-sm text-neutral-400">
                      Showing {surveyResponses.length} of {surveyTotal} responses
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSurveyPage((page) => Math.max(page - 1, 1))}
                        disabled={surveyPage === 1}
                        className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-neutral-300">
                        Page {surveyPage} of {Math.max(1, Math.ceil(surveyTotal / 25))}
                      </span>
                      <button
                        onClick={() => setSurveyPage((page) => page + 1)}
                        disabled={surveyPage * 25 >= surveyTotal}
                        className="px-3 py-2 rounded-2xl border border-white/10 text-sm text-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'dashboard' &&
          activeTab !== 'health' &&
          activeTab !== 'traders' &&
          activeTab !== 'analysts' &&
          activeTab !== 'subscriptions' &&
          activeTab !== 'fees' &&
          activeTab !== 'screening' &&
          activeTab !== 'security' &&
          activeTab !== 'verification' &&
          activeTab !== 'users' &&
          activeTab !== 'transactions' &&
          activeTab !== 'support' &&
          activeTab !== 'email' &&
          activeTab !== 'database' &&
          activeTab !== 'logs' &&
          activeTab !== 'surveys' && (
            <div className="bg-[#111] rounded-2xl p-12 border border-white/5 text-center">
              <Settings className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-xl font-black text-white mb-2">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <p className="text-neutral-500">This section is under development</p>
            </div>
          )}

        {showSubscriptionModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">
                    {subscriptionModalMode === 'create'
                      ? 'Create Subscription Plan'
                      : 'Edit Subscription Plan'}
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Use structured details to manage plan pricing and limits.
                  </p>
                </div>
                <button
                  onClick={closeSubscriptionModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Plan Name</label>
                  <input
                    type="text"
                    value={subscriptionForm.name}
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Description</label>
                  <textarea
                    value={subscriptionForm.description}
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">Price (RWF)</label>
                    <input
                      type="number"
                      value={subscriptionForm.price}
                      onChange={(e) =>
                        setSubscriptionForm((prev) => ({ ...prev, price: e.target.value }))
                      }
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">Features</label>
                    <input
                      type="text"
                      value={subscriptionForm.features}
                      onChange={(e) =>
                        setSubscriptionForm((prev) => ({ ...prev, features: e.target.value }))
                      }
                      placeholder="Comma separated"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Limits (JSON)</label>
                  <textarea
                    value={subscriptionForm.limits}
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({ ...prev, limits: e.target.value }))
                    }
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none font-mono"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="subscription-active"
                    type="checkbox"
                    checked={subscriptionForm.is_active}
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="h-4 w-4 text-orange-600 border-white/10 rounded"
                  />
                  <label htmlFor="subscription-active" className="text-sm text-neutral-400">
                    Plan is active
                  </label>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-white/10">
                <button
                  onClick={submitSubscriptionModal}
                  disabled={subscriptionModalLoading}
                  className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold transition-all disabled:opacity-50"
                >
                  {subscriptionModalLoading
                    ? 'Saving...'
                    : subscriptionModalMode === 'create'
                      ? 'Create Plan'
                      : 'Save Changes'}
                </button>
                <button
                  onClick={closeSubscriptionModal}
                  className="flex-1 px-4 py-3 border border-white/10 text-white rounded-2xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showSurveyQuestionModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">
                    {surveyQuestionModalMode === 'create'
                      ? 'Create Survey Question'
                      : 'Edit Survey Question'}
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Manage onboarding survey questions used for user growth analytics.
                  </p>
                </div>
                <button
                  onClick={closeSurveyQuestionModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Question Text</label>
                  <textarea
                    value={surveyQuestionForm.question}
                    onChange={(e) =>
                      setSurveyQuestionForm((prev) => ({ ...prev, question: e.target.value }))
                    }
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">Question Type</label>
                    <select
                      value={surveyQuestionForm.questionType}
                      onChange={(e) =>
                        setSurveyQuestionForm((prev) => ({ ...prev, questionType: e.target.value }))
                      }
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="multiple_choice">Multiple Choice</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="survey-question-required"
                      type="checkbox"
                      checked={surveyQuestionForm.required}
                      onChange={(e) =>
                        setSurveyQuestionForm((prev) => ({ ...prev, required: e.target.checked }))
                      }
                      className="h-4 w-4 text-orange-600 border-white/10 rounded"
                    />
                    <label htmlFor="survey-question-required" className="text-sm text-neutral-400">
                      Required
                    </label>
                  </div>
                </div>
                {surveyQuestionForm.questionType === 'multiple_choice' && (
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">
                      Options (comma separated)
                    </label>
                    <input
                      type="text"
                      value={surveyQuestionForm.options.join(', ')}
                      onChange={(e) =>
                        setSurveyQuestionForm((prev) => ({
                          ...prev,
                          options: e.target.value
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                      Enter choices separated by commas. Example: Market, Retail, Wholesale
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Order Index</label>
                  <input
                    type="number"
                    value={surveyQuestionForm.orderIndex}
                    onChange={(e) =>
                      setSurveyQuestionForm((prev) => ({
                        ...prev,
                        orderIndex: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-white/10">
                <button
                  onClick={submitSurveyQuestionModal}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all"
                >
                  Save Question
                </button>
                <button
                  onClick={closeSurveyQuestionModal}
                  className="flex-1 px-4 py-3 border border-white/10 text-white rounded-2xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showTraderDetailModal && selectedTrader && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-6xl bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Trader Details:{' '}
                    {selectedTrader.name || selectedTrader.businessName || selectedTrader.email}
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Comprehensive analytics and management for this trader.
                  </p>
                </div>
                <button
                  onClick={closeTraderDetailModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>

              {traderDetailLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
                  <p className="text-neutral-400">Loading trader details...</p>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Trader Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-500">Status</span>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                            selectedTrader.status === 'active'
                              ? 'bg-green-500/10 text-green-300'
                              : 'bg-red-500/10 text-red-300'
                          )}
                        >
                          {selectedTrader.status || 'active'}
                        </span>
                      </div>
                      <p className="text-lg font-black text-white">{selectedTrader.email}</p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-500">Total Transactions</span>
                        <Activity className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-2xl font-black text-white">
                        {traderAnalytics?.totalTransactions || 0}
                      </p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-500">Total Volume</span>
                        <TrendingUp className="w-4 h-4 text-orange-500" />
                      </div>
                      <p className="text-2xl font-black text-white">
                        {formatCurrency(traderAnalytics?.totalVolume || 0)}
                      </p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-500">Fees Collected</span>
                        <DollarSign className="w-4 h-4 text-yellow-500" />
                      </div>
                      <p className="text-2xl font-black text-white">
                        {formatCurrency(traderAnalytics?.feesCollected || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Analytics Charts */}
                  {traderAnalytics?.charts && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/5">
                        <h4 className="text-lg font-bold text-white mb-4">
                          Transaction Volume (Last 30 Days)
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={traderAnalytics.charts.volumeData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#888" />
                            <YAxis stroke="#888" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#111',
                                border: '1px solid #333',
                                borderRadius: '8px',
                              }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="volume"
                              stroke="#f97316"
                              fill="#f97316"
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/5">
                        <h4 className="text-lg font-bold text-white mb-4">
                          Transaction Count (Last 30 Days)
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={traderAnalytics.charts.transactionData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#888" />
                            <YAxis stroke="#888" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#111',
                                border: '1px solid #333',
                                borderRadius: '8px',
                              }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#3b82f6"
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Subscription & Assignments */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Subscription */}
                    <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/5">
                      <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Current Subscription
                      </h4>
                      {traderSubscription ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Plan:</span>
                            <span className="text-white font-semibold">
                              {traderSubscription.name}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Price:</span>
                            <span className="text-white font-semibold">
                              {formatCurrency(traderSubscription.price)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Auto Renew:</span>
                            <span
                              className={cn(
                                'font-semibold',
                                traderSubscription.autoRenew ? 'text-green-400' : 'text-red-400'
                              )}
                            >
                              {traderSubscription.autoRenew ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Expires:</span>
                            <span className="text-white font-semibold">
                              {new Date(traderSubscription.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-4 space-y-3">
                            <select
                              value={traderSubscriptionForm.subscriptionId}
                              onChange={(event) =>
                                setTraderSubscriptionForm((prev) => ({
                                  ...prev,
                                  subscriptionId: event.target.value,
                                }))
                              }
                              className="w-full bg-[#111] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                            >
                              <option value="">Choose subscription plan...</option>
                              {subscriptionPlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name} - {formatCurrency(plan.price)}
                                </option>
                              ))}
                            </select>
                            <label className="flex items-center gap-3 text-sm text-neutral-300">
                              <input
                                type="checkbox"
                                checked={traderSubscriptionForm.autoRenew}
                                onChange={(event) =>
                                  setTraderSubscriptionForm((prev) => ({
                                    ...prev,
                                    autoRenew: event.target.checked,
                                  }))
                                }
                                className="h-4 w-4 text-blue-600 border-white/10 rounded"
                              />
                              Auto renew this plan
                            </label>
                            <button
                              onClick={() =>
                                handleUpdateTraderSubscription(
                                  traderSubscriptionForm.subscriptionId,
                                  traderSubscriptionForm.autoRenew
                                )
                              }
                              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                            >
                              Update Subscription
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-neutral-500">No active subscription</p>
                          <select
                            value={traderSubscriptionForm.subscriptionId}
                            onChange={(event) =>
                              setTraderSubscriptionForm((prev) => ({
                                ...prev,
                                subscriptionId: event.target.value,
                              }))
                            }
                            className="w-full bg-[#111] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                          >
                            <option value="">Choose subscription plan...</option>
                            {subscriptionPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} - {formatCurrency(plan.price)}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              handleUpdateTraderSubscription(
                                traderSubscriptionForm.subscriptionId,
                                traderSubscriptionForm.autoRenew
                              )
                            }
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all"
                          >
                            Assign Subscription
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Analyst Assignments */}
                    <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/5">
                      <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <UserCheck className="w-5 h-5" />
                        Analyst Assignments
                      </h4>
                      {traderAssignments.length > 0 ? (
                        <div className="space-y-3">
                          {traderAssignments.map((assignment: any) => (
                            <div
                              key={assignment.id}
                              className="bg-[#0f0f0f] rounded-xl p-3 border border-white/5"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-white font-semibold">
                                  {assignment.analystName}
                                </span>
                                <span
                                  className={cn(
                                    'text-xs px-2 py-1 rounded-full font-semibold',
                                    assignment.priority === 'high'
                                      ? 'bg-red-500/10 text-red-300'
                                      : assignment.priority === 'medium'
                                        ? 'bg-yellow-500/10 text-yellow-300'
                                        : 'bg-green-500/10 text-green-300'
                                  )}
                                >
                                  {assignment.priority}
                                </span>
                              </div>
                              <p className="text-sm text-neutral-400 mb-2">
                                {assignment.requirements}
                              </p>
                              <p className="text-xs text-neutral-500">
                                Assigned: {new Date(assignment.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-neutral-500 mb-4">No analyst assignments</p>
                      )}
                      <button
                        onClick={openAssignAnalystModal}
                        className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition-all"
                      >
                        Assign Analyst
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={openAssignAnalystModal}
                      className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      Assign Analyst
                    </button>
                    <button
                      onClick={openActivationKeyModal}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Generate Activation Key
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateTraderSubscription(
                          traderSubscriptionForm.subscriptionId,
                          traderSubscriptionForm.autoRenew
                        )
                      }
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <Package className="w-4 h-4" />
                      Update Subscription
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assign Analyst Modal */}
        {showAssignAnalystModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">Assign Business Analyst</h3>
                  <p className="text-sm text-neutral-400">
                    Select an analyst and specify requirements.
                  </p>
                </div>
                <button
                  onClick={closeAssignAnalystModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Select Analyst</label>
                  <select
                    value={assignAnalystForm.analystId}
                    onChange={(e) =>
                      setAssignAnalystForm((prev) => ({ ...prev, analystId: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  >
                    <option value="">Choose an analyst...</option>
                    {analystList.map((analyst: any) => (
                      <option key={analyst.id} value={analyst.id}>
                        {analyst.name} - {analyst.specialization}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Priority</label>
                  <select
                    value={assignAnalystForm.priority}
                    onChange={(e) =>
                      setAssignAnalystForm((prev) => ({
                        ...prev,
                        priority: e.target.value as 'low' | 'medium' | 'high',
                      }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Requirements</label>
                  <textarea
                    value={assignAnalystForm.requirements}
                    onChange={(e) =>
                      setAssignAnalystForm((prev) => ({ ...prev, requirements: e.target.value }))
                    }
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none resize-none"
                    placeholder="Describe the analysis requirements..."
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-white/10">
                <button
                  onClick={submitAssignAnalyst}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all"
                >
                  Assign Analyst
                </button>
                <button
                  onClick={closeAssignAnalystModal}
                  className="flex-1 px-4 py-3 border border-white/10 text-white rounded-2xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activation Key Modal */}
        {showActivationKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">Generate Activation Key</h3>
                  <p className="text-sm text-neutral-400">
                    Create a feature activation key for this trader.
                  </p>
                </div>
                <button
                  onClick={closeActivationKeyModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Feature</label>
                  <input
                    type="text"
                    value={activationKeyForm.feature}
                    onChange={(e) =>
                      setActivationKeyForm((prev) => ({ ...prev, feature: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    placeholder="e.g., premium_features, advanced_analytics"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Expiration (Days)</label>
                  <input
                    type="number"
                    value={activationKeyForm.expiresInDays}
                    onChange={(e) =>
                      setActivationKeyForm((prev) => ({
                        ...prev,
                        expiresInDays: Number(e.target.value),
                      }))
                    }
                    min="1"
                    max="365"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-white/10">
                <button
                  onClick={submitActivationKey}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold transition-all"
                >
                  Generate Key
                </button>
                <button
                  onClick={closeActivationKeyModal}
                  className="flex-1 px-4 py-3 border border-white/10 text-white rounded-2xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Analyst Modal */}
        {showCreateAnalystModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">Create Business Analyst</h3>
                  <p className="text-sm text-neutral-400">
                    Add a new business analyst to the system.
                  </p>
                </div>
                <button
                  onClick={closeCreateAnalystModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">User ID</label>
                  <input
                    type="text"
                    value={createAnalystForm.userId}
                    onChange={(e) =>
                      setCreateAnalystForm((prev) => ({ ...prev, userId: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    placeholder="Enter the user ID"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Specialization</label>
                  <input
                    type="text"
                    value={createAnalystForm.specialization}
                    onChange={(e) =>
                      setCreateAnalystForm((prev) => ({ ...prev, specialization: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    placeholder="e.g., Financial Analysis, Market Research"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Experience (Years)</label>
                  <input
                    type="number"
                    value={createAnalystForm.experienceYears}
                    onChange={(e) =>
                      setCreateAnalystForm((prev) => ({
                        ...prev,
                        experienceYears: Number(e.target.value),
                      }))
                    }
                    min="0"
                    max="50"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Certifications</label>
                  <input
                    type="text"
                    value={createAnalystForm.certifications}
                    onChange={(e) =>
                      setCreateAnalystForm((prev) => ({ ...prev, certifications: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    placeholder="Comma separated certifications"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-white/10">
                <button
                  onClick={submitCreateAnalyst}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all"
                >
                  Create Analyst
                </button>
                <button
                  onClick={closeCreateAnalystModal}
                  className="flex-1 px-4 py-3 border border-white/10 text-white rounded-2xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showFeeRuleModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-[#111] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0d0d0d]">
                <div>
                  <h3 className="text-lg font-black text-white">Add Dynamic Fee Rule</h3>
                  <p className="text-sm text-neutral-400">
                    Use structured fee rules instead of inline prompts.
                  </p>
                </div>
                <button
                  onClick={closeFeeRuleModal}
                  className="px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-300 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Fee Type</label>
                  <input
                    type="text"
                    value={feeRuleForm.feeType}
                    onChange={(e) =>
                      setFeeRuleForm((prev) => ({ ...prev, feeType: e.target.value }))
                    }
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">Percentage (%)</label>
                    <input
                      type="number"
                      value={feeRuleForm.percentage}
                      onChange={(e) =>
                        setFeeRuleForm((prev) => ({ ...prev, percentage: e.target.value }))
                      }
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-2">
                      Fixed Amount (RWF)
                    </label>
                    <input
                      type="number"
                      value={feeRuleForm.fixedAmount}
                      onChange={(e) =>
                        setFeeRuleForm((prev) => ({ ...prev, fixedAmount: e.target.value }))
                      }
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Conditions (JSON)</label>
                  <textarea
                    value={feeRuleForm.conditions}
                    onChange={(e) =>
                      setFeeRuleForm((prev) => ({ ...prev, conditions: e.target.value }))
                    }
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-3 text-sm text-white outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-white/10">
                <button
                  onClick={submitFeeRuleModal}
                  disabled={feeRuleModalLoading}
                  className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold transition-all disabled:opacity-50"
                >
                  {feeRuleModalLoading ? 'Saving...' : 'Add Fee Rule'}
                </button>
                <button
                  onClick={closeFeeRuleModal}
                  className="flex-1 px-4 py-3 border border-white/10 text-white rounded-2xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
