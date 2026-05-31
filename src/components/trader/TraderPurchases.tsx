import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  Search,
  Filter,
  Loader2,
  ShoppingBag,
  Truck,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  QrCode,
  Plus,
  Wallet,
  MessageCircle,
  Mail,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  doc,
  updateDoc,
  getDoc,
  runTransaction,
  increment,
  collection,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { formatCurrency, toDate, cn } from '../../lib/utils';
import { emailService, sendEmail } from '../../services/emailService';
import { autoReceiptService } from '../../services/autoReceiptService';
import { createPurchase } from '../../services/purchaseService';

const QRCodeSVG = React.lazy(() =>
  import('qrcode.react').then((module) => ({ default: module.QRCodeSVG }))
);

interface Purchase {
  id: string;
  customerId: string;
  traderId: string;
  productId: string;
  quantity: number;
  amount: number;
  vat: number;
  status: 'pending' | 'approved' | 'rejected';
  deliveryStatus?: 'Pending' | 'Shipped' | 'Delivered' | 'N/A';
  isDelivery?: boolean;
  deliveryAddress?: string;
  notes?: string;
  paymentMethod: string;
  timestamp: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  productName?: string;
  receiptGenerated?: boolean;
  discountAmount?: number;
  recordedBy?: string;
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
      />
    </label>
  );
}

interface TraderPurchasesProps {
  purchases: Purchase[];
  products?: any[];
  traderName?: string;
  traderTin?: string;
  traderPhone?: string;
  traderAddress?: string;
  traderEmail?: string;
  onSaleRecorded?: () => void | Promise<void>;
}

export default function TraderPurchases({
  purchases,
  products = [],
  traderName,
  traderTin,
  traderPhone,
  traderAddress,
  traderEmail,
  onSaleRecorded,
}: TraderPurchasesProps) {
  const { t } = useLanguage();
  const { sendNotification, showToast } = useNotifications();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'all'
  );
  const [logSection, setLogSection] = useState<'sales' | 'deliveries'>('sales');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [qrVerificationId, setQrVerificationId] = useState<string | null>(null);
  const [showRecordSale, setShowRecordSale] = useState(false);
  const [saleMessage, setSaleMessage] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState({
    productId: '',
    quantity: '1',
    price: '',
    discountAmount: '',
    paymentMethod: 'cash',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    wantsReceipt: true,
    notes: '',
  });

  const handleStatusUpdate = async (
    id: string,
    newStatus: 'approved' | 'rejected',
    purchase?: Purchase
  ) => {
    setLoadingId(id);
    setError(null);
    try {
      if (newStatus === 'approved') {
        await runTransaction(db, async (transaction) => {
          const purchaseRef = doc(db, 'purchases', id);
          const purchaseSnap = await transaction.get(purchaseRef);

          if (!purchaseSnap.exists()) throw new Error('Purchase not found');

          const purchaseData = purchaseSnap.data();
          if (purchaseData.status !== 'pending') throw new Error('Purchase already processed');

          // Update purchase status and set initial delivery status
          transaction.update(purchaseRef, {
            status: 'approved',
            deliveryStatus: 'Pending',
          });

          // Update product stock
          if (purchaseData.productId && purchaseData.quantity) {
            const productRef = doc(db, 'products', purchaseData.productId);
            transaction.update(productRef, {
              stock: increment(-purchaseData.quantity),
            });
          }

          // Award loyalty points to customer
          if (purchaseData.customerId && purchaseData.pointsEarned) {
            const customerRef = doc(db, 'users', purchaseData.customerId);
            transaction.update(customerRef, {
              points: increment(purchaseData.pointsEarned),
            });
          }
        });

        if (purchase) {
          setTimeout(() => {
            autoReceiptService
              .processApprovedPurchase({
                ...purchase,
                productName: purchase.productName || 'Product',
                status: 'approved',
                timestamp: purchase.timestamp || new Date().toISOString(),
              })
              .catch((receiptError) => {
                console.error('Receipt processing failed:', receiptError);
              });
          }, 100);

          if (purchase.customerEmail) {
            emailService
              .sendTransactionReceipt({
                email: purchase.customerEmail,
                name: purchase.customerName || 'Valued Customer',
                type: 'payment',
                amount: purchase.amount,
                fee: (purchase as any).platformFee || 0,
                status: 'success',
                reference: purchase.id,
                recipientName: traderName,
              })
              .catch((emailError) => {
                console.error('Failed to send transaction receipt email:', emailError);
              });
          }

          if (purchase.customerId) {
            await sendNotification(
              purchase.customerId,
              `Your order ${purchase.id} has been approved. Delivery is being prepared and a receipt has been queued for you.`,
              'success',
              'transaction',
              { purchaseId: id, status: 'approved' }
            );
          }

          showToast(
            'Purchase approved. Receipt generation and customer notification started.',
            'success'
          );
        }
      } else {
        await updateDoc(doc(db, 'purchases', id), { status: 'rejected' });
        if (purchase?.customerId) {
          await sendNotification(
            purchase.customerId,
            `Your order ${purchase.id} has been rejected. Please contact the trader for support.`,
            'error',
            'transaction',
            { purchaseId: id, status: 'rejected' }
          );
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeliveryStatusUpdate = async (
    id: string,
    newDeliveryStatus: 'Pending' | 'Shipped' | 'Delivered'
  ) => {
    setLoadingId(id);
    setError(null);
    try {
      await updateDoc(doc(db, 'purchases', id), { deliveryStatus: newDeliveryStatus });
    } catch (err) {
      console.error(err);
      setError('Failed to update delivery status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleVerifyDelivery = async (purchase: Purchase) => {
    setLoadingId(purchase.id);
    setError(null);
    try {
      await updateDoc(doc(db, 'purchases', purchase.id), {
        deliveryStatus: 'Delivered',
        deliveryVerifiedAt: new Date().toISOString(),
      });

      if (purchase.customerId) {
        await sendNotification(
          purchase.customerId,
          `Your delivery for order ${purchase.id} has been verified by the trader. Thank you for shopping with Nexus!`,
          'success',
          'transaction',
          { purchaseId: purchase.id, deliveryStatus: 'Delivered' }
        );
      }

      setQrVerificationId(purchase.id);
      showToast('Delivery verified and customer notified.', 'success');
      setSelectedPurchase({ ...purchase, deliveryStatus: 'Delivered' });
    } catch (err) {
      console.error(err);
      setError('Failed to verify delivery');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDownloadReceipt = async (purchase: Purchase) => {
    const { generateReceiptPDF } = await import('../../lib/ReceiptGenerator');
    generateReceiptPDF({
      id: purchase.id,
      customerName: purchase.customerName || 'Walk-in customer',
      customerPhone: purchase.customerPhone,
      customerEmail: purchase.customerEmail,
      traderName,
      traderTin,
      traderPhone,
      traderEmail,
      traderAddress,
      productName: purchase.productName || 'Product',
      quantity: purchase.quantity,
      amount: purchase.amount,
      discountAmount: purchase.discountAmount || 0,
      timestamp: purchase.timestamp,
      paymentMethod: purchase.paymentMethod,
    });
  };

  const selectedProduct = products.find((product) => product.id === saleForm.productId);
  const saleQuantity = Math.max(1, Number(saleForm.quantity) || 1);
  const saleUnitPrice = Number(saleForm.price || selectedProduct?.price || 0);
  const saleSubtotal = saleUnitPrice * saleQuantity;
  const saleDiscount = Math.max(0, Number(saleForm.discountAmount) || 0);
  const saleTotal = Math.max(0, saleSubtotal - saleDiscount);

  const resetSaleForm = () => {
    setSaleForm({
      productId: '',
      quantity: '1',
      price: '',
      discountAmount: '',
      paymentMethod: 'cash',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      wantsReceipt: true,
      notes: '',
    });
  };

  const receiptText = (purchase: Purchase) => {
    const date = toDate(purchase.timestamp || (purchase as any).createdAt).toLocaleString();
    const subtotal = (purchase.amount || 0) + (purchase.discountAmount || 0);
    return [
      `${traderName || 'Business'} receipt`,
      traderAddress ? `Address: ${traderAddress}` : null,
      traderPhone ? `Contact: ${traderPhone}` : null,
      `Date: ${date}`,
      `Receipt: ${purchase.id}`,
      `Customer: ${purchase.customerName || 'Walk-in customer'}`,
      `Item: ${purchase.productName || 'Sale item'} x ${purchase.quantity}`,
      `Subtotal: RWF ${subtotal.toLocaleString()}`,
      purchase.discountAmount ? `Discount: RWF ${purchase.discountAmount.toLocaleString()}` : null,
      `Total paid: RWF ${(purchase.amount || 0).toLocaleString()}`,
      `Payment method: ${(purchase.paymentMethod || 'manual').replace(/_/g, ' ')}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleSendWhatsApp = (purchase: Purchase) => {
    const phone = String(purchase.customerPhone || '').replace(/\D/g, '');
    if (!phone) {
      setError('Add a customer WhatsApp number to send this receipt.');
      return;
    }
    const normalizedPhone = phone.startsWith('250') ? phone : `250${phone.replace(/^0/, '')}`;
    window.open(
      `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(receiptText(purchase))}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleSendEmailReceipt = async (purchase: Purchase) => {
    if (!purchase.customerEmail) {
      setError('Add a customer email to send this receipt.');
      return;
    }
    setLoadingId(purchase.id);
    setError(null);
    try {
      const text = receiptText(purchase);
      await sendEmail({
        to: purchase.customerEmail,
        message: {
          subject: `Receipt from ${traderName || 'ESOKO trader'} - ${purchase.id.slice(0, 8)}`,
          text,
          html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${text}</pre>`,
        },
      });
      showToast('Receipt emailed to customer.', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to send receipt email.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRecordSale = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) {
      setError('Choose a product from inventory before recording the sale.');
      return;
    }
    if (selectedProduct.stock < saleQuantity) {
      setError(`Only ${selectedProduct.stock} units are in stock.`);
      return;
    }
    if (saleTotal <= 0) {
      setError('Sale total must be greater than zero.');
      return;
    }

    setLoadingId('manual-sale');
    setError(null);
    setSaleMessage(null);
    try {
      const response: any = await createPurchase({
        productId: selectedProduct.id,
        quantity: saleQuantity,
        totalAmount: saleTotal,
        discountAmount: saleDiscount,
        paymentMethod: saleForm.paymentMethod,
        recordedBy: 'trader',
        customerName: saleForm.customerName || 'Walk-in customer',
        customerPhone: saleForm.customerPhone || undefined,
        customerEmail: saleForm.customerEmail || undefined,
        notes: saleForm.notes || undefined,
        idempotencyKey: `manual-sale-${selectedProduct.id}-${Date.now()}`,
      });
      setSaleMessage(
        `Sale recorded. RWF ${saleTotal.toLocaleString()} added to wallet and ${saleQuantity} unit${saleQuantity === 1 ? '' : 's'} removed from stock.`
      );
      resetSaleForm();
      setShowRecordSale(false);
      await onSaleRecorded?.();
      showToast('Manual sale recorded and wallet credited.', 'success');

      if (saleForm.wantsReceipt && saleForm.customerPhone) {
        handleSendWhatsApp({
          id: response.purchaseId || response.id || 'receipt',
          customerId: '',
          traderId: '',
          productId: selectedProduct.id,
          quantity: saleQuantity,
          amount: saleTotal,
          vat: 0,
          status: 'approved',
          paymentMethod: saleForm.paymentMethod,
          timestamp: new Date().toISOString(),
          customerName: saleForm.customerName || 'Walk-in customer',
          customerPhone: saleForm.customerPhone,
          customerEmail: saleForm.customerEmail,
          productName: selectedProduct.name,
          discountAmount: saleDiscount,
          recordedBy: 'trader',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Could not record sale.');
    } finally {
      setLoadingId(null);
    }
  };

  const isDeliveryPurchase = (purchase: Purchase) =>
    Boolean(
      purchase.isDelivery ||
        (purchase.deliveryStatus &&
          String(purchase.deliveryStatus).toLowerCase() !== 'n/a')
    );
  const deliveryStatus = (purchase: Purchase) =>
    String(purchase.deliveryStatus || (isDeliveryPurchase(purchase) ? 'pending' : 'n/a'));
  const deliveryStatusKey = (purchase: Purchase) => deliveryStatus(purchase).toLowerCase();
  const deliveryPurchases = purchases.filter(isDeliveryPurchase);

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.productName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSection = logSection === 'sales' || isDeliveryPurchase(p);
    return matchesSearch && matchesStatus && matchesSection;
  });

  return (
    <div className="space-y-6">
      {/* Enhanced Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
            Commerce Ledger
          </h2>
          <p className="text-neutral-500 font-medium text-sm tracking-tight">
            Record walk-in sales, credit wallet cashflow, reduce stock, and send receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRecordSale(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-orange-900/20 transition-all hover:bg-orange-700"
          >
            <Plus size={16} /> Record Sale
          </button>
          <div className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="micro-label text-emerald-600 mb-0.5">Success Rate</p>
              <p className="text-base font-black tabular-nums">
                {purchases.length > 0
                  ? Math.round(
                      (purchases.filter((p) => p.status === 'approved').length / purchases.length) *
                        100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
          <div className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="micro-label text-blue-600 mb-0.5">Total Volume</p>
              <p className="text-base font-black tabular-nums">{purchases.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder={t.trader.searchPurchases}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-medium dark:text-neutral-100"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-800 p-1 rounded-xl">
          {(['sales', 'deliveries'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setLogSection(section)}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
                logSection === section
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
              )}
            >
              {section === 'sales' ? `Sales (${purchases.length})` : `Deliveries (${deliveryPurchases.length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-800 p-1 rounded-xl">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
              )}
            >
              {status === 'all'
                ? t.common.all
                : status === 'pending'
                  ? t.common.pending
                  : status === 'approved'
                    ? t.common.approved
                    : t.common.rejected}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {saleMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-300"
          >
            <div className="flex items-center gap-2">
              <Wallet size={18} />
              <p className="text-sm font-bold">{saleMessage}</p>
            </div>
            <button
              onClick={() => setSaleMessage(null)}
              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
            >
              <XCircle size={16} />
            </button>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center justify-between gap-3 text-red-600 dark:text-red-400"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <p className="text-sm font-bold">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all"
            >
              <XCircle size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-neutral-900 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-100 dark:border-neutral-800 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  {t.common.customer}
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  {t.common.product}
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  {t.common.amount || 'Total'}
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  Net
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  {t.common.status}
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  Flow
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                  {t.common.date}
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] text-right">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredPurchases.map((purchase) => (
                <tr
                  key={purchase.id}
                  className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors group"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-xs text-neutral-400 group-hover:bg-orange-600 group-hover:text-white transition-all">
                        {purchase.customerName?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-neutral-100 text-sm">
                          {purchase.customerName || t.common.unknownCustomer}
                        </p>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                          {(purchase.paymentMethod || 'manual').replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-slate-900 dark:text-neutral-100 text-sm">
                      {purchase.productName || t.common.unknownProduct}
                    </p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                      {t.common.qty}: {purchase.quantity}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-black text-orange-600 text-sm tabular-nums">
                      {formatCurrency(purchase.amount)} RWF
                    </p>
                    <p className="text-[10px] font-bold text-neutral-400 tabular-nums">
                      Fee: {formatCurrency((purchase as any).platformFee || 0)}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-black text-emerald-500 text-sm tabular-nums">
                      {formatCurrency((purchase as any).netAmount || purchase.amount)} RWF
                    </p>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">
                      Settled
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                        purchase.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : purchase.status === 'rejected'
                            ? 'bg-red-500/10 text-red-600'
                            : 'bg-orange-500/10 text-orange-600'
                      )}
                    >
                      {purchase.status === 'approved' ? (
                        <CheckCircle size={12} />
                      ) : purchase.status === 'rejected' ? (
                        <XCircle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {purchase.status === 'approved' ? (
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest w-fit',
                            deliveryStatusKey(purchase) === 'delivered'
                              ? 'bg-blue-500/10 text-blue-600'
                              : deliveryStatusKey(purchase) === 'shipped'
                                ? 'bg-indigo-500/10 text-indigo-600'
                                : deliveryStatusKey(purchase) === 'pending'
                                  ? 'bg-orange-500/10 text-orange-600'
                                  : 'bg-neutral-500/10 text-neutral-500'
                          )}
                        >
                          {deliveryStatus(purchase)}
                        </span>
                        {isDeliveryPurchase(purchase) && (
                          <div className="relative">
                            <select
                              value={deliveryStatusKey(purchase)}
                              onChange={(e) =>
                                handleDeliveryStatusUpdate(purchase.id, e.target.value as any)
                              }
                              disabled={loadingId === purchase.id}
                              className="appearance-none w-full text-[9px] font-black uppercase tracking-widest bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg pl-3 pr-8 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer hover:bg-white dark:hover:bg-neutral-700 transition-all"
                            >
                              <option value="pending">Pending</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                            </select>
                            <ChevronDown
                              size={10}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-neutral-300 dark:text-neutral-700 uppercase tracking-widest">
                        N/A
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-900 dark:text-neutral-100">
                      {toDate(purchase.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-tighter">
                      {toDate(purchase.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {purchase.status === 'pending' && (
                        <>
                          <button
                            disabled={loadingId === purchase.id}
                            onClick={() => handleStatusUpdate(purchase.id, 'approved', purchase)}
                            className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all disabled:opacity-50"
                            title={t.common.approve}
                          >
                            {loadingId === purchase.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <CheckCircle size={16} />
                            )}
                          </button>
                          <button
                            disabled={loadingId === purchase.id}
                            onClick={() => handleStatusUpdate(purchase.id, 'rejected', purchase)}
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50"
                            title={t.common.reject}
                          >
                            {loadingId === purchase.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <XCircle size={16} />
                            )}
                          </button>
                        </>
                      )}
                      {purchase.status === 'approved' && (
                        <>
                          {isDeliveryPurchase(purchase) && deliveryStatusKey(purchase) !== 'delivered' ? (
                            <button
                              disabled={loadingId === purchase.id}
                              onClick={() => handleVerifyDelivery(purchase)}
                              className="p-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-all disabled:opacity-50"
                              title="Verify Delivery"
                            >
                              <QrCode size={16} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => setSelectedPurchase(purchase)}
                            className="p-1.5 bg-neutral-50 text-neutral-600 rounded-lg hover:bg-neutral-100 transition-all"
                            title="View Details"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={() => handleDownloadReceipt(purchase)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                            title={t.common.downloadReceipt}
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handleSendWhatsApp(purchase)}
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-40"
                            title="Send receipt by WhatsApp"
                            disabled={!purchase.customerPhone}
                          >
                            <MessageCircle size={16} />
                          </button>
                          <button
                            onClick={() => handleSendEmailReceipt(purchase)}
                            className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-all disabled:opacity-40"
                            title="Send receipt by email"
                            disabled={!purchase.customerEmail || loadingId === purchase.id}
                          >
                            {loadingId === purchase.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Mail size={16} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
          {filteredPurchases.map((purchase) => (
            <div key={purchase.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-orange-600/20">
                    {purchase.customerName?.[0] || 'U'}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-neutral-100 text-sm tracking-tight">
                      {purchase.customerName || 'Anonymous'}
                    </h4>
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      {toDate(purchase.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-orange-600 text-sm">
                    {formatCurrency(purchase.amount)}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest',
                      purchase.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : purchase.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                    )}
                  >
                    {purchase.status}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">
                    Asset Purchased
                  </p>
                  <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                    {purchase.productName || 'Unknown Product'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">
                    Quantity
                  </p>
                  <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                    {purchase.quantity} Units
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  {purchase.status === 'pending' ? (
                    <>
                      <button
                        disabled={loadingId === purchase.id}
                        onClick={() => handleStatusUpdate(purchase.id, 'approved', purchase)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={loadingId === purchase.id}
                        onClick={() => handleStatusUpdate(purchase.id, 'rejected', purchase)}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <>
                      {isDeliveryPurchase(purchase) && deliveryStatusKey(purchase) !== 'delivered' && (
                        <button
                          disabled={loadingId === purchase.id}
                          onClick={() => handleVerifyDelivery(purchase)}
                          className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                        >
                          <QrCode size={14} /> Verify Delivery
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedPurchase(purchase)}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        <FileText size={14} /> Details
                      </button>
                      <button
                        onClick={() => handleDownloadReceipt(purchase)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        <Download size={14} /> Receipt
                      </button>
                      <button
                        onClick={() => handleSendWhatsApp(purchase)}
                        disabled={!purchase.customerPhone}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                      <button
                        onClick={() => handleSendEmailReceipt(purchase)}
                        disabled={!purchase.customerEmail || loadingId === purchase.id}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        <Mail size={14} /> Email
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredPurchases.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText size={24} />
            </div>
            <p className="text-neutral-500 text-sm font-medium">{t.trader.noPurchasesFound}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showRecordSale && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleRecordSale}
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-neutral-100 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-600">
                    Manual Sales Capture
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-neutral-950 dark:text-white">
                    Record money received
                  </h3>
                  <p className="mt-1 text-sm font-medium text-neutral-500">
                    Stock goes down, wallet goes up, receipt is ready.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecordSale(false)}
                  className="rounded-full bg-white p-2 text-neutral-500 shadow-sm hover:text-neutral-900 dark:bg-neutral-800 dark:hover:text-white"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="grid max-h-[72vh] grid-cols-1 gap-5 overflow-y-auto p-6 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Item from inventory
                  </span>
                  <select
                    value={saleForm.productId}
                    onChange={(event) => {
                      const product = products.find((item) => item.id === event.target.value);
                      setSaleForm({
                        ...saleForm,
                        productId: event.target.value,
                        price: product?.price ? String(product.price) : '',
                      });
                    }}
                    required
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="">Choose product or service</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.stock} in stock - RWF{' '}
                        {Number(product.price || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>

                <FieldInput
                  label="Quantity"
                  type="number"
                  min="1"
                  value={saleForm.quantity}
                  onChange={(value) => setSaleForm({ ...saleForm, quantity: value })}
                />
                <FieldInput
                  label="Unit price"
                  type="number"
                  min="0"
                  value={saleForm.price}
                  onChange={(value) => setSaleForm({ ...saleForm, price: value })}
                />
                <FieldInput
                  label="Discount"
                  type="number"
                  min="0"
                  value={saleForm.discountAmount}
                  onChange={(value) => setSaleForm({ ...saleForm, discountAmount: value })}
                />
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Payment method
                  </span>
                  <select
                    value={saleForm.paymentMethod}
                    onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <FieldInput
                  label="Customer name"
                  value={saleForm.customerName}
                  placeholder="Walk-in customer"
                  onChange={(value) => setSaleForm({ ...saleForm, customerName: value })}
                />
                <FieldInput
                  label="WhatsApp number"
                  value={saleForm.customerPhone}
                  placeholder="078..."
                  onChange={(value) => setSaleForm({ ...saleForm, customerPhone: value })}
                />
                <FieldInput
                  label="Email"
                  type="email"
                  value={saleForm.customerEmail}
                  placeholder="customer@example.com"
                  onChange={(value) => setSaleForm({ ...saleForm, customerEmail: value })}
                />
                <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm font-bold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={saleForm.wantsReceipt}
                    onChange={(event) => setSaleForm({ ...saleForm, wantsReceipt: event.target.checked })}
                  />
                  Customer wants receipt
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Note
                  </span>
                  <textarea
                    value={saleForm.notes}
                    onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })}
                    placeholder="Short sale note, color, size, or service detail"
                    className="min-h-[88px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 outline-none focus:border-orange-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </label>

                <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5 md:col-span-2 dark:border-orange-900/30 dark:bg-orange-950/20">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                        Subtotal
                      </p>
                      <p className="text-lg font-black text-neutral-950 dark:text-white">
                        RWF {saleSubtotal.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                        Discount
                      </p>
                      <p className="text-lg font-black text-neutral-950 dark:text-white">
                        RWF {saleDiscount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        Wallet credit
                      </p>
                      <p className="text-lg font-black text-emerald-600">
                        RWF {saleTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-neutral-100 p-6 dark:border-neutral-800 md:flex-row">
                <button
                  type="button"
                  onClick={() => setShowRecordSale(false)}
                  className="flex-1 rounded-2xl bg-neutral-100 px-5 py-4 text-xs font-black uppercase tracking-widest text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingId === 'manual-sale'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {loadingId === 'manual-sale' ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  Save Sale
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPurchase && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedPurchase(null)}
                className="absolute top-6 right-6 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors z-10"
              >
                <XCircle size={20} />
              </button>

              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600">
                    <ShoppingBag size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white">
                      Order Details
                    </h3>
                    <p className="text-sm text-neutral-500">ID: {selectedPurchase.id}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                        Customer
                      </p>
                      <p className="text-sm font-bold dark:text-white">
                        {selectedPurchase.customerName}
                      </p>
                    </div>
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                        Product
                      </p>
                      <p className="text-sm font-bold dark:text-white">
                        {selectedPurchase.productName}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                      Delivery Method
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedPurchase.isDelivery ? (
                        <Truck size={16} className="text-blue-600" />
                      ) : (
                        <ShoppingBag size={16} className="text-orange-600" />
                      )}
                      <p className="text-sm font-bold dark:text-white">
                        {selectedPurchase.isDelivery ? 'Home Delivery' : 'Self Pickup'}
                      </p>
                    </div>
                  </div>

                  {isDeliveryPurchase(selectedPurchase) && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-2xl">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                        Delivery Address
                      </p>
                      <p className="text-sm font-medium dark:text-neutral-300">
                        {selectedPurchase.deliveryAddress || 'No address provided'}
                      </p>
                    </div>
                  )}

                  {isDeliveryPurchase(selectedPurchase) && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">
                        Delivery Verification QR
                      </p>
                      <div className="flex justify-center py-4">
                        <React.Suspense
                          fallback={
                            <div className="h-40 w-40 rounded-2xl bg-white border border-neutral-200" />
                          }
                        >
                          <QRCodeSVG
                            value={JSON.stringify({
                              purchaseId: selectedPurchase.id,
                              customerName: selectedPurchase.customerName,
                              productName: selectedPurchase.productName,
                              amount: selectedPurchase.amount,
                              timestamp: selectedPurchase.timestamp,
                            })}
                            size={160}
                            bgColor="#fff"
                            fgColor="#0f172a"
                          />
                        </React.Suspense>
                      </div>
                      <p className="text-[11px] text-neutral-500 text-center">
                        Scan to verify order completion at delivery.
                      </p>
                      {deliveryStatusKey(selectedPurchase) !== 'delivered' && (
                        <button
                          onClick={() => handleVerifyDelivery(selectedPurchase)}
                          disabled={loadingId === selectedPurchase.id}
                          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50"
                        >
                          <QrCode size={16} /> Verify Delivery
                        </button>
                      )}
                      {deliveryStatusKey(selectedPurchase) === 'delivered' && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold">
                          <CheckCircle size={16} /> Delivery verified
                        </div>
                      )}
                    </div>
                  )}

                  {selectedPurchase.notes && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                        Customer Notes
                      </p>
                      <p className="text-sm font-medium dark:text-neutral-300 italic">
                        "{selectedPurchase.notes}"
                      </p>
                    </div>
                  )}

                  <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-500">Gross Amount</span>
                      <span className="font-bold dark:text-white">
                        RWF {formatCurrency(selectedPurchase.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-500">Platform Fee (2%)</span>
                      <span className="font-bold text-red-500">
                        - RWF {formatCurrency((selectedPurchase as any).platformFee || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      <span className="font-black text-neutral-900 dark:text-white text-lg">
                        Net Settlement
                      </span>
                      <span className="text-2xl font-black text-emerald-600">
                        RWF{' '}
                        {formatCurrency(
                          (selectedPurchase as any).netAmount || selectedPurchase.amount
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPurchase(null)}
                  className="w-full mt-8 py-4 bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
