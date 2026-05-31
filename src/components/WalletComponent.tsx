import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  MessageCircle,
  Smartphone,
  History,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Send,
  Search,
  Filter,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Download,
  Zap,
  ArrowRight,
  AlertCircle,
  Share2,
  Scan,
  X,
  Copy,
  Coins,
  HandCoins,
  Award,
  Fingerprint,
  Check,
  Lock,
  Nfc,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  increment,
  runTransaction,
  query,
  where,
  getDocs,
  onSnapshot,
  getDoc,
  setDoc,
  Timestamp,
  serverTimestamp,
} from '../services/firestoreBridge';
import { apiPut } from '../services/apiClient';
import { walletService } from '../services/walletService';
import { calculateWalletFee, FeeCalculation } from '../services/feeService';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { handleFirestoreError, OperationType, safeStringify } from '../lib/firestoreErrorHandler';
import {
  cn,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
  toDate,
  calculateFees,
} from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import LinkedAccounts from './LinkedAccounts';
import QRScanner from './customer/QRScanner';
import { VerifiedBadge } from './VerifiedBadge';
import { emailService } from '../services/emailService';
import { isAccountVerified } from '../lib/verification';
import {
  RWANDAN_BANKS,
  MOBILE_MONEY_PROVIDERS,
  DIGITAL_WALLETS,
  GOV_UTILITY_PAYMENTS,
  REMITTANCE_SERVICES,
  CARD_SCHEMES,
} from '../constants/rwandaPayments';

import { isBiometricSupported, registerBiometric, authenticateBiometric } from '../lib/biometrics';

const LOYALTY_POINT_RWF_VALUE = 0.2;

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type:
    | 'deposit'
    | 'withdrawal'
    | 'payment'
    | 'payroll'
    | 'supply'
    | 'refund'
    | 'loan_disbursement'
    | 'loan_repayment';
  method: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: any;
  category: 'business' | 'personal';
  fromCustomer?: string;
  productName?: string;
  senderName?: string;
  recipientName?: string;
  traderName?: string;
}

interface LinkedAccount {
  id: string;
  userId: string;
  type: any;
  provider: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: any;
}

interface Loan {
  id: string;
  userId: string;
  amount: number;
  interest?: number;
  interestRate?: number;
  loanTerm?: number;
  monthlyPayment?: number;
  totalRepayment?: number;
  amountRepaid?: number;
  status: 'pending' | 'submitted' | 'approved' | 'active' | 'completed' | 'rejected' | 'overdue';
  approvalScore?: number;
  approvalStatus?: string;
  riskLevel?: string;
  nextInstallmentDue?: any;
  dueDate?: any;
  createdAt: any;
}

interface WalletComponentProps {
  balance: number;
  userId: string;
  transactions: Transaction[];
  title?: string;
  tier?: 'free' | 'premium';
  loyaltyPoints?: number;
  onNearPay?: () => void;
}

export default function WalletComponent({
  balance,
  userId,
  transactions,
  title,
  tier = 'free',
  loyaltyPoints = 0,
  onNearPay,
}: WalletComponentProps) {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const { sendNotification } = useNotifications();

  const logSystemActivity = async (
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    source: string = 'Wallet'
  ) => {
    try {
      await addDoc(collection(db, 'system_logs'), {
        message,
        level,
        source,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendModalAuth, setIsSendModalAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    | 'mobile_money'
    | 'card'
    | 'bnr_emoney'
    | 'bank_transfer'
    | 'mpesa'
    | 'regional_momo'
    | 'digital_wallet'
    | 'gov_services'
  >('mobile_money');
  const [withdrawMethod, setWithdrawMethod] = useState<
    | 'mobile_money'
    | 'card'
    | 'bnr_emoney'
    | 'bank_transfer'
    | 'mpesa'
    | 'regional_momo'
    | 'digital_wallet'
  >('mobile_money');
  const [paymentDetails, setPaymentDetails] = useState({
    phoneNumber: '',
    accountNumber: '',
    bankName: '',
    cardHolder: '',
    cardNumber: '',
    walletEmail: '',
    billId: '',
    provider: '',
  });

  // Filtering and Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'deposit' | 'withdrawal' | 'payment' | 'payroll' | 'supply'
  >('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'business' | 'personal'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low'>(
    'newest'
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Simulated Gateway State
  const [gatewayStatus, setGatewayStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>(
    'idle'
  );
  const [showMoMoPrompt, setShowMoMoPrompt] = useState(false);
  const [momoPin, setMomoPin] = useState('');
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [selectedLinkedAccount, setSelectedLinkedAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinAction, setPinAction] = useState<{
    type: 'withdraw' | 'send' | 'redeem' | 'applyLoan';
    data: any;
  } | null>(null);
  const [userPin, setUserPin] = useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifiedRecipient, setVerifiedRecipient] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [flowStep, setFlowStep] = useState<'input' | 'review' | 'success' | 'error'>('input');
  const [transactionSummary, setTransactionSummary] = useState<any>(null);

  const getTrustBadgeLevel = (user: any) => {
    if (!isAccountVerified(user)) return 'verified';
    if (user.role === 'trader' || user.isTrader || (user.businessName && !user.category))
      return 'trader';
    if (user.category === 'organization') return 'customer-organization';
    if (user.category === 'business') return 'customer-business';
    return 'customer-individual';
  };

  const isUserVerified = (user: any) => isAccountVerified(user);

  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'balance' | 'loyalty' | 'loans'>('balance');
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [redeeming, setRedeeming] = useState(false);
  const [applyingLoan, setApplyingLoan] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState('6');
  const [loanFeePaymentMethod, setLoanFeePaymentMethod] = useState<'wallet' | 'points'>('wallet');
  const [loanPreview, setLoanPreview] = useState<any>(null);
  const [loanPreviewLoading, setLoanPreviewLoading] = useState(false);
  const [loanPreviewError, setLoanPreviewError] = useState<string | null>(null);
  const [loanWhatsApp, setLoanWhatsApp] = useState<{
    number: string;
    message: string;
    url: string;
  } | null>(null);
  const [depositFee, setDepositFee] = useState<FeeCalculation | null>(null);
  const [withdrawFee, setWithdrawFee] = useState<FeeCalculation | null>(null);

  // PIN Attempt Tracking & Wallet Security
  const [pinAttempts, setPinAttempts] = useState(0);
  const [walletBlocked, setWalletBlocked] = useState(false);
  const [walletBlockedUntil, setWalletBlockedUntil] = useState<number | null>(null);

  // Passkey for devices without biometrics
  const [passkey, setPasskey] = useState<string | null>(null);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [enteredPasskey, setEnteredPasskey] = useState('');
  const [isSettingPasskey, setIsSettingPasskey] = useState(false);

  useEffect(() => {
    const amount = Number(parseCurrencyInput(depositAmount));
    if (amount > 0) {
      calculateWalletFee('deposit', amount, userId)
        .then(setDepositFee)
        .catch(() => setDepositFee(null));
    } else {
      setDepositFee(null);
    }
  }, [depositAmount, userId]);

  useEffect(() => {
    const amount = Number(parseCurrencyInput(withdrawAmount));
    if (amount > 0) {
      calculateWalletFee('withdrawal', amount, userId)
        .then(setWithdrawFee)
        .catch(() => setWithdrawFee(null));
    } else {
      setWithdrawFee(null);
    }
  }, [withdrawAmount, userId]);

  const generateReceipt = async (data: any) => {
    try {
      const receiptText = `
Transaction Receipt
--------------------------
ID: ${data.transactionId}
Date: ${data.date}
Type: ${data.type.toUpperCase()}
Method: ${data.method}
Amount: RWF ${formatCurrency(data.amount)}
Status: ${data.status.toUpperCase()}
From: ${data.senderName || 'N/A'}
To: ${data.recipientName || 'N/A'}
Product: ${data.productName || 'N/A'}
--------------------------
Thank you for using the platform.
      `;

      const blob = new Blob([receiptText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${data.transactionId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      sendNotification(userId, 'Receipt generated and downloaded.', 'success', 'system');
    } catch (err) {
      console.error('Receipt generation failed:', err);
      setError('Failed to generate receipt.');
    }
  };

  React.useEffect(() => {
    if (!userId) return;

    const loadLoans = async () => {
      try {
        const loans = await walletService.getLoans(userId);
        setMyLoans(loans as Loan[]);
      } catch (err) {
        console.error('Error fetching loans:', err);
      }
    };

    loadLoans();
  }, [userId]);

  const handleRedeemPoints = async () => {
    if (!currentUserData?.loyaltyPoints || currentUserData.loyaltyPoints < 100) {
      setError('Minimum 100 points required to redeem.');
      return;
    }
    setRedeeming(true);
    try {
      const pointsToRedeem = currentUserData.loyaltyPoints;
      await walletService.redeemLoyaltyPoints(userId, pointsToRedeem);

      if (currentUserData) {
        setCurrentUserData({
          ...currentUserData,
          loyaltyPoints: 0,
        });
      }
      sendNotification(userId, 'Loyalty points reserved for service fees.', 'success', 'system');
    } catch (err: any) {
      console.error('Redemption failed:', err);
      setError(err?.message || 'Failed to redeem points.');
    } finally {
      setRedeeming(false);
    }
  };

  const calculateLoanOffer = () => {
    const points = currentUserData?.loyaltyPoints || 0;
    const maxAmount = Math.max(50000, Math.min(500000, points * 10 || 50000));
    return {
      amount: maxAmount,
      interest: 18,
    };
  };

  const handlePreviewLoan = async () => {
    const amount = Number(parseCurrencyInput(loanAmount));
    const term = Math.max(1, Math.floor(Number(loanTerm) || 30));
    if (amount <= 0) {
      setLoanPreviewError('Enter a valid loan amount');
      setLoanPreview(null);
      return;
    }

    setLoanPreviewError(null);
    setLoanPreviewLoading(true);
    setLoanPreview(null);

    try {
      const preview = await walletService.previewLoan(userId, amount, term);
      setLoanPreview(preview);
    } catch (err: any) {
      console.error('Loan preview failed:', err);
      setLoanPreviewError(err?.message || 'Failed to load loan preview.');
      setLoanPreview(null);
    } finally {
      setLoanPreviewLoading(false);
    }
  };

  const handleApplyLoan = async (
    amount: number,
    term: number = 6,
    feePaymentMethod: 'wallet' | 'points' = loanFeePaymentMethod
  ) => {
    if (applyingLoan) return;
    setApplyingLoan(true);
    try {
      const response = await walletService.applyForLoan(userId, amount, term, feePaymentMethod);
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + term);

      setMyLoans((prev) => [
        ...prev,
        {
          id: response.loanId,
          userId,
          amount,
          interestRate: response.interestRate,
          loanTerm: term,
          monthlyPayment: response.monthlyPayment,
          totalRepayment: response.totalRepayment,
          amountRepaid: 0,
          status: response.status === 'active' ? 'active' : (response.approvalStatus as any),
          approvalScore: response.approvalScore,
          approvalStatus: response.approvalStatus,
          riskLevel: response.riskLevel,
          dueDate: dueDate.toISOString(),
          createdAt: new Date().toISOString(),
        } as Loan,
      ]);

      sendNotification(
        userId,
        `Loan ${response.approvalStatus} for RWF ${formatCurrency(amount)}.`,
        'success',
        'system'
      );
      if (response.whatsapp?.url) {
        setLoanWhatsApp(response.whatsapp);
        window.open(response.whatsapp.url, '_blank', 'noopener,noreferrer');
      }
      setLoanAmount('');
      setLoanPreview(null);
    } catch (err: any) {
      console.error('Loan application failed:', err);
      setError(err?.message || 'Failed to apply for loan.');
    } finally {
      setApplyingLoan(false);
    }
  };

  React.useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'system_config', 'global'),
      (snap) => {
        if (snap.exists()) setSystemConfig(snap.data());
      },
      (err) => {
        console.error('Wallet system config error:', err);
      }
    );
    return () => unsubConfig();
  }, []);

  const verifyRecipient = async (term: string) => {
    if (term.length < 3) {
      setVerifiedRecipient(null);
      setTargetUser(null);
      return;
    }
    setIsVerifying(true);
    try {
      let q;
      if (/^\d{8}$/.test(term)) {
        q = query(collection(db, 'users'), where('appNumber', '==', term));
      } else if (term.includes('@')) {
        q = query(collection(db, 'users'), where('email', '==', term));
      } else {
        q = query(collection(db, 'users'), where('phone', '==', term));
      }

      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as any;
        setTargetUser({ id: snap.docs[0].id, ...data });
        setVerifiedRecipient(data.businessName || data.name || 'Unknown User');
      } else {
        setVerifiedRecipient(null);
        setTargetUser(null);
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('PIN must be 4-6 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        transactionPin: newPin,
        pinSetupCompletedAt: new Date().toISOString(),
      });
      setUserPin(newPin);
      setIsSettingPin(false);
      setNewPin('');
      setConfirmPin('');
      setPinError(null);

      // Prompt user to set up biometrics after PIN is set
      const bioReady = await isBiometricSupported();
      if (bioReady && !dismissBioSetup) {
        setTimeout(() => {
          setShowBiometricSetupModal(true);
        }, 500);
      }
    } catch (err) {
      console.error('Error setting PIN:', err);
      setPinError('Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!userId) return;
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data() as any;
          setUserPin(data.transactionPin || null);
          setCurrentUserData({ id: userDoc.id, ...data });
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, [userId]);

  // Fee Calculations
  React.useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'linked_accounts'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const accounts = snapshot.docs.map(
          (doc: any) => ({ id: doc.id, ...doc.data() }) as LinkedAccount
        );
        setLinkedAccounts(accounts);

        // Auto-select default account if none selected
        if (!selectedLinkedAccount) {
          const defaultAcc = accounts.find((acc: any) => acc.isDefault);
          if (defaultAcc) {
            setSelectedLinkedAccount(defaultAcc.id);
            setPaymentMethod(defaultAcc.type);
            setPaymentDetails((prev) => ({
              ...prev,
              provider: defaultAcc.provider,
              accountNumber: defaultAcc.accountNumber,
              phoneNumber: defaultAcc.accountNumber,
              bankName: defaultAcc.provider,
            }));
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'linked_accounts');
      }
    );
    return () => unsubscribe();
  }, [userId, selectedLinkedAccount]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'mobile_money' && !showMoMoPrompt) {
      setShowMoMoPrompt(true);
      return;
    }

    setLoading(true);
    setGatewayStatus('processing');
    setShowMoMoPrompt(false);
    setMomoPin('');

    try {
      const amount = Number(parseCurrencyInput(depositAmount));
      const response = await walletService.deposit(
        userId,
        amount,
        paymentMethod,
        `DEP-${Date.now()}`
      );

      setGatewayStatus('success');
      if (response.pendingSync) {
        setError('Deposit recorded offline. It will sync and verify when internet returns.');
      }

      if (currentUserData?.email && !response.pendingSync) {
        const oldBalance = balance;
        const newBalance = oldBalance + amount - (depositFee?.calculatedFee || 0);

        emailService.sendTransactionReceipt({
          email: currentUserData.email,
          name: currentUserData.name || 'User',
          type: 'deposit',
          amount,
          fee: depositFee?.calculatedFee || 0,
          status: 'success',
          reference: response.transactionId || `DEP-${userId.slice(0, 4)}`,
          oldBalance,
          newBalance,
        });
      }

      setTimeout(() => {
        setIsDepositing(false);
        setDepositAmount('');
        setGatewayStatus('idle');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setGatewayStatus('failed');
      setError(err?.message || 'Deposit failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(parseCurrencyInput(withdrawAmount));

    if (amount > balance) {
      setError(t.wallet.insufficientBalance);
      return;
    }

    setLoading(true);
    setError(null);
    setGatewayStatus('processing');

    try {
      const oldBalance = balance;
      const response = await walletService.withdraw(
        userId,
        amount,
        withdrawMethod,
        `WTH-${Date.now()}`
      );

      setGatewayStatus('success');

      const newBalance = oldBalance - amount - (withdrawFee?.calculatedFee || 0);

      if (currentUserData?.email) {
        emailService.sendTransactionReceipt({
          email: currentUserData.email,
          name: currentUserData.name || 'User',
          type: 'withdrawal',
          amount,
          fee: withdrawFee?.calculatedFee || 0,
          status: 'success',
          reference: response.transactionId || `WTH-${userId.slice(0, 4)}`,
          oldBalance: oldBalance,
          newBalance: newBalance,
        });
      }

      setTimeout(() => {
        setIsWithdrawing(false);
        setWithdrawAmount('');
        setGatewayStatus('idle');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setGatewayStatus('failed');
      setError(err?.message || 'Withdrawal failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();

    if (walletBlocked) {
      setError(
        'Your wallet is temporarily blocked due to multiple incorrect PIN attempts. Check your email for unlock instructions.'
      );
      return;
    }

    if (!targetUser) return;

    const amount = Number(parseCurrencyInput(sendAmount));
    const { totalFee, cashback, pointsEarned } = calculateFees(amount);
    const totalDeduction = amount + totalFee;

    if (totalDeduction > balance) {
      setError(t.wallet.insufficientBalance);
      return;
    }

    setTransactionSummary({
      type: 'p2p',
      recipient: targetUser,
      amount,
      fee: totalFee,
      total: totalDeduction,
      cashback,
      pointsEarned,
    });

    // Require PIN + biometric auth for send
    setPinAction({ type: 'send', data: { amount, fee: totalFee, recipient: targetUser } });
    setShowPinModal(true);
  };

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isBioSupported, setIsBioSupported] = useState(false);
  const [showBioPrompt, setShowBioPrompt] = useState(false);
  const [showBiometricSetupModal, setShowBiometricSetupModal] = useState(false);
  const [dismissBioSetup, setDismissBioSetup] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('bio_prompt_dismissed') === 'true';
    setDismissBioSetup(dismissed);
  }, []);

  useEffect(() => {
    isBiometricSupported().then(setIsBioSupported);
    if (currentUserData?.biometricEnabled) {
      setBiometricEnabled(true);
    } else {
      setBiometricEnabled(false);
    }
  }, [currentUserData?.biometricEnabled]);

  useEffect(() => {
    if (
      isBioSupported &&
      currentUserData &&
      !currentUserData.biometricEnabled &&
      !dismissBioSetup
    ) {
      const timer = setTimeout(() => {
        setShowBioPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isBioSupported, currentUserData, dismissBioSetup]);

  // Load PIN, Passkey, and PIN attempts from Firestore
  useEffect(() => {
    if (userId) {
      const loadSecurityData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserPin(data.transactionPin || null);
            setPasskey(data.walletPasskey || null);
            setPinAttempts(data.pinAttempts || 0);
            setWalletBlocked(data.walletBlocked || false);
            setWalletBlockedUntil(data.walletBlockedUntil || null);
          }
        } catch (err) {
          console.error('Failed to load security data:', err);
        }
      };
      loadSecurityData();
    }
  }, [userId]);

  // Sync PIN attempts to Firestore whenever they change
  useEffect(() => {
    if (userId && pinAttempts >= 0) {
      const updateAttempts = async () => {
        try {
          await updateDoc(doc(db, 'users', userId), {
            pinAttempts: pinAttempts,
          });
        } catch (err) {
          console.error('Failed to update PIN attempts:', err);
        }
      };
      updateAttempts();
    }
  }, [userId, pinAttempts]);

  // Sync wallet blocked status to Firestore
  useEffect(() => {
    if (userId) {
      const updateBlockStatus = async () => {
        try {
          await updateDoc(doc(db, 'users', userId), {
            walletBlocked: walletBlocked,
            walletBlockedUntil: walletBlockedUntil,
          });
        } catch (err) {
          console.error('Failed to update wallet block status:', err);
        }
      };
      updateBlockStatus();
    }
  }, [userId, walletBlocked, walletBlockedUntil]);

  const handleEnableBiometrics = async () => {
    try {
      setLoading(true);
      const result = await registerBiometric();
      if (result.success) {
        // Biometric data is already stored in registerBiometric()
        await updateDoc(doc(db, 'users', userId), {
          biometricEnabled: true,
          biometricSetupCompletedAt: new Date().toISOString(),
        });
        localStorage.setItem('bio_prompt_dismissed', 'true');
        setBiometricEnabled(true);
        setShowBioPrompt(false);
        setShowBiometricSetupModal(false);
        setDismissBioSetup(true);
        sendNotification(
          userId,
          '✅ Fingerprint sensor registered! Your wallet is now extra secure.',
          'success',
          'system'
        );
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable biometrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    try {
      const result = await authenticateBiometric();
      setIsAuthenticating(false);

      if (result.success) {
        // Show success feedback
        setError(null);
        return true;
      } else {
        setError(result.message);
        // If authentication failed but can retry, don't close modal
        // If cannot retry, user will need to use PIN fallback
        return false;
      }
    } catch (err: any) {
      setIsAuthenticating(false);
      setError('Biometric authentication failed - please try again');
      return false;
    }
  };

  const handlePasskeySubmit = async () => {
    if (enteredPasskey === passkey) {
      // Passkey is correct, proceed with transaction
      setShowPasskeyModal(false);
      setEnteredPasskey('');

      if (isSendModalAuth) {
        // We're in send modal context, proceed with send
        setIsSendModalAuth(false);
        setPinAttempts(0); // Reset attempts on success
        await handleSend();
      } else {
        // Main wallet context
        const action = pinAction;
        setPinAction(null);
        setPinAttempts(0); // Reset attempts on success

        if (action?.type === 'withdraw') {
          await handleWithdraw();
        } else if (action?.type === 'send') {
          await handleSend();
        } else if (action?.type === 'redeem') {
          await handleRedeemPoints();
        } else if (action?.type === 'applyLoan') {
          await handleApplyLoan(action.data.amount, action.data.term, action.data.feePaymentMethod);
        }
      }
    } else {
      setError('Incorrect passkey. Please try again.');
      setEnteredPasskey('');
    }
  };

  const handleSetPasskey = async () => {
    if (!newPin || newPin.length < 4) {
      setError('Passkey must be at least 4 characters.');
      return;
    }

    try {
      // Save passkey to Firestore
      await updateDoc(doc(db, 'users', userId), {
        walletPasskey: newPin,
        passkeySetAt: serverTimestamp(),
      });

      setPasskey(newPin);
      setIsSettingPasskey(false);
      setNewPin('');
      setPinError(null);
      sendNotification(userId, 'Wallet passkey set successfully.', 'success', 'system');

      // Return to transaction flow if it was interrupted
      if (pinAction) {
        setPinAction({ ...pinAction });
        setShowPasskeyModal(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set passkey.');
    }
  };

  const handleSendPinSubmit = async () => {
    // Check if wallet is blocked
    if (walletBlocked) {
      setError(
        'Your wallet is temporarily blocked due to multiple incorrect PIN attempts. Check your email for unlock instructions.'
      );
      return;
    }

    if (enteredPin === userPin) {
      // PIN is correct
      // Now check for secondary auth (biometric or passkey)

      if (biometricEnabled && isBioSupported) {
        // Require biometric auth
        setIsAuthenticating(true);
        const success = await handleBiometricAuth();
        setIsAuthenticating(false);

        if (success) {
          // Both PIN and biometric verified, proceed with send
          setEnteredPin('');
          setPinAttempts(0); // Reset attempts on success
          await handleSend();
        } else {
          setError('Biometric authentication failed. Please try again.');
          setEnteredPin('');
        }
      } else if (!isBioSupported) {
        // Biometrics not available, require passkey instead
        if (!passkey) {
          // User hasn't set a passkey, ask them to set one first
          setIsSettingPasskey(true);
          setEnteredPin('');
          return;
        }

        // Show passkey modal
        setShowPasskeyModal(true);
        setIsSendModalAuth(true);
        setEnteredPin('');
      } else {
        // No secondary auth required, proceed directly
        setEnteredPin('');
        setPinAttempts(0);
        await handleSend();
      }
    } else {
      // PIN is incorrect
      const newAttempts = pinAttempts + 1;
      setPinAttempts(newAttempts);
      setEnteredPin('');

      if (newAttempts >= 3) {
        // Block wallet after 3 failed attempts
        setWalletBlocked(true);
        setWalletBlockedUntil(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Send unlock email
        try {
          await emailService.sendWalletUnlockEmail({
            email: currentUserData?.email || 'user@example.com',
            name: currentUserData?.name || 'User',
            unlockLink: `${window.location.origin}/wallet/unlock?token=${userId}`,
            attemptTime: new Date().toLocaleString(),
          });
        } catch (err) {
          console.error('Failed to send unlock email:', err);
        }

        setError(
          'Wallet blocked due to multiple incorrect PIN attempts. Check your email for unlock instructions.'
        );
      } else {
        setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
      }
    }
  };

  const handleSend = async () => {
    if (!transactionSummary) return;

    // PIN and biometric auth already verified in handlePinSubmit
    setLoading(true);
    setError(null);
    const { amount, fee, recipient, cashback, pointsEarned } = transactionSummary;
    const totalDeduction = amount + fee;

    try {
      const response = await walletService.transfer(
        userId,
        recipient.id,
        amount,
        `XFR-${Date.now()}`,
        { skipBiometric: true }
      );

      // Send notification to recipient
      if (!response.pendingSync) {
        await sendNotification(
          recipient.id,
          `You received RWF ${formatCurrency(amount)} from ${currentUserData?.businessName || currentUserData?.name || 'a user'}.`,
          'success',
          'transaction'
        );
      }

      setFlowStep('success');
      if (response.pendingSync) {
        setError('Transfer recorded offline. It will sync and verify when internet returns.');
      }

      // Calculate balances for email receipts
      const senderOldBalance = balance;
      const senderNewBalance = balance - (amount + fee) + cashback;
      const recipientOldBalance = recipient.walletBalance || 0;
      const recipientNewBalance = recipientOldBalance + amount;

      // Send transaction email to SENDER with balance info
      if (currentUserData?.email && !response.pendingSync) {
        emailService.sendTransactionReceipt({
          email: currentUserData.email,
          name: currentUserData.name || 'User',
          type: 'transfer',
          amount,
          fee,
          status: 'success',
          reference: `XFR-${userId.slice(0, 4)}`,
          recipientName: recipient.businessName || recipient.name,
          oldBalance: senderOldBalance,
          newBalance: senderNewBalance,
        });
      }

      // Send transaction email to RECIPIENT with balance info
      if (recipient.email && !response.pendingSync) {
        emailService.sendTransactionReceipt({
          email: recipient.email,
          name: recipient.businessName || recipient.name || 'User',
          type: 'deposit',
          amount,
          fee: 0,
          status: 'success',
          reference: `XFR-${userId.slice(0, 4)}`,
          oldBalance: recipientOldBalance,
          newBalance: recipientNewBalance,
        });
      }

      setTimeout(() => {
        setIsSending(false);
        setIsSendModalAuth(false);
        setFlowStep('input');
        setTargetUser(null);
        setSendAmount('');
        setRecipientId('');
        setVerifiedRecipient(null);
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Wallet error');
      setFlowStep('error');
    } finally {
      setLoading(false);
      setEnteredPin('');
    }
  };

  // Filter and Sort Transactions
  const filteredTransactions = transactions
    .filter((tx) => {
      const matchesSearch =
        tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.fromCustomer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.method.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;

      const txDate = toDate(tx.timestamp);
      const matchesStartDate = !startDate || txDate >= new Date(startDate);
      const matchesEndDate =
        !endDate || txDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));

      return matchesSearch && matchesType && matchesCategory && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime();
      if (sortBy === 'oldest') return toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime();
      if (sortBy === 'amount_high') return b.amount - a.amount;
      if (sortBy === 'amount_low') return a.amount - b.amount;
      return 0;
    });

  const handlePinSubmit = async () => {
    // Check if wallet is blocked
    if (walletBlocked) {
      setError(
        'Your wallet is temporarily blocked due to multiple incorrect PIN attempts. Check your email for unlock instructions.'
      );
      return;
    }

    if (enteredPin === userPin) {
      // PIN is correct
      // Now check for secondary auth (biometric or passkey)

      if (biometricEnabled && isBioSupported) {
        // Require biometric auth
        setIsAuthenticating(true);
        const success = await handleBiometricAuth();
        setIsAuthenticating(false);

        if (success) {
          // Both PIN and biometric verified, proceed with action
          setShowPinModal(false);
          const action = pinAction;
          setPinAction(null);
          setEnteredPin('');
          setPinAttempts(0); // Reset attempts on success

          if (action?.type === 'withdraw') {
            await handleWithdraw();
          } else if (action?.type === 'send') {
            await handleSend();
          } else if (action?.type === 'redeem') {
            await handleRedeemPoints();
          } else if (action?.type === 'applyLoan') {
            await handleApplyLoan(action.data.amount, action.data.term, action.data.feePaymentMethod);
          }
        } else {
          setError('Biometric authentication failed. Please try again.');
          setEnteredPin('');
        }
      } else if (!isBioSupported) {
        // Biometrics not available, require passkey instead
        if (!passkey) {
          // User hasn't set a passkey, ask them to set one first
          setShowPinModal(false);
          setIsSettingPasskey(true);
          setEnteredPin('');
          return;
        }

        // Show passkey modal
        setShowPinModal(false);
        setShowPasskeyModal(true);
        setEnteredPin('');
      } else {
        // Biometrics available but not enabled - optional, proceed
        setShowPinModal(false);
        const action = pinAction;
        setPinAction(null);
        setEnteredPin('');
        setPinAttempts(0); // Reset attempts on success

        if (action?.type === 'withdraw') {
          await handleWithdraw();
        } else if (action?.type === 'send') {
          await handleSend();
        }
      }
    } else {
      // PIN is incorrect
      const newAttempts = pinAttempts + 1;
      setPinAttempts(newAttempts);
      setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
      setEnteredPin('');

      if (newAttempts >= 3) {
        // Block wallet
        setWalletBlocked(true);
        setShowPinModal(false);
        setError(null);

        // Send unlock email
        if (currentUserData?.email) {
          try {
            // Generate unlock token (simple timestamp-based)
            const unlockToken = btoa(`${userId}-${Date.now()}`);
            const unlockLink = `${window.location.origin}?unlockWallet=${unlockToken}`;

            await emailService.sendWalletUnlockEmail({
              email: currentUserData.email,
              name: currentUserData.name || 'User',
              unlockLink,
              attemptTime: new Date().toLocaleString(),
            });

            setError(
              'Wallet blocked due to 3 incorrect PIN attempts. Check your email for unlock instructions.'
            );
          } catch (err) {
            console.error('Failed to send unlock email:', err);
            setError('Wallet blocked. Please contact support.');
          }
        }
      }
    }
  };

  const [dismissBioPrompt, setDismissBioPrompt] = useState(false);

  return (
    <>
      <div className="space-y-4">
        {isBioSupported && !biometricEnabled && !dismissBioPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between gap-4 shadow-lg shadow-indigo-900/10 relative overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-inner shrink-0">
                <Fingerprint size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">
                  Protect your Wallet
                </h4>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-0.5">
                  Enable fingerprint authentication for faster and more secure transactions.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  localStorage.setItem('bio_prompt_dismissed', 'true');
                  setDismissBioPrompt(true);
                }}
                className="p-2 text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleEnableBiometrics}
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Set Up Now'}
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-1 wallet-card p-6 text-white relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest">
                  <ShieldCheck size={12} /> {t.common.secure}
                </div>
              </div>
              <p className="text-orange-100 font-black text-[9px] uppercase tracking-[0.2em] mb-0.5">
                {t.wallet.availableBalance}
              </p>
              <h3 className="text-2xl font-black mt-1 mb-4 tabular-nums">
                RWF {formatCurrency(balance)}
              </h3>

              <div className="flex items-center justify-between mb-4 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                <div>
                  <p className="text-orange-100 text-[7px] font-black uppercase tracking-widest mb-0.5">
                    Loyalty Tier
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full animate-pulse',
                        tier === 'premium' ? 'bg-yellow-400' : 'bg-blue-400'
                      )}
                    />
                    <p className="font-bold text-[10px] capitalize tracking-tight">{tier} Member</p>
                  </div>
                </div>
                <div className="text-right">
                  {!userPin ? (
                    <button
                      onClick={() => setIsSettingPin(true)}
                      className="flex items-center gap-1 text-[7px] font-black uppercase tracking-widest text-white bg-orange-500 px-2 py-1 rounded-full hover:bg-orange-400 transition-all"
                    >
                      <ShieldCheck size={8} /> Set PIN
                    </button>
                  ) : (
                    <>
                      <p className="text-orange-100 text-[7px] font-black uppercase tracking-widest mb-0.5">
                        Points
                      </p>
                      <p className="font-black text-sm leading-none">
                        {loyaltyPoints.toLocaleString()} <span className="text-[7px]">PTS</span>
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsDepositing(true)}
                  className="py-2.5 bg-white text-orange-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight size={14} /> {t.wallet.deposit}
                </button>
                <button
                  onClick={() => setIsWithdrawing(true)}
                  className="py-2.5 bg-white/20 backdrop-blur-md text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowDownLeft size={14} /> {t.wallet.withdraw}
                </button>

                {/* Test Deposit Button */}
                <button
                  onClick={async () => {
                    setLoading(true);
                    setGatewayStatus('processing');
                    try {
                      const amount = 5000;
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      await runTransaction(db, async (transaction) => {
                        const userRef = doc(db, 'users', userId);
                        const userDoc = await transaction.get(userRef);
                        if (!userDoc.exists()) throw new Error('User not found');
                        const newBalance = (userDoc.data().walletBalance || 0) + amount;

                        const txRef = doc(collection(db, 'transactions'));
                        transaction.set(txRef, {
                          userId,
                          amount,
                          type: 'deposit',
                          method: 'test_simulation',
                          status: 'completed',
                          category: 'business',
                          timestamp: serverTimestamp(),
                        });
                        transaction.update(userRef, { walletBalance: newBalance });
                      });
                      setGatewayStatus('success');
                      setTimeout(() => setGatewayStatus('idle'), 1500);
                    } catch (err) {
                      console.error(err);
                      setGatewayStatus('failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="col-span-2 py-2 bg-white/10 backdrop-blur-md text-white/60 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                  <Zap size={14} /> Quick Test Deposit (5,000 RWF)
                </button>

                {isBioSupported && !biometricEnabled && (
                  <button
                    onClick={handleEnableBiometrics}
                    disabled={loading}
                    className="col-span-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40"
                  >
                    <Fingerprint size={16} /> Enable Fingerprint Security
                  </button>
                )}

                {biometricEnabled && (
                  <div className="col-span-2 py-2 px-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center gap-2">
                    <ShieldCheck size={14} className="text-indigo-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">
                      Biometric Security Active
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      if (systemConfig && systemConfig.p2pEnabled === false) {
                        alert('P2P Transfers are currently disabled by the administrator.');
                        return;
                      }
                      setIsSending(true);
                    }}
                    className={cn(
                      'py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border',
                      systemConfig?.p2pEnabled === false
                        ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                        : 'bg-orange-500 text-white hover:bg-orange-400 border-orange-400 shadow-lg shadow-orange-900/20'
                    )}
                  >
                    <Send size={18} /> {t.wallet.sendMoney || 'Send'}
                  </button>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="py-4 bg-[#0a0a0a] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border border-white/10 hover:bg-white/5 active:scale-95"
                  >
                    <Scan size={18} className="text-orange-500" /> Pay
                  </button>
                  <button
                    onClick={onNearPay}
                    disabled={!onNearPay}
                    className="py-4 bg-[#0a0a0a] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border border-white/10 hover:bg-white/5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Nfc size={18} className="text-emerald-400" /> Near
                  </button>
                  <button
                    onClick={() => setShowMyQR(true)}
                    className="py-4 bg-[#050505] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border border-white/10 hover:bg-white/5 active:scale-95"
                  >
                    <Globe size={18} /> {t.wallet.receiveMoney || 'Receive'}
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          </motion.div>

          <div className="lg:col-span-2 space-y-8">
            <LinkedAccounts userId={userId} />

            <div className="card p-5 bg-[#0a0a0a] border-white/5 shadow-2xl">
              {/* Enhanced Tab Navigation */}
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl mb-8 border border-white/10">
                <button
                  onClick={() => setActiveTab('balance')}
                  className={cn(
                    'flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                    activeTab === 'balance'
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  <History size={14} /> {t.common.history || 'History'}
                </button>
                <button
                  onClick={() => setActiveTab('loyalty')}
                  className={cn(
                    'flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                    activeTab === 'loyalty'
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  <Award size={14} /> Rewards
                </button>
                <button
                  onClick={() => setActiveTab('loans')}
                  className={cn(
                    'flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                    activeTab === 'loans'
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  <HandCoins size={14} /> Smart Loans
                </button>
              </div>

              {activeTab === 'balance' ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white/5 text-neutral-100 rounded-lg flex items-center justify-center border border-white/10">
                        <History size={16} />
                      </div>
                      <h3 className="text-lg font-black text-white tracking-tight uppercase">
                        {t.wallet.recentTransactions}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 md:flex-none">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                          size={14}
                        />
                        <input
                          type="text"
                          placeholder={t.common.searchTransactions}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full md:w-48 pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-[10px] font-bold text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                      </div>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                          'p-2 rounded-xl border transition-all',
                          showFilters
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white/5 text-neutral-400 border-white/10 hover:border-white/20'
                        )}
                      >
                        <Filter size={16} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-6"
                      >
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                              {t.common.filterByType}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {['all', 'deposit', 'withdrawal', 'payment', 'payroll', 'supply'].map(
                                (type) => (
                                  <button
                                    key={type}
                                    onClick={() => setFilterType(type as any)}
                                    className={cn(
                                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                                      filterType === type
                                        ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20'
                                        : 'bg-white/5 text-neutral-400 border-white/5 hover:border-white/10'
                                    )}
                                  >
                                    {type === 'all'
                                      ? t.common.all
                                      : type.charAt(0).toUpperCase() + type.slice(1)}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                              Category
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { id: 'all', label: 'All' },
                                { id: 'business', label: 'Business' },
                                { id: 'personal', label: 'Personal' },
                              ].map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => setFilterCategory(cat.id as any)}
                                  className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                                    filterCategory === cat.id
                                      ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20'
                                      : 'bg-white/5 text-neutral-400 border-white/5 hover:border-white/10'
                                  )}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                              {t.common.sortBy}
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                            >
                              <option value="newest" className="bg-[#0a0a0a]">
                                {t.common.newest}
                              </option>
                              <option value="oldest" className="bg-[#0a0a0a]">
                                {t.common.oldest}
                              </option>
                              <option value="amount_high" className="bg-[#0a0a0a]">
                                {t.common.amountHigh}
                              </option>
                              <option value="amount_low" className="bg-[#0a0a0a]">
                                {t.common.amountLow}
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                              {t.common.startDate}
                            </label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                              {t.common.endDate}
                            </label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                          </div>
                          <div className="md:col-span-2 flex justify-end">
                            <button
                              onClick={() => {
                                setSearchTerm('');
                                setFilterType('all');
                                setSortBy('newest');
                                setStartDate('');
                                setEndDate('');
                              }}
                              className="text-xs font-bold text-orange-600 hover:text-orange-700 underline underline-offset-4"
                            >
                              {t.common.clear || 'Clear All Filters'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-3">
                    {filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="card p-4 bg-[#0a0a0a] border-white/5 flex items-center justify-between hover:border-orange-500/30 transition-all group overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-4 relative z-10">
                          <div
                            className={cn(
                              'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm',
                              tx.type === 'deposit'
                                ? 'bg-green-500/10 text-green-500'
                                : tx.type === 'payment'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-red-500/10 text-red-500'
                            )}
                          >
                            {tx.type === 'deposit' ? (
                              <ArrowUpRight size={24} />
                            ) : (
                              <ArrowDownLeft size={24} />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-white text-sm capitalize">
                              {tx.type === 'deposit'
                                ? t.common.deposits
                                : tx.type === 'withdrawal'
                                  ? t.common.withdrawals
                                  : tx.type === 'payroll'
                                    ? 'Payroll'
                                    : tx.type === 'supply'
                                      ? 'Supply'
                                      : t.common.payments}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                {toDate(tx.timestamp).toLocaleDateString()} â€¢{' '}
                                {tx.method?.replace('_', ' ') || 'unknown'}
                              </p>
                              <button
                                onClick={async () => {
                                  try {
                                    const newCat =
                                      tx.category === 'business' ? 'personal' : 'business';
                                    await apiPut(`/api/transactions/${tx.id}`, {
                                      category: newCat,
                                    });
                                    // Optionally refresh data or show success message
                                  } catch (error) {
                                    console.error('Failed to update transaction category:', error);
                                    // Optionally show error message to user
                                  }
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all',
                                  tx.category === 'business'
                                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                )}
                              >
                                {tx.category || 'business'}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="text-right">
                            <p
                              className={cn(
                                'text-sm font-black',
                                tx.type === 'deposit' ? 'text-green-500' : 'text-white'
                              )}
                            >
                              {tx.type === 'deposit' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </p>
                            <div
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mt-1',
                                tx.status === 'completed'
                                  ? 'bg-green-500/10 text-green-500'
                                  : tx.status === 'pending'
                                    ? 'bg-yellow-500/10 text-yellow-500'
                                    : 'bg-red-500/10 text-red-500'
                              )}
                            >
                              {tx.status === 'completed' && <CheckCircle2 size={8} />}
                              {tx.status === 'pending' && <Clock size={8} />}
                              {tx.status === 'failed' && <XCircle size={8} />}
                              {tx.status}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              generateReceipt({
                                transactionId: tx.id,
                                date: toDate(tx.timestamp).toLocaleString(),
                                amount: tx.amount,
                                type: tx.type,
                                method: tx.method,
                                status: tx.status,
                                senderName: tx.senderName,
                                recipientName: tx.recipientName || tx.traderName,
                                productName: tx.productName,
                              })
                            }
                            className="p-2 text-neutral-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"
                            title="Download Receipt"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <Search className="text-neutral-700" size={32} />
                        </div>
                        <p className="text-neutral-400 font-bold">{t.wallet.noTransactions}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Try adjusting your filters or search term
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : activeTab === 'loyalty' ? (
                <div className="space-y-6">
                  <div className="p-8 bg-gradient-to-br from-orange-600 to-orange-800 rounded-3xl text-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-white/20">
                        <Coins size={32} />
                      </div>
                      <h4 className="text-3xl font-black mb-1">
                        {currentUserData?.loyaltyPoints?.toLocaleString() || 0}
                      </h4>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">
                        Total Loyalty points
                      </p>
                      <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => {
                            if (
                              !currentUserData?.loyaltyPoints ||
                              currentUserData.loyaltyPoints < 100
                            )
                              return;
                            setPinAction({ type: 'redeem', data: null });
                            setShowPinModal(true);
                          }}
                          disabled={
                            redeeming ||
                            !currentUserData?.loyaltyPoints ||
                            currentUserData.loyaltyPoints < 100
                          }
                          className="px-8 py-3 bg-white text-orange-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-50 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
                        >
                          {redeeming ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                          <Zap size={16} />
                          )}
                          Reserve for Fees
                        </button>
                      </div>
                      <p className="text-[9px] text-orange-200 mt-4 font-medium italic">
                        1 Point = {LOYALTY_POINT_RWF_VALUE} RWF toward service fees. Minimum 100 PTS.
                      </p>
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                      <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center mb-4">
                        <TrendingUp size={20} />
                      </div>
                      <h5 className="font-black text-white text-sm mb-1">Growth Forecast</h5>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Spend RWF 50,000 more this month to reach{' '}
                        <span className="text-orange-500 font-bold">Gold Tier</span> and earn 2x
                        points.
                      </p>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                      <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center mb-4">
                        <Award size={20} />
                      </div>
                      <h5 className="font-black text-white text-sm mb-1">Exclusive Perks</h5>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Your high loyalty score qualifies you for 0% interest on emergency smart
                        loans.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">
                      Available Loan Offers
                    </h4>
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-green-500/20">
                      Smart Credit
                    </span>
                  </div>

                  {loanWhatsApp && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-green-400">WhatsApp loan request ready</p>
                        <p className="text-[10px] text-green-200/70 font-bold uppercase tracking-widest">
                          Send details to {loanWhatsApp.number}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.open(loanWhatsApp.url, '_blank', 'noopener,noreferrer')}
                        className="px-4 py-3 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <MessageCircle size={16} />
                        Open WhatsApp
                      </button>
                    </div>
                  )}

                  {calculateLoanOffer() ? (
                    <div className="p-8 bg-[#050505] border border-white/10 rounded-3xl space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Requested amount
                          </label>
                          <input
                            type="text"
                            value={loanAmount}
                            onChange={(e) => setLoanAmount(e.target.value)}
                            placeholder="e.g. 50,000"
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                            Loan term (months)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={loanTerm}
                            onChange={(e) => setLoanTerm(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={handlePreviewLoan}
                            disabled={loanPreviewLoading}
                            className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all"
                          >
                            {loanPreviewLoading ? (
                              <Loader2 size={16} className="animate-spin inline-block" />
                            ) : (
                              'Preview loan'
                            )}
                          </button>
                        </div>
                      </div>

                      {loanPreviewError && (
                        <div className="text-sm text-red-500">{loanPreviewError}</div>
                      )}

                      {loanPreview ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Interest rate
                              </p>
                              <p className="text-xl font-black text-white">
                                {(loanPreview.interestRate * 100).toFixed(2)}%
                              </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Monthly payment
                              </p>
                              <p className="text-xl font-black text-white">
                                RWF {formatCurrency(loanPreview.monthlyPayment)}
                              </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Total repayment
                              </p>
                              <p className="text-xl font-black text-white">
                                RWF {formatCurrency(loanPreview.totalRepayment)}
                              </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Total interest
                              </p>
                              <p className="text-xl font-black text-white">
                                RWF {formatCurrency(loanPreview.totalInterest)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Requested amount
                              </p>
                              <p className="text-sm font-black text-white">
                                RWF {formatCurrency(loanPreview.amount)}
                              </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Term
                              </p>
                              <p className="text-sm font-black text-white">
                                {loanPreview.loanTerm} months
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Application fee
                              </p>
                              <p className="text-sm font-black text-white">
                                RWF {formatCurrency(loanPreview.applicationFee || 0)}
                              </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Score
                              </p>
                              <p className="text-sm font-black text-white">
                                {loanPreview.approvalScore || 0}/100
                              </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[9px] uppercase tracking-widest text-neutral-500">
                                Review status
                              </p>
                              <p className="text-sm font-black text-white capitalize">
                                {String(loanPreview.approvalStatus || 'review').replace('_', ' ')}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(['wallet', 'points'] as const).map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setLoanFeePaymentMethod(method)}
                                className={cn(
                                  'px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all',
                                  loanFeePaymentMethod === method
                                    ? 'bg-orange-600 text-white border-orange-500'
                                    : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white'
                                )}
                              >
                                Pay fee with {method}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-3 bg-[#0a0a0a] border border-white/10 rounded-3xl p-4">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                              <span>Installment</span>
                              <span>Payment</span>
                            </div>
                            {loanPreview.schedule.slice(0, 3).map((item: any) => (
                              <div
                                key={item.installment}
                                className="flex items-center justify-between text-sm text-white"
                              >
                                <span>#{item.installment}</span>
                                <span>RWF {formatCurrency(item.payment)}</span>
                              </div>
                            ))}
                            {loanPreview.schedule.length > 3 && (
                              <p className="text-[10px] text-neutral-500">
                                ...plus {loanPreview.schedule.length - 3} more installments.
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setPinAction({
                                type: 'applyLoan',
                                data: {
                                  amount: loanPreview.amount,
                                  term: loanPreview.loanTerm,
                                  feePaymentMethod: loanFeePaymentMethod,
                                },
                              });
                              setShowPinModal(true);
                            }}
                            disabled={applyingLoan}
                            className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all shadow-xl flex items-center justify-center gap-2"
                          >
                            {applyingLoan ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <HandCoins size={16} />
                            )}
                            Apply for Loan
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">
                                Maximum Eligible Amount
                              </p>
                              <h5 className="text-2xl font-black text-white">
                                RWF {formatCurrency(calculateLoanOffer()!.amount)}
                              </h5>
                            </div>
                            <div className="bg-orange-600/10 text-orange-500 px-3 py-1 rounded-lg text-[10px] font-black">
                              {calculateLoanOffer()!.interest}% Interest
                            </div>
                          </div>

                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full w-full bg-gradient-to-r from-orange-600 to-orange-400" />
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[9px] font-black text-neutral-500 uppercase mb-1">
                                Duration
                              </p>
                              <p className="text-xs font-bold text-white">30 Days</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[9px] font-black text-neutral-500 uppercase mb-1">
                                Trust Score
                              </p>
                              <p className="text-xs font-bold text-green-500">EXCELLENT</p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setPinAction({
                                type: 'applyLoan',
                                data: {
                                  amount: calculateLoanOffer()!.amount,
                                  term: 1,
                                  feePaymentMethod: loanFeePaymentMethod,
                                },
                              });
                              setShowPinModal(true);
                            }}
                            disabled={applyingLoan}
                            className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all shadow-xl flex items-center justify-center gap-2"
                          >
                            {applyingLoan ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <HandCoins size={16} />
                            )}
                            Rent Money Now
                          </button>
                          <p className="text-center text-[9px] text-neutral-500 font-medium italic">
                            Approved funds are deposited into your wallet when policy allows.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-4 bg-white/5 border border-white/10 rounded-3xl px-8">
                      <div className="w-16 h-16 bg-white/5 text-neutral-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-white/5">
                        <HandCoins size={32} />
                      </div>
                      <h5 className="text-white font-black">Unlock Smart Loans</h5>
                      <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                        Collect at least <span className="text-orange-500">500 Loyalty Points</span>{' '}
                        to unlock instant rental credit.
                      </p>
                      <button
                        onClick={() => setActiveTab('loyalty')}
                        className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:underline"
                      >
                        How to earn points?
                      </button>
                    </div>
                  )}

                  {myLoans.length > 0 && (
                    <div className="mt-8">
                      <h5 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4">
                        Active Agreements ({myLoans.filter((l) => l.status === 'active').length})
                      </h5>
                      <div className="space-y-3">
                        {myLoans.map((loan) => (
                          <div
                            key={loan.id}
                            className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-xl flex items-center justify-center',
                                  loan.status === 'active'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : 'bg-green-500/10 text-green-500'
                                )}
                              >
                                <Clock size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">
                                  RWF {formatCurrency(loan.amount)}
                                </p>
                                <p className="text-[9px] text-neutral-500">
                                  Next due{' '}
                                  {toDate(loan.nextInstallmentDue || loan.dueDate || loan.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {loan.status === 'active' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const payment = Math.min(
                                        loan.monthlyPayment || loan.totalRepayment || 0,
                                        (loan.totalRepayment || 0) - (loan.amountRepaid || 0)
                                      );
                                      if (payment <= 0) return;
                                      await walletService.repayLoan(loan.id, payment);
                                      const loans = await walletService.getLoans(userId);
                                      setMyLoans(loans as Loan[]);
                                      sendNotification(
                                        userId,
                                        `Loan repayment of RWF ${formatCurrency(payment)} completed.`,
                                        'success',
                                        'system'
                                      );
                                    } catch (err: any) {
                                      setError(err?.message || 'Loan repayment failed.');
                                    }
                                  }}
                                  className="px-3 py-2 rounded-xl bg-green-600 text-white text-[8px] font-black uppercase tracking-widest"
                                >
                                  Pay installment
                                </button>
                              )}
                              <span
                                className={cn(
                                  'px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest',
                                  loan.status === 'active'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : 'bg-green-500/10 text-green-500'
                                )}
                              >
                                {loan.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isDepositing && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-white/5"
            >
              {gatewayStatus !== 'idle' && (
                <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center">
                  {gatewayStatus === 'processing' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-orange-500/10 rounded-full mx-auto"></div>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          className="absolute inset-0 w-20 h-20 border-4 border-orange-600 border-t-transparent rounded-full mx-auto"
                        ></motion.div>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white">{t.common.processing}</h4>
                        <p className="text-sm text-neutral-500 mt-2">{t.common.gatewayMessage}</p>
                      </div>
                    </motion.div>
                  )}
                  {gatewayStatus === 'success' && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-500/10">
                        <CheckCircle2 size={40} />
                      </div>
                      <h4 className="text-xl font-black text-white">
                        {t.common.transactionCompleted}
                      </h4>
                    </motion.div>
                  )}
                  {gatewayStatus === 'failed' && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                        <XCircle size={40} />
                      </div>
                      <h4 className="text-xl font-black text-white">
                        {t.common.transactionFailed}
                      </h4>
                      <button
                        onClick={() => setGatewayStatus('idle')}
                        className="px-6 py-2 bg-orange-600 text-white rounded-xl font-bold"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
              <h3 className="text-lg font-black text-white mb-3">{t.wallet.depositFunds}</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold flex items-center gap-2">
                  <XCircle size={14} />
                  {error}
                </div>
              )}

              {showMoMoPrompt ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Smartphone size={24} />
                    </div>
                    <h4 className="text-lg font-black">Mobile Money</h4>
                    <p className="text-[10px] text-neutral-500">
                      Enter PIN to authorize RWF {depositAmount}
                    </p>
                  </div>

                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all',
                          momoPin.length >= i
                            ? 'border-orange-600 bg-orange-500/10 text-orange-500'
                            : 'border-white/10 bg-white/5 text-neutral-600'
                        )}
                      >
                        {momoPin.length >= i ? 'â€¢' : ''}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((num) => (
                      <button
                        key={num.toString()}
                        type="button"
                        onClick={() => {
                          if (num === 'C') setMomoPin('');
                          else if (num === 'OK') {
                            if (momoPin.length === 4)
                              handleDeposit({ preventDefault: () => {} } as any);
                          } else if (momoPin.length < 4) setMomoPin((prev) => prev + num);
                        }}
                        className={cn(
                          'py-3 rounded-xl font-black text-base transition-all active:scale-95 border',
                          num === 'OK'
                            ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20'
                            : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMoMoPrompt(false)}
                    className="w-full py-2 text-neutral-500 font-bold text-xs hover:text-neutral-700 transition-colors"
                  >
                    Back to methods
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleDeposit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">
                      {t.common.amount} (RWF)
                    </label>
                    <input
                      type="text"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(formatCurrencyInput(e.target.value))}
                      placeholder={t.wallet.enterAmount}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-orange-500 outline-none transition-all text-base font-bold text-white placeholder:text-neutral-700"
                    />
                  </div>

                  {depositFee && Number(parseCurrencyInput(depositAmount)) > 0 && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Estimated platform fee</span>
                        <span className="font-bold text-white">
                          RWF {formatCurrency(depositFee.calculatedFee)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Net amount credited</span>
                        <span className="font-bold text-white">
                          RWF {formatCurrency(depositFee.netAmount)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">
                      {t.wallet.paymentMethod}
                    </label>
                    <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {/* Linked Accounts */}
                      {linkedAccounts.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[9px] font-bold text-neutral-500 uppercase mb-1.5 px-1">
                            {t.wallet.savedMethods}
                          </p>
                          <div className="space-y-1.5">
                            {linkedAccounts.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLinkedAccount(acc.id);
                                  setPaymentMethod(acc.type);
                                  setPaymentDetails({
                                    ...paymentDetails,
                                    provider: acc.provider,
                                    accountNumber: acc.accountNumber,
                                    phoneNumber: acc.accountNumber,
                                    bankName: acc.provider,
                                  });
                                }}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all ${selectedLinkedAccount === acc.id ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                              >
                                <div className="w-7 h-7 bg-white/10 border border-white/10 rounded-lg flex items-center justify-center shrink-0">
                                  {acc.type === 'bank' ? (
                                    <TrendingUp size={14} className="text-blue-500" />
                                  ) : (
                                    <Smartphone size={14} className="text-yellow-500" />
                                  )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                  <p className="font-bold text-xs text-white truncate">
                                    {acc.provider}
                                  </p>
                                  <p className="text-[10px] text-neutral-500 truncate">
                                    {acc.accountNumber}
                                  </p>
                                </div>
                                {selectedLinkedAccount === acc.id && (
                                  <CheckCircle2 size={14} className="text-orange-600" />
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="h-px bg-white/5 my-3" />
                          <p className="text-[9px] font-bold text-neutral-500 uppercase mb-1.5 px-1">
                            {t.wallet.otherMethods}
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLinkedAccount(null);
                          setPaymentMethod('bank_transfer');
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${paymentMethod === 'bank_transfer' && !selectedLinkedAccount ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                      >
                        <div className="w-8 h-8 bg-green-500/10 text-green-500 rounded-lg flex items-center justify-center shrink-0 border border-green-500/10">
                          <TrendingUp size={16} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm text-white">
                            {t.wallet.rwandanBankTransfer}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {t.wallet.bankTransferDesc}
                          </p>
                        </div>
                      </button>

                      {paymentMethod === 'bank_transfer' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 space-y-3"
                        >
                          <select
                            value={paymentDetails.bankName}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, bankName: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="" className="bg-[#0a0a0a]">
                              {t.wallet.selectBank}
                            </option>
                            {RWANDAN_BANKS.map((bank) => (
                              <option key={bank} value={bank} className="bg-[#0a0a0a]">
                                {bank}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={t.wallet.accountNumber}
                            value={paymentDetails.accountNumber}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({
                                ...prev,
                                accountNumber: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </motion.div>
                      )}

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('mobile_money')}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'mobile_money' ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                      >
                        <div className="w-10 h-10 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center border border-yellow-500/10">
                          <Smartphone size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-white">{t.wallet.mobileMoney}</p>
                          <p className="text-xs text-neutral-500">{t.wallet.mobileMoneyDesc}</p>
                        </div>
                      </button>

                      {paymentMethod === 'mobile_money' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 space-y-3"
                        >
                          <select
                            value={paymentDetails.provider}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, provider: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="" className="bg-[#0a0a0a]">
                              {t.wallet.selectProvider}
                            </option>
                            {MOBILE_MONEY_PROVIDERS.filter((p) => !p.name.includes('Regional')).map(
                              (p) => (
                                <option key={p.id} value={p.name} className="bg-[#0a0a0a]">
                                  {p.name}
                                </option>
                              )
                            )}
                          </select>
                          <input
                            type="text"
                            placeholder={t.wallet.phoneNumber}
                            value={paymentDetails.phoneNumber}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({
                                ...prev,
                                phoneNumber: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </motion.div>
                      )}

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('regional_momo')}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'regional_momo' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'}`}
                      >
                        <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                          <Globe size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-neutral-900">{t.wallet.regionalMomo}</p>
                          <p className="text-xs text-neutral-500">{t.wallet.regionalMomoDesc}</p>
                        </div>
                      </button>

                      {paymentMethod === 'regional_momo' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 space-y-3"
                        >
                          <select
                            value={paymentDetails.provider}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, provider: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">{t.wallet.selectProvider}</option>
                            {MOBILE_MONEY_PROVIDERS.filter((p) => p.name.includes('Regional')).map(
                              (p) => (
                                <option key={p.id} value={p.name}>
                                  {p.name}
                                </option>
                              )
                            )}
                          </select>
                          <input
                            type="text"
                            placeholder={t.wallet.phoneNumber}
                            value={paymentDetails.phoneNumber}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({
                                ...prev,
                                phoneNumber: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </motion.div>
                      )}

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'card' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'}`}
                      >
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                          <CreditCard size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-neutral-900">{t.common.card}</p>
                          <p className="text-xs text-neutral-500">{t.wallet.cardsDesc}</p>
                        </div>
                      </button>

                      {paymentMethod === 'card' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 space-y-3"
                        >
                          <select
                            value={paymentDetails.provider}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, provider: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">{t.wallet.selectCardScheme}</option>
                            {CARD_SCHEMES.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={t.wallet.cardNumber}
                            value={paymentDetails.cardNumber}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, cardNumber: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </motion.div>
                      )}

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('digital_wallet')}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'digital_wallet' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'}`}
                      >
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                          <Wallet size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-neutral-900">Digital Wallets</p>
                          <p className="text-xs text-neutral-500">{t.wallet.digitalWalletsDesc}</p>
                        </div>
                      </button>

                      {paymentMethod === 'digital_wallet' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 space-y-3"
                        >
                          <select
                            value={paymentDetails.provider}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, provider: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">{t.wallet.selectWallet}</option>
                            {DIGITAL_WALLETS.map((w) => (
                              <option key={w.id} value={w.name}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={t.wallet.walletEmail}
                            value={paymentDetails.walletEmail}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({
                                ...prev,
                                walletEmail: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </motion.div>
                      )}

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('gov_services')}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'gov_services' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'}`}
                      >
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                          <ShieldCheck size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-neutral-900">Gov & Utility Services</p>
                          <p className="text-xs text-neutral-500">{t.wallet.govServicesDesc}</p>
                        </div>
                      </button>

                      {paymentMethod === 'gov_services' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 space-y-3"
                        >
                          <select
                            value={paymentDetails.provider}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, provider: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">{t.wallet.selectService}</option>
                            {GOV_UTILITY_PAYMENTS.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={t.wallet.billId}
                            value={paymentDetails.billId}
                            onChange={(e) =>
                              setPaymentDetails((prev) => ({ ...prev, billId: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsDepositing(false)}
                      className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all text-sm"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          {t.wallet.confirmDeposit} <ShieldCheck size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isWithdrawing && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-white/5"
            >
              {gatewayStatus !== 'idle' && (
                <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center">
                  {gatewayStatus === 'processing' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-orange-500/10 rounded-full mx-auto"></div>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          className="absolute inset-0 w-20 h-20 border-4 border-orange-600 border-t-transparent rounded-full mx-auto"
                        ></motion.div>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white">{t.common.processing}</h4>
                        <p className="text-sm text-neutral-500 mt-2">{t.common.gatewayMessage}</p>
                      </div>
                    </motion.div>
                  )}
                  {gatewayStatus === 'success' && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-500/10">
                        <CheckCircle2 size={40} />
                      </div>
                      <h4 className="text-xl font-black text-white">
                        {t.common.transactionCompleted}
                      </h4>
                    </motion.div>
                  )}
                  {gatewayStatus === 'failed' && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                        <XCircle size={40} />
                      </div>
                      <h4 className="text-xl font-black text-white">
                        {t.common.transactionFailed}
                      </h4>
                      <button
                        onClick={() => setGatewayStatus('idle')}
                        className="px-6 py-2 bg-orange-600 text-white rounded-xl font-bold"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
              <h3 className="text-lg font-black text-white mb-3">{t.wallet.withdrawFunds}</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold flex items-center gap-2">
                  <XCircle size={14} />
                  {error}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  if (walletBlocked) {
                    setError(
                      'Your wallet is temporarily blocked due to multiple incorrect PIN attempts. Check your email for unlock instructions.'
                    );
                    return;
                  }

                  const amount = Number(parseCurrencyInput(withdrawAmount));
                  if (amount <= 0 || amount > balance) {
                    setError(t.wallet.insufficientBalance);
                    return;
                  }

                  // Require PIN + biometric auth for withdraw
                  setPinAction({
                    type: 'withdraw',
                    data: { amount, method: withdrawMethod, account: withdrawAccount },
                  });
                  setShowPinModal(true);
                }}
                className="space-y-3"
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      {t.common.amount} (RWF)
                    </label>
                    <span className="text-[10px] font-bold text-orange-500">
                      Max: RWF {formatCurrency(balance)}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(formatCurrencyInput(e.target.value))}
                    placeholder={t.wallet.enterAmount}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-orange-500 outline-none transition-all text-base font-bold text-white placeholder:text-neutral-700"
                  />
                </div>

                {withdrawFee && Number(parseCurrencyInput(withdrawAmount)) > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Estimated withdrawal fee</span>
                      <span className="font-bold text-white">
                        RWF {formatCurrency(withdrawFee.calculatedFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Total deducted</span>
                      <span className="font-bold text-white">
                        RWF{' '}
                        {formatCurrency(
                          Number(parseCurrencyInput(withdrawAmount)) + withdrawFee.calculatedFee
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">
                    {withdrawMethod === 'mobile_money' || withdrawMethod === 'mpesa'
                      ? t.wallet.phoneNumber
                      : withdrawMethod === 'card' || withdrawMethod === 'bank_transfer'
                        ? t.wallet.bankAccount
                        : t.wallet.accountNumber}
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawAccount}
                    onChange={(e) => setWithdrawAccount(e.target.value)}
                    placeholder={
                      withdrawMethod === 'mobile_money' || withdrawMethod === 'mpesa'
                        ? '078... / 079...'
                        : withdrawMethod === 'card' || withdrawMethod === 'bank_transfer'
                          ? 'Account Number'
                          : 'Enter details'
                    }
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-orange-500 outline-none transition-all font-bold text-xs text-white placeholder:text-neutral-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">
                    {t.wallet.withdrawTo}
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {/* Linked Accounts */}
                    {linkedAccounts.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[9px] font-bold text-neutral-500 uppercase mb-1.5 px-1">
                          {t.wallet.savedMethods}
                        </p>
                        <div className="space-y-1.5">
                          {linkedAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setSelectedLinkedAccount(acc.id);
                                setWithdrawMethod(acc.type as any);
                                setWithdrawAccount(acc.accountNumber);
                              }}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all ${selectedLinkedAccount === acc.id ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                            >
                              <div className="w-7 h-7 bg-white/10 border border-white/10 rounded-lg flex items-center justify-center shrink-0">
                                {acc.type === 'bank' ? (
                                  <TrendingUp size={14} className="text-blue-500" />
                                ) : (
                                  <Smartphone size={14} className="text-yellow-500" />
                                )}
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="font-bold text-xs text-white truncate">
                                  {acc.provider}
                                </p>
                                <p className="text-[10px] text-neutral-500 truncate">
                                  {acc.accountNumber}
                                </p>
                              </div>
                              {selectedLinkedAccount === acc.id && (
                                <CheckCircle2 size={14} className="text-orange-600" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="h-px bg-white/5 my-3" />
                        <p className="text-[9px] font-bold text-neutral-500 uppercase mb-1.5 px-1">
                          {t.wallet.otherMethods}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLinkedAccount(null);
                        setWithdrawMethod('mobile_money');
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${withdrawMethod === 'mobile_money' && !selectedLinkedAccount ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                    >
                      <div className="w-8 h-8 bg-yellow-500/10 text-yellow-500 rounded-lg flex items-center justify-center shrink-0 border border-yellow-500/10">
                        <Smartphone size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-white">{t.wallet.mobileMoney}</p>
                        <p className="text-[10px] text-neutral-500">{t.wallet.mobileMoneyDesc}</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('regional_momo')}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${withdrawMethod === 'regional_momo' ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                    >
                      <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center border border-orange-500/10">
                        <Globe size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">{t.wallet.regionalMomo}</p>
                        <p className="text-xs text-neutral-500">{t.wallet.regionalMomoDesc}</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('bank_transfer')}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${withdrawMethod === 'bank_transfer' ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                    >
                      <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center border border-green-500/10">
                        <TrendingUp size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">{t.wallet.rwandanBankTransfer}</p>
                        <p className="text-xs text-neutral-500">{t.wallet.bankTransferDesc}</p>
                      </div>
                    </button>

                    {withdrawMethod === 'bank_transfer' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="px-2 pb-2"
                      >
                        <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-1 focus:ring-orange-500">
                          <option value="" className="bg-[#0a0a0a]">
                            Select your bank...
                          </option>
                          {RWANDAN_BANKS.map((bank) => (
                            <option key={bank} value={bank} className="bg-[#0a0a0a]">
                              {bank}
                            </option>
                          ))}
                        </select>
                      </motion.div>
                    )}

                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('card')}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${withdrawMethod === 'card' ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                    >
                      <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/10">
                        <CreditCard size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">Cards & Local Schemes</p>
                        <p className="text-xs text-neutral-500">SmartCash, Visa, Mastercard</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('mpesa')}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${withdrawMethod === 'mpesa' ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                    >
                      <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/10">
                        <Smartphone size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">M-Pesa</p>
                        <p className="text-xs text-neutral-500">Withdraw to M-Pesa</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('bnr_emoney')}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${withdrawMethod === 'bnr_emoney' ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                    >
                      <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center border border-purple-500/10">
                        <TrendingUp size={20} />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">{t.wallet.bnrEmoney}</p>
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-black rounded-full uppercase tracking-widest border border-purple-500/10">
                            {t.common.testing}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500">{t.wallet.withdrawToBnr}</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawing(false)}
                    className="flex-1 py-3 bg-white/5 text-neutral-400 rounded-xl font-bold hover:bg-white/10 transition-all text-sm border border-white/5"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !withdrawAmount ||
                      !withdrawAccount ||
                      Number(parseCurrencyInput(withdrawAmount)) <= 0 ||
                      Number(parseCurrencyInput(withdrawAmount)) > balance
                    }
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-lg shadow-orange-900/20"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        {t.wallet.confirmWithdrawal} <ArrowDownLeft size={18} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSettingPin && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center border border-white/5"
            >
              <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-orange-500/10">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Set Transaction PIN</h3>
              <p className="text-xs text-neutral-500 mb-8">
                Create a 4-6 digit PIN to secure your transactions
              </p>

              {pinError && (
                <div className="mb-6 p-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-bold border border-red-500/20">
                  {pinError}
                </div>
              )}

              <form onSubmit={handleSetPin} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 text-left">
                      New PIN
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-1 focus:ring-orange-500 outline-none transition-all font-bold text-center text-2xl tracking-[0.5em] text-white"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 text-left">
                      Confirm PIN
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-1 focus:ring-orange-500 outline-none transition-all font-bold text-center text-2xl tracking-[0.5em] text-white"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingPin(false);
                      setNewPin('');
                      setConfirmPin('');
                      setPinError(null);
                    }}
                    className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || newPin.length < 4}
                    className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-900/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Set PIN'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showMyQR && currentUserData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#050505] w-full max-w-sm rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative"
          >
            <button
              onClick={() => setShowMyQR(false)}
              className="absolute top-6 right-6 p-2 text-neutral-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-6">
              <div>
                <h3 className="text-xl font-black text-white">
                  {t.wallet.myNexusId || 'My Wallet ID'}
                </h3>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                  {t.wallet.qrScanDescription || 'Scan this to send me money instantly'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-3xl mx-auto shadow-2xl inline-block">
                <QRCodeSVG
                  value={safeStringify({
                    type: 'p2p',
                    userId,
                    appNumber: currentUserData?.appNumber,
                    name: currentUserData?.businessName || currentUserData?.name,
                  })}
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-black text-white">
                  {currentUserData?.businessName || currentUserData?.name}
                </p>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em]">
                  ID: {currentUserData?.appNumber}
                </p>
              </div>

              <button
                onClick={() => {
                  const qrData = safeStringify({
                    type: 'p2p',
                    userId,
                    appNumber: currentUserData?.appNumber,
                    name: currentUserData?.businessName || currentUserData?.name,
                  });
                  navigator.clipboard.writeText(qrData);
                  alert('Wallet ID details copied!');
                }}
                className="w-full py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"
              >
                <Copy size={14} /> Copy ID Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showScanner && (
        <QRScanner onClose={() => setShowScanner(false)} onSuccess={() => setShowScanner(false)} />
      )}
      <AnimatePresence>
        {isSending && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden"
            >
              {flowStep === 'input' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-white">{t.wallet.sendMoney}</h3>
                    <button
                      onClick={() => {
                        setIsSending(false);
                        setIsSendModalAuth(false);
                      }}
                      className="p-2 hover:bg-white/5 rounded-full text-neutral-500"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold flex items-center gap-2">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleInitiateSend} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 leading-none">
                          Find Recipient
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={recipientId}
                            onChange={(e) => {
                              setRecipientId(e.target.value);
                              verifyRecipient(e.target.value);
                            }}
                            placeholder="App #, Phone or Email"
                            className="w-full pl-4 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm text-white"
                          />
                          {isVerifying ? (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              <Loader2 size={18} className="animate-spin text-orange-600" />
                            </div>
                          ) : targetUser ? (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                              <CheckCircle2 size={18} />
                            </div>
                          ) : null}
                        </div>

                        <AnimatePresence mode="wait">
                          {targetUser ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 p-3 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5"
                            >
                              <div className="w-10 h-10 rounded-xl overflow-hidden border border-orange-500/10 bg-orange-500/10 flex items-center justify-center">
                                {targetUser.photoURL ? (
                                  <img
                                    src={targetUser.photoURL}
                                    alt={targetUser.businessName || targetUser.name || 'Recipient'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-orange-500 font-black text-sm">
                                    {targetUser.businessName?.[0] || targetUser.name?.[0] || 'U'}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black text-white truncate">
                                    {targetUser.businessName || targetUser.name}
                                  </p>
                                  {isUserVerified(targetUser) && (
                                    <VerifiedBadge
                                      level={getTrustBadgeLevel(targetUser)}
                                      size="xs"
                                      showLabel={false}
                                      animated
                                      className="!border-white/10"
                                    />
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                  ID: {targetUser.appNumber}
                                </p>
                              </div>
                            </motion.div>
                          ) : (
                            recipientId.length >= 3 &&
                            !isVerifying && (
                              <p className="text-[10px] text-neutral-600 font-bold mt-2 ml-1 italic">
                                No user found with these details
                              </p>
                            )
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 leading-none">
                          {t.common.amount} (RWF)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-neutral-700">
                            RWF
                          </span>
                          <input
                            type="text"
                            required
                            value={sendAmount}
                            onChange={(e) => setSendAmount(formatCurrencyInput(e.target.value))}
                            placeholder="0"
                            className="w-full pl-16 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-2xl font-black text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        !targetUser || !sendAmount || Number(parseCurrencyInput(sendAmount)) <= 0
                      }
                      className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-30 shadow-xl shadow-orange-900/40"
                    >
                      Review Transfer <ArrowRight size={18} />
                    </button>
                  </form>
                </div>
              )}

              {flowStep === 'review' && transactionSummary && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/10">
                      <ShieldCheck size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white">Review Transfer</h3>
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-1">
                      Transfer Review: Ready
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest">
                        Recipient
                      </span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-white font-black truncate">
                          {transactionSummary.recipient.businessName ||
                            transactionSummary.recipient.name}
                        </span>
                        {isUserVerified(transactionSummary.recipient) && (
                          <VerifiedBadge
                            level={getTrustBadgeLevel(transactionSummary.recipient)}
                            size="xs"
                            showLabel={false}
                            animated
                            className="!border-white/10"
                          />
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest">
                        Amount
                      </span>
                      <span className="text-white font-black">
                        RWF {formatCurrency(transactionSummary.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest">
                        Ecosystem Fee
                      </span>
                      <span className="text-white font-black">
                        RWF {formatCurrency(transactionSummary.fee)}
                      </span>
                    </div>
                    {transactionSummary.cashback > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-500">
                        <span className="font-bold uppercase tracking-widest">Reward</span>
                        <span className="font-black">
                          -{formatCurrency(transactionSummary.cashback)} RWF
                        </span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pb-1">
                        Total Deduction
                      </span>
                      <span className="text-2xl font-black text-orange-500">
                        RWF {formatCurrency(transactionSummary.total - transactionSummary.cashback)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">
                        Enter PIN to Authorize
                      </p>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              'w-8 h-10 rounded-lg border flex items-center justify-center text-base font-black transition-all',
                              enteredPin.length >= i
                                ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                                : 'border-white/10 bg-white/5 text-neutral-800'
                            )}
                          >
                            {enteredPin.length >= i ? 'â€¢' : ''}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((num) => (
                        <button
                          key={num.toString()}
                          onClick={() => {
                            if (num === 'C') setEnteredPin('');
                            else if (num === 'OK') {
                              if (enteredPin.length >= 4) handleSendPinSubmit();
                            } else if (enteredPin.length < 6) setEnteredPin((prev) => prev + num);
                          }}
                          className={cn(
                            'py-3 rounded-xl font-black text-sm transition-all border',
                            num === 'OK'
                              ? 'bg-orange-600 text-white border-transparent shadow-lg shadow-orange-900/20'
                              : 'bg-white/5 text-neutral-500 border-white/5 hover:bg-white/10'
                          )}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setFlowStep('input')}
                      className="w-full py-3 text-neutral-600 font-bold text-[10px] uppercase tracking-widest hover:text-neutral-400 transition-colors"
                    >
                      {t.common.back}
                    </button>
                  </div>
                </div>
              )}

              {flowStep === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/10">
                    <CheckCircle2 size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Transfer Complete</h3>
                    <p className="text-sm text-neutral-500 mt-2">
                      Funds have been secured and transferred.
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl inline-block min-w-[200px]">
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-1">
                      Final Amount
                    </p>
                    <p className="text-xl font-black text-white">
                      RWF {formatCurrency(transactionSummary.amount)}
                    </p>
                  </div>
                </motion.div>
              )}

              {flowStep === 'error' && (
                <div className="text-center py-12 space-y-6">
                  <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                    <AlertCircle size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Transfer Failed</h3>
                    <p className="text-sm text-neutral-500 mt-2">
                      {error || 'Connection timed out.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setFlowStep('input')}
                    className="w-full py-4 bg-white/5 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center border border-white/5 relative overflow-hidden"
            >
              {isAuthenticating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4"
                >
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-orange-500/20 rounded-full animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Fingerprint size={40} className="text-orange-500 animate-bounce" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">Place your finger on the sensor</p>
                    <p className="text-white/80 text-sm mt-1">Verifying fingerprint...</p>
                  </div>
                </motion.div>
              )}

              <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-orange-500/10">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">{t.common.enterTransactionPin}</h3>
              <p className="text-xs text-neutral-500 mb-2">{t.common.enterPinToAuthorize}</p>

              {isBioSupported ? (
                <p className="text-[10px] text-orange-500/80 font-bold mb-4 flex items-center justify-center gap-1.5">
                  <Fingerprint size={14} /> PIN{' '}
                  {biometricEnabled ? '+ Fingerprint' : '(Optional Fingerprint)'} Required
                </p>
              ) : (
                <p className="text-[10px] text-purple-500/80 font-bold mb-4 flex items-center justify-center gap-1.5">
                  🔐 PIN + Passkey Required
                </p>
              )}

              {pinAttempts > 0 && pinAttempts < 3 && (
                <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-600 text-xs font-bold flex items-center justify-center gap-1">
                  ⚠️ {3 - pinAttempts} attempt{3 - pinAttempts === 1 ? '' : 's'} remaining
                </div>
              )}

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
                  <X size={14} />
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-10 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all',
                      enteredPin.length >= i
                        ? 'border-orange-600 bg-orange-500/10 text-orange-500'
                        : 'border-white/10 bg-white/5 text-neutral-700'
                    )}
                  >
                    {enteredPin.length >= i ? 'â€¢' : ''}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((num) => (
                  <button
                    key={num.toString()}
                    type="button"
                    onClick={() => {
                      if (num === 'C') setEnteredPin('');
                      else if (num === 'OK') {
                        if (enteredPin.length >= 4) handlePinSubmit();
                      } else if (enteredPin.length < 6) setEnteredPin((prev) => prev + num);
                    }}
                    className={cn(
                      'py-4 rounded-2xl font-black text-lg transition-all active:scale-95 border',
                      num === 'OK'
                        ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20'
                        : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setEnteredPin('');
                  setPinAction(null);
                }}
                className="text-sm font-bold text-neutral-500 hover:text-neutral-400 transition-colors"
              >
                {t.common.cancel}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Passkey Modal - For devices without biometrics */}
      <AnimatePresence>
        {showPasskeyModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center border border-white/5 relative overflow-hidden"
            >
              <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/10">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Enter Passkey</h3>
              <p className="text-xs text-neutral-500 mb-8">
                This device does not support fingerprint. Please enter your security passkey.
              </p>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
                  <X size={14} />
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-10 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all',
                      enteredPasskey.length >= i
                        ? 'border-purple-600 bg-purple-500/10 text-purple-500'
                        : 'border-white/10 bg-white/5 text-neutral-700'
                    )}
                  >
                    {enteredPasskey.length >= i ? 'â€¢' : ''}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((num) => (
                  <button
                    key={num.toString()}
                    type="button"
                    onClick={() => {
                      if (num === 'C') setEnteredPasskey('');
                      else if (num === 'OK') {
                        if (enteredPasskey.length >= 4) handlePasskeySubmit();
                      } else if (enteredPasskey.length < 10)
                        setEnteredPasskey((prev) => prev + num);
                    }}
                    className={cn(
                      'py-4 rounded-2xl font-black text-lg transition-all active:scale-95 border',
                      num === 'OK'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20'
                        : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPasskeyModal(false);
                  setEnteredPasskey('');
                }}
                className="text-sm font-bold text-neutral-500 hover:text-neutral-400 transition-colors"
              >
                {t.common.cancel}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Biometric Setup Prompt Modal - Encourage new users */}
      <AnimatePresence>
        {showBiometricSetupModal && isBioSupported && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto border border-orange-500/20 animate-pulse">
                  <Fingerprint size={32} />
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white mb-2">Secure Your Wallet</h2>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                    Set up fingerprint authentication for quick and secure access
                  </p>
                </div>

                <div className="space-y-3 text-left bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex gap-3">
                    <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Lightning Fast</p>
                      <p className="text-[10px] text-neutral-500">Authenticate in under 1 second</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <ShieldCheck size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Super Secure</p>
                      <p className="text-[10px] text-neutral-500">
                        Your fingerprint never leaves your device
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Lock size={18} className="text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Your Choice</p>
                      <p className="text-[10px] text-neutral-500">PIN fallback always available</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <button
                    onClick={handleEnableBiometrics}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-orange-900/20"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="inline animate-spin mr-2" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <Fingerprint size={16} className="inline mr-2" />
                        Register Fingerprint
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      localStorage.setItem('bio_prompt_dismissed', 'true');
                      setShowBiometricSetupModal(false);
                      setDismissBioSetup(true);
                    }}
                    className="w-full py-3 text-neutral-500 font-bold text-[10px] uppercase tracking-widest hover:text-neutral-300 transition-colors"
                  >
                    Maybe Later
                  </button>
                </div>

                <p className="text-[10px] text-neutral-600 italic">
                  You can always enable biometrics later in settings.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingPasskey && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center border border-white/5"
            >
              <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/10">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Set Security Passkey</h3>
              <p className="text-xs text-neutral-500 mb-8">
                Create a passkey for secure transactions (minimum 4 characters)
              </p>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-bold border border-red-500/20">
                  {error}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSetPasskey();
                }}
                className="space-y-6"
              >
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-1 focus:ring-purple-500 outline-none transition-all font-bold text-center text-xl tracking-[0.5em] text-white"
                  placeholder="Enter passkey"
                  required
                  minLength={4}
                  maxLength={20}
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingPasskey(false);
                      setNewPin('');
                      setPinError(null);
                    }}
                    className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || newPin.length < 4}
                    className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-900/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Set Passkey'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
