import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  Heart,
  Bookmark,
  UserPlus,
  Navigation,
  Play,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Share2,
  ShoppingCart,
  Store,
  X,
} from 'lucide-react';
import { auth } from '../../firebase';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import LiveTraderRoom from './LiveTraderRoom';
import { cn, formatCurrency } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { getProducts } from '../../services/productService';
import {
  getMarketplacePosts,
  recordPostView,
  togglePostFavorite,
  togglePostLike,
  toggleTraderFollow,
  MarketplacePost,
} from '../../services/postService';
import { subscribeToLiveUpdates } from '../../services/liveSyncService';
import { createTicket } from '../../services/ticketService';
import PurchaseModal from './PurchaseModal';
import MapView from './MapView';
import { calculateDistance, getCurrentCoordinates, Coordinates } from '../../lib/locationUtils';

type MediaBlock = {
  id: string;
  type: 'image' | 'video' | 'text';
  url?: string;
  text?: string;
};

type Product = {
  id: string;
  name: string;
  title: string;
  seller: string;
  sellerVerificationLevel?: any;
  price: string;
  priceAmount: number;
  stock: number;
  category?: string;
  imageUrl?: string;
  description: string;
  traderId?: string;
  mediaBlocks: MediaBlock[];
  raw: Record<string, any>;
};

type MarketplaceProps = {
  initialSearchMode?: 'products' | 'shops';
  initialNearby?: boolean;
  initialMapView?: boolean;
  onAskTrader?: (product: Product, message?: string) => void | Promise<void>;
};

function normalizeMediaBlocks(product: any): MediaBlock[] {
  if (Array.isArray(product.mediaBlocks)) return product.mediaBlocks;
  if (Array.isArray(product.media)) return product.media;
  // Support server `mediaItems` or `images` fields (may be array or JSON string)
  const maybeMedia = product.mediaItems || product.images || null;
  if (maybeMedia) {
    let items: any[] = [];
    if (typeof maybeMedia === 'string') {
      try {
        items = JSON.parse(maybeMedia);
      } catch {
        items = [];
      }
    } else if (Array.isArray(maybeMedia)) {
      items = maybeMedia;
    }

    if (items.length) {
      return items.map((it: any, idx: number) => {
        const type = (it.type || (it.url && it.url.endsWith('.mp4') ? 'video' : 'image') || 'image') as
          | 'image'
          | 'video'
          | 'text';
        return { id: it.id || `media-${product.id}-${idx}`, type, url: it.url || it.path || it.src, text: it.text } as MediaBlock;
      });
    }
  }

  if (product.imageUrl || product.image) {
    return [{ id: `img-${product.id}`, type: 'image', url: product.imageUrl || product.image }];
  }
  if (product.videoUrl) {
    return [{ id: `vid-${product.id}`, type: 'video', url: product.videoUrl }];
  }
  return [{ id: `fallback-${product.id}`, type: 'text', text: product.name || 'ESOKO' }];
}

function normalizeProduct(product: any): Product {
  const priceAmount =
    typeof product.price === 'number'
      ? product.price
      : Number(String(product.price || '').replace(/[^\d.]/g, '')) || 0;
  const title = product.name || product.title || 'Untitled Product';
  const seller = product.traderName || product.traderBusinessName || product.seller || 'Trader';
  const imageUrl = product.imageUrl || product.image;

  return {
    id: String(product.id),
    name: title,
    title,
    seller,
    sellerVerificationLevel: product.sellerVerificationLevel || product.traderVerificationLevel,
    price: priceAmount > 0 ? `RWF ${formatCurrency(priceAmount)}` : product.priceText || 'Price on request',
    priceAmount,
    stock: Number(product.stock || 0),
    category: product.category,
    imageUrl,
    description: product.description || 'No description provided yet.',
    traderId: product.traderId,
    mediaBlocks: normalizeMediaBlocks(product),
    raw: product,
  };
}

function productForPurchase(product: Product) {
  return {
    ...product.raw,
    id: product.id,
    name: product.name,
    title: product.title,
    price: product.priceAmount,
    stock: product.stock,
    traderId: product.traderId,
    description: product.description,
    imageUrl: product.imageUrl,
  };
}

function getProductTraderCoordinates(product: Product): Coordinates | null {
  const raw = product.raw || {};
  const lat = Number(
    raw?.coordinates?.lat ?? raw?.latitude ?? raw?.lat ?? raw?.traderLatitude ?? raw?.traderLat
  );
  const lng = Number(
    raw?.coordinates?.lng ?? raw?.longitude ?? raw?.lng ?? raw?.traderLongitude ?? raw?.traderLng
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

function buildTraderRecords(products: Product[]) {
  const seen = new Map<string, any>();

  products.forEach((product) => {
    if (!product.traderId) return;
    if (seen.has(product.traderId)) return;

    const traderCoordinates = getProductTraderCoordinates(product);
    const trader = {
      ...product.raw,
      id: product.traderId,
      businessName: product.seller,
      name: product.seller,
      businessAddress: product.raw?.businessAddress || product.raw?.address || product.raw?.location,
      businessCategory: product.category || product.raw?.businessCategory,
      coordinates: traderCoordinates || undefined,
    };

    seen.set(product.traderId, trader);
  });

  return Array.from(seen.values());
}

const Marketplace: React.FC<MarketplaceProps> = ({
  initialSearchMode = 'products',
  initialNearby = false,
  initialMapView = false,
  onAskTrader,
}) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [postEngagement, setPostEngagement] = useState<Record<string, Partial<MarketplacePost>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchMode, setSearchMode] = useState<'products' | 'shops'>(initialSearchMode);
  const [nearbyOnly, setNearbyOnly] = useState(initialNearby);
  const [mapView, setMapView] = useState(initialMapView);
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchaseProduct, setPurchaseProduct] = useState<Product | null>(null);
  const [commentProduct, setCommentProduct] = useState<Product | null>(null);
  const [shopTraderId, setShopTraderId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [navigationProductId, setNavigationProductId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [activeLiveSession, setActiveLiveSession] = useState<any>(null);
  const [liveOverlayProduct, setLiveOverlayProduct] = useState<Product | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');

  // Search/filter drawer — closed by default on every breakpoint now. Opened via the
  // top-right search toggle (see the button near the top of the returned JSX, positioned
  // next to where the app header's notification bell sits) instead of always being docked
  // inline on desktop.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartRef = useRef(0);
  const touchCurrentRef = useRef(0);

  // Autoplay / tap-to-pause video state for the TikTok-style feed
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [pausedVideos, setPausedVideos] = useState<Set<string>>(new Set());
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const toggleVideoPlay = (productId: string) => {
    const el = videoRefs.current[productId];
    if (!el) return;
    if (el.paused) {
      // Try to play unmuted (user-initiated). If browser blocks it, fall back to muted autoplay.
      el.muted = false;
      el.volume = 1;
      void el.play().catch(() => {
        // Play was blocked; try muted autoplay as a fallback.
        el.muted = true;
        el.play().catch(() => console.warn('It was not possible to play the video.'));
      });
      setPausedVideos((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    } else {
      el.pause();
      setPausedVideos((prev) => new Set(prev).add(productId));
    }
  };

  useEffect(() => {
    const intersectionCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        const productId = entry.target.getAttribute('data-product-id');
        if (!productId) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          setActiveVideoId(productId);
        }
      });
    };

    const observer = new IntersectionObserver(intersectionCallback, {
      threshold: [0.65],
    });
    observerRef.current = observer;

    Object.values(slideRefs.current).forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [activeVideoId, pausedVideos]);

  useEffect(() => {
    let cancelled = false;

    async function fetchMarketplace() {
      setLoading(true);
      setError('');
      try {
        const [data, postData] = await Promise.all([
          getProducts({ status: 'available', limit: 100 }),
          getMarketplacePosts({ limit: 100 }),
        ]);
        const mapped = (data?.products || []).map(normalizeProduct);
        const loadedPosts = postData?.posts || [];
        const postProducts = loadedPosts.map((post) =>
          normalizeProduct({
            ...post,
            id: `post-${post.id}`,
            name: post.caption || post.traderBusinessName || post.traderName || 'Marketplace post',
            description: post.caption || 'Shared by a verified trader.',
            imageUrl: post.mediaType === 'image' ? post.mediaUrl : undefined,
            mediaItems: [{ id: `${post.id}-media`, type: post.mediaType, url: post.mediaUrl }],
          })
        );
        const productIdsInPosts = new Set(loadedPosts.map((post) => post.productId).filter(Boolean));
        const combined = [...postProducts, ...mapped.filter((product: Product) => !productIdsInPosts.has(product.id))];
        if (!cancelled) {
          setPosts(loadedPosts);
          setProducts(combined);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setProducts([]);
          setError('Marketplace could not load. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchMarketplace();

    // Subscribe to live updates so marketplace refreshes when products change
    const unsubscribe = subscribeToLiveUpdates((event) => {
      const collection = (event.collection || (event.path || '').match(/^\/api\/([^/?]+)/)?.[1]) || '';
      if (!collection || collection === 'products' || collection === 'marketplace') {
        setTimeout(() => void fetchMarketplace(), 200);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const postForProduct = (product: Product) =>
    posts.find((post) => `post-${post.id}` === product.id || post.productId === product.id);

  const showAuthNotice = () => setNotice('Please sign in to engage with marketplace posts.');

  const engageWithPost = async (product: Product, action: 'like' | 'follow' | 'favorite') => {
    const post = postForProduct(product);
    if (!post) return;
    try {
      if (action === 'like') {
        const result = await togglePostLike(post.id);
        setPostEngagement((current) => ({
          ...current,
          [post.id]: { ...current[post.id], liked: result.liked, likeCount: result.likeCount },
        }));
        return;
      }
      if (action === 'follow') {
        const result = await toggleTraderFollow(post.traderId, post.id);
        setPostEngagement((current) => ({
          ...current,
          [post.id]: { ...current[post.id], following: result.following },
        }));
        return;
      }
      const result = await togglePostFavorite(post.id);
      setPostEngagement((current) => ({
        ...current,
        [post.id]: {
          ...current[post.id],
          favorited: result.favorited,
        },
      }));
    } catch (err: any) {
      if (String(err?.message || '').includes('401')) showAuthNotice();
      else setNotice('That action could not be completed.');
    }
  };

  useEffect(() => {
    const post = activeVideoId ? postForProduct(products.find((item) => item.id === activeVideoId) as Product) : null;
    if (post) void recordPostView(post.id).catch(() => {});
  }, [activeVideoId]);

  useEffect(() => {
    let cancelled = false;

    const loadLiveSessions = async () => {
      setLiveLoading(true);
      setLiveError('');
      try {
        const res = await fetch('/api/live/sessions', { credentials: 'include' });
        if (!res.ok) throw new Error('Unable to fetch live sessions');
        const data = await res.json();
        if (!cancelled) setLiveSessions(data.sessions || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLiveError('Could not load live streams.');
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    };

    void loadLiveSessions();
    const interval = window.setInterval(loadLiveSessions, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const getLiveSessionForProduct = (product: Product) =>
    liveSessions.find((session) => session.traderId === product.traderId);

  useEffect(() => {
    setSearchMode(initialSearchMode);
    setNearbyOnly(initialNearby);
    setMapView(initialMapView);
  }, [initialSearchMode, initialNearby, initialMapView]);

  const [locationRetryAttempts, setLocationRetryAttempts] = useState(0);

  useEffect(() => {
    if (!nearbyOnly && !mapView) return;
    if (userLocation || locating) return;
    if (locationRetryAttempts >= 3) return;

    let cancelled = false;
    const retryDelay = 1000;

    const isPermissionError = (error: any) => {
      const message = String(error?.message || '').toLowerCase();
      return message.includes('permission') || message.includes('denied') || message.includes('user denied');
    };

    const requestLocation = async () => {
      setLocating(true);
      setLocationError('');
      try {
        const coords = await getCurrentCoordinates();
        if (!cancelled) {
          setUserLocation(coords);
          setLocationRetryAttempts(0);
        }
      } catch (err: any) {
        if (!cancelled) {
          const message =
            err?.message || 'Unable to get location. Allow location access to use nearby or map mode.';
          setLocationError(message);

          if (!isPermissionError(err)) {
            setLocationRetryAttempts((attempts) => attempts + 1);
          }
        }
      } finally {
        if (!cancelled) setLocating(false);
      }
    };

    void requestLocation();

    return () => {
      cancelled = true;
    };
  }, [nearbyOnly, mapView, userLocation, locating, locationRetryAttempts]);

  const ui = useMemo(
    () => ({
      viewText: (t as any)?.common?.view || 'View',
      commentsText: (t as any)?.common?.comments || (t as any)?.common?.comment || 'Ask',
      shareText: (t as any)?.common?.share || 'Share',
      wordsText: (t as any)?.common?.words || 'Details',
      buyText: (t as any)?.common?.buy || 'Buy',
      shopText: (t as any)?.common?.shop || 'Shop',
      marketplaceLabel: (t as any)?.common?.marketplace || 'Marketplace',
    }),
    [t]
  );

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches[0]?.clientX ?? 0;
    touchCurrentRef.current = touchStartRef.current;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    touchCurrentRef.current = event.touches[0]?.clientX ?? touchCurrentRef.current;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchCurrentRef.current - touchStartRef.current;
    if (!sidebarOpen && touchStartRef.current < 40 && swipeDistance > 70) {
      setSidebarOpen(true);
    }
  };

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const sellerFilter = shopTraderId;

    return products.filter((product) => {
      if (sellerFilter && product.traderId !== sellerFilter) return false;
      if (!term) return true;
      const haystack = [
        product.title,
        product.seller,
        product.category,
        product.description,
        product.price,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [products, query, shopTraderId]);

  const nearbyProducts = useMemo(() => {
    if (!nearbyOnly) return filteredProducts;
    if (!userLocation) return [];

    return filteredProducts.filter((product) => {
      const coords = getProductTraderCoordinates(product);
      if (!coords) return false;
      return calculateDistance(userLocation, coords) <= 30;
    });
  }, [filteredProducts, nearbyOnly, userLocation]);

  const displayProducts = useMemo(() => {
    const baseProducts = nearbyProducts;
    const sortByLive = (a: Product, b: Product) => {
      const aLive = Boolean(liveSessions.find((session) => session.traderId === a.traderId));
      const bLive = Boolean(liveSessions.find((session) => session.traderId === b.traderId));
      return Number(bLive) - Number(aLive);
    };

    if (searchMode === 'products' || shopTraderId) {
      return [...baseProducts].sort(sortByLive);
    }

    const seen = new Set<string>();
    return baseProducts
      .filter((product) => {
        const key = product.traderId || product.seller;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(sortByLive);
  }, [nearbyProducts, searchMode, shopTraderId, liveSessions]);

  const traderRecords = useMemo(() => buildTraderRecords(displayProducts), [displayProducts]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([productId, video]) => {
      if (!video) return;
      if (productId === activeVideoId) {
        if (!pausedVideos.has(productId)) {
          // Use muted autoplay for intersection-driven playback to avoid NotAllowedError.
          video.muted = true;
          video.volume = 1;
          void video.play().catch(() => console.warn('Auto play blocked'));
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }
    });
  }, [activeVideoId, pausedVideos]);

  useEffect(() => {
    if (!observerRef.current) return;
    const observer = observerRef.current;
    Object.values(slideRefs.current).forEach((slide) => {
      if (slide) observer.observe(slide);
    });
    return () => {
      Object.values(slideRefs.current).forEach((slide) => {
        if (slide) observer.unobserve(slide);
      });
    };
  }, [displayProducts]);

  const activeShopName = useMemo(
    () => products.find((product) => product.traderId === shopTraderId)?.seller,
    [products, shopTraderId]
  );

  const resultCount = displayProducts.length;

  const copyProductLink = async (product: Product) => {
    const url = `${window.location.origin}${window.location.pathname}?tab=marketplace&product=${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, text: product.description, url });
        return;
      } catch {
        // Fall through to clipboard when the share sheet is cancelled or unavailable.
      }
    }
    await navigator.clipboard.writeText(url);
    setNotice('Product link copied.');
    window.setTimeout(() => setNotice(''), 2200);
  };

  const submitQuestion = async () => {
    if (!commentProduct || !commentText.trim()) return;
    setCommentSaving(true);
    try {
      if (typeof onAskTrader === 'function') {
        await onAskTrader(commentProduct, commentText.trim());
      } else {
        const currentUser = auth.currentUser as any;
        await createTicket({
          title: `Product question: ${commentProduct.title}`,
          description: [
            commentText.trim(),
            '',
            `Product: ${commentProduct.title}`,
            `Seller: ${commentProduct.seller}`,
            `Product ID: ${commentProduct.id}`,
            commentProduct.traderId ? `Trader ID: ${commentProduct.traderId}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          status: 'open',
          priority: 'medium',
          category: 'product-question',
          createdBy: currentUser?.uid || currentUser?.id || 'customer',
        });
      }
      setCommentText('');
      setCommentProduct(null);
      setNotice('Your question was sent.');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (err: any) {
      setNotice(err?.message || 'Question could not be sent.');
      window.setTimeout(() => setNotice(''), 3200);
    } finally {
      setCommentSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
          <Loader2 className="animate-spin text-orange-500" size={18} />
          Loading marketplace
        </div>
      </div>
    );
  }

  // Shared search/filter controls markup — now rendered ONLY inside the slide-in drawer,
  // on every breakpoint, opened via the search toggle button. It's no longer permanently
  // docked at the top of the desktop layout.
  const headerContent = (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-3 md:px-0 pt-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#0a0a0a] p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchMode === 'shops' ? 'Search shops or categories' : 'Search products, shops, prices'}
            className="h-12 w-full rounded-2xl border border-white/10 bg-black pl-12 pr-4 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-orange-500"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 md:flex md:items-center">
          <button
            type="button"
            onClick={() => setSearchMode('products')}
            className={cn(
              'h-12 rounded-2xl px-2 md:px-3 text-[9px] md:text-[10px] font-black tracking-tight leading-none whitespace-nowrap',
              searchMode === 'products' ? 'bg-orange-600 text-white' : 'bg-white/5 text-white/45'
            )}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('shops')}
            className={cn(
              'h-12 rounded-2xl px-2 md:px-3 text-[9px] md:text-[10px] font-black tracking-tight leading-none whitespace-nowrap',
              searchMode === 'shops' ? 'bg-orange-600 text-white' : 'bg-white/5 text-white/45'
            )}
          >
            Shops
          </button>
          <button
            type="button"
            onClick={() => setNearbyOnly((value) => !value)}
            className={cn(
              'flex h-12 items-center justify-center rounded-2xl px-3',
              nearbyOnly ? 'bg-emerald-600 text-white' : 'bg-white/5 text-white/45'
            )}
            title="Nearby"
            aria-label="Toggle nearby marketplace"
          >
            <MapPin size={18} />
          </button>
          <button
            type="button"
            onClick={() => setMapView((value) => !value)}
            className={cn(
              'flex h-12 items-center justify-center rounded-2xl px-3',
              mapView ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/45'
            )}
            title="Map mode"
            aria-label="Toggle map mode"
          >
            <Store size={18} />
          </button>
        </div>

        {!error && resultCount > 0 ? (
          <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left md:min-w-[180px] md:items-end">
            <span className="font-black text-white">
              {resultCount} matching {searchMode === 'shops' && !shopTraderId ? 'shops' : 'listings'}
            </span>
            <div className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
              {nearbyOnly && <span>Within 30 km</span>}
              {mapView && <span>Map view enabled</span>}
              {!nearbyOnly && !mapView && <span>Showing all available listings</span>}
            </div>
          </div>
        ) : null}
      </div>

      {(nearbyOnly || mapView || shopTraderId) && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/45 px-2">
          {shopTraderId && (
            <button
              type="button"
              onClick={() => setShopTraderId(null)}
              className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-orange-300"
            >
              {activeShopName || 'Shop'} <X size={12} />
            </button>
          )}
          {nearbyOnly && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-300">
              Nearby only
            </span>
          )}
          {mapView && (
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-blue-300">
              Map view enabled
            </span>
          )}
        </div>
      )}

      {locationError ? (
        <div className="mx-auto mt-4 max-w-[720px] rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-100 px-2">
          {locationError}
        </div>
      ) : null}
    </div>
  );

  return (
    // Root fills whatever height the parent gives it (see CustomerDashboard: h-[calc(100dvh-56px)] / md:h-[100dvh]).
    // A single scroll container lives inside this box so each card can snap to exactly one
    // viewport height, TikTok-style — on every breakpoint now, since the header no longer
    // permanently docks at the top on desktop.
    <div
      className="flex flex-col min-h-[100dvh] h-full"
      style={{ height: '100dvh' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Search toggle — fixed top-right, on every breakpoint. Sits at the same corner the
          app header's notification bell occupies, so it reads as "the search icon next to
          notifications" rather than a separate mobile-only control. Opens the drawer below,
          which replaces the old always-visible desktop search bar. */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-sm active:scale-90"
        aria-label="Open search and filters"
      >
        <Search size={20} />
      </button>

      {/* Search/filter drawer — used on every breakpoint (mobile and desktop alike). */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-sm md:max-w-md overflow-y-auto bg-[#050505] pb-6"
            >
              <div className="flex items-center justify-between p-4">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">
                  Search &amp; Filters
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-2xl bg-white/5 p-2 text-white/60"
                  aria-label="Close filters"
                >
                  <X size={18} />
                </button>
              </div>
              {headerContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* TikTok-style full-height snap scroller: one scroll container, one card per viewport,
          filling the entire 100dvh since there's no in-flow header taking up space anymore. */}
      <div
        className="flex-1 min-h-0 overflow-y-scroll snap-y snap-mandatory overscroll-y-contain"
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {mapView ? (
          <div className="snap-start h-full w-full flex items-center justify-center px-3 md:px-0">
            <div className="mx-auto w-full max-w-[980px]">
              <MapView
                traders={traderRecords}
                userLocation={userLocation}
                radius={nearbyOnly ? 30 : undefined}
                onTraderClick={(trader) => {
                  if (trader?.id) {
                    setShopTraderId(String(trader.id));
                    setSearchMode('shops');
                  }
                }}
                searchQuery={query}
                allProducts={products}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="snap-start h-full w-full flex items-center justify-center px-3">
            <div className="mx-auto max-w-[520px] rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm font-bold text-red-100">
              {error}
            </div>
          </div>
        ) : null}

        {!error && displayProducts.length === 0 ? (
          <div className="snap-start h-full w-full flex items-center justify-center px-3">
            <div className="mx-auto max-w-[520px] rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <Package className="mx-auto mb-4 text-white/20" size={44} />
              <p className="text-lg font-black text-white">No matching listings</p>
              <p className="mt-2 text-sm font-bold text-white/45">Try a different product, shop, or category.</p>
            </div>
          </div>
        ) : null}

        {displayProducts.map((product) => {
          const post = postForProduct(product);
          const engagement = post ? { ...post, ...postEngagement[post.id] } : null;
          const background = product.mediaBlocks.find((block) => block.type === 'video' || block.type === 'image');
          const textOverlays = product.mediaBlocks.filter(
            (block) => block.type === 'text' || (!block.url && block.type !== 'image' && block.type !== 'video')
          );
          const isShopCard = searchMode === 'shops' && !shopTraderId;
          const liveSession = getLiveSessionForProduct(product);

          return (
            <div
              key={`${product.id}-slide`}
              data-product-id={product.id}
              ref={(el) => {
                if (el) slideRefs.current[product.id] = el;
              }}
              className="snap-start snap-always h-full w-full flex items-start md:items-center justify-center md:px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))] px-0 md:px-0"
              style={{ scrollSnapStop: 'always' }}
            >
              <motion.article
                key={`${product.id}-${searchMode}-${shopTraderId || 'all'}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  'mx-auto w-full',
                  'overflow-visible md:overflow-hidden',
                  'border border-white/10',
                  'bg-[#0f0f0f]',
                  'shadow-2xl shadow-black/40',
                  'relative',
                  // Card is a flex column on every breakpoint now: the media block below is
                  // flex-1 (it always grows to fill whatever the info panel doesn't use), and
                  // the info panel is sized to its own content (shrink-0). On mobile the card
                  // should stretch to fill the viewport and avoid empty bottom gaps.
                  'h-full flex-1 min-h-0 rounded-none',
                  'md:h-[85vh] md:max-w-[420px] md:rounded-[2rem]',
                  'flex flex-col'
                )}
              >
                <div className="relative h-full flex-1 min-h-[160px] flex flex-col overflow-hidden bg-black text-white">
                  {background?.type === 'image' && background.url ? (
                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                      <img
                        src={background.url}
                        alt={product.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ) : background?.type === 'video' && background.url ? (
                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                      <video
                        ref={(el) => {
                          videoRefs.current[product.id] = el;
                        }}
                        src={background.url}
                        controls={false}
                        playsInline
                        autoPlay
                        loop
                        className="absolute inset-0 h-full w-full object-cover"
                        onLoadedData={(event) => {
                          const target = event.currentTarget;
                          target.muted = false;
                          target.volume = 1;
                        }}
                        onClick={() => toggleVideoPlay(product.id)}
                      />
                      {pausedVideos.has(product.id) && (
                        <button
                          aria-label="Play video"
                          title="Play video"
                          onClick={() => toggleVideoPlay(product.id)}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 p-4 text-white"
                        >
                          <Play size={28} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-950 via-slate-950 to-black">
                      <Package className="text-white/10" size={88} />
                    </div>
                  )}

                  {textOverlays.length > 0 && (
                    <div className="pointer-events-none absolute inset-0">
                      {textOverlays.slice(0, 6).map((block, idx) => (
                        <div key={block.id} className="absolute left-6 right-6" style={{ top: `${10 + idx * 12}%` }}>
                          <p className="line-clamp-1 text-[13px] font-black uppercase leading-5 tracking-[0.12em] text-white drop-shadow">
                            {block.text || product.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {liveSession && (
                    <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white shadow-xl shadow-black/30 backdrop-blur-sm">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE NOW
                    </div>
                  )}

                  {/* Gradient + title/price overlay now lives inside the media container,
                      so it always exactly matches the media's real rendered height instead
                      of a separately-tracked vh value. */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 z-20">
                    <div className="pointer-events-none absolute left-0 right-0 top-0 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                            {isShopCard ? ui.shopText : ui.marketplaceLabel}
                          </p>
                          <p className="mt-1 truncate text-[14px] font-black uppercase tracking-[0.08em] text-white">
                            {isShopCard ? product.seller : product.title}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="max-w-[170px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-white/60">
                              {isShopCard ? `${filteredProducts.filter((item) => item.traderId === product.traderId).length} listings` : product.seller}
                            </span>
                            <VerifiedBadge
                              level={product.sellerVerificationLevel || 'customer-individual'}
                              size="xs"
                              showLabel={false}
                              animated
                              className="!border-white/10"
                            />
                            {post && Number(engagement?.qualityScore || 0) > 0 && (
                              <span className="text-[10px] font-black text-amber-300">
                                ★ {Number(engagement?.qualityScore || 0).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-2xl bg-orange-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black">
                          {isShopCard ? 'Open' : product.price}
                        </div>
                      </div>
                    </div>

                    {liveSession && (
                      <div className="pointer-events-auto absolute right-4 top-4 z-30 flex flex-col items-center gap-3 rounded-[2rem] bg-black/60 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLiveSession(liveSession);
                            setLiveOverlayProduct(product);
                          }}
                          className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                          LIVE
                        </button>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                          {liveSession.viewerCount || '0'} viewers
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info panel — sized to its own content (shrink-0), not a fixed height, so it
                    never leaves leftover space. Caps at 45% of the card height with its own
                    scroll for unusually long descriptions. */}
                <div
                  className="relative shrink-0 h-auto max-h-full md:max-h-[45%] bg-[#0f0f0f] p-4 pr-16 md:pr-4 z-10 flex flex-col gap-4 overflow-visible md:overflow-y-auto overscroll-contain"
                  style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                  <div>
                    <p className="line-clamp-2 text-[12px] leading-5 text-white/75">{product.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.category && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/50">
                          {product.category}
                        </span>
                      )}
                      {!isShopCard && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/50">
                          Stock {product.stock}
                        </span>
                      )}
                    </div>

                    {navigationProductId === product.id && (
                      <div className="mt-4 rounded-[2rem] overflow-hidden border border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/40">
                        <MapView
                          traders={[
                            {
                              id: product.traderId,
                              businessName: product.seller,
                              businessAddress: product.raw?.businessAddress || product.raw?.location,
                              coordinates: (() => {
                                const c = getProductTraderCoordinates(product);
                                return c ? { lat: c.lat, lng: c.lng } : undefined;
                              })(),
                            },
                          ].filter(Boolean)}
                          userLocation={userLocation}
                          onTraderClick={(t) => setShopTraderId(t?.id || null)}
                          searchQuery={query}
                          allProducts={products.map((p) => p.raw)}
                          heightClass="h-48"
                        />
                      </div>
                    )}
                  </div>

                  {/* Desktop-only horizontal action row. On phones this is replaced entirely
                      by the right-side vertical rail below. */}
                  <div className="hidden md:flex md:items-center md:gap-3 md:flex-wrap">
                    {post && (
                      <>
                        <button
                          onClick={() => void engageWithPost(product, 'like')}
                          className={cn('flex h-11 items-center gap-2 rounded-2xl border border-white/10 px-3 text-white transition hover:bg-white/10', engagement?.liked ? 'text-rose-400' : '')}
                          aria-label="Like post"
                        >
                          <Heart size={18} fill={engagement?.liked ? 'currentColor' : 'none'} />
                          <span className="text-[10px] font-black">{engagement?.likeCount || 0}</span>
                        </button>
                        <button
                          onClick={() => void engageWithPost(product, 'follow')}
                          className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 px-3 text-white transition hover:bg-white/10"
                          aria-label="Follow trader"
                        >
                          <UserPlus size={18} />
                          <span className="text-[10px] font-black">{engagement?.following ? 'Following' : 'Follow'}</span>
                        </button>
                        <button
                          onClick={() => void engageWithPost(product, 'favorite')}
                          className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white transition hover:bg-white/10', engagement?.favorited ? 'text-amber-400' : '')}
                          aria-label="Save post"
                        >
                          <Bookmark size={18} fill={engagement?.favorited ? 'currentColor' : 'none'} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => (isShopCard ? setShopTraderId(product.traderId || null) : setSelectedProduct(product))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:h-12 md:w-12"
                      aria-label={isShopCard ? 'Open shop' : 'View product'}
                      title={isShopCard ? ui.shopText : ui.viewText}
                    >
                      {isShopCard ? <Store size={20} /> : <Eye size={20} />}
                    </button>

                    <button
                      onClick={() => {
                        if (typeof onAskTrader === 'function') {
                          void onAskTrader(product);
                        } else {
                          setCommentProduct(product);
                        }
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:h-12 md:w-12"
                      aria-label="Ask seller"
                      title={ui.commentsText}
                    >
                      <MessageSquare size={20} />
                    </button>

                    <button
                      onClick={() => void copyProductLink(product)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:h-12 md:w-12"
                      aria-label="Share"
                      title={ui.shareText}
                    >
                      <Share2 size={20} />
                    </button>

                    <button
                      onClick={() => {
                        const toggle = navigationProductId === product.id ? null : product.id;
                        setNavigationProductId(toggle);
                        if (!userLocation) {
                          void getCurrentCoordinates()
                            .then((coords) => setUserLocation(coords))
                            .catch(() => {});
                        }
                      }}
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:h-12 md:w-12',
                        navigationProductId === product.id ? 'bg-blue-600 text-white' : ''
                      )}
                      aria-label="Navigate"
                      title="Navigate"
                    >
                      <Navigation size={18} />
                    </button>

                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:h-12 md:w-12"
                      aria-label="Product details"
                      title={ui.wordsText}
                    >
                      <Package size={18} />
                    </button>

                    <button
                      onClick={() => setShopTraderId(product.traderId || null)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:h-12 md:w-12"
                      aria-label="Go to shop"
                      title={ui.shopText}
                    >
                      <ArrowRight size={18} />
                    </button>

                    <button
                      onClick={() => setPurchaseProduct(product)}
                      disabled={isShopCard || !product.traderId || product.priceAmount <= 0 || product.stock <= 0}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-black shadow-xl shadow-orange-900/40 transition-all hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 md:h-12 md:w-12"
                      aria-label="Buy"
                      title={ui.buyText}
                    >
                      <ShoppingCart size={22} />
                    </button>
                  </div>
                </div>

                {/* TikTok-style right-side action rail — phones only. Positioned absolutely
                    against the whole card, so it floats over both the media and the info
                    panel at a fixed spot on the right edge and never scrolls away. */}
                <div className="pointer-events-auto absolute right-3 bottom-4 z-40 flex flex-col items-center gap-3 md:hidden">
                  {post && (
                    <>
                      <button
                        onClick={() => void engageWithPost(product, 'like')}
                        className={cn('flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90', engagement?.liked ? 'text-rose-400' : '')}
                        aria-label="Like post"
                      >
                        <Heart size={19} fill={engagement?.liked ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => void engageWithPost(product, 'follow')}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
                        aria-label="Follow trader"
                      >
                        <UserPlus size={18} />
                      </button>
                      <button
                        onClick={() => void engageWithPost(product, 'favorite')}
                        className={cn('flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90', engagement?.favorited ? 'text-amber-400' : '')}
                        aria-label="Save post"
                      >
                        <Bookmark size={18} fill={engagement?.favorited ? 'currentColor' : 'none'} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => (isShopCard ? setShopTraderId(product.traderId || null) : setSelectedProduct(product))}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
                    aria-label={isShopCard ? 'Open shop' : 'View product'}
                  >
                    {isShopCard ? <Store size={19} /> : <Eye size={19} />}
                  </button>

                  <button
                    onClick={() => {
                      if (typeof onAskTrader === 'function') {
                        void onAskTrader(product);
                      } else {
                        setCommentProduct(product);
                      }
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
                    aria-label="Ask seller"
                  >
                    <MessageSquare size={19} />
                  </button>

                  <button
                    onClick={() => void copyProductLink(product)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
                    aria-label="Share"
                  >
                    <Share2 size={19} />
                  </button>

                  <button
                    onClick={() => {
                      const toggle = navigationProductId === product.id ? null : product.id;
                      setNavigationProductId(toggle);
                      if (!userLocation) {
                        void getCurrentCoordinates()
                          .then((coords) => setUserLocation(coords))
                          .catch(() => {});
                      }
                    }}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90',
                      navigationProductId === product.id ? 'bg-blue-600 border-blue-500' : ''
                    )}
                    aria-label="Navigate"
                  >
                    <Navigation size={17} />
                  </button>

                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
                    aria-label="Product details"
                  >
                    <Package size={17} />
                  </button>

                  <button
                    onClick={() => setShopTraderId(product.traderId || null)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
                    aria-label="Go to shop"
                  >
                    <ArrowRight size={17} />
                  </button>

                  <button
                    onClick={() => setPurchaseProduct(product)}
                    disabled={isShopCard || !product.traderId || product.priceAmount <= 0 || product.stock <= 0}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-black shadow-xl shadow-orange-900/50 transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Buy"
                  >
                    <ShoppingCart size={22} />
                  </button>
                </div>
              </motion.article>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 z-[130] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-center text-xs font-black text-white shadow-2xl"
          >
            <Check size={16} className="shrink-0 text-emerald-400" />
            {notice}
          </motion.div>
        )}

        {selectedProduct && (
          <ProductSheet
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAsk={() => {
              if (typeof onAskTrader === 'function') {
                void onAskTrader(selectedProduct);
              } else {
                setCommentProduct(selectedProduct);
              }
              setSelectedProduct(null);
            }}
            onBuy={() => {
              setPurchaseProduct(selectedProduct);
              setSelectedProduct(null);
            }}
            onShare={() => void copyProductLink(selectedProduct)}
          />
        )}

        {commentProduct && (
          <QuestionSheet
            product={commentProduct}
            value={commentText}
            saving={commentSaving}
            onChange={setCommentText}
            onClose={() => {
              setCommentProduct(null);
              setCommentText('');
            }}
            onSubmit={submitQuestion}
          />
        )}

        {purchaseProduct && (
          <PurchaseModal
            product={productForPurchase(purchaseProduct)}
            onClose={() => setPurchaseProduct(null)}
            onSuccess={() => setPurchaseProduct(null)}
          />
        )}

        {activeLiveSession && liveOverlayProduct && (
          <LiveTraderRoom
            session={activeLiveSession}
            product={liveOverlayProduct}
            onClose={() => setActiveLiveSession(null)}
            onBuy={(product) => {
              setPurchaseProduct(product);
              setActiveLiveSession(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

function ProductSheet({
  product,
  onClose,
  onAsk,
  onBuy,
  onShare,
}: {
  product: Product;
  onClose: () => void;
  onAsk: () => void;
  onBuy: () => void;
  onShare: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:items-center md:pb-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.98 }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">{product.seller}</p>
            <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">{product.title}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-2xl bg-white/5 p-3 text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Media preview: image or video (first media block) */}
        {product.mediaBlocks && product.mediaBlocks.length > 0 && (
          <div className="mb-4 w-full">
            {product.mediaBlocks[0].type === 'image' && product.mediaBlocks[0].url ? (
              <img
                src={product.mediaBlocks[0].url}
                alt={product.title}
                className="max-h-[40vh] w-full rounded-2xl object-cover"
              />
            ) : product.mediaBlocks[0].type === 'video' && product.mediaBlocks[0].url ? (
              <video
                src={product.mediaBlocks[0].url}
                controls
                className="max-h-[40vh] w-full rounded-2xl bg-black object-cover"
              />
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Metric label="Price" value={product.price} />
          <Metric label="Stock" value={String(product.stock)} />
          <Metric label="Category" value={product.category || 'General'} />
        </div>

        <p className="mt-5 text-sm font-bold leading-6 text-white/65">{product.description}</p>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <button onClick={onAsk} className="rounded-2xl bg-white/5 px-2 py-4 text-[10px] font-black uppercase tracking-widest text-white/70 sm:px-4">
            Ask
          </button>
          <button onClick={onShare} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-2 py-4 text-[10px] font-black uppercase tracking-widest text-white/70 sm:px-4">
            <Copy size={14} /> Share
          </button>
          <button
            onClick={onBuy}
            disabled={!product.traderId || product.priceAmount <= 0 || product.stock <= 0}
            className="rounded-2xl bg-orange-600 px-2 py-4 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-40 sm:px-4"
          >
            Buy
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuestionSheet({
  product,
  value,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  product: Product;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:items-center md:pb-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.98 }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">Ask seller</p>
            <h3 className="mt-1 text-lg font-black text-white sm:text-xl">{product.title}</h3>
            <p className="mt-1 text-xs font-bold text-white/40">{product.seller}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-2xl bg-white/5 p-3 text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ask about availability, delivery, wholesale price, or product details."
          className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-orange-500"
        />

        <button
          onClick={onSubmit}
          disabled={saving || !value.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-40"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
          Send question
        </button>
      </motion.div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-white">{value}</p>
    </div>
  );
}

export default Marketplace;
