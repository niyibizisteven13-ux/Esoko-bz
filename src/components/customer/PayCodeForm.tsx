import React, { useState } from 'react';
import { auth } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  User,
  Search,
  Hash,
  Star,
  Store,
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { calculateIncentives, IncentiveProgram } from '../../lib/incentiveUtils';
import TraderShop from './TraderShop';

interface PayCodeFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  userBalance: number;
  tier?: 'free' | 'premium';
}

export default function PayCodeForm({
  onClose,
  onSuccess,
  userBalance,
  tier = 'free',
}: PayCodeFormProps) {
  const { t } = useLanguage();
  const [traderTin, setTraderTin] = useState('');
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState('1');

  const [product, setProduct] = useState<any>(null);
  const [trader, setTrader] = useState<any>(null);
  const [incentivePrograms, setIncentivePrograms] = useState<IncentiveProgram[]>([]);
  const [appliedIncentives, setAppliedIncentives] = useState<string[]>([]);
  const [pointsToEarn, setPointsToEarn] = useState(0);
  const [originalAmount, setOriginalAmount] = useState(0);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'looking' | 'processing' | 'success' | 'error' | 'pin_required'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [userPin, setUserPin] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [showShop, setShowShop] = useState(false);

  // Fetch user's PIN
  React.useEffect(() => {
    const fetchPin = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserPin(userDoc.data().transactionPin || null);
        }
      } catch (err) {
        console.error('Error fetching user PIN:', err);
      }
    };
    fetchPin();
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traderTin || !productCode) return;

    setLoading(true);
    setStatus('looking');
    setError(null);

    try {
      const normalizedTin = traderTin.toUpperCase().trim();
      const normalizedCode = productCode.toUpperCase().trim();

      // 1. Find Trader by TIN
      const traderQuery = query(
        collection(db, 'users'),
        where('tin', '==', normalizedTin),
        where('role', '==', 'trader')
      );
      const traderSnapshot = await getDocs(traderQuery);

      if (traderSnapshot.empty) {
        throw new Error(t.customer.traderNotFound);
      }

      const traderDoc = traderSnapshot.docs[0];
      const traderData = { id: traderDoc.id, ...traderDoc.data() } as any;
      setTrader(traderData);

      // 2. Find Product by Code and Trader ID
      const productQuery = query(
        collection(db, 'products'),
        where('code', '==', normalizedCode),
        where('traderId', '==', traderDoc.id)
      );
      const productSnapshot = await getDocs(productQuery);

      if (productSnapshot.empty) {
        throw new Error(t.customer.productNotFound);
      }

      const productData = {
        id: productSnapshot.docs[0].id,
        ...productSnapshot.docs[0].data(),
      } as any;
      setProduct(productData);

      const qty = Number(quantity) || 1;
      setOriginalAmount(productData.price * qty);

      // Fetch incentives
      const incentiveSnapshot = await getDocs(
        query(
          collection(db, 'incentive_programs'),
          where('traderId', '==', traderDoc.id),
          where('active', '==', true)
        )
      );
      const programs = incentiveSnapshot.docs.map(
        (doc: any) => ({ id: doc.id, ...doc.data() }) as IncentiveProgram
      );
      setIncentivePrograms(programs);

      // Calculate incentives
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const {
            finalAmount,
            pointsEarned,
            appliedIncentives: applied,
          } = calculateIncentives(productData.price * qty, qty, programs, userDoc.data());
          setAmount(finalAmount.toString());
          setPointsToEarn(pointsEarned);
          setAppliedIncentives(applied);
        }
      }

      setStatus('idle');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to lookup details');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!auth.currentUser || !product || !trader) return;

    const payAmount = Number(amount);
    const qty = Number(quantity) || 1;

    if (isNaN(payAmount) || payAmount <= 0) {
      setError('Invalid amount');
      return;
    }

    if (userBalance < payAmount) {
      setError('Insufficient balance. Please add money to your wallet.');
      return;
    }

    if (userPin && status !== 'pin_required') {
      setStatus('pin_required');
      return;
    }

    if (userPin && enteredPin !== userPin) {
      setError(t.common.pinMismatch);
      setEnteredPin('');
      return;
    }

    setLoading(true);
    setStatus('processing');

    try {
      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'users', auth.currentUser!.uid);
        const traderRef = doc(db, 'users', trader.id);

        const [customerDoc, tDoc] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(traderRef),
        ]);

        if (!customerDoc.exists()) throw new Error('Customer not found');
        if (!tDoc.exists()) throw new Error('Trader not found');

        const customerBalance = customerDoc.data().walletBalance || 0;
        const currentPoints = customerDoc.data().points || 0;

        if (customerBalance < payAmount) {
          throw new Error('Insufficient balance');
        }

        // Update balances and points
        transaction.update(customerRef, {
          walletBalance: customerBalance - payAmount,
          points: currentPoints + pointsToEarn,
        });
        transaction.update(traderRef, {
          walletBalance: (tDoc.data().walletBalance || 0) + payAmount,
        });

        // Record transaction for customer
        const customerTxRef = doc(collection(db, 'transactions'));
        transaction.set(customerTxRef, {
          userId: auth.currentUser!.uid,
          amount: payAmount,
          type: 'payment',
          method: 'wallet',
          status: 'completed',
          category: 'personal',
          timestamp: serverTimestamp(),
          recipientId: trader.id,
          productName: product.name,
          productId: product.id,
          traderName: tDoc.data().businessName || tDoc.data().name,
        });

        // Record transaction for trader
        const traderTxRef = doc(collection(db, 'transactions'));
        transaction.set(traderTxRef, {
          userId: trader.id,
          amount: payAmount,
          type: 'deposit',
          method: 'wallet',
          status: 'completed',
          category: 'business',
          timestamp: serverTimestamp(),
          senderId: auth.currentUser!.uid,
          productName: product.name,
          productId: product.id,
          customerName: customerDoc.data().name,
        });

        // Record purchase
        const purchaseRef = doc(collection(db, 'purchases'));
        transaction.set(purchaseRef, {
          customerId: auth.currentUser!.uid,
          traderId: trader.id,
          productId: product.id,
          productName: product.name,
          traderName: tDoc.data().businessName || tDoc.data().name,
          amount: payAmount,
          quantity: qty,
          pointsEarned: pointsToEarn,
          appliedIncentives,
          status: 'approved',
          timestamp: serverTimestamp(),
        });
      });

      setStatus('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Payment failed');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a0a0a] w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-white/5"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white z-10 transition-colors border border-white/5"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-black text-white tracking-tight">{t.customer.payCode}</h3>
            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-1">
              Enter merchant and product details
            </p>
          </div>

          {status === 'success' ? (
            <div className="text-center py-12 space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/10"
              >
                <CheckCircle2 size={40} />
              </motion.div>
              <h4 className="text-xl font-black text-white">Payment Successful!</h4>
              <p className="text-sm text-neutral-500 leading-relaxed">
                RWF {formatCurrency(amount)} transferred to <br />
                <span className="font-bold text-white">{trader?.businessName || trader?.name}</span>
              </p>
            </div>
          ) : status === 'processing' ? (
            <div className="text-center py-12 space-y-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-white/5 rounded-full"></div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 border-4 border-orange-600 border-t-transparent rounded-full"
                />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">
                Securing Payment...
              </p>
            </div>
          ) : status === 'pin_required' ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/10">
                  <Hash size={32} />
                </div>
                <h4 className="text-xl font-black text-white">{t.common.enterTransactionPin}</h4>
                <p className="text-xs text-neutral-500 mt-1">{t.common.enterPinToAuthorize}</p>
              </div>

              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-10 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all',
                      enteredPin.length >= i
                        ? 'border-orange-600 bg-orange-500/10 text-orange-500'
                        : 'border-white/10 bg-white/5 text-white/20'
                    )}
                  >
                    {enteredPin.length >= i ? 'â€¢' : ''}
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 mb-4">
                  <AlertCircle size={16} />
                  <p className="text-[10px] font-bold">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((num) => (
                  <button
                    key={num.toString()}
                    type="button"
                    onClick={() => {
                      if (num === 'C') setEnteredPin('');
                      else if (num === 'OK') {
                        if (enteredPin.length >= 4) handlePayment();
                      } else if (enteredPin.length < 6) setEnteredPin((prev) => prev + num);
                    }}
                    className={cn(
                      'py-4 rounded-2xl font-black text-lg transition-all active:scale-95 border',
                      num === 'OK'
                        ? 'bg-orange-600 text-white border-transparent shadow-xl shadow-orange-900/40'
                        : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setStatus('idle');
                  setEnteredPin('');
                  setError(null);
                }}
                className="w-full py-3 text-neutral-600 font-bold text-xs hover:text-neutral-400 transition-colors"
              >
                {t.common.back}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {!product ? (
                <form onSubmit={handleLookup} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block ml-1">
                      {t.customer.enterTIN}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600">
                        <Hash size={16} />
                      </span>
                      <input
                        type="text"
                        required
                        value={traderTin}
                        onChange={(e) => setTraderTin(e.target.value)}
                        placeholder="Merchant TIN"
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all text-white placeholder:text-neutral-700"
                      />
                    </div>
                  </div>

                  {trader && (
                    <motion.button
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      type="button"
                      onClick={() => setShowShop(true)}
                      className="w-full py-3 bg-orange-500/5 text-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-orange-500/10 hover:bg-orange-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Store size={14} /> Visit {trader.businessName || trader.name}'s Shop
                    </motion.button>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block ml-1">
                      {t.customer.serviceCode}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600">
                        <Search size={16} />
                      </span>
                      <input
                        type="text"
                        required
                        value={productCode}
                        onChange={(e) => setProductCode(e.target.value)}
                        placeholder={t.customer.enterServiceCode}
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all text-white placeholder:text-neutral-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block ml-1">
                      {t.customer.times}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all text-white"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500">
                      <AlertCircle size={16} />
                      <p className="text-[10px] font-bold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    {loading && status === 'looking' ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        {t.customer.lookup} <Search size={16} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-orange-500 border border-white/10 shadow-sm shrink-0">
                      <ShoppingCart size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">
                        Product Identified
                      </p>
                      <h4 className="font-black text-white truncate leading-tight">
                        {product.name}
                      </h4>
                      <p className="text-[10px] font-bold text-neutral-500">Qty: {quantity}</p>
                    </div>
                    {pointsToEarn > 0 && (
                      <div className="bg-orange-600 text-white px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg shadow-orange-900/20">
                        <Star size={10} /> +{pointsToEarn}
                      </div>
                    )}
                  </div>

                  {appliedIncentives.length > 0 && (
                    <div className="space-y-1">
                      {appliedIncentives.map((inc, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/10"
                        >
                          <CheckCircle2 size={12} /> {inc}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-white/5">
                      <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-neutral-500 border border-white/5">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                          Merchant
                        </p>
                        <p className="text-xs font-bold text-white">
                          {trader?.businessName || trader?.name || 'ESOKO Merchant'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block ml-1">
                        Payment Amount (RWF)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-neutral-700">
                          RWF
                        </span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-16 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-2xl font-black focus:ring-2 focus:ring-orange-500 outline-none transition-all text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setProduct(null);
                        setTrader(null);
                        setError(null);
                      }}
                      className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                    >
                      {t.common.back}
                    </button>
                    <button
                      onClick={handlePayment}
                      disabled={loading}
                      className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-900/40 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          Pay Now <CheckCircle2 size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showShop && trader && (
          <TraderShop
            traderId={trader.id}
            traderData={trader}
            onClose={() => setShowShop(false)}
            userBalance={userBalance}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
