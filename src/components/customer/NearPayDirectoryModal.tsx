import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Nfc, Search, Store, User, Wallet, X } from 'lucide-react';
import { collection, getDocs, query, where } from '../../services/firestoreBridge';
import { calculateDistance, Coordinates, getCurrentCoordinates } from '../../lib/locationUtils';
import { cn } from '../../lib/utils';
import NearPaymentModal from './NearPaymentModal';

interface NearbyPayee {
  id: string;
  name?: string;
  businessName?: string;
  businessAddress?: string;
  phone?: string;
  phoneNumber?: string;
  role?: string;
  coordinates?: Coordinates;
  distance?: number;
}

interface NearPayDirectoryModalProps {
  onClose: () => void;
}

export default function NearPayDirectoryModal({ onClose }: NearPayDirectoryModalProps) {
  const db = undefined;
  const [payees, setPayees] = useState<NearbyPayee[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedPayee, setSelectedPayee] = useState<NearbyPayee | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadNearby = async () => {
      setLoading(true);
      setError(null);
      try {
        const coords = await getCurrentCoordinates();
        const traderSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'trader')));
        const customerSnap = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'customer'))
        );

        const merged = [...traderSnap.docs, ...customerSnap.docs]
          .map((doc: any) => ({ id: doc.id, ...doc.data() }))
          .map((payee: NearbyPayee) => {
            const lat = Number(payee.coordinates?.lat);
            const lng = Number(payee.coordinates?.lng);
            const hasCoords =
              Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
            return hasCoords
              ? {
                  ...payee,
                  coordinates: { lat, lng },
                  distance: calculateDistance(coords, { lat, lng }),
                }
              : payee;
          })
          .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));

        if (!mounted) return;
        setUserLocation(coords);
        setPayees(merged);
      } catch (err) {
        if (!mounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Location permission is needed to find people and merchants near you.'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadNearby();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredPayees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payees;
    return payees.filter((payee) =>
      [payee.businessName, payee.name, payee.businessAddress, payee.phone, payee.phoneNumber, payee.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [payees, search]);

  return (
    <>
      <div className="fixed inset-0 z-[135] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2rem] bg-[#0a0a0a] border border-white/10 shadow-2xl flex flex-col"
        >
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">
                Near Pay
              </p>
              <h3 className="text-2xl font-black text-white leading-tight">
                Choose someone nearby
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-3 rounded-2xl bg-white/5 text-neutral-400 hover:text-white border border-white/5"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-5 border-b border-white/5 space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nearby traders, customers, shop names, phones..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-neutral-700"
              />
            </div>
            {userLocation && (
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300">
                <Navigation size={14} /> Location active. Closest choices appear first.
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
            {loading && (
              <div className="py-16 text-center text-neutral-500 font-black uppercase tracking-widest text-[10px]">
                Finding nearby people and traders...
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-5 text-blue-300 text-sm font-bold">
                {error}
              </div>
            )}

            {!loading &&
              filteredPayees.map((payee) => (
                <button
                  key={payee.id}
                  type="button"
                  onClick={() => setSelectedPayee(payee)}
                  className="w-full rounded-2xl bg-white/5 border border-white/5 p-4 text-left hover:border-orange-500/30 hover:bg-white/10 transition-all flex items-center gap-4"
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0',
                      payee.role === 'trader'
                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    )}
                  >
                    {payee.role === 'trader' ? <Store size={22} /> : <User size={22} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black truncate">
                      {payee.businessName || payee.name || 'Nearby user'}
                    </p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                      {payee.businessAddress || payee.phone || payee.phoneNumber || payee.role || 'Nexus account'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                      {payee.distance !== undefined ? `${payee.distance.toFixed(1)} km` : 'No map'}
                    </p>
                    <p className="text-[9px] font-bold text-neutral-600">Tap to pay</p>
                  </div>
                </button>
              ))}

            {!loading && !error && filteredPayees.length === 0 && (
              <div className="py-16 text-center">
                <MapPin className="mx-auto text-neutral-800 mb-4" size={48} />
                <p className="text-neutral-500 font-bold">No nearby payees found.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {selectedPayee && (
        <NearPaymentModal
          trader={selectedPayee}
          onClose={() => setSelectedPayee(null)}
        />
      )}
    </>
  );
}
