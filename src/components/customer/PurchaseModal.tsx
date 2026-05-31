import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingBag,
  Truck,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  FileText,
} from 'lucide-react';
import { auth } from '../../firebase';
import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { calculateIncentives, IncentiveProgram } from '../../lib/incentiveUtils';
import { safeStringify } from '../../lib/firestoreErrorHandler';
import { walletService } from '../../services/walletService';
import { createPurchase } from '../../services/purchaseService';

interface PurchaseModalProps {
  product: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PurchaseModal({ product, onClose, onSuccess }: PurchaseModalProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<
    'details' | 'delivery' | 'payment' | 'processing' | 'success' | 'error'
  >('details');
  const [quantity, setQuantity] = useState(1);
  const [isDelivery, setIsDelivery] = useState(false);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trader, setTrader] = useState<any>(null);
  const [incentivePrograms, setIncentivePrograms] = useState<IncentiveProgram[]>([]);
  const [appliedIncentives, setAppliedIncentives] = useState<string[]>([]);
  const [pointsToEarn, setPointsToEarn] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const traderSnap = await getDoc(doc(db, 'users', product.traderId));
        if (traderSnap.exists()) {
          setTrader(traderSnap.data());
        }

        const incentiveSnapshot = await getDocs(
          query(
            collection(db, 'incentive_programs'),
            where('traderId', '==', product.traderId),
            where('active', '==', true)
          )
        );

        const programs = incentiveSnapshot.docs.map((doc: any) => doc.data() as IncentiveProgram);
        setIncentivePrograms(programs);
        setFinalAmount(product.price * quantity);
      } catch (err) {
        console.error('Error fetching purchase data:', err);
      }
    };
    fetchData();
  }, [product.traderId, product.price, quantity]);

  const handlePurchase = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setStep('processing');
    setError(null);

    try {
      const authResult = await walletService.authenticateBiometricForTransaction();
      if (!authResult.authenticated) {
        throw new Error(authResult.error || 'Secure authentication required before payment');
      }

      await createPurchase({
        customerId: auth.currentUser.uid,
        traderId: product.traderId,
        productId: product.id,
        quantity,
        isDelivery,
        deliveryAddress: isDelivery ? address : '',
        notes,
        paymentMethod: 'wallet',
        idempotencyKey: `purchase-${product.id}-${auth.currentUser.uid}-${Date.now()}`,
      });

      setStep('success');

      // Send transaction email
      if (auth.currentUser?.email) {
        fetch('/api/transaction-email', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: safeStringify({
            email: auth.currentUser.email,
            amount: formatCurrency(product.price * quantity),
            type: 'purchase',
            recipientName: trader?.businessName || trader?.name || 'Merchant',
            status: 'completed',
            reference: 'PUR-' + Math.random().toString(36).substring(7).toUpperCase(),
          }),
        }).catch((err) => console.error('Failed to send purchase email:', err));
      }

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Purchase failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a0a0a] w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl relative border border-white/5"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors z-10 border border-white/5"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-orange-500 border border-white/5">
                    <ShoppingBag size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{product.name}</h3>
                    <p className="text-sm text-neutral-500">
                      {trader?.businessName || trader?.name || 'Merchant'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-sm font-bold text-neutral-400">Quantity</span>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg shadow-sm font-bold text-white border border-white/10 hover:bg-white/10"
                      >
                        -
                      </button>
                      <span className="font-black text-white">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg shadow-sm font-bold text-white border border-white/10 hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-orange-500">Total Amount</span>
                      <span className="text-xl font-black text-orange-500">
                        RWF {formatCurrency(product.price * quantity)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep('delivery')}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-900/40 transition-all"
                >
                  Continue to Delivery
                </button>
              </motion.div>
            )}

            {step === 'delivery' && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/10">
                    <Truck size={32} />
                  </div>
                  <h3 className="text-xl font-black text-white">Delivery Options</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Choose how you want to receive your order
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setIsDelivery(false)}
                    className={cn(
                      'w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4',
                      !isDelivery ? 'border-orange-600 bg-orange-500/5' : 'border-white/5'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        !isDelivery ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-600'
                      )}
                    >
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <p className="font-black text-sm text-white">Self Pickup</p>
                      <p className="text-[10px] text-neutral-500">
                        Collect from merchant's location
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsDelivery(true)}
                    className={cn(
                      'w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4',
                      isDelivery ? 'border-orange-600 bg-orange-500/5' : 'border-white/5'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        isDelivery ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-600'
                      )}
                    >
                      <Truck size={20} />
                    </div>
                    <div>
                      <p className="font-black text-sm text-white">Home Delivery</p>
                      <p className="text-[10px] text-neutral-500">
                        We'll bring it to your doorstep
                      </p>
                    </div>
                  </button>
                </div>

                {isDelivery && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                        Delivery Address
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-3 text-neutral-600" size={18} />
                        <textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Enter your full address..."
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none text-white placeholder:text-neutral-700"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                        Notes for Merchant
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-4 top-3 text-neutral-600" size={18} />
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any special instructions?"
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none text-white placeholder:text-neutral-700"
                          rows={2}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('details')}
                    className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('payment')}
                    disabled={isDelivery && !address}
                    className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-900/40 transition-all disabled:opacity-50"
                  >
                    Review & Pay
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/10">
                    <CreditCard size={32} />
                  </div>
                  <h3 className="text-xl font-black text-white">Order Summary</h3>
                  <p className="text-xs text-neutral-500 mt-1">Review your order before payment</p>
                </div>

                <div className="bg-white/5 p-6 rounded-[2rem] space-y-3 border border-white/5">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Subtotal</span>
                    <span className="font-bold text-white">
                      RWF {formatCurrency(product.price * quantity)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Method</span>
                    <span className="font-bold text-white">
                      {isDelivery ? 'Home Delivery' : 'Self Pickup'}
                    </span>
                  </div>
                  {isDelivery && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-1">
                        Address
                      </p>
                      <p className="text-xs font-medium text-neutral-300">{address}</p>
                    </div>
                  )}
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="font-black text-white">Total Paid</span>
                    <span className="text-2xl font-black text-orange-500">
                      RWF {formatCurrency(product.price * quantity)}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl bg-white/5 p-4 border border-white/10 text-[10px] text-neutral-400 font-black uppercase tracking-[0.2em]">
                  Secure authorization is required before placing this order.
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('delivery')}
                    className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePurchase}
                    className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-900/40 transition-all"
                  >
                    Pay Now
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-6"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-white/5 rounded-full"></div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 border-4 border-orange-600 border-t-transparent rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Processing Order</h3>
                  <p className="text-sm text-neutral-500">
                    Please wait while we secure your payment...
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-6"
              >
                <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/10">
                  <CheckCircle2 size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Order Placed!</h3>
                  <p className="text-sm text-neutral-500">
                    Your order has been successfully placed and paid.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-6"
              >
                <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                  <AlertCircle size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Order Failed</h3>
                  <p className="text-sm text-neutral-500">{error}</p>
                </div>
                <button
                  onClick={() => setStep('payment')}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-900/40 transition-all border border-orange-500/10"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
