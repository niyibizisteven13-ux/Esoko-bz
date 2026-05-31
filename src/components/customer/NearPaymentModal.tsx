import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  CreditCard,
  Hash,
  Loader2,
  Nfc,
  Phone,
  QrCode,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

type NearPaymentMethod = 'nfc' | 'qr' | 'momo' | 'airtel' | 'wallet' | 'merchant-code';

interface NearPaymentModalProps {
  product?: any;
  trader?: any;
  onClose: () => void;
  onBuy?: (product: any) => void;
}

const methodConfig: Array<{
  id: NearPaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'nfc',
    label: 'NFC Tap',
    description: 'Use supported Android/browser NFC devices for a tap style payment handoff.',
    icon: <Nfc size={18} />,
  },
  {
    id: 'qr',
    label: 'QR Pay',
    description: 'Show or scan a code when the phone or merchant does not support NFC.',
    icon: <QrCode size={18} />,
  },
  {
    id: 'momo',
    label: 'MTN MoMo',
    description: 'Prepare a MoMo request-to-pay flow for this merchant.',
    icon: <Smartphone size={18} />,
  },
  {
    id: 'airtel',
    label: 'Airtel Money',
    description: 'Prepare an Airtel Money collection flow.',
    icon: <Phone size={18} />,
  },
  {
    id: 'wallet',
    label: 'Wallet',
    description: 'Pay from the local in-app wallet balance.',
    icon: <Wallet size={18} />,
  },
  {
    id: 'merchant-code',
    label: 'Code',
    description: 'Use a short merchant/payment code for feature phones and weak internet.',
    icon: <Hash size={18} />,
  },
];

function buildReference(product?: any, trader?: any) {
  const seed = `${product?.id || 'market'}-${trader?.id || product?.traderId || 'trader'}-${Date.now()}`;
  return `NEX-${seed.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
}

export default function NearPaymentModal({ product, trader, onClose, onBuy }: NearPaymentModalProps) {
  const [method, setMethod] = useState<NearPaymentMethod>('nfc');
  const [status, setStatus] = useState<'idle' | 'listening' | 'ready' | 'completed'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const paymentRef = useMemo(() => buildReference(product, trader), [product, trader]);
  const merchantName = trader?.businessName || trader?.name || product?.traderName || 'Merchant';
  const amount = Number(product?.price || 0);
  const nfcAvailable = typeof window !== 'undefined' && 'NDEFReader' in window;

  const payload = useMemo(
    () => ({
      type: 'esoko-near-payment',
      reference: paymentRef,
      merchantId: trader?.id || product?.traderId || 'unknown',
      merchantName,
      productId: product?.id,
      productName: product?.name,
      amount,
      currency: 'RWF',
      method,
      createdAt: new Date().toISOString(),
    }),
    [amount, merchantName, method, paymentRef, product, trader]
  );

  const savePendingPayment = () => {
    const existing = JSON.parse(localStorage.getItem('esoko_near_payments') || '[]');
    localStorage.setItem('esoko_near_payments', JSON.stringify([payload, ...existing].slice(0, 25)));
  };

  const beginPayment = async () => {
    setMessage(null);
    setStatus('listening');

    try {
      savePendingPayment();

      if (method === 'nfc') {
        if (!nfcAvailable) {
          setStatus('ready');
          setMessage('NFC handoff is not available on this browser. Use QR, code, or mobile money.');
          return;
        }

        const NDEFReaderCtor = (window as any).NDEFReader;
        const ndef = new NDEFReaderCtor();
        await ndef.scan();
        setStatus('ready');
        setMessage('NFC reader is active. Tap a merchant tag or terminal handoff tag.');
        return;
      }

      setStatus('ready');
      setMessage(`${methodConfig.find((item) => item.id === method)?.label} payment is ready.`);
    } catch (error) {
      setStatus('ready');
      setMessage(error instanceof Error ? error.message : 'Could not start this payment method.');
    }
  };

  const completeDemoPayment = () => {
    savePendingPayment();
    setStatus('completed');
    setMessage('Payment request saved locally and marked ready for merchant confirmation.');
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-[#0a0a0a] border border-white/10 shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/5 p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">
              Universal Near Pay
            </p>
            <h3 className="text-2xl font-black text-white leading-tight">{merchantName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/5 text-neutral-400 hover:text-white border border-white/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {methodConfig.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMethod(item.id);
                    setStatus('idle');
                    setMessage(null);
                  }}
                  className={cn(
                    'text-left p-4 rounded-2xl border transition-all',
                    method === item.id
                      ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/30'
                      : 'bg-white/5 text-neutral-300 border-white/5 hover:border-orange-500/30'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-75">{item.description}</p>
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/5 p-5 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  Amount
                </p>
                <p className="text-2xl font-black text-orange-500">
                  {amount > 0 ? `${formatCurrency(amount)} RWF` : 'Open amount'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  Reference
                </p>
                <p className="font-black text-white tracking-widest">{paymentRef}</p>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/5 p-4">
                <p className="text-[10px] font-bold text-neutral-400 leading-relaxed">
                  This module keeps the app self-contained. Real MoMo, Airtel, bank, or card
                  settlement can be connected behind the same method buttons when your PSP access is
                  ready.
                </p>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={cn(
                'p-4 rounded-2xl border text-sm font-bold flex items-center gap-3',
                status === 'completed'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
              )}
            >
              {status === 'completed' ? <BadgeCheck size={18} /> : <CreditCard size={18} />}
              {message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={beginPayment}
              disabled={status === 'listening'}
              className="flex-1 py-4 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {status === 'listening' ? <Loader2 className="animate-spin" size={18} /> : <Nfc size={18} />}
              Start Near Payment
            </button>
            <button
              type="button"
              onClick={completeDemoPayment}
              className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
            >
              Mark Ready
            </button>
            {product && onBuy && (
              <button
                type="button"
                onClick={() => onBuy(product)}
                className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all"
              >
                Buy Item
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
