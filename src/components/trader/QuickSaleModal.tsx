import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  Smartphone,
  CreditCard,
  Wallet,
  Banknote,
  Percent,
  Star,
  Award,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  where,
  getDocs,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, cn } from '../../lib/utils';
import { createPurchase } from '../../services/purchaseService';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  code?: string;
}

interface QuickSaleModalProps {
  product: Product;
  traderId: string;
  traderName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickSaleModal({
  product,
  traderId,
  traderName,
  onClose,
  onSuccess,
}: QuickSaleModalProps) {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | 'wallet'>(
    'cash'
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerAppNumber, setCustomerAppNumber] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [isVerifyingCustomer, setIsVerifyingCustomer] = useState(false);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);

  const verifyCustomer = async (num: string) => {
    if (num.length !== 8) return;
    setIsVerifyingCustomer(true);
    try {
      const q = query(collection(db, 'users'), where('appNumber', '==', num));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setCustomerName(snap.docs[0].data().name || 'Customer Found');
        setTargetCustomerId(snap.docs[0].id);
      } else {
        setCustomerName('Member not found');
        setTargetCustomerId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifyingCustomer(false);
    }
  };
  const [incentives, setIncentives] = useState<any[]>([]);

  useEffect(() => {
    const fetchIncentives = async () => {
      const q = query(
        collection(db, 'incentive_programs'),
        where('traderId', '==', traderId),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      setIncentives(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    };
    fetchIncentives();
  }, [traderId]);

  const calculateDiscount = () => {
    let discount = 0;
    const bulkProgram = incentives.find((i) => i.type === 'bulk_discount');
    if (bulkProgram && quantity >= (bulkProgram.config.minBulkQuantity || 0)) {
      discount = product.price * quantity * ((bulkProgram.config.bulkDiscountPercent || 0) / 100);
    }
    return discount;
  };

  const discountAmount = calculateDiscount();
  const subtotal = product.price * quantity;
  const totalAmount = subtotal - discountAmount;

  const handleRecordSale = async () => {
    if (quantity > product.stock) {
      setError('Not enough stock available!');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createPurchase({
        customerId: targetCustomerId || traderId,
        traderId,
        productId: product.id,
        quantity,
        paymentMethod,
        recordedBy: 'trader',
        customerName: targetCustomerId ? customerName : 'Walk-in Customer',
        subtotal,
        discountAmount,
        totalAmount,
        idempotencyKey: `quick-sale-${product.id}-${traderId}-${Date.now()}`,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to record sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="text-orange-600" size={20} />
            Quick Sale
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2"
            >
              <X size={14} className="shrink-0" />
              {error}
            </motion.div>
          )}
          {success ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={48} />
              </div>
              <h4 className="text-2xl font-bold text-neutral-900 mb-2">Sale Recorded!</h4>
              <p className="text-neutral-500">Stock updated and revenue added to your records.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      Product
                    </p>
                    <p className="font-bold text-neutral-900">{product.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      Stock
                    </p>
                    <p
                      className={cn(
                        'font-bold',
                        product.stock < 10 ? 'text-red-500' : 'text-neutral-900'
                      )}
                    >
                      {product.stock}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
                  <p className="text-sm font-medium text-neutral-500">Unit Price</p>
                  <p className="font-bold text-neutral-900">RWF {formatCurrency(product.price)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2 flex items-center justify-between">
                  Link Customer (Optional)
                  {isVerifyingCustomer && (
                    <Loader2 size={12} className="animate-spin text-orange-600" />
                  )}
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    size={16}
                  />
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="Enter 8-digit App Number"
                    value={customerAppNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCustomerAppNumber(val);
                      if (val.length === 8) verifyCustomer(val);
                      else {
                        setTargetCustomerId(null);
                        setCustomerName('Walk-in Customer');
                      }
                    }}
                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>
                {customerAppNumber.length === 8 && (
                  <div
                    className={cn(
                      'mt-2 p-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2',
                      targetCustomerId ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    )}
                  >
                    {targetCustomerId ? <CheckCircle2 size={12} /> : <X size={12} />}
                    {customerName}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2">Quantity</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 bg-white border border-neutral-200 rounded-xl flex items-center justify-center font-bold hover:bg-neutral-50 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-2xl font-black w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      className="w-12 h-12 bg-white border border-neutral-200 rounded-xl flex items-center justify-center font-bold hover:bg-neutral-50 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-3">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        paymentMethod === 'cash'
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-neutral-100 hover:border-neutral-200'
                      )}
                    >
                      <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                        <Banknote size={18} />
                      </div>
                      <span className="text-sm font-bold">Cash</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('mobile_money')}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        paymentMethod === 'mobile_money'
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-neutral-100 hover:border-neutral-200'
                      )}
                    >
                      <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center">
                        <Smartphone size={18} />
                      </div>
                      <span className="text-sm font-bold">MoMo</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        paymentMethod === 'card'
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-neutral-100 hover:border-neutral-200'
                      )}
                    >
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                        <CreditCard size={18} />
                      </div>
                      <span className="text-sm font-bold">Card</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('wallet')}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        paymentMethod === 'wallet'
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-neutral-100 hover:border-neutral-200'
                      )}
                    >
                      <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                        <Wallet size={18} />
                      </div>
                      <span className="text-sm font-bold">Wallet</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-100">
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-medium">Subtotal</span>
                    <span className="text-neutral-900 font-bold">
                      RWF {formatCurrency(subtotal)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span className="font-medium flex items-center gap-1">
                        <Percent size={14} /> Discount Applied
                      </span>
                      <span className="font-bold">- RWF {formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                    <span className="text-neutral-500 font-medium">Total Revenue</span>
                    <span className="text-3xl font-black text-orange-600">
                      RWF {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleRecordSale}
                  disabled={loading || product.stock === 0}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-200 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Record Sale'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
