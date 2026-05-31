import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  onSnapshot,
  increment,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Truck,
  Package,
  CheckCircle2,
  Loader2,
  Search,
  MapPin,
  Clock,
  ChevronRight,
  Store,
  AlertCircle,
  Hash,
  Download,
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';

interface TraderShopProps {
  traderId: string;
  traderData: any;
  onClose: () => void;
  userBalance: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export default function TraderShop({
  traderId,
  traderData,
  onClose,
  userBalance,
}: TraderShopProps) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [step, setStep] = useState<'browse' | 'checkout' | 'tracking'>('browse');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<any>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), where('traderId', '==', traderId));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [traderId]);

  // Listen for delivery updates if we have an order
  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, 'deliveries', orderId), (doc) => {
      if (doc.exists()) {
        setDeliveryStatus(doc.data());
      }
    });
    return () => unsub();
  }, [orderId]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.imageUrl,
        },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 1000; // Flat fee for demo
  const totalAmount = cartTotal + deliveryFee;

  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!auth.currentUser) return;
    if (userBalance < totalAmount) {
      setError('Insufficient balance. Please add money to your wallet.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Create Order/Delivery
      const orderRef = await addDoc(collection(db, 'deliveries'), {
        customerId: auth.currentUser.uid,
        traderId: traderId,
        items: cart,
        totalAmount,
        cartTotal,
        deliveryFee,
        address: deliveryAddress,
        note: deliveryNote,
        status: 'pending',
        timestamp: serverTimestamp(),
        traderName: traderData.businessName || traderData.name,
        customerName: auth.currentUser.displayName || 'Customer',
      });

      // 2. Record Transaction (Simplified for now, real app would use runTransaction)
      await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser.uid,
        amount: totalAmount,
        type: 'payment',
        method: 'wallet',
        status: 'completed',
        category: 'shopping',
        description: `Order from ${traderData.businessName || traderData.name}`,
        timestamp: serverTimestamp(),
        recipientId: traderId,
        orderId: orderRef.id,
      });

      // Update user balance
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        walletBalance: increment(-totalAmount),
      });

      setOrderId(orderRef.id);
      setStep('tracking');
      setCart([]);
      setShowCart(false);
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a0a0a] w-full max-w-md h-[80vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-white/5"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0a0a0a] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center border border-orange-500/10">
              <Store size={20} />
            </div>
            <div>
              <h3 className="font-black text-white leading-tight">
                {traderData.businessName || traderData.name}
              </h3>
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                TIN: {traderData.tin}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors border border-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
          {step === 'browse' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    layoutId={product.id}
                    className="bg-white/5 rounded-2xl p-3 border border-white/5 group"
                  >
                    <div className="aspect-square bg-black rounded-xl mb-3 overflow-hidden relative border border-white/5">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-800">
                          <Package size={32} />
                        </div>
                      )}
                      <button
                        onClick={() => addToCart(product)}
                        className="absolute bottom-2 right-2 p-2 bg-orange-600 text-white rounded-lg shadow-xl shadow-orange-900/40 hover:bg-orange-700 transition-all active:scale-90"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <h4 className="font-bold text-white text-xs truncate leading-none mb-1">
                      {product.name}
                    </h4>
                    <p className="text-orange-500 font-black text-xs leading-none">
                      {formatCurrency(product.price)} RWF
                    </p>
                  </motion.div>
                ))}
              </div>
              {products.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Package className="mx-auto text-neutral-800 mb-4" size={48} />
                  <p className="text-neutral-500 font-bold">No products found</p>
                </div>
              )}
            </div>
          )}

          {step === 'checkout' && (
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <h4 className="text-xs font-black text-neutral-600 uppercase tracking-widest mb-4">
                  Delivery Details
                </h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                      Delivery Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 text-neutral-600" size={16} />
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Enter your full address..."
                        className="w-full pl-12 pr-4 py-3 bg-black border border-white/10 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all min-h-[100px] text-white placeholder:text-neutral-800"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                      Note for Driver (Optional)
                    </label>
                    <input
                      type="text"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="e.g. Gate code, floor number..."
                      className="w-full px-4 py-3 bg-black border border-white/10 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all text-white placeholder:text-neutral-800"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                  <AlertCircle size={20} />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              )}

              <div className="bg-orange-500/5 p-6 rounded-3xl border border-orange-500/10 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-bold">Subtotal</span>
                  <span className="text-white font-black">{formatCurrency(cartTotal)} RWF</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-bold">Delivery Fee</span>
                  <span className="text-white font-black">{formatCurrency(deliveryFee)} RWF</span>
                </div>
                <div className="h-px bg-orange-500/20 my-2" />
                <div className="flex justify-between text-lg">
                  <span className="text-white font-black">Total</span>
                  <span className="text-orange-500 font-black">
                    {formatCurrency(totalAmount)} RWF
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === 'tracking' && deliveryStatus && (
            <div className="space-y-8 py-4 px-2">
              <div className="text-center">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/10">
                  <Truck size={40} />
                </div>
                <h4 className="text-xl font-black text-white">Order Tracked!</h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Order ID: #{orderId?.slice(-6).toUpperCase()}
                </p>
              </div>

              <div className="space-y-6 relative ml-1">
                <TrackingStep
                  icon={<Package size={20} />}
                  title="Order Placed"
                  time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  active={true}
                  completed={true}
                />
                <TrackingStep
                  icon={<Store size={20} />}
                  title="Merchant Preparing"
                  time="Processing"
                  active={
                    deliveryStatus.status === 'pending' || deliveryStatus.status === 'preparing'
                  }
                  completed={['preparing', 'on_the_way', 'delivered'].includes(
                    deliveryStatus.status
                  )}
                />
                <TrackingStep
                  icon={<Truck size={20} />}
                  title="On the Way"
                  time="Estimated 15m"
                  active={deliveryStatus.status === 'on_the_way'}
                  completed={['delivered'].includes(deliveryStatus.status)}
                />
                <TrackingStep
                  icon={<CheckCircle2 size={20} />}
                  title="Delivered"
                  time="---"
                  active={deliveryStatus.status === 'delivered'}
                  completed={deliveryStatus.status === 'delivered'}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-neutral-600 border border-white/5">
                    <MapPin size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-neutral-600 uppercase leading-none mb-1">
                      Delivery to
                    </p>
                    <p className="text-xs font-bold text-white truncate">{deliveryAddress}</p>
                  </div>
                </div>

                {deliveryStatus.trackingNumber && (
                  <div className="bg-orange-500/5 p-4 rounded-2xl border border-orange-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/10">
                        <Hash size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-orange-500/60 uppercase leading-none mb-1">
                          Tracking Number
                        </p>
                        <p className="text-xs font-black text-white tracking-widest uppercase">
                          {deliveryStatus.trackingNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(deliveryStatus.trackingNumber);
                      }}
                      className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#0a0a0a] border-t border-white/5 sticky bottom-0">
          {step === 'browse' && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowCart(!showCart)}
                className="relative p-4 bg-white/5 text-neutral-400 rounded-2xl hover:bg-white/10 transition-all border border-white/5"
              >
                <ShoppingCart size={24} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black shadow-lg shadow-orange-900/40">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                disabled={cart.length === 0}
                onClick={() => setStep('checkout')}
                className="flex-1 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-900/40 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                Checkout {cart.length > 0 && `(${formatCurrency(cartTotal)} RWF)`}
              </button>
            </div>
          )}

          {step === 'checkout' && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('browse')}
                className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
              >
                Back
              </button>
              <button
                disabled={!deliveryAddress || loading}
                onClick={handleCheckout}
                className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-900/40 hover:bg-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Pay & Order <Truck size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'tracking' && (
            <button
              onClick={onClose}
              className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Done
            </button>
          )}
        </div>

        {/* Cart Overlay */}
        <AnimatePresence>
          {showCart && (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              className="absolute inset-x-0 bottom-0 top-20 bg-[#0a0a0a] z-20 flex flex-col border-t border-white/10"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h4 className="text-lg font-black text-white">Your Cart</h4>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-none">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5"
                  >
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-neutral-800 overflow-hidden border border-white/5">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-white text-xs truncate leading-none mb-1">
                        {item.name}
                      </h5>
                      <p className="text-orange-500 font-black text-[10px] leading-none">
                        {formatCurrency(item.price)} RWF
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-black rounded-lg p-1 border border-white/10">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-white/5 rounded text-neutral-600"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-xs font-black w-4 text-center text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-white/5 rounded text-orange-500"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-neutral-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {cart.length === 0 && (
                  <div className="text-center py-12">
                    <ShoppingCart className="mx-auto text-neutral-800 mb-4" size={48} />
                    <p className="text-neutral-500 font-bold">Your cart is empty</p>
                  </div>
                )}
              </div>
              <div className="p-6 bg-white/5 border-t border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-neutral-500 font-bold">Total</span>
                  <span className="text-xl font-black text-orange-500">
                    {formatCurrency(cartTotal)} RWF
                  </span>
                </div>
                <button
                  disabled={cart.length === 0}
                  onClick={() => {
                    setShowCart(false);
                    setStep('checkout');
                  }}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-900/40 hover:bg-orange-700 disabled:opacity-50 transition-all"
                >
                  Confirm Order
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function TrackingStep({
  icon,
  title,
  time,
  active,
  completed,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex gap-4 relative">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 z-10 border',
            completed
              ? 'bg-emerald-500 text-white border-transparent'
              : active
                ? 'bg-orange-600 text-white border-transparent animate-pulse shadow-lg shadow-orange-900/40'
                : 'bg-white/5 text-neutral-600 border-white/5'
          )}
        >
          {icon}
        </div>
        <div
          className={cn(
            'w-0.5 h-full absolute top-10 transition-all duration-500',
            completed ? 'bg-emerald-500' : 'bg-white/5'
          )}
        />
      </div>
      <div className="flex-1 pt-1">
        <div className="flex justify-between items-center">
          <h5
            className={cn(
              'font-black text-sm transition-colors',
              active || completed ? 'text-white' : 'text-neutral-600'
            )}
          >
            {title}
          </h5>
          <span className="text-[10px] font-bold text-neutral-600">{time}</span>
        </div>
        <p className="text-[10px] font-bold text-neutral-700 mt-0.5 uppercase tracking-tighter">
          {completed ? 'Completed' : active ? 'In Progress' : 'Waiting'}
        </p>
      </div>
    </div>
  );
}
