import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Download,
  Loader2,
  Mic,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import {
  exportCreditScore,
  getBusinessSurvivalSnapshot,
  postVoiceLedgerEntry,
  runGroupOrderAggregation,
  type BusinessFailureRisk,
} from '../../services/businessSurvivalService';
import { saveLocalLedgerEntry } from '../../services/localFirstStore';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function riskClasses(risk?: BusinessFailureRisk) {
  if (risk?.level === 'high') return 'border-red-500/30 bg-red-500/10 text-red-100';
  if (risk?.level === 'watch') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
}

export default function BusinessSurvivalPanel({ traderId }: { traderId: string }) {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voiceText, setVoiceText] = useState('');
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');

  const speechSupported = useMemo(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const response = await getBusinessSurvivalSnapshot(traderId);
      setSnapshot(response);
    } catch (error) {
      console.error('Failed to load survival snapshot', error);
      setStatus('Ntibyashobotse kubona amakuru. Reba internet wongere ugerageze.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, [traderId]);

  const startListening = () => {
    if (!speechSupported) {
      setStatus('Telefone/browser yawe ntishyigikira voice. Andika ibyo wavuze hasi.');
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = 'rw-RW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setStatus('Voice ntiyumvikanye neza. Ongera ugerageze cyangwa wandike.');
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setVoiceText(transcript);
    };
    recognition.start();
  };

  const submitVoiceLedger = async () => {
    if (!voiceText.trim()) return;
    setVoiceSaving(true);
    setStatus('');
    try {
      const response: any = await postVoiceLedgerEntry({
        traderId,
        rawText: voiceText.trim(),
        language: 'rw',
      });
      if (response.offline) {
        await saveLocalLedgerEntry(traderId, {
          rawText: voiceText.trim(),
          status: 'offline_pending',
          createdAt: new Date().toISOString(),
        });
        setStatus('Byabitswe offline. Bizajya kuri server internet igarutse.');
      } else {
        setStatus('Byanditswe muri ledger.');
      }
      setVoiceText('');
      await loadSnapshot();
    } catch (error: any) {
      setStatus(error?.message || 'Ntibyashobotse kubika ledger.');
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleExportScore = async () => {
    const response = await exportCreditScore(traderId);
    downloadJson(`esoko-credit-score-${traderId}.json`, response.export);
  };

  const handleGroupRun = async () => {
    setStatus('');
    const response = await runGroupOrderAggregation(50);
    setStatus(
      response.activated.length
        ? `Group Buy yakozwe: ${response.activated.length}`
        : 'Nta group order nshya iragera ku bacuruzi 50.'
    );
    await loadSnapshot();
  };

  const creditScore = snapshot?.creditScore;
  const risk = snapshot?.failureRisk as BusinessFailureRisk | undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">
            Kwirinda Igihombo
          </p>
          <h3 className="text-2xl font-black text-white">Business Survival</h3>
        </div>
        <button
          type="button"
          onClick={loadSnapshot}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-8 text-center text-white/50">
          <Loader2 className="mx-auto mb-3 animate-spin text-orange-500" />
          Turimo kureba uko ubucuruzi buhagaze...
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-5">
              <div className="mb-4 flex items-center justify-between">
                <Banknote className="text-orange-500" size={28} />
                <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-white/60">
                  Bank export
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Credit Score
              </p>
              <p className="mt-1 text-4xl font-black text-white">
                {creditScore?.score || 0}
                <span className="ml-2 text-base text-orange-500">{creditScore?.grade}</span>
              </p>
              <button
                type="button"
                onClick={handleExportScore}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
              >
                <Download size={16} /> Export
              </button>
            </div>

            <div className={cn('rounded-3xl border p-5', riskClasses(risk))}>
              <div className="mb-4 flex items-center justify-between">
                <AlertTriangle size={28} />
                <span className="rounded-full bg-black/20 px-3 py-1 text-[10px] font-black uppercase">
                  {risk?.level || 'healthy'}
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                Personal / Revenue
              </p>
              <p className="mt-1 text-4xl font-black">{Math.round((risk?.ratio || 0) * 100)}%</p>
              <p className="mt-3 text-xs font-bold leading-relaxed opacity-90">{risk?.messageRw}</p>
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-5">
              <PackagePlus className="mb-4 text-blue-400" size={28} />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Group Buy
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {snapshot?.groupOrders?.length || 0} active
              </p>
              <button
                type="button"
                onClick={handleGroupRun}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
              >
                <ShieldCheck size={16} /> Check Demand
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400">
                  Voice Bookkeeping
                </p>
                <h4 className="text-lg font-black text-white">Vuga igicuruzwa cyangwa expense</h4>
              </div>
              <button
                type="button"
                onClick={startListening}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest text-white',
                  listening ? 'bg-red-600' : 'bg-emerald-600'
                )}
              >
                <Mic size={18} /> {listening ? 'Listening' : 'Vuga'}
              </button>
            </div>
            <textarea
              value={voiceText}
              onChange={(event) => setVoiceText(event.target.value)}
              placeholder="Urugero: Nagurishije isukari 12000 cash. Cyangwa: Nakoresheje 5000 ku rugo."
              className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-[#050505] p-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
            />
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white/50">
                {!navigator.onLine && <WifiOff size={14} className="text-yellow-400" />}
                Kinyarwanda first. Offline entries queue automatically.
              </div>
              <button
                type="button"
                onClick={submitVoiceLedger}
                disabled={voiceSaving || !voiceText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {voiceSaving ? <Loader2 className="animate-spin" size={16} /> : <Banknote size={16} />}
                Bika muri Ledger
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(snapshot?.groupOrders || []).slice(0, 4).map((order: any) => (
              <div key={order.id} className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Wholesale Opportunity
                </p>
                <h4 className="mt-1 text-lg font-black text-white">{order.itemName}</h4>
                <p className="mt-2 text-xs font-bold text-white/50">
                  {order.participantCount} traders. Qty {order.totalQuantity}
                </p>
              </div>
            ))}
            <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                30-day revenue
              </p>
              <p className="mt-1 text-xl font-black text-white">
                RWF {formatCurrency(risk?.revenue || 0)}
              </p>
              <p className="mt-2 text-xs font-bold text-white/50">
                Personal: RWF {formatCurrency(risk?.personalExpenses || 0)}
              </p>
            </div>
          </div>
        </>
      )}

      {status && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/70">
          {status}
        </div>
      )}
    </div>
  );
}
