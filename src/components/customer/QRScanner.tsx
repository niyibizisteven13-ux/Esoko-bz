import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  CreditCard,
  Zap,
  ZapOff,
  Star,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency, cn, calculateFees } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { calculateIncentives, IncentiveProgram } from '../../lib/incentiveUtils';

import { useNotifications } from '../../context/NotificationContext';

interface QRScannerProps {
  onClose: () => void;
  onSuccess?: () => void;
  tier?: 'free' | 'premium';
}

export default function QRScanner({ onClose, onSuccess, tier = 'free' }: QRScannerProps) {
  const { t } = useLanguage();
  const { sendNotification } = useNotifications();
  const [scanning, setScanning] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [trader, setTrader] = useState<any>(null);
  const [receiver, setReceiver] = useState<any>(null);
  const [incentivePrograms, setIncentivePrograms] = useState<IncentiveProgram[]>([]);
  const [appliedIncentives, setAppliedIncentives] = useState<string[]>([]);
  const [pointsToEarn, setPointsToEarn] = useState(0);
  const [originalAmount, setOriginalAmount] = useState(0);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'success' | 'error' | 'pin_required'
  >('idle');
  const [isInstant, setIsInstant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [userPin, setUserPin] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [enteredPin, setEnteredPin] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'reader';

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserPin(data.transactionPin || null);
          setCurrentUserData(data);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(readerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
      ],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    const config = {
      fps: 20, // Higher FPS for faster scanning
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    // Start scanning
    html5QrCode
      .start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure)
      .then(() => {
        // Check for flashlight support
        try {
          // Use a small timeout to ensure track is fully ready
          setTimeout(() => {
            if (scannerRef.current) {
              const capabilities = scannerRef.current.getRunningTrackCapabilities();
              if (capabilities && (capabilities as any).torch) {
                setHasFlash(true);
              }
            }
          }, 500);
        } catch (e) {
          console.warn('Flashlight check failed', e);
        }
      })
      .catch((err) => {
        console.error('Failed to start scanner', err);
        setError('Camera access denied or not found.');
        setStatus('error');
      });

    function onScanSuccess(decodedText: string) {
      stopScanner();
      setScanning(false);
      handleProductLookup(decodedText);
    }

    function onScanFailure(error: any) {
      // Ignore frequent scan failures
    }

    return () => {
      stopScanner();
    };
  }, [scannerKey]);

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch((err) => console.error('Failed to stop scanner', err));
    }
  };

  const toggleFlash = async () => {
    if (!scannerRef.current || !hasFlash) return;
    try {
      const newState = !isFlashOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }] as any,
      });
      setIsFlashOn(newState);
    } catch (err) {
      console.error('Failed to toggle flash', err);
    }
  };

  const handleProductLookup = async (scannedData: string) => {
    setLoading(true);
    setError(null);
    try {
      let productId = '';
      let productCode = scannedData.toUpperCase().trim();

      // 1. Check for nexus:// pay links
      if (scannedData.startsWith('nexus://pay')) {
        try {
          const url = new URL(scannedData);
          const traderId = url.searchParams.get('traderId');
          const amountParam = url.searchParams.get('amount');
          const pId = url.searchParams.get('productId');
          const tName = url.searchParams.get('traderName');
          const pName = url.searchParams.get('productName');

          if (traderId) {
            // Set initial trader info from URL if available
            if (tName) {
              setTrader({
                id: traderId,
                businessName: decodeURIComponent(tName),
                name: decodeURIComponent(tName),
              });
            }

            const traderRef = doc(db, 'users', traderId);
            const traderSnap = await getDoc(traderRef);
            if (traderSnap.exists()) {
              const traderData = { id: traderSnap.id, ...traderSnap.data() } as any;
              setTrader(traderData);

              if (pId) {
                // Set initial product info from URL if available
                if (pName) {
                  setProduct({
                    id: pId,
                    name: decodeURIComponent(pName),
                    price: amountParam ? Number(amountParam) : 0,
                  });
                }

                const pRef = doc(db, 'products', pId);
                const pSnap = await getDoc(pRef);
                if (pSnap.exists()) {
                  const productData = { id: pSnap.id, ...pSnap.data() } as any;
                  setProduct(productData);
                  const price = productData.price || 0;
                  setOriginalAmount(price);
                  setAmount(price.toString());
                  setIsInstant(price > 0);
                  setLoading(false);
                  return;
                }
              } else {
                setProduct({
                  id: 'direct_payment',
                  name: 'Direct Payment',
                  traderId: traderId,
                  price: amountParam ? Number(amountParam) : 0,
                });
                setOriginalAmount(amountParam ? Number(amountParam) : 0);
                setAmount(amountParam || '');
                setIsInstant(!!amountParam && Number(amountParam) > 0);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          console.error('Invalid nexus:// URI', e);
        }
      }

      // 2. Try to parse as JSON first
      try {
        const parsed = JSON.parse(scannedData);
        if (parsed.type === 'p2p') {
          handleP2PLookup(parsed.userId, parsed.appNumber);
          return;
        }
        if (parsed.type === 'direct_payment') {
          const traderRef = doc(db, 'users', parsed.traderId);
          const traderSnap = await getDoc(traderRef);
          if (traderSnap.exists()) {
            setTrader({ id: traderSnap.id, ...traderSnap.data() });
            setProduct({
              id: 'direct_payment',
              name: 'Direct Payment',
              traderId: parsed.traderId,
              price: parsed.amount || 0,
            });
            setOriginalAmount(parsed.amount || 0);
            setAmount((parsed.amount || 0).toString());
            setIsInstant((parsed.amount || 0) > 0);
            setLoading(false);
            return;
          }
        }
        if (parsed.id) {
          productId = parsed.id;
        }
        if (parsed.code) {
          productCode = parsed.code.toUpperCase().trim();
        }
      } catch (e) {
        // Not JSON, check for prefixes
        if (scannedData.startsWith('esoko-trader-') || scannedData.startsWith('esoko-shop-')) {
          const actualTraderId = scannedData
            .replace('esoko-trader-', '')
            .replace('esoko-shop-', '');
          const traderRef = doc(db, 'users', actualTraderId);
          const traderSnap = await getDoc(traderRef);
          if (traderSnap.exists() && traderSnap.data()?.role === 'trader') {
            const traderData = { id: traderSnap.id, ...traderSnap.data() } as any;
            setTrader(traderData);
            setProduct({
              id: 'direct_payment',
              name: 'Direct Payment',
              traderId: traderSnap.id,
              price: 0,
            });
            setOriginalAmount(0);
            setAmount('');
            setLoading(false);
            return;
          }
        }
      }

      // 3. Check for 8-digit app number specifically before generic ID lookup
      if (/^\d{8}$/.test(scannedData)) {
        const q = query(collection(db, 'users'), where('appNumber', '==', scannedData));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const foundUser = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
          if (foundUser.role === 'trader') {
            setTrader(foundUser);
            setProduct({
              id: 'direct_payment',
              name: 'Direct Payment',
              traderId: foundUser.id,
              price: 0,
            });
            setOriginalAmount(0);
            setAmount('');
            setLoading(false);
            return;
          } else {
            handleP2PLookup(null, scannedData);
            return;
          }
        }
      }

      let productDocSnap: any = null;

      // 1. Try by ID if we have one from JSON
      if (productId) {
        const docRef = doc(db, 'products', productId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          productDocSnap = snap;
        }
      }

      // 2. If not found, try by code (barcode)
      if (!productDocSnap) {
        const q = query(collection(db, 'products'), where('code', '==', productCode));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          productDocSnap = snapshot.docs[0];
        }
      }

      // 3. If still not found, try the raw scanned data as a direct ID
      if (!productDocSnap) {
        const docRef = doc(db, 'products', scannedData);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          productDocSnap = snap;
        }
      }

      if (!productDocSnap) {
        setError('Product not found. Please check the code and try again.');
        setStatus('error');
        return;
      }

      const productData = { id: productDocSnap.id, ...productDocSnap.data() } as any;
      setProduct(productData);
      setOriginalAmount(productData.price);
      setAmount(productData.price.toString());

      if (!productData.traderId) {
        setLoading(false);
        return;
      }

      // Fetch trader info and incentives
      const [traderDoc, incentiveSnapshot] = await Promise.all([
        getDoc(doc(db, 'users', productData.traderId)),
        getDocs(
          query(
            collection(db, 'incentive_programs'),
            where('traderId', '==', productData.traderId),
            where('active', '==', true)
          )
        ),
      ]);

      if (traderDoc.exists()) {
        setTrader(traderDoc.data());
      }

      const programs = incentiveSnapshot.docs.map(
        (doc: any) => ({ id: doc.id, ...doc.data() }) as IncentiveProgram
      );
      setIncentivePrograms(programs);

      // Initial incentive calculation
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const {
            finalAmount,
            pointsEarned,
            appliedIncentives: applied,
          } = calculateIncentives(productData.price, 1, programs, userDoc.data());
          setAmount(finalAmount.toString());
          setPointsToEarn(pointsEarned);
          setAppliedIncentives(applied);
        }
      }
    } catch (err) {
      console.error('Product lookup error:', err);
      setError('An error occurred while looking up the product.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleP2PLookup = async (uid: string | null, appNum?: string) => {
    setLoading(true);
    setStatus('idle');
    try {
      let userQuery;
      if (uid) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() } as any;
          setupP2PFlow(userData);
          return;
        }
      } else if (appNum) {
        const q = query(collection(db, 'users'), where('appNumber', '==', appNum));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
          setupP2PFlow(userData);
          return;
        }
      }
      setError('User not found in ESOKO Nexus.');
      setStatus('error');
    } catch (err) {
      setError('Verification failed.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const setupP2PFlow = (userData: any) => {
    setTrader(userData);
    setProduct({
      id: 'p2p_transfer',
      name: 'Peer-to-Peer Transfer',
      traderId: userData.id,
      price: 0,
    });
    setOriginalAmount(0);
    setAmount('');
    setLoading(false);
  };

  const handlePayment = async () => {
    if (!auth.currentUser || !product || !trader) return;

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      setError('Invalid amount');
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
      const { totalFee, cashback, pointsEarned: nexusPoints } = calculateFees(payAmount);
      const totalToDeduct =
        product.id === 'p2p_transfer' ? payAmount + totalFee - cashback : payAmount;
      const finalPoints = product.id === 'p2p_transfer' ? nexusPoints : pointsToEarn;

      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'users', auth.currentUser!.uid);
        const traderRef = doc(db, 'users', product.traderId);

        const [customerDoc, traderDoc] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(traderRef),
        ]);

        if (!customerDoc.exists()) throw new Error('Customer not found');
        if (!traderDoc.exists()) throw new Error('Target account not found');

        const customerBalance = customerDoc.data().walletBalance || 0;
        const currentPoints = customerDoc.data().loyaltyPoints || customerDoc.data().points || 0;

        if (customerBalance < totalToDeduct) {
          throw new Error('Insufficient balance in your wallet.');
        }

        // Update balances and points
        transaction.update(customerRef, {
          walletBalance: customerBalance - totalToDeduct,
          loyaltyPoints: currentPoints + finalPoints,
        });
        transaction.update(traderRef, {
          walletBalance: (traderDoc.data().walletBalance || 0) + payAmount,
        });

        // Record transaction for sender/customer
        const customerTxRef = doc(collection(db, 'transactions'));
        transaction.set(customerTxRef, {
          userId: auth.currentUser!.uid,
          amount: payAmount,
          fee: product.id === 'p2p_transfer' ? totalFee : 0,
          cashback: product.id === 'p2p_transfer' ? cashback : 0,
          type: 'payment',
          method: product.id === 'p2p_transfer' ? 'p2p_transfer' : 'wallet',
          status: 'completed',
          category: product.id === 'p2p_transfer' ? 'personal' : 'business',
          timestamp: serverTimestamp(),
          recipientId: product.traderId,
          productName: product.name,
          productId: product.id,
          recipientName: traderDoc.data().businessName || traderDoc.data().name,
        });

        // Record transaction for recipient
        const traderTxRef = doc(collection(db, 'transactions'));
        transaction.set(traderTxRef, {
          userId: product.traderId,
          amount: payAmount,
          type: 'deposit',
          method: product.id === 'p2p_transfer' ? 'p2p_transfer' : 'wallet',
          status: 'completed',
          category: 'business',
          timestamp: serverTimestamp(),
          senderId: auth.currentUser!.uid,
          productName: product.name,
          productId: product.id,
          senderName: customerDoc.data().businessName || customerDoc.data().name || 'Nexus User',
        });

        if (product.id !== 'p2p_transfer') {
          // Record purchase
          const purchaseRef = doc(collection(db, 'purchases'));
          transaction.set(purchaseRef, {
            customerId: auth.currentUser!.uid,
            traderId: product.traderId,
            productId: product.id,
            productName: product.name,
            traderName: traderDoc.data().businessName || traderDoc.data().name,
            amount: payAmount,
            quantity: 1,
            pointsEarned: finalPoints,
            appliedIncentives,
            status: 'approved',
            timestamp: serverTimestamp(),
          });
        }
      });

      // Send notification to trader/recipient
      const senderName = currentUserData?.businessName || currentUserData?.name || 'A user';
      const notificationMessage =
        product.id === 'p2p_transfer'
          ? `You received RWF ${formatCurrency(payAmount)} from ${senderName}.`
          : `New payment received: RWF ${formatCurrency(payAmount)} from ${senderName} for ${product.name}.`;

      await sendNotification(product.traderId, notificationMessage, 'success', 'transaction');

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
          {scanning ? (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-black text-white tracking-tight">Scan Product</h3>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-1">
                  Point camera at QR or Barcode
                </p>
              </div>

              <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#050505] border-4 border-white/5 group shadow-inner">
                <div id={readerId} className="w-full h-full object-cover"></div>

                {/* Scanning Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-[40px] border-black/60"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[170px] h-[170px] border-2 border-orange-500/50 rounded-2xl shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                    <motion.div
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,1)]"
                    />
                  </div>
                </div>

                {/* Flash Toggle */}
                {hasFlash && (
                  <button
                    onClick={toggleFlash}
                    className={cn(
                      'absolute bottom-4 right-4 p-3 rounded-xl backdrop-blur-md transition-all active:scale-95 border border-white/10',
                      isFlashOn
                        ? 'bg-orange-500 text-white'
                        : 'bg-black/40 text-white hover:bg-black/60'
                    )}
                  >
                    {isFlashOn ? <Zap size={20} /> : <ZapOff size={20} />}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-neutral-600">
                <Loader2 className="animate-spin" size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Searching for codes...
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {status === 'processing' && (
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
              )}

              {status === 'pin_required' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/10">
                      <ShieldCheck size={32} />
                    </div>
                    <h4 className="text-xl font-black text-white">
                      {t.common.enterTransactionPin}
                    </h4>
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
              )}

              {status === 'success' && (
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
                    <span className="font-bold text-white">
                      {trader?.businessName || trader?.name}
                    </span>
                  </p>
                </div>
              )}

              {status === 'error' && (
                <div className="text-center py-12 space-y-4">
                  <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                    <AlertCircle size={40} />
                  </div>
                  <h4 className="text-xl font-black text-white">Scan Failed</h4>
                  <p className="text-sm text-neutral-500">{error}</p>
                  <button
                    onClick={() => {
                      setScanning(true);
                      setStatus('idle');
                      setError(null);
                      setProduct(null);
                      setTrader(null);
                      setHasFlash(false);
                      setIsFlashOn(false);
                      setScannerKey((prev) => prev + 1);
                    }}
                    className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-colors shadow-xl shadow-orange-900/40"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {status === 'idle' && product && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="space-y-6"
                >
                  {isInstant ? (
                    <div className="text-center space-y-6 py-4">
                      <div className="flex flex-col items-center">
                        <div className="w-24 h-24 bg-orange-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-orange-900/40 relative mb-6">
                          <Zap size={48} className="drop-shadow-lg" />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-orange-500 rounded-[2rem] -z-10"
                          />
                        </div>
                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] mb-1">
                          Nexus Instant Pay
                        </p>
                        <h4 className="text-2xl font-black text-white tracking-tight uppercase">
                          {trader?.businessName || trader?.name}
                        </h4>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                          {product.id === 'direct_payment' ? 'Direct Transfer' : product.name}
                        </p>
                      </div>

                      <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10">
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                          Amount to Transfer
                        </p>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-sm font-black text-white opacity-40">RWF</span>
                          <span className="text-5xl font-black text-white tracking-tighter">
                            {Number(amount).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setIsInstant(false)}
                          className="flex-1 py-5 bg-white/5 text-neutral-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                        >
                          Modify
                        </button>
                        <button
                          onClick={handlePayment}
                          disabled={loading}
                          className="flex-[2] py-5 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-orange-900/40 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                        >
                          {loading ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <>
                              Pay Now
                              <CheckCircle2
                                size={20}
                                className="group-hover:scale-110 transition-transform"
                              />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-orange-500 border border-white/10 shadow-sm shrink-0">
                          {product.id === 'p2p_transfer' ? (
                            <User size={24} />
                          ) : (
                            <ShoppingCart size={24} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">
                            {product.id === 'p2p_transfer'
                              ? 'User Identified'
                              : product.id === 'direct_payment'
                                ? 'Merchant Identified'
                                : 'Product Identified'}
                          </p>
                          <h4 className="font-black text-white truncate leading-tight">
                            {product.id === 'p2p_transfer'
                              ? trader?.name || 'Nexus User'
                              : product.id === 'direct_payment'
                                ? trader?.businessName || trader?.name
                                : product.name}
                          </h4>
                          {product.id !== 'direct_payment' && product.id !== 'p2p_transfer' && (
                            <p className="text-[10px] font-bold text-neutral-500">
                              Stock: {product.stock || 'Available'}
                            </p>
                          )}
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
                        {product.id !== 'direct_payment' && product.id !== 'p2p_transfer' && (
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
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block ml-1">
                            Payment Amount (RWF)
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-neutral-700">
                              RWF
                            </span>
                            <input
                              autoFocus
                              type="number"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="w-full pl-16 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-2xl font-black focus:ring-2 focus:ring-orange-500 outline-none transition-all text-white"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-[9px] text-neutral-600 font-bold italic ml-1 leading-relaxed">
                            {product.id === 'p2p_transfer'
                              ? '* Transfer limits apply based on your tier'
                              : '* You can adjust the amount for tips or partial payments'}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setScanning(true);
                            setStatus('idle');
                            setProduct(null);
                            setTrader(null);
                            setReceiver(null);
                          }}
                          className="flex-1 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handlePayment}
                          disabled={loading || !amount}
                          className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-900/40 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {loading ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <>
                              Confirm Payment <CheckCircle2 size={18} />
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
