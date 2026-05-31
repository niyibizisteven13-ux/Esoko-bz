import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { useLanguage } from '../../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Store,
  Navigation,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  SlidersHorizontal,
  Eye,
  X,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VerifiedBadge } from '../VerifiedBadge';
import { calculateDistance, getCurrentCoordinates, Coordinates } from '../../lib/locationUtils';
import { isAccountVerified } from '../../lib/verification';

export default function TraderSuppliers() {
  const { t } = useLanguage();
  const [traders, setTraders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [distanceFilter, setDistanceFilter] = useState(10); // 10km default for suppliers
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);

  useEffect(() => {
    // Fetch all traders
    const unsubTraders = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'trader')),
      (snap) => {
        setTraders(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );

    // Fetch all products to know who sells what
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTraders();
      unsubProducts();
    };
  }, []);

  const handleNearbyToggle = async () => {
    if (!nearbyOnly && !userLocation) {
      setGettingLocation(true);
      try {
        const coords = await getCurrentCoordinates();
        setUserLocation(coords);
        setNearbyOnly(true);
      } catch (err) {
        console.error('Location error:', err);
      } finally {
        setGettingLocation(false);
      }
    } else {
      setNearbyOnly(!nearbyOnly);
    }
  };

  const filteredSuppliers = traders.filter((trader) => {
    const queryTerms = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t);

    const matchesSearch = queryTerms.every((term) => {
      // Check if any product of this trader matches the term
      const hasMatchingProduct = products.some(
        (p) =>
          p.traderId === trader.id &&
          (p.name?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term) ||
            p.category?.toLowerCase().includes(term))
      );

      return (
        trader.businessName?.toLowerCase().includes(term) ||
        trader.businessCategory?.toLowerCase().includes(term) ||
        trader.businessAddress?.toLowerCase().includes(term) ||
        trader.name?.toLowerCase().includes(term) ||
        hasMatchingProduct
      );
    });

    let matchesDistance = true;
    if (nearbyOnly && userLocation) {
      if (trader.coordinates) {
        const dist = calculateDistance(userLocation, trader.coordinates);
        matchesDistance = dist <= distanceFilter;
      } else {
        matchesDistance = false;
      }
    }

    return matchesSearch && matchesDistance;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">
          {t.common.findSupplier || 'Find Suppliers'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'p-3 rounded-2xl transition-all border flex items-center gap-2 font-bold text-sm',
              showFilters
                ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/20 dark:border-orange-900/30'
                : 'bg-white border-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400'
            )}
          >
            <SlidersHorizontal size={18} />
            Filters
          </button>
          <button
            onClick={handleNearbyToggle}
            disabled={gettingLocation}
            className={cn(
              'p-3 rounded-2xl transition-all border flex items-center gap-2 font-bold text-sm',
              nearbyOnly
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                : 'bg-white border-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400'
            )}
          >
            {gettingLocation ? (
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Navigation size={18} />
            )}
            {t.common.nearBy || 'Nearby'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search
          className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-orange-500 transition-colors"
          size={20}
        />
        <input
          type="text"
          placeholder={
            t.trader.searchSuppliersPlaceholder ||
            'Search by product name, business name, or category...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-14 pr-6 py-5 bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm font-medium dark:text-white"
        />
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                      Discovery Radius
                    </p>
                    <span className="text-xs font-black text-orange-600">{distanceFilter}km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={distanceFilter}
                    onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
                    className="w-full accent-orange-600 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 bg-white dark:bg-neutral-900 rounded-[2.5rem] animate-pulse"
            />
          ))
        ) : filteredSuppliers.length > 0 ? (
          filteredSuppliers.map((trader) => {
            const distance =
              userLocation && trader.coordinates
                ? calculateDistance(userLocation, trader.coordinates)
                : null;
            const traderProducts = products.filter((p) => p.traderId === trader.id);

            return (
              <motion.div
                key={trader.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-neutral-900 p-6 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="w-14 h-14 bg-orange-50 dark:bg-orange-950 rounded-2xl flex items-center justify-center text-orange-600">
                    <Store size={28} />
                  </div>
                  {distance !== null && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
                      <Navigation size={10} className="fill-current" />
                      {distance.toFixed(1)}km
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-6">
                  <div className="inline-flex px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-neutral-200 dark:border-neutral-700">
                    {trader.businessCategory || 'General Trader'}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white leading-tight">
                      {trader.businessName || trader.name}
                    </h3>
                    {isAccountVerified(trader) && (
                      <VerifiedBadge
                        level="verified"
                        size="xs"
                        showLabel={false}
                        animated
                        className="!border-white/10"
                      />
                    )}
                  </div>
                </div>

                {/* Micro Product Preview */}
                {traderProducts.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">
                      Inventory Highlights
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {traderProducts.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-lg text-[8px] font-bold dark:text-neutral-300"
                        >
                          {p.name}
                        </div>
                      ))}
                      {traderProducts.length > 3 && (
                        <div className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-[8px] font-bold text-neutral-400 rounded-lg">
                          +{traderProducts.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTrader(trader)}
                    className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/10"
                  >
                    View Contact <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-20 bg-neutral-50 dark:bg-neutral-900 rounded-[3rem] border-2 border-dashed border-neutral-200 dark:border-neutral-800">
            <ShoppingBag
              className="mx-auto text-neutral-200 dark:text-neutral-800 mb-4"
              size={48}
            />
            <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">
              No Suppliers Found
            </h3>
            <p className="text-neutral-400 font-medium">
              Try adjusting your search or radius filters.
            </p>
          </div>
        )}
      </div>

      {/* Supplier Contact Modal */}
      <AnimatePresence>
        {selectedTrader && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-neutral-950 max-w-lg w-full rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-neutral-100 dark:border-neutral-800"
            >
              <button
                onClick={() => setSelectedTrader(null)}
                className="absolute top-6 right-6 p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-full transition-all z-20"
              >
                <X size={20} />
              </button>

              <div className="p-10 space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-orange-50 dark:bg-orange-950 rounded-3xl flex items-center justify-center text-orange-600">
                    <Store size={40} />
                  </div>
                  <div>
                    <div className="inline-flex px-3 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 border border-orange-100 dark:border-orange-900/30">
                      {selectedTrader.businessCategory || 'General Trader'}
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
                      {selectedTrader.businessName || selectedTrader.name}
                    </h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                    Contact Information
                  </h4>
                  <div className="grid gap-3">
                    {(selectedTrader.phone || selectedTrader.phoneNumber) && (
                      <a
                        href={`tel:${selectedTrader.phone || selectedTrader.phoneNumber}`}
                        className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center gap-4 group hover:border-emerald-500 transition-all"
                      >
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          <Phone size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                            {t.common.phone}
                          </p>
                          <p className="font-bold text-neutral-900 dark:text-white">
                            {selectedTrader.phone || selectedTrader.phoneNumber}
                          </p>
                        </div>
                      </a>
                    )}
                    {selectedTrader.email && (
                      <a
                        href={`mailto:${selectedTrader.email}`}
                        className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center gap-4 group hover:border-blue-500 transition-all"
                      >
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <Mail size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                            {t.common.email}
                          </p>
                          <p className="font-bold text-neutral-900 dark:text-white truncate max-w-[200px]">
                            {selectedTrader.email}
                          </p>
                        </div>
                      </a>
                    )}
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-xl flex items-center justify-center">
                        <MapPin size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Business Address
                        </p>
                        <p className="font-bold text-neutral-900 dark:text-white">
                          {selectedTrader.businessAddress || 'Kigali, Rwanda'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setSelectedTrader(null)}
                    className="w-full py-5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
