import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from '../../services/firestoreBridge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  Phone,
  Loader2,
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';

interface Delivery {
  id: string;
  status: string;
  trackingNumber?: string;
  customerName: string;
  address: string;
  note?: string;
  totalAmount: number;
  timestamp: any;
  items: any[];
}

export default function TraderDeliveries({ traderId }: { traderId: string }) {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'preparing' | 'on_the_way' | 'delivered'
  >('all');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, 'deliveries'), where('traderId', '==', traderId));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Delivery[];
        setDeliveries(data);

        // Initialize tracking numbers state
        const tracking: Record<string, string> = {};
        data.forEach((d) => {
          tracking[d.id] = d.trackingNumber || '';
        });
        setTrackingNumbers(tracking);

        setLoading(false);
      },
      (err) => {
        console.error('Trader deliveries listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [traderId]);

  const handleUpdate = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'deliveries', id), {
        status,
        trackingNumber: trackingNumbers[id] || '',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating delivery:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredDeliveries = deliveries.filter((d) => filter === 'all' || d.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            Delivery Management
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            Track and manage your outgoing deliveries
          </p>
        </div>
        <div className="flex gap-2 bg-white dark:bg-neutral-900 p-1 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-x-auto no-scrollbar">
          {(['all', 'pending', 'preparing', 'on_the_way', 'delivered'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                filter === s
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
              )}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredDeliveries.map((delivery) => (
          <motion.div
            key={delivery.id}
            layout
            className="bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                    delivery.status === 'delivered'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                  )}
                >
                  <Truck size={24} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-black text-neutral-900 dark:text-neutral-100 truncate">
                      Order #{delivery.id.slice(-6).toUpperCase()}
                    </h4>
                    <span
                      className={cn(
                        'text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest',
                        delivery.status === 'pending'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : delivery.status === 'preparing'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : delivery.status === 'on_the_way'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      )}
                    >
                      {delivery.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                    <span className="flex items-center gap-1">
                      <User size={12} /> {delivery.customerName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {delivery.timestamp?.toDate()?.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 mb-1">
                  <MapPin size={14} className="shrink-0" />
                  <p className="text-xs font-bold truncate">{delivery.address}</p>
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium italic">
                  "{delivery.note || 'No delivery notes'}"
                </p>
              </div>

              <div className="flex flex-col gap-3 shrink-0 min-w-[200px]">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase">
                      Total Value
                    </p>
                    <p className="font-black text-orange-600 dark:text-orange-400">
                      {formatCurrency(delivery.totalAmount)} RWF
                    </p>
                  </div>
                  <select
                    value={delivery.status}
                    onChange={(e) => handleUpdate(delivery.id, e.target.value)}
                    className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-orange-500 dark:text-neutral-100"
                  >
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="on_the_way">On the Way</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tracking Number"
                    value={trackingNumbers[delivery.id] || ''}
                    onChange={(e) =>
                      setTrackingNumbers((prev) => ({ ...prev, [delivery.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-orange-500 dark:text-neutral-100"
                  />
                  <button
                    onClick={() => handleUpdate(delivery.id, delivery.status)}
                    disabled={updatingId === delivery.id}
                    className="px-4 py-2 bg-neutral-900 dark:bg-neutral-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-600 transition-all disabled:opacity-50"
                  >
                    {updatingId === delivery.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Update'
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-50 dark:border-neutral-800 flex flex-wrap gap-4">
              {delivery.items?.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-100 dark:border-neutral-700"
                >
                  <span className="text-[10px] font-black text-orange-600 dark:text-orange-400">
                    {item.quantity}x
                  </span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {deliveries.length === 0 && !loading && (
          <div className="bg-white dark:bg-neutral-900 p-12 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 text-center">
            <Truck className="mx-auto text-neutral-200 dark:text-neutral-700 mb-4" size={64} />
            <h3 className="text-xl font-black text-neutral-900 dark:text-neutral-100 mb-2">
              No Deliveries Yet
            </h3>
            <p className="text-neutral-400 dark:text-neutral-500 font-medium">
              When customers order for delivery, they will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
