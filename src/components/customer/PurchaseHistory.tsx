import { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from '../../services/firestoreBridge';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';
import {
  ShoppingBag,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  Package,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { generateReceipt } from '../../lib/pdfGenerator';
import { Download } from 'lucide-react';

interface Purchase {
  id: string;
  productId: string;
  productName: string;
  traderId: string;
  traderName: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  timestamp: any;
  productCode?: string;
  quantity?: number;
  method?: string;
}

export default function PurchaseHistory() {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>(
    'all'
  );

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'payment'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const purchaseData = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        })) as any[];
        setPurchases(
          purchaseData.sort((a: any, b: any) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
            return timeB - timeA;
          })
        );
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.traderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-100 rounded w-1/3"></div>
                <div className="h-3 bg-neutral-100 rounded w-1/4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
            Commerce Ledger
          </h2>
          <p className="text-neutral-500 font-medium text-sm tracking-tight">
            Comprehensive transaction history and digitized RRA-compliant receipts.
          </p>
        </div>

        <div className="flex bg-[#0a0a0a] p-1 rounded-2xl border border-white/5 shadow-inner shrink-0">
          {['all', 'completed', 'pending', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={cn(
                'px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                filterStatus === status
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                  : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Search by product, trader, or transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-[#0a0a0a] border border-white/5 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm text-neutral-100"
          />
        </div>
      </div>

      {/* Purchase List */}
      <div className="space-y-3">
        {filteredPurchases.length > 0 ? (
          filteredPurchases.map((purchase) => (
            <motion.div
              key={purchase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 group hover:border-orange-500/30 transition-all cursor-pointer bg-[#0a0a0a] border-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-600/10 text-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm border border-orange-500/10">
                    <ShoppingBag size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-neutral-100 text-sm tracking-tight">
                        {purchase.productName || 'Purchase'}
                      </h4>
                      {purchase.productCode && (
                        <span className="px-2 py-0.5 bg-white/5 text-neutral-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10">
                          #{purchase.productCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        <Store size={12} />
                        {purchase.traderName || 'ESOKO Merchant'}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        <Clock size={12} />
                        {purchase.timestamp?.toDate
                          ? format(purchase.timestamp.toDate(), 'MMM dd, HH:mm')
                          : 'Just now'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white">
                    {purchase.amount.toLocaleString()} RWF
                  </p>
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mt-1',
                      purchase.status === 'completed'
                        ? 'bg-green-500/10 text-green-500'
                        : purchase.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-red-500/10 text-red-500'
                    )}
                  >
                    {purchase.status === 'completed' && <CheckCircle2 size={8} />}
                    {purchase.status === 'pending' && <Clock size={8} />}
                    {purchase.status === 'failed' && <XCircle size={8} />}
                    {purchase.status || 'completed'}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                    <Package size={12} />
                    Qty: {purchase.quantity || 1}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                    <AlertCircle size={12} />
                    ID: {purchase.id.slice(0, 8)}...
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateReceipt({
                        transactionId: purchase.id,
                        date: purchase.timestamp?.toDate
                          ? format(purchase.timestamp.toDate(), 'PPP p')
                          : 'Just now',
                        amount: purchase.amount,
                        type: 'payment',
                        method: purchase.method || 'wallet',
                        status: purchase.status || 'completed',
                        businessName: purchase.traderName,
                        productName: purchase.productName,
                        quantity: purchase.quantity,
                      });
                    }}
                    className="p-2 text-neutral-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"
                    title="Download Receipt"
                  >
                    <Download size={16} />
                  </button>
                  <button className="flex items-center gap-1 text-orange-500 text-[10px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                    Details <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="card text-center py-20 bg-[#0a0a0a] border-dashed border-white/10 rounded-[2.5rem]">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-white/5">
              <ShoppingBag className="text-neutral-700" size={32} />
            </div>
            <h3 className="text-white font-black text-lg tracking-tight">No purchases found</h3>
            <p className="text-neutral-500 text-sm mt-1">
              Try adjusting your filters or search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
