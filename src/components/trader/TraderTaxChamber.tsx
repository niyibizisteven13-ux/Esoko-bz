import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Building2,
  Lock,
  Zap,
  HardDrive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { cn, formatCurrency } from '../../lib/utils';
import { collection, query, where, getDocs, orderBy, limit } from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge

export default function TraderTaxChamber({
  traderId,
  userData,
}: {
  traderId: string;
  userData: any;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'standing' | 'ebm' | 'reports'>('standing');
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
            Business Health Center
          </h2>
          <p className="text-neutral-500 font-medium text-sm tracking-tight">
            Compliance score, invoice readiness and device synchronization for your trading
            operation.
          </p>
        </div>

        <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-inner shrink-0">
          <button
            onClick={() => setActiveTab('standing')}
            className={cn(
              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              activeTab === 'standing'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-xl'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            )}
          >
            Health
          </button>
          <button
            onClick={() => setActiveTab('ebm')}
            className={cn(
              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              activeTab === 'ebm'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-xl'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            )}
          >
            EBM Device
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              activeTab === 'reports'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-xl'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            )}
          >
            Reports
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-4"
        >
          {activeTab === 'standing' && <StandingView traderId={traderId} userData={userData} />}
          {activeTab === 'ebm' && <EBMView userData={userData} />}
          {activeTab === 'reports' && <ReportsView traderId={traderId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StandingView({ traderId, userData }: { traderId: string; userData: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight">
              Business Integrity Rating
            </h4>
            <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg font-black text-[9px] uppercase tracking-widest">
              A+ Rating
            </div>
          </div>

          <div className="flex items-center gap-8 mb-8">
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-neutral-100 dark:text-neutral-800 stroke-current"
                  strokeWidth="10"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-blue-600 stroke-current"
                  strokeWidth="10"
                  strokeLinecap="round"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - 0.94)}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-neutral-900 dark:text-white leading-none">
                  94
                </span>
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">
                  Excellent
                </span>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              <StandingMetric label="VAT Reporting Consistency" score={98} />
              <StandingMetric label="EBM Device Uptime" score={100} />
              <StandingMetric label="Tax Reliability" score={85} />
              <StandingMetric label="Accounting Integrity" score={92} />
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center text-xs font-bold text-neutral-400 italic">
            <span>* Score calculated based on the last 12 months of RRA interactions.</span>
            <button className="text-blue-600 font-black flex items-center gap-2 hover:underline">
              View Full Audit <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FiscalStatusCard
            title="VAT Quarter 1"
            status="approved"
            date="Mar 31, 2026"
            amount="RWF 2,844,000"
            icon={CheckCircle2}
            color="text-green-600"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <FiscalStatusCard
            title="Annual Income Tax"
            status="pending"
            date="Due Apr 30, 2026"
            amount="Estimated: RWF 1.2M"
            icon={Clock}
            color="text-orange-600"
            bgColor="bg-orange-50 dark:bg-orange-900/20"
          />
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-neutral-900 dark:bg-black p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl" />
          <h4 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
            <Calendar size={20} className="text-blue-400" /> Tax Calendar
          </h4>
          <div className="space-y-6">
            <CalendarItem
              date="15 Apr"
              title="PAYE Declaration"
              desc="Monthly payroll tax due"
              isUrgent
            />
            <CalendarItem
              date="15 Apr"
              title="RSSB Contributions"
              desc="Pension + Maternity contributions"
              isUrgent
            />
            <CalendarItem
              date="30 Apr"
              title="VAT Monthly Returns"
              desc="For March 2026 transactions"
            />
            <CalendarItem date="25 May" title="Local Gov Fees" desc="Trade license renewal" />
          </div>
          <button className="w-full mt-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/5">
            Sync to Google Calendar
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-8 rounded-[3rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-lg">
          <h4 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
            <Building2 size={20} className="text-blue-600" /> Business Registration
          </h4>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                TIN
              </p>
              <p className="font-black text-neutral-900 dark:text-white">
                {userData?.tin || '---'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Registration Date
              </p>
              <p className="font-bold text-neutral-700 dark:text-neutral-300">Jan 12, 2022</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Tax Office
              </p>
              <p className="font-bold text-neutral-700 dark:text-neutral-300">
                Kigali, City Center Hub
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EBMView({ userData }: { userData: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
      <div className="bg-neutral-900 dark:bg-black p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
          <HardDrive size={200} />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h3 className="text-3xl font-black tracking-tight mb-2">EBM Serial #774-22</h3>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
                Device Online
              </span>
            </div>
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
              <Zap size={28} className="text-orange-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                RRA Link Status
              </p>
              <p className="text-xl font-bold">Synchronized</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                Last Signature
              </p>
              <p className="text-xl font-bold">Today, 10:42 AM</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-xs font-bold text-white/60">Total VCDC Invoices Issued</p>
              <p className="text-lg font-black">1,492</p>
            </div>
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-xs font-bold text-white/60">Total SDC Transactions</p>
              <p className="text-lg font-black">RWF 14.8M</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 p-10 rounded-[3rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-xl flex flex-col justify-between">
        <div>
          <h4 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight mb-6">
            Device Configuration
          </h4>
          <div className="space-y-6 mb-10">
            <ConfigItem label="Communication Port" value="SSL/TLS Handshake (Port 443)" />
            <ConfigItem label="Encryption Algorithm" value="AES-256 HMAC-SHA256" />
            <ConfigItem label="Data Residency" value="RRA Central SDC Server (Kigali)" />
          </div>
        </div>
        <div className="flex gap-4">
          <button className="flex-1 py-5 bg-neutral-900 dark:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
            Restart EBM Service
          </button>
          <button className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/10">
            Manual Audit Push
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsView({ traderId }: { traderId: string }) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-[3rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-xl overflow-hidden">
      <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
        <h4 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
          <FileText size={24} className="text-blue-600" /> Exportable Tax Documents
        </h4>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={14} /> Filter
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-neutral-50/50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
            <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              <th className="px-8 py-5">Document Name</th>
              <th className="px-8 py-5">Type</th>
              <th className="px-8 py-5">Frequency</th>
              <th className="px-8 py-5">Last Generated</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            <ReportRow
              name="RRA Form 01 - Monthly VAT"
              type="Regulatory"
              freq="Monthly"
              date="Apr 01, 2026"
            />
            <ReportRow
              name="Withholding Tax Summary"
              type="Regulatory"
              freq="Monthly"
              date="Mar 31, 2026"
            />
            <ReportRow
              name="PAYE Tax Declaration"
              type="Payable"
              freq="Monthly"
              date="Mar 20, 2026"
            />
            <ReportRow
              name="CIT (Corporate Income Tax)"
              type="Regulatory"
              freq="Annual"
              date="Jan 15, 2026"
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StandingMetric({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="text-neutral-400">{label}</span>
        <span
          className={cn(
            score > 90 ? 'text-green-600' : score > 80 ? 'text-blue-600' : 'text-orange-600'
          )}
        >
          {score}%
        </span>
      </div>
      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={cn(
            'h-full rounded-full',
            score > 90 ? 'bg-green-600' : score > 80 ? 'bg-blue-600' : 'bg-orange-600'
          )}
        />
      </div>
    </div>
  );
}

function FiscalStatusCard({ title, status, date, amount, icon: Icon, color, bgColor }: any) {
  return (
    <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-50 dark:border-neutral-800 p-6 rounded-3xl hover:border-blue-200 transition-all flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110',
            bgColor,
            color
          )}
        >
          <Icon size={24} />
        </div>
        <div>
          <h5 className="font-black text-neutral-900 dark:text-white leading-tight">{title}</h5>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-neutral-900 dark:text-white">{amount}</p>
        <span className={cn('text-[9px] font-black uppercase tracking-tighter', color)}>
          {status}
        </span>
      </div>
    </div>
  );
}

function CalendarItem({ date, title, desc, isUrgent }: any) {
  return (
    <div className="flex gap-4 group cursor-default">
      <div
        className={cn(
          'w-12 h-12 rounded-2xl flex flex-col items-center justify-center border shrink-0 transition-all group-hover:bg-blue-600 group-hover:border-blue-600',
          isUrgent
            ? 'bg-orange-600 border-orange-600 text-white'
            : 'bg-white/5 border-white/10 text-white/60'
        )}
      >
        <span className="text-xs font-black leading-none">{date.split(' ')[0]}</span>
        <span className="text-[8px] font-bold uppercase">{date.split(' ')[1]}</span>
      </div>
      <div className="flex-1">
        <h5 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">
          {title}
        </h5>
        <p className="text-[10px] text-white/40 font-medium leading-tight">{desc}</p>
      </div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-5">
      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
      <div>
        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{value}</p>
      </div>
    </div>
  );
}

function ReportRow({ name, type, freq, date }: any) {
  return (
    <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors group">
      <td className="px-8 py-5">
        <p className="font-black text-neutral-900 dark:text-white">{name}</p>
        <p className="text-[10px] font-bold text-neutral-400 tracking-widest uppercase">
          System Generated
        </p>
      </td>
      <td className="px-8 py-5">
        <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
          {type}
        </span>
      </td>
      <td className="px-8 py-5 text-sm font-bold text-neutral-500">{freq}</td>
      <td className="px-8 py-5 text-sm font-bold text-neutral-500">{date}</td>
      <td className="px-8 py-5 text-right">
        <button className="p-2.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
          <Download size={20} />
        </button>
      </td>
    </tr>
  );
}
