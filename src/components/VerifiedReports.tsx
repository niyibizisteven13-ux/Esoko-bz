import React, { useMemo, useRef, useState } from 'react';
import { Download, CalendarDays, ShieldCheck, FileText } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { formatCurrency, toDate, cn } from '../lib/utils';
import { generateVerifiedActivityReport } from '../lib/verifiedReportGenerator';

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

interface VerifiedReportsProps {
  userId: string;
  userName: string;
  role: string;
  transactions?: any[];
  purchases?: any[];
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function checksum(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, '0');
}

function getRecordDate(record: any) {
  return toDate(record.timestamp || record.createdAt || record.updatedAt || new Date());
}

function money(value: any) {
  return Number(value || 0);
}

export default function VerifiedReports({
  userId,
  userName,
  role,
  transactions = [],
  purchases = [],
}: VerifiedReportsProps) {
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [isGenerating, setIsGenerating] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);

    if (period === 'week') start.setDate(now.getDate() - 6);
    if (period === 'month') start.setMonth(now.getMonth() - 1);
    if (period === 'year') start.setFullYear(now.getFullYear() - 1);
    if (period === 'custom') {
      return {
        start: startOfDay(new Date(customStart)),
        end: endOfDay(new Date(customEnd)),
        label: `${customStart} to ${customEnd}`,
      };
    }

    return {
      start,
      end,
      label:
        period === 'today'
          ? 'Today'
          : period === 'week'
            ? 'Last 7 Days'
            : period === 'month'
              ? 'Last Month'
              : 'Last Year',
    };
  }, [customEnd, customStart, period]);

  const report = useMemo(() => {
    const inRange = (record: any) => {
      const date = getRecordDate(record);
      return date >= range.start && date <= range.end;
    };

    const saleBackedTypes = new Set(['purchase', 'sale']);
    const periodTransactions = transactions
      .filter(inRange)
      .filter((tx) => !(role === 'trader' && purchases.length > 0 && saleBackedTypes.has(String(tx.type))));
    const periodPurchases = purchases.filter(inRange);
    const rows = [
      ...periodTransactions.map((tx) => ({
        date: getRecordDate(tx),
        type: tx.type || 'transaction',
        description: tx.description || tx.productName || tx.reference || 'Transaction',
        amount: money(tx.amount),
        status: tx.status || 'completed',
        direction:
          ['deposit', 'sale', 'payment_in', 'refund'].includes(String(tx.type)) ||
          tx.recipientId === userId
            ? 'in'
            : 'out',
      })),
      ...periodPurchases.map((purchase) => ({
        date: getRecordDate(purchase),
        type: role === 'trader' ? 'sale' : 'purchase',
        description: purchase.productName || purchase.description || 'Purchase',
        amount: money(purchase.amount || purchase.totalAmount),
        status: purchase.status || 'approved',
        direction: role === 'trader' ? 'in' : 'out',
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const income = rows
      .filter((row) => row.direction === 'in')
      .reduce((sum, row) => sum + row.amount, 0);
    const spending = rows
      .filter((row) => row.direction === 'out')
      .reduce((sum, row) => sum + row.amount, 0);
    const deliveryCount = periodPurchases.filter((purchase) =>
      Boolean(
        purchase.isDelivery ||
          (purchase.deliveryStatus && String(purchase.deliveryStatus).toLowerCase() !== 'n/a')
      )
    ).length;
    const seed = `${userId}|${role}|${range.start.toISOString()}|${range.end.toISOString()}|${income}|${spending}|${rows.length}`;
    const verificationCode = checksum(seed);
    const reportId = `RPT-${verificationCode}-${Date.now().toString(36).toUpperCase()}`;
    const verificationPayload = JSON.stringify({
      app: 'ESOKO Nexus',
      reportId,
      userId,
      role,
      period: range.label,
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      verificationCode,
    });

    return {
      reportId,
      verificationCode,
      verificationPayload,
      rows,
      summary: {
        income,
        spending,
        net: income - spending,
        transactionCount: periodTransactions.length,
        purchaseCount: periodPurchases.length,
        deliveryCount,
      },
    };
  }, [purchases, range, role, transactions, userId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const canvas = qrCanvasRef.current ?? (document.getElementById('verified-report-qr') as HTMLCanvasElement | null);
      generateVerifiedActivityReport({
        reportId: report.reportId,
        title: `${role} Activity Report`,
        ownerName: userName || 'ESOKO User',
        ownerRole: role,
        ownerId: userId,
        periodLabel: range.label,
        startDate: range.start.toLocaleDateString(),
        endDate: range.end.toLocaleDateString(),
        generatedAt: new Date().toLocaleString(),
        verificationCode: report.verificationCode,
        qrDataUrl: canvas?.toDataURL('image/png'),
        summary: report.summary,
        rows: report.rows.map((row) => [
          row.date.toLocaleString(),
          row.type,
          row.description,
          `RWF ${formatCurrency(row.amount)}`,
          row.status,
        ]),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
            Verified Reports
          </h2>
          <p className="text-neutral-500 font-medium text-sm">
            Generate activity reports with QR verification for any period.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-600 text-white text-xs font-black uppercase tracking-widest hover:bg-orange-700 disabled:opacity-60"
        >
          <Download size={16} />
          {isGenerating ? 'Generating' : 'Download PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] p-5 space-y-5">
          <div className="flex items-center gap-2 text-neutral-900 dark:text-white">
            <CalendarDays size={18} className="text-orange-600" />
            <h3 className="font-black uppercase tracking-widest text-xs">Report Period</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={cn(
                  'px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                  period === item
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-neutral-50 text-neutral-500 hover:text-neutral-900 dark:bg-neutral-800 dark:hover:text-white'
                )}
              >
                {item === 'today' ? 'Any Day' : item}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  Start Date
                </span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="w-full rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 px-4 py-3 text-sm font-bold dark:text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  End Date
                </span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="w-full rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 px-4 py-3 text-sm font-bold dark:text-white"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Income" value={`RWF ${formatCurrency(report.summary.income)}`} />
            <Metric label="Spending" value={`RWF ${formatCurrency(report.summary.spending)}`} />
            <Metric label="Net" value={`RWF ${formatCurrency(report.summary.net)}`} />
            <Metric label="Records" value={report.rows.length.toLocaleString()} />
          </div>
        </div>

        <div className="bg-slate-950 text-white rounded-[2rem] p-5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="font-black uppercase tracking-widest text-xs">Verification</h3>
          </div>
          <div className="bg-white rounded-2xl p-3 w-fit">
            <QRCodeCanvas
              id="verified-report-qr"
              ref={qrCanvasRef}
              value={report.verificationPayload}
              size={150}
              level="H"
              includeMargin
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">
              Code
            </p>
            <p className="font-black text-lg tracking-widest">{report.verificationCode}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
          <FileText size={18} className="text-orange-600" />
          <h3 className="font-black uppercase tracking-widest text-xs dark:text-white">
            Report Preview
          </h3>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {report.rows.slice(0, 8).map((row, index) => (
            <div key={`${row.date.toISOString()}-${index}`} className="p-4 flex justify-between gap-4">
              <div>
                <p className="text-sm font-black dark:text-white">{row.description}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  {row.type} - {row.status}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-orange-600">
                  RWF {formatCurrency(row.amount)}
                </p>
                <p className="text-[10px] font-bold text-neutral-400">
                  {row.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {report.rows.length === 0 && (
            <div className="p-10 text-center text-neutral-500 text-sm font-bold">
              No records found for this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
        {label}
      </p>
      <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}
