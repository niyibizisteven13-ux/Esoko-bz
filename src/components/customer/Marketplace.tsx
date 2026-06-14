import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, getDocs } from '../../services/firestoreBridge';
import { useMemo, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingBag,
  Store,
  Download,
  Star,
  Percent,
  Award,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  X,
  MapPin,
  Navigation,
  Phone,
  Mail,
  Map as MapIcon,
  List,
  ShoppingCart,
  Flag,
  AlertTriangle,
  Radio,
  Nfc,
  Share2,
  Copy,
  MessageCircle,
  Send,
  Maximize2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VerifiedBadge } from '../VerifiedBadge';
import PurchaseModal from './PurchaseModal';
import MapView from './MapView';
import LiveTraderRoom from './LiveTraderRoom';
import NearPaymentModal from './NearPaymentModal';
import {
  calculateDistance,
  getCurrentCoordinates,
  Coordinates,
  openGoogleMapsDirections,
} from '../../lib/locationUtils';
import { auth } from '../../firebase';
import { createTicket } from '../../services/ticketService';
import { isAccountVerified } from '../../lib/verification';

import QRScanner from './QRScanner';

export function Marketplace({
  initialSearchMode = 'products',
  initialNearby = false,
  initialMapView = false,
}: {
  initialSearchMode?: 'products' | 'shops';
  initialNearby?: boolean;
  initialMapView?: boolean;
} = {}) {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [incentives, setIncentives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'products' | 'shops'>(initialSearchMode);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000000 });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showQuickView, setShowQuickView] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [nearPaymentTarget, setNearPaymentTarget] = useState<{
    product?: any;
    trader?: any;
  } | null>(null);
  const [liveRoomTarget, setLiveRoomTarget] = useState<{
    product?: any;
    trader?: any;
    products?: any[];
    session?: any;
  } | null>(null);
  const [reportModalProduct, setReportModalProduct] = useState<any>(null);
  const [reportReason, setReportReason] = useState<'irrelevant' | 'misleading' | 'spam' | 'other'>(
    'irrelevant'
  );
  const [reportMessage, setReportMessage] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [shareProduct, setShareProduct] = useState<any>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [nearbyOnly, setNearbyOnly] = useState(initialNearby);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [traders, setTraders] = useState<Record<string, any>>({});
  const [distanceFilter, setDistanceFilter] = useState(5); // 5km default
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isMapView, setIsMapView] = useState(initialMapView);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Traders for location data
    const fetchTraders = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'trader'));
      const snap = await getDocs(q);
      const traderMap: Record<string, any> = {};
      snap.docs.forEach((doc: any) => {
        traderMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setTraders(traderMap);
    };
    fetchTraders();

    const qProducts = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(
      qProducts,
      (snapshot: any) => {
        const productsData = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);

        // Update max price based on products
        if (productsData.length > 0) {
          const max = Math.max(...productsData.map((p: any) => p.price || 0));
          setPriceRange((prev) => ({ ...prev, max }));
        }

        setLoading(false);
      },
      (error) => {
        console.error('Error fetching products:', error);
        setLoading(false);
      }
    );

    const qIncentives = query(collection(db, 'incentive_programs'), where('active', '==', true));
    const unsubIncentives = onSnapshot(qIncentives, (snapshot: any) => {
      setIncentives(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubProducts();
      unsubIncentives();
    };
  }, []);

  useEffect(() => {
    const loadLiveSessions = async () => {
      try {
        const res = await fetch('/api/live/sessions', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setLiveSessions(data.sessions || []);
      } catch (error) {
        console.error('Failed to load live sessions:', error);
      }
    };
    loadLiveSessions();
    const interval = window.setInterval(loadLiveSessions, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('liveSession');
    if (!sessionId || liveSessions.length === 0) return;
    const session = liveSessions.find((item) => item.id === sessionId);
    if (!session) return;
    const trader = traders[session.traderId] || {
      id: session.traderId,
      name: session.traderName,
      businessName: session.businessName,
      phoneNumber: session.traderPhone,
    };
    setLiveRoomTarget({
      session,
      trader,
      product: products.find((product) => product.id === session.pinnedProductId),
      products: getTraderProducts(session.traderId),
    });
  }, [liveSessions, traders, products]);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get('product');
    if (!productId || products.length === 0) return;
    const product = products.find((item) => item.id === productId);
    if (product) setShowQuickView(product);
  }, [products]);

  const openReportModal = (product: any) => {
    setReportModalProduct(product);
    setReportReason('irrelevant');
    setReportMessage('');
    setReportError(null);
    setReportSuccess(null);
  };

  const closeReportModal = () => {
    setReportModalProduct(null);
    setReportError(null);
    setReportSuccess(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalProduct) return;
    if (!reportMessage.trim()) {
      setReportError('Please explain what is wrong with this product or video.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setReportError('You must be logged in to submit a report.');
      return;
    }

    setReportSubmitting(true);
    setReportError(null);
    setReportSuccess(null);

    try {
      await createTicket({
        title: `Marketplace report: ${reportModalProduct.name || 'Product'}`,
        description: `Reason: ${reportReason}\nProduct: ${reportModalProduct.name || reportModalProduct.id}\nTrader ID: ${reportModalProduct.traderId || 'unknown'}\n\nDetails:\n${reportMessage.trim()}`,
        status: 'open',
        priority: reportReason === 'spam' ? 'high' : 'medium',
        createdBy: currentUser.uid,
        category: 'marketplace-report',
        metadata: {
          productId: reportModalProduct.id,
          traderId: reportModalProduct.traderId,
          reason: reportReason,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setReportSuccess('Thank you. Your report has been submitted for review.');
      setReportMessage('');
    } catch (err) {
      console.error('Report submission failed:', err);
      setReportError(
        err instanceof Error ? err.message : 'Failed to send report. Please try again.'
      );
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleNearbyToggle = async () => {
    if (!nearbyOnly && !userLocation) {
      setGettingLocation(true);
      setLocationError(null);
      try {
        const coords = await getCurrentCoordinates();
        setUserLocation(coords);
        setNearbyOnly(true);
      } catch (err) {
        console.error('Location error:', err);
        setLocationError(
          err instanceof Error ? err.message : 'Location permission is unavailable right now.'
        );
      } finally {
        setGettingLocation(false);
      }
    } else {
      setNearbyOnly(!nearbyOnly);
    }
  };

  const openTraderMap = async () => {
    setSearchMode('shops');
    setIsMapView(true);
    if (!userLocation) {
      await handleNearbyToggle();
    } else {
      setNearbyOnly(true);
    }
  };

  const getTraderCoordinates = (trader: any): Coordinates | null => {
    const lat = Number(trader?.coordinates?.lat ?? trader?.latitude ?? trader?.lat);
    const lng = Number(trader?.coordinates?.lng ?? trader?.longitude ?? trader?.lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
    return null;
  };

  const navigateToTrader = (trader: any) => {
    const coordinates = getTraderCoordinates(trader);
    if (coordinates) openGoogleMapsDirections(coordinates, userLocation || undefined);
  };

  const getTraderDistance = (trader: any) => {
    if (!userLocation) return null;
    const coordinates = getTraderCoordinates(trader);
    return coordinates ? calculateDistance(userLocation, coordinates) : null;
  };

  const filteredProducts = products
    .filter((product) => {
      const queryTerms = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t);
      const traderInfo = traders[product.traderId];

      const matchesSearch = queryTerms.every(
        (term) =>
          product.name?.toLowerCase().includes(term) ||
          product.description?.toLowerCase().includes(term) ||
          product.category?.toLowerCase().includes(term) ||
          traderInfo?.businessName?.toLowerCase().includes(term) ||
          traderInfo?.businessAddress?.toLowerCase().includes(term) ||
          traderInfo?.name?.toLowerCase().includes(term)
      );
      const matchesCategory =
        selectedCategory === 'all' ||
        product.category === selectedCategory ||
        traderInfo?.businessCategory === selectedCategory;
      const matchesPrice =
        (product.price || 0) >= priceRange.min && (product.price || 0) <= priceRange.max;

      let matchesDistance = true;
      if (nearbyOnly && userLocation) {
        const traderCoordinates = getTraderCoordinates(traderInfo);
        if (traderCoordinates) {
          const dist = calculateDistance(userLocation, traderCoordinates);
          matchesDistance = dist <= distanceFilter;
        } else {
          matchesDistance = false;
        }
      }

      return matchesSearch && matchesCategory && matchesPrice && matchesDistance;
    })
    .sort((a, b) => {
      if (!userLocation) return 0;
      const aDistance = getTraderDistance(traders[a.traderId]);
      const bDistance = getTraderDistance(traders[b.traderId]);
      if (aDistance === null && bDistance === null) return 0;
      if (aDistance === null) return 1;
      if (bDistance === null) return -1;
      return aDistance - bDistance;
    });

  const filteredShops = Object.values(traders)
    .filter((trader) => {
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
          trader.businessAddress?.toLowerCase().includes(term) ||
          trader.category?.toLowerCase().includes(term) ||
          trader.businessCategory?.toLowerCase().includes(term) ||
          trader.name?.toLowerCase().includes(term) ||
          hasMatchingProduct
        );
      });
      const matchesCategory =
        selectedCategory === 'all' || trader.businessCategory === selectedCategory;

      let matchesDistance = true;
      if (nearbyOnly && userLocation) {
        const traderCoordinates = getTraderCoordinates(trader);
        if (traderCoordinates) {
          const dist = calculateDistance(userLocation, traderCoordinates);
          matchesDistance = dist <= distanceFilter;
        } else {
          matchesDistance = false;
        }
      }
      return matchesSearch && matchesCategory && matchesDistance;
    })
    .sort((a, b) => {
      if (!userLocation) return 0;
      const aDistance = getTraderDistance(a);
      const bDistance = getTraderDistance(b);
      if (aDistance === null && bDistance === null) return 0;
      if (aDistance === null) return 1;
      if (bDistance === null) return -1;
      return aDistance - bDistance;
    });

  const quickViewProducts = useMemo(() => {
    if (!showQuickView) return [];
    const seen = new Set<string>();
    const addUnique = (items: any[]) =>
      items.filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    return [
      ...addUnique([showQuickView]),
      ...addUnique(products.filter((product) => product.traderId === showQuickView.traderId)),
      ...addUnique(products.filter((product) => product.category === showQuickView.category)),
      ...addUnique(filteredProducts),
      ...addUnique(products),
    ];
  }, [filteredProducts, products, showQuickView]);

  const getTraderProducts = (traderId?: string) => {
    if (!traderId) return [];
    return products.filter((product) => product.traderId === traderId);
  };

  const getLiveSessionForTrader = (traderId?: string) => {
    if (!traderId) return null;
    const trader = traders[traderId];
    const normalize = (value?: string) =>
      String(value || '')
        .trim()
        .toLowerCase();
    const traderMatches = [trader?.businessName, trader?.name, trader?.email]
      .map(normalize)
      .filter(Boolean);

    return (
      liveSessions.find((session) => {
        if (session.status !== 'live') return false;
        if (session.traderId === traderId) return true;

        const sessionMatches = [
          session.businessName,
          session.traderName,
          session.traderEmail,
          session.metadata?.businessName,
          session.metadata?.traderName,
          session.metadata?.traderEmail,
        ]
          .map(normalize)
          .filter(Boolean);

        return sessionMatches.some((value) => traderMatches.includes(value));
      }) || null
    );
  };

  const getLiveSessionForProduct = (product: any) => {
    const session = getLiveSessionForTrader(product?.traderId);
    if (!session) return null;
    if (!session.pinnedProductId || session.pinnedProductId === product.id) return session;
    return session;
  };

  const getProductIncentives = (traderId: string) => {
    return incentives.filter((i) => i.traderId === traderId);
  };

  const getTraderTrustLevel = (trader: any) => {
    if (!trader) return 'basic';
    if (trader.accountType === 'family' || trader.familyMember || trader.category === 'family')
      return 'family';
    if (
      trader.accountType === 'organization' ||
      trader.businessCategory === 'organization' ||
      trader.category === 'organization'
    )
      return 'organization';
    if (trader.role === 'delivery' || trader.deliveryPartner || trader.category === 'delivery')
      return 'delivery';
    if (trader.role === 'trader' || trader.isTrader || trader.businessName) return 'trader';
    if (isAccountVerified(trader)) return 'verified';
    return 'basic';
  };

  const getTraderTrustLabel = (trader: any) => {
    if (!trader) return 'New seller';
    if (trader.trustScore) return `${trader.trustScore}% reliable`;
    if (isAccountVerified(trader)) return 'Verified seller';
    if (trader.role === 'delivery') return 'Delivery partner';
    return 'New seller';
  };

  const buildProductShare = (product: any) => {
    const url = new URL(window.location.href);
    url.searchParams.set('product', product.id);
    url.searchParams.delete('liveSession');
    const traderName =
      product.traderName ||
      traders[product.traderId]?.businessName ||
      traders[product.traderId]?.name ||
      'ESOKO trader';
    const text = `${product.name} from ${traderName} - RWF ${Number(product.price || 0).toLocaleString()}`;
    return { url: url.toString(), text };
  };

  const openShareProduct = (product: any) => {
    setShareProduct(product);
    setShareCopied(false);
  };

  const shareToSocial = async (
    target: 'native' | 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'copy'
  ) => {
    if (!shareProduct) return;
    const { url, text } = buildProductShare(shareProduct);

    if (target === 'native' && navigator.share) {
      await navigator.share({ title: shareProduct.name, text, url });
      return;
    }

    if (target === 'copy' || (target === 'native' && !navigator.share)) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareCopied(true);
      return;
    }

    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const socialTarget = target as 'whatsapp' | 'facebook' | 'x' | 'telegram';
    const shareUrls: Record<typeof socialTarget, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    };
    window.open(shareUrls[socialTarget], '_blank', 'noopener,noreferrer');
  };

  const exportToCSV = () => {
    if (filteredProducts.length === 0) return;

    const headers = ['Name', 'Trader', 'Category', 'Price (RWF)', 'Description'];
    const rows = filteredProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.traderName || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.price,
      `"${(p.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `marketplace_export_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categories = [
    'all',
    ...Array.from(
      new Set(
        [
          ...products.map((p) => p.category),
          ...Object.values(traders).map((t) => t.businessCategory || t.category),
        ].filter(Boolean)
      )
    ),
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-white/5 border-t-orange-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
            Market
          </h2>
          <p className="text-neutral-500 font-medium text-sm tracking-tight">
            Shop, pay, chat, live.
          </p>
        </div>
        <div className="flex bg-[#0a0a0a] p-1 rounded-2xl border border-white/5 shadow-inner shrink-0">
          <button
            onClick={() => setSearchMode('products')}
            className={cn(
              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              searchMode === 'products'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            {t.common.products}
          </button>
          <button
            onClick={() => setSearchMode('shops')}
            className={cn(
              'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              searchMode === 'shops'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            Shops
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        <button
          type="button"
          onClick={() => setNearPaymentTarget({})}
          className="min-w-[138px] md:min-w-0 px-3 py-2.5 rounded-2xl bg-orange-600 text-white text-left shadow-lg shadow-orange-900/20 hover:bg-orange-700 transition-all flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
            <Nfc size={19} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Pay</p>
            <h3 className="text-sm font-black leading-tight truncate">Near Pay</h3>
          </div>
        </button>
        <button
          type="button"
          onClick={openTraderMap}
          className="min-w-[138px] md:min-w-0 px-3 py-2.5 rounded-2xl bg-blue-600 text-white text-left hover:bg-blue-700 transition-all flex items-center gap-3 shadow-lg shadow-blue-950/20"
        >
          <div className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
            <MapIcon size={19} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Map</p>
            <h3 className="text-sm font-black leading-tight truncate">Nearby</h3>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('shops')}
          className="min-w-[138px] md:min-w-0 px-3 py-2.5 rounded-2xl bg-[#0a0a0a] border border-white/5 text-left hover:border-orange-500/30 transition-all flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <Radio size={19} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-500">
              Live
            </p>
            <h3 className="text-sm font-black text-white leading-tight truncate">
              {liveSessions.length} online
            </h3>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="min-w-[138px] md:min-w-0 px-3 py-2.5 rounded-2xl bg-[#0a0a0a] border border-white/5 text-left hover:border-emerald-500/30 transition-all flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <ShoppingCart size={19} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400">
              Scan
            </p>
            <h3 className="text-sm font-black text-white leading-tight truncate">QR</h3>
          </div>
        </button>
      </div>

      {liveSessions.length > 0 && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <Radio size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
                  Live now
                </p>
                <h3 className="text-base font-black text-white truncate">Tap to join</h3>
              </div>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {liveSessions.length} live
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {liveSessions.map((session) => {
              const trader = traders[session.traderId] || session;
              const pinnedProduct = products.find((item) => item.id === session.pinnedProductId);
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() =>
                    setLiveRoomTarget({
                      session,
                      trader,
                      product: pinnedProduct,
                      products: getTraderProducts(session.traderId),
                    })
                  }
                  className="min-w-[260px] max-w-[320px] flex-1 text-left rounded-2xl bg-black/40 border border-white/10 p-4 hover:border-red-400/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-white truncate">{session.title}</p>
                      <p className="text-xs font-bold text-neutral-400 truncate mt-1">
                        {session.businessName ||
                          session.traderName ||
                          trader.businessName ||
                          trader.name}
                      </p>
                    </div>
                    <Radio className="text-red-400 shrink-0" size={22} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-300">
                      Camera / mic room
                    </span>
                    <span className="text-[10px] font-bold text-neutral-500">
                      {session.viewerCount || 0} watching
                    </span>
                  </div>
                  {(pinnedProduct || session.pinnedProductName) && (
                    <p className="mt-2 text-xs text-orange-300 truncate">
                      Selling: {pinnedProduct?.name || session.pinnedProductName}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {locationError && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold">
          {locationError} You can still search by shop, product, map, QR, or merchant code.
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMapView(false)}
              className={cn(
                'p-3 rounded-2xl transition-all border flex items-center gap-2 font-bold text-sm',
                !isMapView
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                  : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:text-neutral-300'
              )}
            >
              <List size={18} />
              List
            </button>
            <button
              onClick={() => setIsMapView(true)}
              className={cn(
                'p-3 rounded-2xl transition-all border flex items-center gap-2 font-bold text-sm',
                isMapView
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                  : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:text-neutral-300'
              )}
            >
              <MapIcon size={18} />
              Map
            </button>
          </div>

          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
              size={20}
            />
            <input
              type="text"
              placeholder={
                searchMode === 'products'
                  ? 'Search by product, store, or location...'
                  : 'Search shops by name, location, or product...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-14 py-3 bg-[#0a0a0a] border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium text-white placeholder:text-neutral-600"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-orange-600/10 text-orange-500 rounded-xl hover:bg-orange-600 hover:text-white transition-all border border-orange-500/20"
              title="Scan QR Code"
            >
              <ShoppingCart size={18} />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
            <button
              onClick={handleNearbyToggle}
              disabled={gettingLocation}
              className={cn(
                'px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border flex items-center gap-2',
                nearbyOnly
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-[#0a0a0a] text-neutral-500 border-white/5 hover:border-blue-500/50'
              )}
            >
              {gettingLocation ? (
                <X className="animate-spin" size={14} />
              ) : (
                <Navigation size={14} className={nearbyOnly ? 'animate-pulse' : ''} />
              )}
              {t.common.nearBy || 'Near Me'}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category as string)}
                className={cn(
                  'px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border',
                  selectedCategory === category
                    ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20'
                    : 'bg-[#0a0a0a] text-neutral-500 border-white/5 hover:border-orange-500/50'
                )}
              >
                {category === 'all' ? t.common.allCategories : category}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-4 md:p-5 rounded-3xl border border-white/5 shadow-sm space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Price Filter */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="text-orange-500" size={18} />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Filter By Price
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                    Min Price
                  </label>
                  <input
                    type="number"
                    value={priceRange.min}
                    onChange={(e) =>
                      setPriceRange((prev) => ({ ...prev, min: Number(e.target.value) }))
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-bold text-white transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] font-black text-neutral-600 uppercase tracking-widest ml-1">
                    Max Price
                  </label>
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e) =>
                      setPriceRange((prev) => ({ ...prev, max: Number(e.target.value) }))
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-bold text-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Distance Filter */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Navigation className="text-blue-500" size={18} />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Search Radius ({distanceFilter}km)
                </span>
              </div>
              <div className="pt-2 px-1">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={distanceFilter}
                  onChange={(e) => setDistanceFilter(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                    1km
                  </span>
                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">
                    {distanceFilter}km
                  </span>
                  <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                    50km
                  </span>
                </div>
              </div>
            </div>

            {/* Utilities */}
            <div className="flex items-end">
              <button
                onClick={exportToCSV}
                disabled={filteredProducts.length === 0}
                className="w-full px-6 py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"
              >
                <Download size={14} /> {t.common.download} Marketplace CSV
              </button>
            </div>
          </div>
        </div>

        {nearbyOnly && userLocation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-3xl border flex flex-col md:flex-row items-center gap-4',
              searchMode === 'products'
                ? 'bg-blue-500/5 border-blue-500/20'
                : 'bg-emerald-500/5 border-emerald-500/20'
            )}
          >
            <div className="flex items-center gap-3 shrink-0">
              <MapPin
                className={searchMode === 'products' ? 'text-blue-500' : 'text-emerald-500'}
                size={18}
              />
              <span
                className={cn(
                  'text-[10px] font-black uppercase tracking-widest',
                  searchMode === 'products' ? 'text-blue-300' : 'text-emerald-300'
                )}
              >
                Discovery Radius
              </span>
            </div>
            <div className="flex-1 flex items-center gap-4 w-full">
              <input
                type="range"
                min="1"
                max="50"
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(Number(e.target.value))}
                className={cn(
                  'flex-1 accent-current',
                  searchMode === 'products' ? 'text-blue-500' : 'text-emerald-500'
                )}
              />
              <span
                className={cn(
                  'text-sm font-black w-12',
                  searchMode === 'products' ? 'text-blue-500' : 'text-emerald-500'
                )}
              >
                {distanceFilter}
                {t.common.km || 'km'}
              </span>
            </div>
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                searchMode === 'products' ? 'text-blue-500' : 'text-emerald-500'
              )}
            >
              Exploring within {distanceFilter}km radius
            </p>
          </motion.div>
        )}
      </div>

      {isMapView ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-[2rem] bg-[#0a0a0a] border border-white/10 p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">
                Marketplace Map
              </p>
              <h3 className="text-xl font-black text-white leading-tight">
                Shops and traders near the selected market
              </h3>
              <p className="text-xs font-bold text-neutral-500 mt-1">
                Use Near Me for your live position, or browse mapped traders around Kigali.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNearbyToggle}
                disabled={gettingLocation}
                className="px-4 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center gap-2"
              >
                <Navigation size={14} />
                {nearbyOnly ? 'Refresh Near Me' : 'Use My Location'}
              </button>
              <button
                type="button"
                onClick={() => setIsMapView(false)}
                className="px-4 py-3 rounded-2xl bg-white/5 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10 flex items-center gap-2"
              >
                <List size={14} />
                List
              </button>
            </div>
          </div>
          <MapView
            traders={
              searchMode === 'products'
                ? filteredProducts.length > 0
                  ? Array.from(new Set(filteredProducts.map((p) => p.traderId)))
                      .map((tid) => traders[tid])
                      .filter(Boolean)
                  : filteredShops
                : filteredShops
            }
            userLocation={userLocation}
            radius={nearbyOnly ? distanceFilter : undefined}
            searchQuery={searchQuery}
            allProducts={products}
            onTraderClick={(trader) => {
              setSearchQuery(trader.businessName || trader.name || '');
              setSearchMode('shops');
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(searchMode === 'products'
              ? filteredProducts.length > 0
                ? Array.from(new Set(filteredProducts.map((p) => p.traderId)))
                    .map((tid) => traders[tid])
                    .filter(Boolean)
                : filteredShops
              : filteredShops
            )
              .filter((trader) => getTraderCoordinates(trader))
              .slice(0, 9)
              .map((trader) => {
                const coordinates = getTraderCoordinates(trader);
                const distance =
                  userLocation && coordinates ? calculateDistance(userLocation, coordinates) : null;
                return (
                  <div
                    key={trader.id || trader.uid}
                    className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-4 flex items-center gap-4"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-orange-600/10 text-orange-500 border border-orange-500/20 flex items-center justify-center shrink-0">
                      <Store size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {trader.businessName || trader.name}
                      </p>
                      <p className="truncate text-[10px] font-bold text-neutral-500">
                        {trader.businessAddress || trader.location || 'Mapped trader'}
                      </p>
                      {distance !== null && (
                        <p className="mt-1 text-[10px] font-black text-blue-400">
                          {distance.toFixed(1)} km away
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToTrader(trader)}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                      <Navigation size={14} />
                      Go
                    </button>
                  </div>
                );
              })}
          </div>
        </motion.div>
      ) : searchMode === 'products' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const traderInfo = traders[product.traderId];
            const liveSession = getLiveSessionForProduct(product);
            // Get featured media item or fallback to first valid media item
            const featuredMedia =
              product.mediaItems?.find(
                (m: { isMain?: boolean; url?: string }) => m.isMain && m.url
              ) || product.mediaItems?.find((m: { url?: string }) => m.url);
            const displayMedia =
              featuredMedia ||
              (product.imageUrl ? { type: 'image' as const, url: product.imageUrl } : undefined);

            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card p-0 bg-[#0a0a0a] border-white/5 group overflow-hidden"
              >
                <div className="aspect-square bg-[#111] mb-0 overflow-hidden relative group cursor-pointer">
                  {displayMedia?.type === 'video' && displayMedia?.url ? (
                    <>
                      <video
                        src={displayMedia.url}
                        poster={displayMedia.thumbnail || displayMedia.url}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                        muted
                        loop
                        playsInline
                        onClick={(e) => {
                          const video = e.currentTarget as HTMLVideoElement;
                          if (video.paused) {
                            video.play().catch(() => {});
                          } else {
                            video.pause();
                            video.currentTime = 0;
                          }
                        }}
                        onMouseEnter={(e) => {
                          const video = e.currentTarget as HTMLVideoElement;
                          video.play().catch(() => {});
                        }}
                        onMouseLeave={(e) => {
                          const video = e.currentTarget as HTMLVideoElement;
                          video.pause();
                          video.currentTime = 0;
                        }}
                      />
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all pointer-events-none">
                        <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6 text-white fill-current ml-1" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21" />
                          </svg>
                        </div>
                      </div>
                      {/* Video Duration Badge */}
                      {displayMedia?.duration && (
                        <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-[8px] font-bold text-white">
                          {Math.floor(displayMedia.duration / 60)}:
                          {(displayMedia.duration % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </>
                  ) : displayMedia?.url ? (
                    <img
                      src={displayMedia.url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-800">
                      <ShoppingBag size={48} />
                    </div>
                  )}
                  {product.category && (
                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black text-orange-500 uppercase tracking-widest shadow-sm border border-white/5">
                      {product.category}
                    </div>
                  )}
                  {liveSession && (
                    <button
                      type="button"
                      onClick={() =>
                        setLiveRoomTarget({
                          session: liveSession,
                          product,
                          trader: traderInfo,
                          products: getTraderProducts(product.traderId),
                        })
                      }
                      className="absolute bottom-3 left-3 right-3 rounded-2xl bg-red-600 text-white px-4 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl shadow-red-900/40"
                    >
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      Join live with trader
                    </button>
                  )}
                  {/* Media Indicator Badge */}
                  {featuredMedia && (
                    <div className="absolute top-3 left-3 bg-orange-600 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest shadow-sm flex items-center gap-1">
                      {displayMedia.type === 'video' ? '🎬 Video' : '📸 Photo'}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-white truncate">{product.name}</h4>
                    {userLocation && getTraderCoordinates(traderInfo) && (
                      <div className="flex items-center gap-1 text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/10">
                        <Navigation size={10} className="fill-current" />
                        {calculateDistance(userLocation, getTraderCoordinates(traderInfo)!).toFixed(
                          1
                        )}
                        {t.common.km}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between group/info">
                    <div className="flex items-center gap-2 text-neutral-500">
                      <Store size={12} className="text-orange-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest truncate">
                        {product.traderName || 'Official Store'}
                      </span>
                      {traderInfo && (
                        <VerifiedBadge
                          level={getTraderTrustLevel(traderInfo)}
                          size="sm"
                          showLabel={false}
                          animated
                          className="!border-white/10"
                        />
                      )}
                    </div>
                    {(traderInfo?.phone || traderInfo?.phoneNumber) && (
                      <a
                        href={`tel:${traderInfo.phone || traderInfo.phoneNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-black text-emerald-500 opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        <Phone size={10} /> {t.common.call}
                      </a>
                    )}
                  </div>

                  {traderInfo?.businessAddress && (
                    <div className="flex items-center gap-1.5 text-neutral-600 text-[9px] font-bold">
                      <MapPin size={10} />
                      <span className="truncate">{traderInfo.businessAddress}</span>
                    </div>
                  )}
                  {traderInfo && (
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mt-2">
                      {getTraderTrustLabel(traderInfo)}
                    </div>
                  )}
                  {liveSession && (
                    <button
                      type="button"
                      onClick={() =>
                        setLiveRoomTarget({
                          session: liveSession,
                          product,
                          trader: traderInfo,
                          products: getTraderProducts(product.traderId),
                        })
                      }
                      className="mt-3 w-full rounded-2xl border border-red-500/40 bg-red-600/15 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-red-100 shadow-lg shadow-red-950/20 transition-all hover:bg-red-600 hover:text-white"
                    >
                      <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-red-500 align-middle shadow-[0_0_16px_rgba(239,68,68,0.9)] animate-pulse" />
                      Live now - watch trader speaking
                    </button>
                  )}

                  {/* Incentive Badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {getProductIncentives(product.traderId).map((incentive) => (
                      <div
                        key={incentive.id}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter',
                          incentive.type === 'points'
                            ? 'bg-orange-500/10 text-orange-400'
                            : incentive.type === 'bulk_discount'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                        )}
                        title={incentive.description}
                      >
                        {incentive.type === 'points' ? (
                          <Star size={8} />
                        ) : incentive.type === 'bulk_discount' ? (
                          <Percent size={8} />
                        ) : (
                          <Award size={8} />
                        )}
                        {incentive.name}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                    <div>
                      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                        {t.common.price}
                      </p>
                      <p className="font-black text-orange-500">
                        {product.price?.toLocaleString()} RWF
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 max-w-[68%]">
                      <button
                        onClick={() => setShowQuickView(product)}
                        className="h-10 w-10 shrink-0 bg-white/5 text-neutral-500 rounded-xl hover:bg-white/10 transition-all border border-white/5 flex items-center justify-center"
                        title="Quick View"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openShareProduct(product)}
                        className="h-10 w-10 shrink-0 bg-white/5 text-neutral-500 rounded-xl hover:bg-white/10 hover:text-white transition-all border border-white/5 flex items-center justify-center"
                        title="Share product"
                      >
                        <Share2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLiveRoomTarget({
                            session: liveSession || undefined,
                            product,
                            trader: traderInfo,
                            products: getTraderProducts(product.traderId),
                          })
                        }
                        className={cn(
                          'h-10 w-10 shrink-0 rounded-xl transition-all border flex items-center justify-center',
                          liveSession
                            ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/30'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white border-red-500/20'
                        )}
                        title={liveSession ? 'Join live trader' : 'Live trader room'}
                      >
                        <Radio size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNearPaymentTarget({ product, trader: traderInfo })}
                        className="h-10 w-10 shrink-0 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20 flex items-center justify-center"
                        title="Near payment"
                      >
                        <Nfc size={18} />
                      </button>
                      <button
                        disabled={product.stock <= 0}
                        onClick={() => setSelectedProduct(product)}
                        className={cn(
                          'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2',
                          product.stock > 0
                            ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20'
                            : 'bg-white/5 text-neutral-600 cursor-not-allowed border border-white/5'
                        )}
                      >
                        <motion.div
                          whileTap={{ scale: 1.5, rotate: [0, -10, 10, -10, 0] }}
                          transition={{ duration: 0.3 }}
                        >
                          <ShoppingBag size={14} />
                        </motion.div>
                        {product.stock > 0 ? t.common.buyNow : t.common.outOfStock}
                      </button>
                      <button
                        type="button"
                        onClick={() => openReportModal(product)}
                        className="min-w-[104px] h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Flag size={14} />
                        Report
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((trader) => {
            const distance =
              userLocation && trader.coordinates
                ? calculateDistance(userLocation, getTraderCoordinates(trader)!)
                : null;
            const liveSession = getLiveSessionForTrader(trader.id);
            return (
              <motion.div
                key={trader.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0a0a0a] p-6 rounded-[2rem] border border-white/5 shadow-sm hover:shadow-xl hover:border-orange-500/20 transition-all relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-orange-500 border border-white/10">
                    <Store size={28} />
                  </div>
                  {distance !== null && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
                      <Navigation size={10} className="fill-current" />
                      {distance.toFixed(1)}
                      {t.common.km}
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex px-2.5 py-0.5 bg-orange-500/10 text-orange-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-orange-500/10">
                      {trader.businessCategory || 'General Shop'}
                    </div>
                    {liveSession && (
                      <div className="px-2 py-0.5 bg-red-600 text-white rounded-md text-[8px] font-black uppercase tracking-tighter border border-red-500/50 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Live now
                      </div>
                    )}
                    {searchQuery &&
                      products.some(
                        (p) =>
                          p.traderId === trader.id &&
                          p.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ) && (
                        <div className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[8px] font-black uppercase tracking-tighter border border-blue-500/10">
                          Matching Inventory
                        </div>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white leading-tight">
                      {trader.businessName || trader.name}
                    </h3>
                    <VerifiedBadge
                      level={getTraderTrustLevel(trader)}
                      size="xs"
                      showLabel={false}
                      animated
                      className="!border-white/10"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <MapPin size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                      {trader.businessAddress || 'Kigali, Rwanda'}
                    </span>
                  </div>
                  {trader && (
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60 mt-1">
                      {getTraderTrustLabel(trader)}
                    </div>
                  )}
                  {(trader.phoneNumber || trader.email) && (
                    <div className="flex gap-3 pt-1">
                      {trader.phoneNumber && (
                        <div className="flex items-center gap-1.5 text-neutral-600 text-[9px] font-bold">
                          <Phone size={10} /> {trader.phoneNumber}
                        </div>
                      )}
                      {trader.email && (
                        <div className="flex items-center gap-1.5 text-neutral-600 text-[9px] font-bold truncate">
                          <Mail size={10} /> {trader.email}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 relative z-10">
                  <button
                    onClick={() => {
                      setSearchQuery(trader.businessName || trader.name || '');
                      setSearchMode('products');
                    }}
                    className="flex-1 py-3 bg-white/5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center justify-center gap-2 border border-white/5 shadow-xl shadow-black/50"
                  >
                    View Products{' '}
                    <ChevronRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setLiveRoomTarget({
                          session: liveSession || undefined,
                          trader,
                          products: getTraderProducts(trader.id),
                        })
                      }
                      className={cn(
                        'p-3 rounded-2xl transition-all border',
                        liveSession
                          ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/30'
                          : 'bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white border-red-500/20'
                      )}
                      title={liveSession ? 'Join live trader' : 'Live trader room'}
                    >
                      <Radio size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNearPaymentTarget({ trader })}
                      className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20"
                      title="Near payment"
                    >
                      <Nfc size={20} />
                    </button>
                    {trader.phoneNumber && (
                      <a
                        href={`tel:${trader.phoneNumber}`}
                        className="p-3 bg-white/5 text-emerald-500 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all border border-white/5"
                        title={t.common.call}
                      >
                        <Phone size={20} />
                      </a>
                    )}
                    {getTraderCoordinates(trader) && (
                      <button
                        type="button"
                        onClick={() => navigateToTrader(trader)}
                        className="p-3 bg-white/5 text-blue-500 rounded-2xl hover:bg-blue-600 hover:text-white transition-all border border-white/5"
                        title="Get Directions"
                      >
                        <Navigation size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <PurchaseModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        )}

        {nearPaymentTarget && (
          <NearPaymentModal
            product={nearPaymentTarget.product}
            trader={nearPaymentTarget.trader}
            onClose={() => setNearPaymentTarget(null)}
            onBuy={(product) => {
              setNearPaymentTarget(null);
              setSelectedProduct(product);
            }}
          />
        )}

        {liveRoomTarget && (
          <LiveTraderRoom
            product={liveRoomTarget.product}
            trader={liveRoomTarget.trader}
            products={liveRoomTarget.products}
            session={liveRoomTarget.session}
            onClose={() => setLiveRoomTarget(null)}
            onBuy={(product) => {
              setLiveRoomTarget(null);
              setSelectedProduct(product);
            }}
          />
        )}

        {showQuickView && (
          <ProductFeedViewer
            products={quickViewProducts}
            traders={traders}
            t={t}
            onClose={() => setShowQuickView(null)}
            onBuy={(product) => {
              setShowQuickView(null);
              setSelectedProduct(product);
            }}
            onLive={(product) => {
              setShowQuickView(null);
              setLiveRoomTarget({
                product,
                trader: traders[product.traderId],
                products: getTraderProducts(product.traderId),
                session: getLiveSessionForProduct(product) || undefined,
              });
            }}
            onNearPay={(product) => {
              setShowQuickView(null);
              setNearPaymentTarget({ product, trader: traders[product.traderId] });
            }}
            onReport={openReportModal}
            onShare={openShareProduct}
          />
        )}

        {showScanner && (
          <QRScanner
            onClose={() => setShowScanner(false)}
            onSuccess={() => {
              setShowScanner(false);
            }}
          />
        )}

        {shareProduct && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[160] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md rounded-[2rem] bg-[#0a0a0a] border border-white/10 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">
                    Share Product
                  </p>
                  <h3 className="mt-2 text-xl font-black text-white leading-tight">
                    {shareProduct.name}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-neutral-500">
                    Send this listing to customers on social media.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareProduct(null)}
                  className="p-2 rounded-xl bg-white/5 text-neutral-400 hover:text-white border border-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => shareToSocial('whatsapp')}
                  className="rounded-2xl bg-emerald-600 text-white py-4 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700"
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => shareToSocial('facebook')}
                  className="rounded-2xl bg-blue-600 text-white py-4 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700"
                >
                  <Share2 size={16} /> Facebook
                </button>
                <button
                  type="button"
                  onClick={() => shareToSocial('x')}
                  className="rounded-2xl bg-white text-black py-4 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-200"
                >
                  <Share2 size={16} /> X
                </button>
                <button
                  type="button"
                  onClick={() => shareToSocial('telegram')}
                  className="rounded-2xl bg-sky-600 text-white py-4 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-sky-700"
                >
                  <Send size={16} /> Telegram
                </button>
                <button
                  type="button"
                  onClick={() => shareToSocial('native')}
                  className="col-span-2 rounded-2xl bg-orange-600 text-white py-4 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-700"
                >
                  <Share2 size={16} /> Phone Share
                </button>
                <button
                  type="button"
                  onClick={() => shareToSocial('copy')}
                  className="col-span-2 rounded-2xl bg-white/5 text-neutral-200 py-4 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 border border-white/10"
                >
                  <Copy size={16} /> {shareCopied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Report Modal */}
        {reportModalProduct && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0a0a0a] max-w-md w-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="p-8">
                <button
                  onClick={closeReportModal}
                  className="absolute top-6 right-6 p-2 bg-white/5 text-neutral-500 hover:text-white rounded-full transition-all z-20 border border-white/10"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <AlertTriangle size={24} className="text-orange-500" />
                  <h3 className="text-xl font-black text-white">Report Listing</h3>
                </div>

                <p className="text-sm text-neutral-400 mb-6">
                  Help us keep the marketplace safe. Report this product if it violates our terms of
                  service.
                </p>

                <form onSubmit={handleSubmitReport} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 block">
                      Reason for Report
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                    >
                      <option value="irrelevant">Not related to marketplace</option>
                      <option value="misleading">Misleading or inaccurate</option>
                      <option value="spam">Spam or suspicious</option>
                      <option value="other">Other policy violation</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 block">
                      Details (Required)
                    </label>
                    <textarea
                      value={reportMessage}
                      onChange={(e) => setReportMessage(e.target.value)}
                      placeholder="Please explain what is wrong with this product or listing..."
                      maxLength={500}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                      rows={4}
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      {reportMessage.length}/500 characters
                    </p>
                  </div>

                  {reportError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
                      {reportError}
                    </div>
                  )}

                  {reportSuccess && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-400">
                      {reportSuccess}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={closeReportModal}
                      disabled={reportSubmitting}
                      className="flex-1 py-2 px-4 bg-white/5 text-neutral-400 rounded-lg font-bold text-sm hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reportSubmitting || !reportMessage.trim()}
                      className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg font-bold text-sm hover:bg-orange-700 transition-all disabled:opacity-50"
                    >
                      {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isMapView && searchMode === 'products' && filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="mx-auto text-neutral-800 mb-4" size={48} />
          <p className="text-neutral-600 font-medium">No products found</p>
        </div>
      )}
    </div>
  );
}

function ProductFeedViewer({
  products,
  traders,
  t,
  onClose,
  onBuy,
  onLive,
  onNearPay,
  onReport,
  onShare,
}: {
  products: any[];
  traders: Record<string, any>;
  t: any;
  onClose: () => void;
  onBuy: (product: any) => void;
  onLive: (product: any) => void;
  onNearPay: (product: any) => void;
  onReport: (product: any) => void;
  onShare: (product: any) => void;
}) {
  const [activeProductId, setActiveProductId] = useState(products[0]?.id);
  const [muted, setMuted] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const slideRefs = useRef<Record<string, HTMLElement | null>>({});
  const activeProductIdRef = useRef(activeProductId);

  useEffect(() => {
    activeProductIdRef.current = activeProductId;
  }, [activeProductId]);

  const syncVideoPlayback = (nextActiveProductId = activeProductIdRef.current) => {
    Object.entries(videoRefs.current).forEach(([productId, video]) => {
      if (!video) return;
      const isCurrent = productId === nextActiveProductId;
      video.muted = muted || !isCurrent;
      if (isCurrent) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  };

  useEffect(() => {
    setActiveProductId(products[0]?.id);
  }, [products]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute('data-product-id');
        if (id) {
          activeProductIdRef.current = id;
          setActiveProductId(id);
          syncVideoPlayback(id);
        }
      },
      { threshold: [0.55, 0.75] }
    );

    Object.values(slideRefs.current).forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => observer.disconnect();
  }, [products]);

  useEffect(() => {
    syncVideoPlayback(activeProductId);
  }, [activeProductId, muted]);

  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach((video) => {
        video?.pause();
      });
    };
  }, []);

  const expandActive = (productId: string) => {
    slideRefs.current[productId]?.requestFullscreen?.();
  };

  if (products.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl">
      <div className="h-full overflow-y-auto scroll-smooth snap-y snap-mandatory">
        {products.map((product, index) => {
          const trader = traders[product.traderId];
          const media = getProductDisplayMedia(product);
          const isVideo = media?.type === 'video' && media?.url;
          const price = Number(product.price || 0);
          const isActive = product.id === activeProductId;

          return (
            <section
              key={product.id}
              data-product-id={product.id}
              ref={(node) => {
                slideRefs.current[product.id] = node;
              }}
              className="min-h-[100dvh] snap-start flex items-center justify-center px-3 py-5 md:px-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'relative grid h-[calc(100dvh-2.5rem)] w-full max-w-5xl overflow-hidden rounded-[2rem] border bg-[#050505] shadow-2xl md:grid-cols-[1.1fr_0.9fr]',
                  isActive ? 'border-orange-500/30 shadow-orange-950/30' : 'border-white/10'
                )}
              >
                <div className="relative min-h-[45dvh] bg-black md:min-h-0">
                  {isVideo ? (
                    <video
                      ref={(node) => {
                        videoRefs.current[product.id] = node;
                      }}
                      src={media.url}
                      poster={media.thumbnail || product.imageUrl || media.url}
                      loop
                      playsInline
                      muted={muted || !isActive}
                      preload={isActive || index < 2 ? 'auto' : 'metadata'}
                      onLoadedMetadata={() => {
                        syncVideoPlayback(activeProductIdRef.current);
                      }}
                      onPlay={(event) => {
                        const current = event.currentTarget;
                        activeProductIdRef.current = product.id;
                        setActiveProductId(product.id);
                        Object.entries(videoRefs.current).forEach(([productId, video]) => {
                          if (!video) return;
                          const isCurrent = video === current && productId === product.id;
                          video.muted = muted || !isCurrent;
                          if (!isCurrent) video.pause();
                        });
                      }}
                      className="h-full w-full object-cover"
                    />
                  ) : media?.url ? (
                    <img
                      src={media.url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-800">
                      <ShoppingBag size={72} />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute left-4 top-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onReport(product)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur hover:bg-white/10"
                      title="Report this listing"
                    >
                      <Flag size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onShare(product)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur hover:bg-white/10"
                      title="Share this product"
                    >
                      <Share2 size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => expandActive(product.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur hover:bg-white/10"
                      title="Fullscreen"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>

                  {isVideo && (
                    <button
                      type="button"
                      onClick={() => setMuted((value) => !value)}
                      className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur hover:bg-white/10"
                      title={muted ? 'Unmute sound' : 'Mute sound'}
                    >
                      {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  )}

                  {products.length > 1 && (
                    <div className="absolute bottom-5 left-5 rounded-full bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                      {index + 1} / {products.length}
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col overflow-y-auto p-6 md:p-8">
                  <button
                    onClick={onClose}
                    className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-400 transition-all hover:text-white"
                    title="Close"
                  >
                    <X size={22} />
                  </button>

                  <div className="pr-12">
                    <div className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-500">
                      {product.category || 'General'}
                    </div>
                    <h2 className="mt-5 text-3xl font-black leading-tight text-white md:text-4xl">
                      {product.name}
                    </h2>
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-neutral-500">
                      <Store size={15} className="text-orange-500" />
                      {product.traderName ||
                        trader?.businessName ||
                        trader?.name ||
                        'Official Store'}
                    </div>
                  </div>

                  <div className="my-7 grid grid-cols-2 gap-5 border-y border-white/10 py-6">
                    <div>
                      <p className="text-3xl font-black text-orange-500">
                        RWF {price.toLocaleString()}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        Sale price
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        Stock
                      </p>
                      <p className="mt-2 text-lg font-black text-neutral-200">
                        {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm font-semibold leading-relaxed text-neutral-400">
                    {product.description || 'No detailed description available for this product.'}
                  </p>

                  {product.variants && product.variants.length > 0 && (
                    <div className="mt-6">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        Available Variants
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((variant: any) => (
                          <div
                            key={variant.id || variant.name}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-neutral-300"
                          >
                            {variant.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto grid grid-cols-2 gap-3 pt-7">
                    <button
                      type="button"
                      onClick={() => onLive(product)}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-red-300 transition-all hover:bg-red-600 hover:text-white"
                    >
                      <Radio size={18} /> Live
                    </button>
                    <button
                      type="button"
                      onClick={() => onNearPay(product)}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-blue-300 transition-all hover:bg-blue-600 hover:text-white"
                    >
                      <Nfc size={18} /> Near Pay
                    </button>
                    <button
                      type="button"
                      onClick={() => onShare(product)}
                      className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-300 transition-all hover:bg-white/10"
                    >
                      <Share2 size={18} /> Share Product
                    </button>
                    <button
                      disabled={product.stock <= 0}
                      onClick={() => onBuy(product)}
                      className={cn(
                        'col-span-2 flex items-center justify-center gap-3 rounded-2xl py-5 text-[10px] font-black uppercase tracking-widest shadow-xl transition-all',
                        product.stock > 0
                          ? 'bg-orange-600 text-white shadow-orange-900/40 hover:bg-orange-700'
                          : 'cursor-not-allowed border border-white/5 bg-white/5 text-neutral-600'
                      )}
                    >
                      <ShoppingBag size={20} />
                      {product.stock > 0 ? `${t.common.buyNow}` : t.common.outOfStock}
                      {product.stock > 0 && <ChevronRight size={18} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function getProductDisplayMedia(product: any) {
  return (
    product.mediaItems?.find(
      (item: { isMain?: boolean; url?: string }) => item.isMain && item.url
    ) ||
    product.mediaItems?.find((item: { url?: string }) => item.url) ||
    (product.imageUrl ? { type: 'image' as const, url: product.imageUrl } : undefined)
  );
}
