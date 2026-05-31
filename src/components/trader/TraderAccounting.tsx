import React, { useState, useEffect } from 'react';
import {
  Book,
  FileText,
  PieChart,
  TrendingUp,
  ArrowRightLeft,
  Receipt,
  ShoppingCart,
  Package,
  BarChart3,
  Lock,
  Zap,
  Loader2,
  Edit3,
  Save,
  X,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { useLanguage } from '../../context/LanguageContext';
import { cn, formatCurrency } from '../../lib/utils';
import { generateAccountingReport } from '../../lib/pdfGenerator';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  setDoc,
  getDoc,
} from '../../services/firestoreBridge';
import TraderUpgrade from './TraderUpgrade';
const db = undefined; // Used by firestoreBridge
import { format } from 'date-fns';

type AccountingTab =
  | 'ledger'
  | 'journal'
  | 'cashbook'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'trial_balance'
  | 'financials';

interface FinancialData {
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expenses: number;
  vatPayable?: number;
}

interface FixedAsset {
  id: string;
  name: string;
  cost: number;
  depreciationRate: string;
  bookValue: number;
}

interface TrialBalanceEntry {
  id: string;
  accountName: string;
  debitBalance: number;
  creditBalance: number;
}

export default function TraderAccounting({ traderId, tier }: { traderId: string; tier: string }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AccountingTab>('ledger');
  const [bookType, setBookType] = useState<'managerial' | 'tax'>('managerial');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const isPremium = tier === 'premium';
  const [hasUsedTrial, setHasUsedTrial] = useState(() => {
    return localStorage.getItem(`accounting_trial_used_${traderId}`) === 'true';
  });

  // Financial data state
  const [financialData, setFinancialData] = useState<FinancialData>({
    assets: 0,
    liabilities: 0,
    equity: 0,
    revenue: 0,
    expenses: 0,
    vatPayable: 0,
  });
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [trialBalanceEntries, setTrialBalanceEntries] = useState<TrialBalanceEntry[]>([]);
  const [financialDateModified, setFinancialDateModified] = useState<string>(new Date().toISOString());
  const [pendingStatementReport, setPendingStatementReport] = useState<{
    title: string;
    reportId: string;
    verificationPayload: string;
    headers: string[];
    body: any[][];
  } | null>(null);
  const [isEditingLedger, setIsEditingLedger] = useState(false);
  const [isEditingAssets, setIsEditingAssets] = useState(false);
  const [isEditingTrialBalance, setIsEditingTrialBalance] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load financial data from Firestore
  useEffect(() => {
    const loadFinancialData = async () => {
      try {
        const docRef = doc(db, 'trader_financials', traderId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setFinancialData(data.financialData || financialData);
          setFixedAssets(data.fixedAssets || []);
          setTrialBalanceEntries(data.trialBalanceEntries || []);
          setFinancialDateModified(
            data.updatedAt?.toDate?.()?.toISOString?.() ||
              data.updatedAt ||
              data.modifiedAt ||
              new Date().toISOString()
          );
        } else {
          // Initialize with default empty data
          setFinancialData({
            assets: 0,
            liabilities: 0,
            equity: 0,
            revenue: 0,
            expenses: 0,
            vatPayable: 0,
          });
          setFixedAssets([]);
          setTrialBalanceEntries([]);
          setFinancialDateModified(new Date().toISOString());
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isPremium) {
      loadFinancialData();
    } else {
      setLoading(false);
    }
  }, [traderId, isPremium]);

  // Save financial data to Firestore
  const saveFinancialData = async (data: any) => {
    try {
      const docRef = doc(db, 'trader_financials', traderId);
      const modifiedAt = new Date().toISOString();
      await setDoc(
        docRef,
        {
          traderId,
          financialData: data.financialData || financialData,
          fixedAssets: data.fixedAssets || fixedAssets,
          trialBalanceEntries: data.trialBalanceEntries || trialBalanceEntries,
          updatedAt: modifiedAt,
          modifiedAt,
        },
        { merge: true }
      );
      setFinancialDateModified(modifiedAt);
    } catch (error) {
      console.error('Error saving financial data:', error);
      throw error;
    }
  };

  const handleUseTrial = () => {
    if (!isPremium && !hasUsedTrial) {
      setHasUsedTrial(true);
      localStorage.setItem(`accounting_trial_used_${traderId}`, 'true');
    }
  };

  if (!isPremium && hasUsedTrial) {
    return (
      <>
        <div className="bg-white p-8 rounded-[2rem] border-2 border-orange-100 shadow-xl shadow-orange-50 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h3 className="text-2xl font-black text-neutral-900 mb-3">
            {t.accounting.upgradeToAccounting}
          </h3>
          <p className="text-neutral-500 font-medium mb-6 text-sm">
            Your one-time trial has ended. Professional accounting is essential for scaling your
            business and staying tax compliant.
          </p>
          <div className="bg-neutral-50 p-4 rounded-xl mb-6 border border-neutral-100">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
              Subscription Fee
            </p>
            <p className="text-3xl font-black text-orange-600">{t.accounting.monthlyFee}</p>
          </div>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full py-4 bg-orange-600 text-white rounded-xl font-black text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-3"
          >
            <Zap size={20} /> Upgrade to Premium
          </button>
        </div>

        <AnimatePresence>
          {showUpgradeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black">Upgrade Subscription</h2>
                    <p className="text-sm text-neutral-500">
                      Pay from wallet to unlock premium accounting.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="text-neutral-500 hover:text-neutral-900"
                  >
                    Close
                  </button>
                </div>
                <div className="p-6">
                  <TraderUpgrade
                    traderId={traderId}
                    currentTier={tier}
                    isTrialActive={false}
                    onUpgrade={() => {
                      setShowUpgradeModal(false);
                      window.location.reload();
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  const tabs: { id: AccountingTab; label: string; icon: any }[] = [
    { id: 'ledger', label: t.accounting.generalLedger, icon: Book },
    { id: 'journal', label: t.accounting.generalJournal, icon: FileText },
    { id: 'cashbook', label: t.accounting.cashBook, icon: Receipt },
    { id: 'sales', label: t.accounting.salesJournal, icon: ShoppingCart },
    { id: 'purchase', label: t.accounting.purchaseJournal, icon: Package },
    { id: 'inventory', label: t.accounting.inventoryBook, icon: BarChart3 },
    { id: 'trial_balance', label: t.accounting.trialBalance, icon: TrendingUp },
    { id: 'financials', label: t.accounting.financialStatements, icon: PieChart },
  ];

  const handleExport = async () => {
    const tabLabel = tabs.find((t) => t.id === activeTab)?.label || 'Report';
    let headers: string[] = [];
    let body: any[][] = [];

    if (activeTab === 'ledger') {
      headers = ['Account Name', 'Balance (RWF)'];
      body = [
        [t.accounting.assets, formatCurrency(financialData.assets)],
        [t.accounting.liabilities, formatCurrency(financialData.liabilities)],
        [t.accounting.equity, formatCurrency(financialData.equity)],
        [t.accounting.revenue, formatCurrency(financialData.revenue)],
        [t.accounting.expenses, formatCurrency(financialData.expenses)],
      ];
    } else if (activeTab === 'inventory') {
      headers = ['Asset Name', 'Cost (RWF)', 'Depreciation Rate', 'Book Value (RWF)'];
      body = fixedAssets.map((asset) => [
        asset.name,
        formatCurrency(asset.cost),
        asset.depreciationRate,
        formatCurrency(asset.bookValue || asset.cost),
      ]);
    } else if (activeTab === 'trial_balance') {
      headers = ['Account Name', 'Debit Balance', 'Credit Balance'];
      body = trialBalanceEntries.map((entry) => [
        entry.accountName,
        entry.debitBalance > 0 ? formatCurrency(entry.debitBalance) : '-',
        entry.creditBalance > 0 ? formatCurrency(entry.creditBalance) : '-',
      ]);
    } else if (activeTab === 'journal') {
      headers = ['Date', 'Description', 'Ref', 'Debit', 'Credit'];
      body = [['Sample Entry', 'Real data will be loaded from transactions', 'REF-001', '0', '0']];
    } else if (activeTab === 'sales') {
      // Fetch real sales data
      const q = query(
        collection(db, 'purchases'),
        where('traderId', '==', traderId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      headers = ['Date', 'Product', 'Customer', 'Amount (RWF)'];
      body = snap.docs.map((doc: any) => {
        const data = doc.data();
        return [
          data.timestamp?.toDate ? format(data.timestamp.toDate(), 'yyyy-MM-dd') : 'N/A',
          data.productName || 'N/A',
          data.customerName || 'N/A',
          formatCurrency(data.amount),
        ];
      });
    } else {
      headers = ['Data', 'Value'];
      body = [['Sample Data', 'Real data will be available after setup']];
    }

    generateAccountingReport(tabLabel, headers, body, 'ESOKO Merchant');
  };

  const buildFinancialStatementRows = (statementType: string) => {
    if (statementType === 'balance_sheet') {
      return {
        headers: ['Account', 'Amount (RWF)'],
        body: [
          ['Assets', formatCurrency(financialData.assets)],
          ['Liabilities', formatCurrency(financialData.liabilities)],
          ['Equity', formatCurrency(financialData.equity)],
          ['Balance Check', formatCurrency(financialData.assets - financialData.liabilities - financialData.equity)],
        ],
      };
    }

    if (statementType === 'profit_loss') {
      return {
        headers: ['Line Item', 'Amount (RWF)'],
        body: [
          ['Revenue', formatCurrency(financialData.revenue)],
          ['Expenses', formatCurrency(financialData.expenses)],
          ['Net Profit', formatCurrency(financialData.revenue - financialData.expenses)],
        ],
      };
    }

    const netCash = financialData.revenue - financialData.expenses;
    return {
      headers: ['Cash Flow Item', 'Amount (RWF)'],
      body: [
        ['Operating cash inflow', formatCurrency(financialData.revenue)],
        ['Operating cash outflow', formatCurrency(financialData.expenses)],
        ['Net operating cash flow', formatCurrency(netCash)],
        ['Closing cash estimate', formatCurrency(financialData.assets - financialData.liabilities)],
      ],
    };
  };

  const handleFinancialStatementExport = (
    statementType: 'balance_sheet' | 'profit_loss' | 'cash_flow',
    label: string
  ) => {
    const reportId = `ACC-${statementType.toUpperCase().replace(/_/g, '-')}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const reportRows = buildFinancialStatementRows(statementType);
    const verificationPayload = JSON.stringify({
      app: 'ESOKO Nexus',
      reportId,
      traderId,
      statementType,
      bookType,
      dateModified: financialDateModified,
      generatedAt: new Date().toISOString(),
    });

    setPendingStatementReport({
      title: label,
      reportId,
      verificationPayload,
      headers: reportRows.headers,
      body: reportRows.body,
    });
  };

  useEffect(() => {
    if (!pendingStatementReport) return;
    const frame = window.requestAnimationFrame(() => {
      const canvas = document.getElementById('accounting-report-qr') as HTMLCanvasElement | null;
      const qrDataUrl = canvas?.toDataURL('image/png');
      generateAccountingReport(
        pendingStatementReport.title,
        pendingStatementReport.headers,
        pendingStatementReport.body,
        'ESOKO Merchant',
        {
          reportId: pendingStatementReport.reportId,
          statementType: pendingStatementReport.title,
          dateModified: new Date(financialDateModified).toLocaleString(),
          verificationPayload: pendingStatementReport.verificationPayload,
          qrDataUrl,
        }
      );
      setPendingStatementReport(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingStatementReport, financialDateModified]);

  return (
    <div className="space-y-8 pb-12" onClick={handleUseTrial}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="animate-spin text-orange-600 mx-auto mb-4" size={32} />
            <p className="text-neutral-500 font-medium">Loading your financial data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                Internal Fiscal Hub
              </h2>
              <p className="text-neutral-500 font-medium text-sm tracking-tight">
                Enterprise-grade multi-ledger accounting and fiscal synchronization.
              </p>
            </div>

            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl border border-neutral-100 dark:border-neutral-700 shadow-inner">
              <button
                onClick={() => setBookType('managerial')}
                className={cn(
                  'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  bookType === 'managerial'
                    ? 'bg-white dark:bg-neutral-900 text-orange-600 shadow-xl'
                    : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                {t.accounting.managerialBooks}
              </button>
              <button
                onClick={() => setBookType('tax')}
                className={cn(
                  'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  bookType === 'tax'
                    ? 'bg-white dark:bg-neutral-900 text-orange-600 shadow-xl'
                    : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                {t.accounting.taxBooks}
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar bg-white dark:bg-neutral-900 p-2 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all',
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-2xl'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-2xl overflow-hidden min-h-[500px]">
            <div className="p-8 border-b border-neutral-50 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-neutral-50/30 dark:bg-neutral-800/20">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl flex items-center justify-center text-orange-600 border border-neutral-100 dark:border-neutral-700">
                  {tabs.find((t) => t.id === activeTab)?.icon &&
                    React.createElement(tabs.find((t) => t.id === activeTab)!.icon, { size: 32 })}
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-neutral-100 tracking-tight">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-orange-500/20">
                      {bookType === 'managerial' ? 'Managerial' : 'Tax/Sync'}
                    </span>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      Live Ledger Synchronization Active
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 shadow-xl"
                >
                  <FileText size={18} /> Export Protocol
                </button>
              </div>
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab + bookType}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {activeTab === 'ledger' && (
                    <LedgerView
                      bookType={bookType}
                      financialData={financialData}
                      isEditing={isEditingLedger}
                      onEdit={() => setIsEditingLedger(true)}
                      onSave={async () => {
                        try {
                          await saveFinancialData({ financialData });
                          setIsEditingLedger(false);
                        } catch (error) {
                          console.error('Failed to save financial data:', error);
                        }
                      }}
                      onCancel={() => {
                        // Reload data to reset changes
                        const loadData = async () => {
                          const docRef = doc(db, 'trader_financials', traderId);
                          const docSnap = await getDoc(docRef);
                          if (docSnap.exists()) {
                            const data = docSnap.data();
                            setFinancialData(data.financialData || financialData);
                          }
                        };
                        loadData();
                        setIsEditingLedger(false);
                      }}
                      onDataChange={setFinancialData}
                    />
                  )}
                  {activeTab === 'journal' && (
                    <JournalView traderId={traderId} bookType={bookType} />
                  )}
                  {activeTab === 'cashbook' && (
                    <CashBookView traderId={traderId} bookType={bookType} />
                  )}
                  {activeTab === 'sales' && (
                    <SalesJournalView traderId={traderId} bookType={bookType} />
                  )}
                  {activeTab === 'purchase' && <PurchaseJournalView bookType={bookType} />}
                  {activeTab === 'inventory' && (
                    <InventoryBookView
                      bookType={bookType}
                      fixedAssets={fixedAssets}
                      isEditing={isEditingAssets}
                      onEdit={() => setIsEditingAssets(true)}
                      onSave={async () => {
                        try {
                          await saveFinancialData({ fixedAssets });
                          setIsEditingAssets(false);
                        } catch (error) {
                          console.error('Failed to save fixed assets:', error);
                        }
                      }}
                      onCancel={() => {
                        // Reload data to reset changes
                        const loadData = async () => {
                          const docRef = doc(db, 'trader_financials', traderId);
                          const docSnap = await getDoc(docRef);
                          if (docSnap.exists()) {
                            const data = docSnap.data();
                            setFixedAssets(data.fixedAssets || []);
                          }
                        };
                        loadData();
                        setIsEditingAssets(false);
                      }}
                      onAssetsChange={setFixedAssets}
                    />
                  )}
                  {activeTab === 'trial_balance' && (
                    <TrialBalanceView
                      bookType={bookType}
                      trialBalanceEntries={trialBalanceEntries}
                      isEditing={isEditingTrialBalance}
                      onEdit={() => setIsEditingTrialBalance(true)}
                      onSave={async () => {
                        try {
                          await saveFinancialData({ trialBalanceEntries });
                          setIsEditingTrialBalance(false);
                        } catch (error) {
                          console.error('Failed to save trial balance:', error);
                        }
                      }}
                      onCancel={() => {
                        // Reload data to reset changes
                        const loadData = async () => {
                          const docRef = doc(db, 'trader_financials', traderId);
                          const docSnap = await getDoc(docRef);
                          if (docSnap.exists()) {
                            const data = docSnap.data();
                            setTrialBalanceEntries(data.trialBalanceEntries || []);
                          }
                        };
                        loadData();
                        setIsEditingTrialBalance(false);
                      }}
                      onEntriesChange={setTrialBalanceEntries}
                    />
                  )}
                  {activeTab === 'financials' && (
                    <FinancialStatementsView
                      bookType={bookType}
                      dateModified={financialDateModified}
                      onExport={handleFinancialStatementExport}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="fixed -left-[9999px] top-0" aria-hidden="true">
            {pendingStatementReport && (
              <QRCodeCanvas
                id="accounting-report-qr"
                value={pendingStatementReport.verificationPayload}
                size={160}
                level="H"
                includeMargin
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LedgerView({
  bookType,
  financialData,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDataChange,
}: {
  bookType: 'managerial' | 'tax';
  financialData: FinancialData;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDataChange: (data: FinancialData) => void;
}) {
  const { t } = useLanguage();

  const accounts = [
    {
      key: 'assets',
      name: t.accounting.assets,
      balance: financialData.assets,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      key: 'liabilities',
      name: t.accounting.liabilities,
      balance: financialData.liabilities,
      color: 'bg-red-50 text-red-600',
    },
    {
      key: 'equity',
      name: t.accounting.equity,
      balance: financialData.equity,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      key: 'revenue',
      name: t.accounting.revenue,
      balance: financialData.revenue,
      color: 'bg-green-50 text-green-600',
    },
    {
      key: 'expenses',
      name: t.accounting.expenses,
      balance: financialData.expenses,
      color: 'bg-orange-50 text-orange-600',
    },
  ];


  const handleInputChange = (key: keyof FinancialData, value: string) => {
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    onDataChange({ ...financialData, [key]: numValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white">General Ledger</h3>
          <p className="text-sm text-neutral-500 font-medium">
            Enter your actual financial balances
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-all"
          >
            <Edit3 size={16} /> Edit Balances
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-600 text-white rounded-xl font-bold text-sm hover:bg-neutral-700 transition-all"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc, i) => (
          <div
            key={i}
            className="p-6 rounded-3xl border-2 border-neutral-50 hover:border-orange-100 transition-all group"
          >
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center mb-4 font-black',
                acc.color
              )}
            >
              {acc.name[0]}
            </div>
            <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">
              {acc.name}
            </p>

            {isEditing ? (
              <input
                type="text"
                value={acc.balance.toLocaleString()}
                onChange={(e) => handleInputChange(acc.key as keyof FinancialData, e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-lg font-black text-neutral-900 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="0"
              />
            ) : (
              <p className="text-2xl font-black text-neutral-900">
                RWF {formatCurrency(acc.balance)}
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-neutral-50 flex justify-between items-center">
              <span className="text-[10px] font-black text-neutral-400 uppercase">
                Last Entry: 2h ago
              </span>
              <button className="text-orange-600 text-xs font-black hover:underline">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-sm text-blue-800 font-medium">
            💡 <strong>Tip:</strong> Enter your actual financial balances from your business
            records. These values will be used for accurate financial reporting and tax
            calculations.
          </p>
        </div>
      )}
    </div>
  );
}

function JournalView({ traderId, bookType }: { traderId: string; bookType: 'managerial' | 'tax' }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', traderId),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        setTransactions(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [traderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-orange-600" size={32} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100">
            <th className="pb-4">Date</th>
            <th className="pb-4">Description</th>
            <th className="pb-4">Ref</th>
            <th className="pb-4 text-right">Debit</th>
            <th className="pb-4 text-right">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {transactions.map((tx, i) => {
            const isDebit = tx.type === 'deposit' || tx.type === 'sale';
            return (
              <tr key={tx.id} className="group hover:bg-neutral-50/50 transition-colors">
                <td className="py-4 text-sm font-bold text-neutral-600">
                  {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'MMM dd, yyyy') : 'N/A'}
                </td>
                <td className="py-4">
                  <p className="text-sm font-black text-neutral-900">
                    {tx.description || tx.type.toUpperCase()}
                  </p>
                  <p className="text-[10px] font-bold text-neutral-400">
                    {tx.method ? tx.method.replace('_', ' ').toUpperCase() : 'N/A'}
                  </p>
                </td>
                <td className="py-4 text-xs font-black text-neutral-400">
                  TX-{tx.id.slice(0, 5).toUpperCase()}
                </td>
                <td className="py-4 text-sm font-black text-neutral-900 text-right">
                  {isDebit ? `RWF ${formatCurrency(tx.amount)}` : 'RWF 0'}
                </td>
                <td className="py-4 text-sm font-black text-neutral-900 text-right">
                  {!isDebit ? `RWF ${formatCurrency(tx.amount)}` : 'RWF 0'}
                </td>
              </tr>
            );
          })}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-12 text-center text-neutral-400 font-medium">
                No journal entries found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CashBookView({
  traderId,
  bookType,
}: {
  traderId: string;
  bookType: 'managerial' | 'tax';
}) {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', traderId),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        setTransactions(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [traderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-orange-600" size={32} />
      </div>
    );
  }

  const receipts = transactions
    .filter((tx) => tx.type === 'deposit' || tx.type === 'sale')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const disbursements = transactions
    .filter(
      (tx) =>
        tx.type === 'withdrawal' ||
        tx.type === 'payment' ||
        tx.type === 'payroll' ||
        tx.type === 'supply'
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h5 className="text-sm font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            {t.accounting.receipts}
          </h5>
          <div className="bg-green-50/30 rounded-3xl p-6 border border-green-100">
            <p className="text-3xl font-black text-green-700">RWF {formatCurrency(receipts)}</p>
            <p className="text-xs font-bold text-green-600/60 mt-1">Total cash inflows</p>
          </div>
        </div>
        <div className="space-y-4">
          <h5 className="text-sm font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            {t.accounting.disbursements}
          </h5>
          <div className="bg-red-50/30 rounded-3xl p-6 border border-red-100">
            <p className="text-3xl font-black text-red-700">RWF {formatCurrency(disbursements)}</p>
            <p className="text-xs font-bold text-red-600/60 mt-1">Total cash outflows</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesJournalView({
  traderId,
  bookType,
}: {
  traderId: string;
  bookType: 'managerial' | 'tax';
}) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchSales = async () => {
      try {
        const q = query(
          collection(db, 'purchases'),
          where('traderId', '==', traderId),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        setSales(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [traderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-orange-600" size={32} />
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="bg-neutral-50 rounded-3xl p-8 border border-neutral-100 text-center">
        <ShoppingCart size={48} className="mx-auto text-neutral-200 mb-4" />
        <p className="text-neutral-500 font-bold">
          Sales Journal data will appear here after your first credit sale.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100">
              <th className="pb-4">Date</th>
              <th className="pb-4">Product</th>
              <th className="pb-4">Customer</th>
              <th className="pb-4 text-right">Amount</th>
              <th className="pb-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {sales.map((sale) => (
              <tr key={sale.id} className="group hover:bg-neutral-50/50 transition-colors">
                <td className="py-4 text-sm font-bold text-neutral-600">
                  {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'MMM dd, yyyy') : 'N/A'}
                </td>
                <td className="py-4">
                  <p className="text-sm font-black text-neutral-900">{sale.productName}</p>
                  <p className="text-[10px] font-bold text-neutral-400">Qty: {sale.quantity}</p>
                </td>
                <td className="py-4 text-sm font-bold text-neutral-600">
                  {sale.customerName || 'Walk-in'}
                </td>
                <td className="py-4 text-sm font-black text-neutral-900 text-right">
                  RWF {formatCurrency(sale.amount)}
                </td>
                <td className="py-4 text-sm font-black text-neutral-900 text-right">
                  RWF {formatCurrency(sale.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseJournalView({ bookType }: { bookType: 'managerial' | 'tax' }) {
  return (
    <div className="bg-neutral-50 rounded-3xl p-8 border border-neutral-100 text-center">
      <Package size={48} className="mx-auto text-neutral-200 mb-4" />
      <p className="text-neutral-500 font-bold">
        Purchase Journal data will appear here after your first inventory restock.
      </p>
    </div>
  );
}

function InventoryBookView({
  bookType,
  fixedAssets,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onAssetsChange,
}: {
  bookType: 'managerial' | 'tax';
  fixedAssets: FixedAsset[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onAssetsChange: (assets: FixedAsset[]) => void;
}) {
  const addAsset = () => {
    const newAsset: FixedAsset = {
      id: Date.now().toString(),
      name: '',
      cost: 0,
      depreciationRate: '10% p.a.',
      bookValue: 0,
    };
    onAssetsChange([...fixedAssets, newAsset]);
  };

  const updateAsset = (id: string, field: keyof FixedAsset, value: string | number) => {
    onAssetsChange(
      fixedAssets.map((asset) => (asset.id === id ? { ...asset, [field]: value } : asset))
    );
  };

  const removeAsset = (id: string) => {
    onAssetsChange(fixedAssets.filter((asset) => asset.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white">
            Fixed Assets & Depreciation
          </h3>
          <p className="text-sm text-neutral-500 font-medium">
            Track your business assets and depreciation
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-all"
          >
            <Edit3 size={16} /> Manage Assets
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={addAsset}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
            >
              <Plus size={16} /> Add Asset
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-600 text-white rounded-xl font-bold text-sm hover:bg-neutral-700 transition-all"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {fixedAssets.length === 0 && !isEditing ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-neutral-200 mb-4" />
            <p className="text-neutral-500 font-bold mb-4">No fixed assets recorded yet</p>
            <button
              onClick={onEdit}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all"
            >
              Add Your First Asset
            </button>
          </div>
        ) : (
          fixedAssets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between p-6 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl hover:shadow-md transition-all"
            >
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={asset.name}
                      onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                      placeholder="Asset name (e.g., Delivery Motorcycle)"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                          Cost (RWF)
                        </label>
                        <input
                          type="text"
                          value={asset.cost.toLocaleString()}
                          onChange={(e) =>
                            updateAsset(
                              asset.id,
                              'cost',
                              parseFloat(e.target.value.replace(/,/g, '')) || 0
                            )
                          }
                          placeholder="0"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                          Depreciation Rate
                        </label>
                        <select
                          value={asset.depreciationRate}
                          onChange={(e) =>
                            updateAsset(asset.id, 'depreciationRate', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                          <option value="5% p.a.">5% per annum</option>
                          <option value="10% p.a.">10% per annum</option>
                          <option value="15% p.a.">15% per annum</option>
                          <option value="20% p.a.">20% per annum</option>
                          <option value="25% p.a.">25% per annum</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-black text-neutral-900 dark:text-white">
                      {asset.name || 'Unnamed Asset'}
                    </p>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      Depreciation: {asset.depreciationRate}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-right ml-4">
                {isEditing ? (
                  <button
                    onClick={() => removeAsset(asset.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <div>
                    <p className="text-sm font-black text-neutral-900 dark:text-white">
                      RWF {formatCurrency(asset.bookValue || asset.cost)}
                    </p>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest line-through">
                      Cost: {formatCurrency(asset.cost)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isEditing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-sm text-blue-800 font-medium">
            💡 <strong>Tip:</strong> Add your business fixed assets like vehicles, equipment,
            furniture, and computers. The system will automatically calculate depreciation based on
            the rate you select.
          </p>
        </div>
      )}
    </div>
  );
}

function TrialBalanceView({
  bookType,
  trialBalanceEntries,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onEntriesChange,
}: {
  bookType: 'managerial' | 'tax';
  trialBalanceEntries: TrialBalanceEntry[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEntriesChange: (entries: TrialBalanceEntry[]) => void;
}) {
  const addEntry = () => {
    const newEntry: TrialBalanceEntry = {
      id: Date.now().toString(),
      accountName: '',
      debitBalance: 0,
      creditBalance: 0,
    };
    onEntriesChange([...trialBalanceEntries, newEntry]);
  };

  const updateEntry = (id: string, field: keyof TrialBalanceEntry, value: string | number) => {
    onEntriesChange(
      trialBalanceEntries.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  const removeEntry = (id: string) => {
    onEntriesChange(trialBalanceEntries.filter((entry) => entry.id !== id));
  };

  const totalDebit = trialBalanceEntries.reduce((sum, entry) => sum + entry.debitBalance, 0);
  const totalCredit = trialBalanceEntries.reduce((sum, entry) => sum + entry.creditBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white">Trial Balance</h3>
          <p className="text-sm text-neutral-500 font-medium">List all your account balances</p>
        </div>
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-all"
          >
            <Edit3 size={16} /> Edit Entries
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={addEntry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
            >
              <Plus size={16} /> Add Account
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-600 text-white rounded-xl font-bold text-sm hover:bg-neutral-700 transition-all"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              <th className="px-8 py-4">Account Name</th>
              <th className="px-8 py-4 text-right">Debit Balance</th>
              <th className="px-8 py-4 text-right">Credit Balance</th>
              {isEditing && <th className="px-8 py-4 w-16"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
            {trialBalanceEntries.length === 0 && !isEditing ? (
              <tr>
                <td colSpan={4} className="px-8 py-12 text-center text-neutral-400 font-medium">
                  No trial balance entries yet. Click "Edit Entries" to add your accounts.
                </td>
              </tr>
            ) : (
              <>
                {trialBalanceEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="font-bold text-sm hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="px-8 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={entry.accountName}
                          onChange={(e) => updateEntry(entry.id, 'accountName', e.target.value)}
                          placeholder="Account name"
                          className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      ) : (
                        entry.accountName || 'Unnamed Account'
                      )}
                    </td>
                    <td className="px-8 py-4 text-right">
                      {isEditing ? (
                        <input
                          type="text"
                          value={entry.debitBalance.toLocaleString()}
                          onChange={(e) =>
                            updateEntry(
                              entry.id,
                              'debitBalance',
                              parseFloat(e.target.value.replace(/,/g, '')) || 0
                            )
                          }
                          placeholder="0"
                          className="w-32 px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl font-bold text-sm text-right focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      ) : entry.debitBalance > 0 ? (
                        `RWF ${formatCurrency(entry.debitBalance)}`
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-8 py-4 text-right">
                      {isEditing ? (
                        <input
                          type="text"
                          value={entry.creditBalance.toLocaleString()}
                          onChange={(e) =>
                            updateEntry(
                              entry.id,
                              'creditBalance',
                              parseFloat(e.target.value.replace(/,/g, '')) || 0
                            )
                          }
                          placeholder="0"
                          className="w-32 px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl font-bold text-sm text-right focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      ) : entry.creditBalance > 0 ? (
                        `RWF ${formatCurrency(entry.creditBalance)}`
                      ) : (
                        '-'
                      )}
                    </td>
                    {isEditing && (
                      <td className="px-8 py-4">
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="bg-neutral-100 dark:bg-neutral-800 font-black text-sm border-t-2 border-neutral-300 dark:border-neutral-600">
                  <td className="px-8 py-4 text-orange-600">TOTALS</td>
                  <td className="px-8 py-4 text-right text-orange-600">
                    RWF {formatCurrency(totalDebit)}
                  </td>
                  <td className="px-8 py-4 text-right text-orange-600">
                    RWF {formatCurrency(totalCredit)}
                  </td>
                  {isEditing && <td></td>}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-sm text-blue-800 font-medium">
            💡 <strong>Tip:</strong> Enter all your business accounts and their current balances.
            Debit balances go in the left column, credit balances in the right. The totals should
            balance for accurate financial reporting.
          </p>
        </div>
      )}
    </div>
  );
}

function FinancialStatementsView({
  bookType,
  dateModified,
  onExport,
}: {
  bookType: 'managerial' | 'tax';
  dateModified: string;
  onExport: (type: 'balance_sheet' | 'profit_loss' | 'cash_flow', label: string) => void;
}) {
  const { t } = useLanguage();
  const modifiedLabel = Number.isNaN(new Date(dateModified).getTime())
    ? dateModified
    : new Date(dateModified).toLocaleString();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-orange-50 border border-orange-100 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">
            Verified PDF Statements
          </p>
          <p className="text-sm font-bold text-neutral-600">
            Each report includes a QR verification code and date modified.
          </p>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
          Date modified: {modifiedLabel}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            type: 'balance_sheet' as const,
            label: t.accounting.balanceSheet,
            icon: PieChart,
            color: 'text-blue-600 bg-blue-50',
          },
          {
            type: 'profit_loss' as const,
            label: t.accounting.profitAndLoss,
            icon: BarChart3,
            color: 'text-green-600 bg-green-50',
          },
          {
            type: 'cash_flow' as const,
            label: t.accounting.cashFlow,
            icon: TrendingUp,
            color: 'text-orange-600 bg-orange-50',
          },
        ].map((sheet) => (
          <button
            key={sheet.type}
            type="button"
            onClick={() => onExport(sheet.type, sheet.label)}
            className="p-8 rounded-[2.5rem] border-2 border-neutral-50 hover:border-orange-600 hover:shadow-xl transition-all group text-center"
          >
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110',
                sheet.color
              )}
            >
              <sheet.icon size={32} />
            </div>
            <h5 className="text-lg font-black text-neutral-900 mb-2">{sheet.label}</h5>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Generate Verified PDF
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
