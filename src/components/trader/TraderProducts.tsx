import React, { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  QrCode,
  Loader2,
  Download,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Maximize,
  Camera,
  Image as ImageIcon,
  Upload,
  MapPin,
  Navigation,
  Phone,
  User as UserIcon,
  Store,
  AlertCircle,
  PlusCircle,
  TrendingUp,
  CheckCircle2,
  ShieldCheck as VerifiedIcon,
  SlidersHorizontal,
  Radio,
  Video,
  CameraOff,
  Mic,
  MicOff,
  Share2,
  MessageCircle,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from '../../services/firestoreBridge';
import Fuse from 'fuse.js';
import { QRCodeCanvas } from 'qrcode.react';
import QRScanner from '../QRScanner';
import MediaUpload from './MediaUpload';
import { useLanguage } from '../../context/LanguageContext';
import { cn, formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../lib/utils';
import { calculateDistance, getCurrentCoordinates, Coordinates } from '../../lib/locationUtils';
import { subscribeToLiveUpdates } from '../../services/liveSyncService';

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Product {
  id: string;
  traderId: string;
  code?: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  qrCode?: string;
  imageUrl?: string;
  category?: string;
  variants?: ProductVariant[];
  mediaItems?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    duration?: number;
    isMain?: boolean;
    createdAt?: string;
  }>;
}

interface TraderProductsProps {
  products: Product[];
  traderId?: string;
  traderName?: string;
  traderTin?: string;
  traderPhone?: string;
  traderAddress?: string;
  traderData?: any;
  vatRate?: number;
  lowStockThreshold?: number;
  initialStockFilter?: 'all' | 'low' | 'in-stock' | 'out-of-stock';
  initialEditProductId?: string | null;
  setInitialEditProductId?: (id: string | null) => void;
}

function RemoteViewerTile({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative h-36 overflow-hidden rounded-2xl bg-black border border-white/10">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
        {label}
      </span>
    </div>
  );
}

export default function TraderProducts({
  products,
  traderId = '',
  traderName = '',
  traderTin = '',
  traderPhone = '',
  traderAddress = '',
  traderData,
  vatRate = 18,
  lowStockThreshold = 10,
  initialStockFilter = 'all',
  initialEditProductId = null,
  setInitialEditProductId,
}: TraderProductsProps) {
  const db = undefined; // Used by firestoreBridge
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQRModal, setShowQRModal] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showScanner, setShowScanner] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveViewerVideoRef = useRef<HTMLVideoElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const livePeersRef = useRef<Record<string, RTCPeerConnection>>({});
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const [liveRemoteStreams, setLiveRemoteStreams] = useState<
    Array<{ viewerId: string; stream: MediaStream }>
  >([]);
  const [liveParticipants, setLiveParticipants] = useState<any[]>([]);
  const [isLivePanelOpen, setIsLivePanelOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [activeLiveSession, setActiveLiveSession] = useState<any>(null);
  const [liveViewerConnected, setLiveViewerConnected] = useState(false);
  const [liveCameraOn, setLiveCameraOn] = useState(false);
  const [liveMicOn, setLiveMicOn] = useState(true);
  const [liveTitle, setLiveTitle] = useState(`${traderName || 'My shop'} live market`);
  const [livePinnedProductId, setLivePinnedProductId] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [liveReply, setLiveReply] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'in-stock' | 'out-of-stock'>(
    initialStockFilter
  );
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const qrRef = useRef<HTMLDivElement>(null);
  const productsListRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    return () => {
      liveStreamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(livePeersRef.current).forEach((peer) => peer.close());
    };
  }, []);

  const startLiveCamera = async () => {
    setLiveError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLiveError('Camera is not available in this browser. Use HTTPS and allow camera permission.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioStream.getAudioTracks().forEach((track) => stream.addTrack(track));
        setLiveMicOn(true);
      } catch {
        setLiveMicOn(false);
      }

      liveStreamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      setLiveCameraOn(true);
    } catch (error: any) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setLiveError('Camera permission was blocked. Allow camera access in your browser settings and try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setLiveError('No camera was found on this device.');
      } else {
        setLiveError(error instanceof Error ? error.message : 'Camera could not be opened.');
      }
    }
  };

  const stopLiveCamera = () => {
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    if (liveViewerVideoRef.current) liveViewerVideoRef.current.srcObject = null;
    Object.values(livePeersRef.current).forEach((peer) => peer.close());
    livePeersRef.current = {};
    setLiveRemoteStreams([]);
    setLiveParticipants([]);
    setLiveCameraOn(false);
    setLiveViewerConnected(false);
    setIsLive(false);
    if (activeLiveSession?.id) {
      void fetch(`/api/live/sessions/${activeLiveSession.id}/end`, {
        method: 'PUT',
        credentials: 'include',
      });
    }
    setActiveLiveSession(null);
  };

  const toggleLiveMic = () => {
    const next = !liveMicOn;
    liveStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setLiveMicOn(next);
  };

  const publishLiveSession = async () => {
    const selectedProduct = products.find((product) => product.id === livePinnedProductId);
    if (!liveCameraOn) {
      await startLiveCamera();
    }
    if (!liveStreamRef.current) {
      setLiveError('Camera and microphone are required before going live.');
      return;
    }
    const response = await fetch('/api/live/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: liveTitle,
        pinnedProductId: selectedProduct?.id || null,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setLiveError(data.error || 'Could not publish live session.');
      return;
    }
    setActiveLiveSession(data.session);
    setIsLive(true);
  };

  React.useEffect(() => {
    if (!activeLiveSession?.id || !liveStreamRef.current) return;

    const sendSignal = async (viewerId: string, type: string, payload: any) => {
      await fetch(`/api/live/sessions/${activeLiveSession.id}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ viewerId, type, payload }),
      });
    };

    const handleOffer = async (signal: any) => {
      if (processedSignalsRef.current.has(signal.id)) return;
      processedSignalsRef.current.add(signal.id);
      const viewerId = signal.viewerId;
      let peer = livePeersRef.current[viewerId];
      if (!peer) {
        peer = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        livePeersRef.current[viewerId] = peer;
        liveStreamRef.current?.getTracks().forEach((track) => {
          if (liveStreamRef.current) peer.addTrack(track, liveStreamRef.current);
        });
        peer.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (liveViewerVideoRef.current && remoteStream) {
            liveViewerVideoRef.current.srcObject = remoteStream;
            setLiveViewerConnected(true);
            setLiveRemoteStreams((prev) => {
              if (prev.some((item) => item.viewerId === viewerId)) return prev;
              return [...prev, { viewerId, stream: remoteStream }].slice(-6);
            });
          }
        };
        peer.onicecandidate = (event) => {
          if (event.candidate) void sendSignal(viewerId, 'candidate', event.candidate.toJSON());
        };
      }
      await peer.setRemoteDescription(signal.payload);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal(viewerId, 'answer', answer);
    };

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/live/sessions/${activeLiveSession.id}/signals`, {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      for (const signal of data.signals || []) {
        if (signal.type === 'offer') {
          await handleOffer(signal);
        }
        if (signal.type === 'candidate') {
          const peer = livePeersRef.current[signal.viewerId];
          if (peer?.remoteDescription && !processedSignalsRef.current.has(signal.id)) {
            processedSignalsRef.current.add(signal.id);
            await peer.addIceCandidate(signal.payload);
          }
        }
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [activeLiveSession?.id]);

  React.useEffect(() => {
    if (!activeLiveSession?.id) return;
    const loadParticipants = async () => {
      await fetch(`/api/live/sessions/${activeLiveSession.id}/participants`, {
        method: 'POST',
        credentials: 'include',
      });
      const response = await fetch(`/api/live/sessions/${activeLiveSession.id}/participants`, {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setLiveParticipants(data.participants || []);
    };
    loadParticipants();
    const interval = window.setInterval(loadParticipants, 5000);
    return () => window.clearInterval(interval);
  }, [activeLiveSession?.id]);

  const loadLiveMessages = React.useCallback(async () => {
    if (!activeLiveSession?.id) return;
    const response = await fetch(`/api/live/sessions/${activeLiveSession.id}/messages?limit=100`, {
      credentials: 'include',
    });
    if (!response.ok) return;
    const data = await response.json();
    setLiveMessages(data.messages || []);
  }, [activeLiveSession?.id]);

  React.useEffect(() => {
    if (!activeLiveSession?.id) {
      setLiveMessages([]);
      return;
    }

    loadLiveMessages();
    const interval = window.setInterval(loadLiveMessages, 1000);
    const unsubscribe = subscribeToLiveUpdates((event) => {
      if (
        event.collection === 'live_messages' &&
        event.path?.includes(`/api/live/sessions/${activeLiveSession.id}/messages`)
      ) {
        void loadLiveMessages();
      }
    });

    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [activeLiveSession?.id, loadLiveMessages]);

  const sendLiveReply = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const message = liveReply.trim();
    if (!message || !activeLiveSession?.id) return;

    setLiveReply('');
    await fetch(`/api/live/sessions/${activeLiveSession.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message }),
    });
    await loadLiveMessages();
  };

  const [nearbySuppliers, setNearbySuppliers] = useState<any[]>([]);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState<string | null>(null);
  const [sourcingQuery, setSourcingQuery] = useState('');

  const handleFindSuppliers = async (productName: string) => {
    setShowSupplierModal(productName);
    setSearchingSuppliers(true);
    setNearbySuppliers([]);

    try {
      const userCoords = await getCurrentCoordinates();

      // 1. Find other products with similar name
      // Firestore doesn't support fuzzy search, so we'll fetch products by category or just all and filter
      // For demo, we search all products not belonging to current user
      const q = query(collection(db, 'products'), where('traderId', '!=', traderId));
      const productSnap = await getDocs(q);

      const potentialProducts = productSnap.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }) as any)
        .filter((p: any) => p.name.toLowerCase().includes(productName.toLowerCase()));

      if (potentialProducts.length === 0) {
        setNearbySuppliers([]);
        return;
      }

      // 2. Get unique trader IDs
      const traderIds: string[] = Array.from(
        new Set(potentialProducts.map((p: any) => p.traderId as string))
      );

      // 3. Fetch trader details (locations)
      const tradersData: any[] = [];
      for (const tId of traderIds) {
        const tDoc = await getDoc(doc(db, 'users', tId));
        if (tDoc.exists()) {
          const tData = tDoc.data();
          if (tData.coordinates) {
            const distance = calculateDistance(userCoords, tData.coordinates);
            tradersData.push({
              id: tId,
              ...tData,
              distance,
              matchingProducts: potentialProducts.filter((p: any) => p.traderId === tId),
            });
          }
        }
      }

      // 4. Sort by distance
      setNearbySuppliers(tradersData.sort((a, b) => a.distance - b.distance));
    } catch (err) {
      console.error('Supplier search error:', err);
    } finally {
      setSearchingSuppliers(false);
    }
  };

  React.useEffect(() => {
    if (initialStockFilter !== 'all') {
      setStockFilter(initialStockFilter);
      setShowFilters(true);
      // Scroll to the products list
      productsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialStockFilter]);

  React.useEffect(() => {
    if (initialEditProductId) {
      const product = products.find((p) => p.id === initialEditProductId);
      if (product) {
        setSearchTerm(product.name);
        setEditingProduct(product);
        setFormError(null);
        setFormData({
          name: product.name,
          description: product.description || '',
          price: formatCurrencyInput(product.price.toString()),
          stock: product.stock.toString(),
          code: product.code || '',
          imageUrl: product.imageUrl || '',
          category: product.category || '',
          variants: product.variants || [],
          mediaItems: product.mediaItems || [],
        });
        setIsAdding(true);
        // Scroll to top to see the modal
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Clear the initial edit ID so it doesn't re-open
        setInitialEditProductId?.(null);
      }
    }
  }, [initialEditProductId, products, setInitialEditProductId]);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: string;
    stock: string;
    code: string;
    imageUrl: string;
    category: string;
    variants: ProductVariant[];
    mediaItems: Array<{
      id: string;
      type: 'image' | 'video';
      url: string;
      thumbnail?: string;
      duration?: number;
      isMain?: boolean;
      createdAt?: string;
    }>;
  }>({
    name: '',
    description: '',
    price: '',
    stock: '',
    code: '',
    imageUrl: '',
    category: '',
    variants: [],
    mediaItems: [],
  });

  const [newVariant, setNewVariant] = useState({
    name: '',
    price: '',
    stock: '',
  });

  const addVariantToForm = () => {
    setVariantError(null);
    if (!newVariant.name || !newVariant.price || !newVariant.stock) {
      setVariantError('Please fill in all variant fields');
      return;
    }

    const price = Number(parseCurrencyInput(newVariant.price));
    if (isNaN(price) || price <= 0) {
      setVariantError('Price must be a positive number');
      return;
    }

    const stock = Number(newVariant.stock);
    if (isNaN(stock) || stock < 0) {
      setVariantError('Stock must be a non-negative number');
      return;
    }

    if (editingVariantId) {
      setFormData({
        ...formData,
        variants: formData.variants.map((v) =>
          v.id === editingVariantId ? { ...v, name: newVariant.name, price, stock } : v
        ),
      });
      setEditingVariantId(null);
    } else {
      const variant: ProductVariant = {
        id: Date.now().toString(),
        name: newVariant.name,
        price: price,
        stock: stock,
      };
      setFormData({
        ...formData,
        variants: [...formData.variants, variant],
      });
    }
    setNewVariant({ name: '', price: '', stock: '' });
  };

  const editVariantInForm = (variant: ProductVariant) => {
    setVariantError(null);
    setNewVariant({
      name: variant.name,
      price: formatCurrencyInput(variant.price.toString()),
      stock: variant.stock.toString(),
    });
    setEditingVariantId(variant.id);
  };

  const removeVariantFromForm = (id: string) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((v) => v.id !== id),
    });
  };

  const [isRestocking, setIsRestocking] = useState(false);
  const [restockData, setRestockData] = useState({ productId: '', quantity: '', cost: '' });

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const product = products.find((p) => p.id === restockData.productId);
      if (!product) return;

      const qty = Number(restockData.quantity);
      const cost = Number(parseCurrencyInput(restockData.cost));

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', restockData.productId);
        const pDoc = await transaction.get(productRef);
        if (!pDoc.exists()) throw new Error('Product not found');

        // Update stock
        transaction.update(productRef, {
          stock: (pDoc.data().stock || 0) + qty,
        });

        // Record transaction
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: traderId,
          amount: cost,
          type: 'supply',
          method: 'cash',
          status: 'completed',
          category: 'business',
          description: `Restock: ${product.name} (+${qty})`,
          timestamp: serverTimestamp(),
        });
      });

      setIsRestocking(false);
      setRestockData({ productId: '', quantity: '', cost: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file');
      return;
    }

    setUploading(true);
    setFormError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
        setUploading(false);
      };
      reader.onerror = () => {
        setFormError('Failed to read image file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setFormError('Failed to process image. Please try again.');
      setUploading(false);
    }
  };

  const generateProductQRCode = (product: Product) => {
    setShowQRModal(product);
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById('product-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qr-${showQRModal?.name || 'product'}.png`;
      link.href = url;
      link.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Product name is required');
      return;
    }

    const mainPrice = Number(parseCurrencyInput(formData.price));
    if (isNaN(mainPrice) || mainPrice <= 0) {
      setFormError('Product price must be a positive number');
      return;
    }

    const stockNum = Number(formData.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('Stock quantity must be a valid non-negative number');
      return;
    }

    setLoading(true);
    try {
      const productData = {
        traderId,
        name: formData.name,
        description: formData.description,
        price: mainPrice,
        stock: Number(formData.stock),
        code: (formData.code || `PRD-${Date.now()}`).toUpperCase().trim(),
        qrCode: `esoko-product-${(formData.code || Date.now()).toString().toUpperCase().trim()}`,
        imageUrl: formData.imageUrl,
        category: formData.category,
        variants: formData.variants,
        mediaItems: formData.mediaItems,
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), productData);
      }
      setIsAdding(false);
      setEditingProduct(null);
      setFormError(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        stock: '',
        code: '',
        imageUrl: '',
        category: '',
        variants: [],
        mediaItems: [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'products', deletingProduct.id));
      setDeletingProduct(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['Food', 'Electronics', 'Clothing', 'Home', 'Beauty', 'Other'];

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // 1. Fuzzy Search
    if (searchTerm.trim()) {
      const fuse = new Fuse(result, {
        keys: ['name', 'code', 'description', 'category'],
        threshold: 0.35,
        distance: 100,
        ignoreLocation: true,
      });
      result = fuse.search(searchTerm).map((r) => r.item);
    }

    // 2. Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // 3. Stock Filter
    if (stockFilter !== 'all') {
      result = result.filter((p) => {
        if (stockFilter === 'low') return p.stock > 0 && p.stock < lowStockThreshold;
        if (stockFilter === 'in-stock') return p.stock >= lowStockThreshold;
        if (stockFilter === 'out-of-stock') return p.stock === 0;
        return true;
      });
    }

    // 4. Price Filter
    const min = Number(parseCurrencyInput(minPrice));
    const max = Number(parseCurrencyInput(maxPrice));

    if (!isNaN(min) && minPrice !== '') {
      result = result.filter((p) => p.price >= min);
    }
    if (!isNaN(max) && maxPrice !== '') {
      result = result.filter((p) => p.price <= max);
    }

    return result;
  }, [products, searchTerm, selectedCategory, stockFilter, minPrice, maxPrice, lowStockThreshold]);

  const resetFilters = () => {
    setStockFilter('all');
    setSelectedCategory('all');
    setMinPrice('');
    setMaxPrice('');
    setSearchTerm('');
  };

  const exportToCSV = () => {
    if (filteredProducts.length === 0) return;

    const headers = ['Name', 'Code', 'Category', 'Price (RWF)', 'Stock', 'Description'];
    const rows = filteredProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.code || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.price,
      p.stock,
      `"${(p.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" ref={productsListRef}>
      {/* Dynamic Market Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
            Market Core
          </h2>
          <p className="text-neutral-500 font-medium text-[11px] md:text-sm tracking-tight">
            Real-time inventory management and intelligent marketplace sourcing.
          </p>
        </div>

        <div className="grid grid-cols-2 md:flex items-center gap-2">
          <button
            onClick={() => setIsRestocking(true)}
            className="flex items-center justify-center gap-2 px-4 md:px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            <Package size={16} /> <span className="truncate">Restock</span>
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setIsAdding(true);
            }}
            className="flex items-center justify-center gap-2 px-4 md:px-6 py-3 bg-orange-600 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg active:scale-95 shadow-orange-600/20"
          >
            <PlusCircle size={16} /> <span className="truncate">New Asset</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <Radio size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">
                  Live Marketplace Control
                </p>
                {isLive && (
                  <span className="px-2 py-1 rounded-full bg-red-600 text-white text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-white leading-tight">
                Go live from inventory and sell while customers watch
              </h3>
              <p className="text-xs text-neutral-500 font-bold mt-1 max-w-2xl">
                Pin a product, open camera, share the live room, and keep inventory controls in the
                same market command area.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsLivePanelOpen((value) => !value)}
            className="px-5 py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2"
          >
            <Video size={18} />
            {isLivePanelOpen ? 'Hide Live Tools' : 'Open Live Tools'}
          </button>
        </div>

        <AnimatePresence>
          {isLivePanelOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/5"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 p-5 md:p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                        Live title
                      </label>
                      <input
                        value={liveTitle}
                        onChange={(e) => setLiveTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                        Pin product
                      </label>
                      <select
                        value={livePinnedProductId}
                        onChange={(e) => setLivePinnedProductId(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">No product pinned</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - RWF {formatCurrency(product.price || 0)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={liveCameraOn ? stopLiveCamera : publishLiveSession}
                      disabled={!liveTitle.trim()}
                      className="py-4 rounded-2xl bg-red-600 text-white border border-red-500/40 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-40"
                    >
                      {liveCameraOn ? <CameraOff size={16} /> : <Camera size={16} />}
                      {liveCameraOn ? 'End Live' : 'Start Live'}
                    </button>
                    <button
                      type="button"
                      onClick={toggleLiveMic}
                      disabled={!liveCameraOn}
                      className="py-4 rounded-2xl bg-white/5 text-white border border-white/10 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-40"
                    >
                      {liveMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                      Mic
                    </button>
                    <button
                      type="button"
                      onClick={publishLiveSession}
                      disabled={!liveTitle.trim()}
                      className="py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-40"
                    >
                      <Radio size={16} />
                      Go Live
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/customer?live=${traderId}`;
                        const liveUrl = activeLiveSession?.id
                          ? `${window.location.origin}/customer?liveSession=${activeLiveSession.id}`
                          : url;
                        navigator.clipboard.writeText(liveUrl);
                      }}
                      className="py-4 rounded-2xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-700"
                    >
                      <Share2 size={16} />
                      Share
                    </button>
                  </div>

                  {liveError && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                      {liveError}
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] bg-black border border-white/10 overflow-hidden min-h-[220px] relative">
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={cn(
                      'w-full h-full object-cover absolute inset-0',
                      !liveCameraOn && 'hidden'
                    )}
                  />
                  {!liveCameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                      <Video className="text-neutral-700 mb-4" size={48} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        Live preview appears here
                      </p>
                    </div>
                  )}
                  <video
                    ref={liveViewerVideoRef}
                    autoPlay
                    playsInline
                    className={cn(
                      'absolute bottom-4 right-4 w-28 h-36 rounded-2xl object-cover border border-white/20 shadow-2xl bg-black',
                      !liveViewerConnected && 'hidden'
                    )}
                  />
                  {isLive && !liveViewerConnected && (
                    <div className="absolute top-4 left-4 rounded-2xl bg-black/70 border border-white/10 px-4 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                        Waiting for customers
                      </p>
                    </div>
                  )}
                  {isLive && (
                    <div className="absolute top-4 right-4 rounded-2xl bg-black/70 border border-white/10 px-4 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white">
                        {Math.max(liveParticipants.length - 1, 0)} joined
                      </p>
                    </div>
                  )}
                </div>
                {isLive && liveParticipants.length > 0 && (
                  <div className="lg:col-span-2 rounded-2xl bg-black/40 border border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        Live participants
                      </p>
                      <p className="text-[10px] font-bold text-red-300">
                        {liveRemoteStreams.length} video callers
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {liveParticipants.map((participant) => (
                        <span
                          key={participant.id || participant.userId}
                          className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-bold text-neutral-300"
                        >
                          {participant.role === 'trader' ? 'Host: ' : ''}
                          {participant.displayName || 'Guest'}
                        </span>
                      ))}
                    </div>
                    {liveRemoteStreams.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {liveRemoteStreams.map((remote, index) => (
                          <RemoteViewerTile
                            key={remote.viewerId}
                            stream={remote.stream}
                            label={`Caller ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isLive && activeLiveSession?.id && (
                  <div className="lg:col-span-2 rounded-2xl bg-black/40 border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
                          <MessageCircle size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                            Live customer chat
                          </p>
                          <p className="text-xs font-bold text-neutral-500">
                            Messages customers send from Marketplace appear here.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                        {liveMessages.length} messages
                      </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto p-4 space-y-3">
                      {liveMessages.length === 0 ? (
                        <div className="py-8 text-center text-xs font-bold text-neutral-600">
                          No customer messages yet.
                        </div>
                      ) : (
                        liveMessages.map((message) => {
                          const isMe = message.userId === auth.currentUser?.uid;
                          return (
                            <div
                              key={message.id}
                              className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                            >
                              <div
                                className={cn(
                                  'max-w-[82%] rounded-2xl px-4 py-3 text-xs font-bold leading-relaxed',
                                  isMe
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-white/5 text-neutral-200 border border-white/10'
                                )}
                              >
                                {!isMe && (
                                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-orange-300">
                                    {message.senderName || 'Customer'}
                                  </p>
                                )}
                                {message.message}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form onSubmit={sendLiveReply} className="p-4 border-t border-white/10 flex gap-2">
                      <input
                        value={liveReply}
                        onChange={(event) => setLiveReply(event.target.value)}
                        placeholder="Reply to live customers..."
                        className="flex-1 min-w-0 rounded-2xl bg-black border border-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-neutral-700"
                      />
                      <button
                        type="submit"
                        disabled={!liveReply.trim()}
                        className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 disabled:opacity-40"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] text-white overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000">
          <TrendingUp size={120} />
        </div>
        <div className="relative z-10 space-y-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/50 mb-4 flex items-center gap-2">
              <Navigation size={14} /> Marketplace Sourcing
            </h3>
            <div className="relative max-w-2xl">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300"
                size={20}
              />
              <input
                type="text"
                placeholder={
                  t.trader.searchSupplierProduct || 'Search any product name across the network...'
                }
                value={sourcingQuery}
                onChange={(e) => setSourcingQuery(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && sourcingQuery && handleFindSuppliers(sourcingQuery)
                }
                className="w-full pl-12 pr-32 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl focus:ring-2 focus:ring-white outline-none font-black text-sm placeholder:text-white/40"
              />
              <button
                onClick={() => sourcingQuery && handleFindSuppliers(sourcingQuery)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-white text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all"
              >
                {t.common.findSupplier || 'Find Hubs'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Stock Synced</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-xl">
              <VerifiedIcon size={14} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Clean Receipts</span>
            </div>
          </div>
        </div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Advanced Filter Architecture */}
        <div className="flex flex-col gap-4 bg-white dark:bg-neutral-900 p-2 rounded-[1.5rem] md:rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto px-2 no-scrollbar">
              {(['all', 'in-stock', 'low', 'out-of-stock'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStockFilter(s)}
                  className={cn(
                    'px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                    stockFilter === s
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                  )}
                >
                  {s === 'all' ? t.common.all : s.replace('-', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-2 pb-1 lg:pb-0">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder={t.trader.searchProducts}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full lg:w-64 pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[11px] font-bold shadow-inner"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'p-2 rounded-xl transition-all border flex items-center gap-2',
                  showFilters
                    ? 'bg-orange-50 border-orange-200 text-orange-600'
                    : 'bg-neutral-50 border-transparent text-neutral-400 hover:text-neutral-600'
                )}
              >
                <SlidersHorizontal size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                  Refine
                </span>
              </button>
            </div>
          </div>

          {/* Expansible Refined Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-neutral-100 dark:border-neutral-800 px-4 pt-4 pb-2"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Category Selection */}
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 leading-none">
                      Market Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight border transition-all',
                          selectedCategory === 'all'
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                        )}
                      >
                        All Categories
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight border transition-all',
                            selectedCategory === cat
                              ? 'bg-orange-600 border-orange-600 text-white'
                              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 leading-none">
                      Price Range (RWF)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Min Price"
                          value={minPrice}
                          onChange={(e) => setMinPrice(formatCurrencyInput(e.target.value))}
                          className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div className="w-4 h-px bg-neutral-200 dark:bg-neutral-700" />
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Max Price"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(formatCurrencyInput(e.target.value))}
                          className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <button
                        onClick={resetFilters}
                        className="px-4 py-2 text-neutral-400 hover:text-red-600 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                      >
                        <X size={12} /> Clear
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col h-full"
            >
              <div className="relative h-48 bg-neutral-50 dark:bg-neutral-800 group-hover:h-56 transition-all duration-500">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-200">
                    <Package size={64} className="group-hover:scale-110 transition-transform" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                  <button
                    onClick={() => generateProductQRCode(product)}
                    className="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-orange-600 hover:text-white transition-all"
                  >
                    <QrCode size={20} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setIsAdding(true);
                    }}
                    className="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setDeletingProduct(product)}
                    className="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-red-600 hover:text-white transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 bg-white items-center gap-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-lg">
                    #{product.code}
                  </span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-neutral-100 text-lg leading-tight group-hover:text-orange-600 transition-colors uppercase tracking-tight">
                      {product.name}
                    </h4>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
                      {product.category || 'General Inventory'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-orange-600 text-lg tabular-nums leading-none mb-1">
                      {formatCurrency(product.price)} RWF
                    </p>
                    <p className="text-[8px] font-black text-neutral-400 uppercase tracking-tighter">
                      Tax Inc.
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      Inventory Status
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-black tabular-nums',
                        product.stock < lowStockThreshold ? 'text-red-600' : 'text-emerald-600'
                      )}
                    >
                      {product.stock} units
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-50 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, (product.stock / lowStockThreshold) * 100)}%`,
                      }}
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        product.stock < lowStockThreshold
                          ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                          : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      )}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleFindSuppliers(product.name)}
                  className="w-full mt-6 py-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:bg-slate-900 hover:text-white rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border border-transparent hover:border-slate-900"
                >
                  Analyze Sourcing Flow
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isRestocking && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-neutral-900 mb-6">Restock Inventory</h3>
              <form onSubmit={handleRestock} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                    Select Product
                  </label>
                  <select
                    required
                    value={restockData.productId}
                    onChange={(e) =>
                      setRestockData((prev) => ({ ...prev, productId: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm"
                  >
                    <option value="">Select a product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Current: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={restockData.quantity}
                      onChange={(e) =>
                        setRestockData((prev) => ({ ...prev, quantity: e.target.value }))
                      }
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                      Total Cost (RWF)
                    </label>
                    <input
                      type="text"
                      required
                      value={restockData.cost}
                      onChange={(e) =>
                        setRestockData((prev) => ({
                          ...prev,
                          cost: formatCurrencyInput(e.target.value),
                        }))
                      }
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsRestocking(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Confirm Restock'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-neutral-900">{t.trader.productQrCode}</h3>
                <button
                  onClick={() => setShowQRModal(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className="bg-neutral-50 p-6 rounded-2xl mb-6 flex flex-col items-center"
                ref={qrRef}
              >
                <QRCodeCanvas
                  id="product-qr-canvas"
                  value={`nexus://pay?traderId=${traderId}&productId=${showQRModal.id}&amount=${showQRModal.price}&traderName=${encodeURIComponent(traderName)}&productName=${encodeURIComponent(showQRModal.name)}&tin=${traderTin}${traderPhone ? `&phone=${encodeURIComponent(traderPhone)}` : ''}${traderAddress ? `&addr=${encodeURIComponent(traderAddress)}` : ''}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
                <div className="mt-4 w-full">
                  <p className="font-black text-slate-900 uppercase tracking-tight">
                    {showQRModal.name}
                  </p>
                  <p className="text-orange-600 font-black text-lg tabular-nums mt-1">
                    {formatCurrency(showQRModal.price)} RWF
                  </p>

                  <div className="mt-4 pt-4 border-t border-neutral-100 w-full text-left space-y-1">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      {t.common.trader}: <span className="text-slate-700">{traderName}</span>
                    </p>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      {t.common.tin}: <span className="text-slate-700">{traderTin}</span>
                    </p>
                    {traderPhone && (
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                        Phone: <span className="text-slate-700">{traderPhone}</span>
                      </p>
                    )}
                    {traderAddress && (
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                        Address:{' '}
                        <span className="text-slate-700 leading-tight">{traderAddress}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={downloadQRCode}
                className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
              >
                <Download size={20} /> {t.trader.downloadPng}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">
                {t.common.confirmDelete}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 font-medium mb-8">
                Are you sure you want to delete{' '}
                <span className="text-neutral-900 dark:text-white font-bold">
                  "{deletingProduct.name}"
                </span>
                ? This action cannot be undone.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setDeletingProduct(null)}
                  className="flex-1 py-4 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold hover:bg-neutral-200 dark:hover:bg-white/10 transition-all font-bold"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : t.common.reject}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-neutral-900 z-10 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                  {editingProduct ? t.trader.editProduct : t.trader.addProduct}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingProduct(null);
                    setFormError(null);
                    setFormData({
                      name: '',
                      description: '',
                      price: '',
                      stock: '',
                      code: '',
                      imageUrl: '',
                      category: '',
                      variants: [],
                      mediaItems: [],
                    });
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <X size={24} className="text-neutral-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                {formError && (
                  <p className="text-sm text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2">
                    <X size={16} /> {formError}
                  </p>
                )}

                {/* Image Upload Section */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                    Product Image
                  </label>
                  <div className="flex flex-col items-center gap-4">
                    {formData.imageUrl ? (
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 group">
                        <img
                          src={formData.imageUrl}
                          alt="Product preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 bg-white text-neutral-900 rounded-xl font-bold hover:bg-orange-50 transition-all flex items-center gap-2"
                          >
                            <Camera size={18} /> Change
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                            className="p-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center gap-2"
                          >
                            <Trash2 size={18} /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full aspect-video rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-3 hover:border-orange-500 hover:bg-orange-50/30 transition-all group disabled:opacity-50"
                      >
                        {uploading ? (
                          <Loader2 className="animate-spin text-orange-600" size={32} />
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-xl flex items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                              <Upload size={24} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                                Upload Product Image
                              </p>
                              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
                                PNG, JPG — all sizes supported
                              </p>
                            </div>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 ml-1">
                    Hero Image
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 flex items-center justify-center overflow-hidden relative group">
                      {formData.imageUrl ? (
                        <>
                          <img
                            src={formData.imageUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={20} className="text-white" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="text-neutral-300" size={24} />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-all flex items-center gap-2"
                        >
                          <Upload size={14} /> Upload Image
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        All image sizes supported. Recommended: Square aspect ratio.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Media Upload Component */}
                <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
                  <MediaUpload
                    mediaItems={formData.mediaItems}
                    onMediaAdd={(items) => setFormData({ ...formData, mediaItems: items })}
                    onMediaRemove={(id) =>
                      setFormData({
                        ...formData,
                        mediaItems: formData.mediaItems.filter((m) => m.id !== id),
                      })
                    }
                    onMediaSetMain={(id) =>
                      setFormData({
                        ...formData,
                        mediaItems: formData.mediaItems.map((m) => ({ ...m, isMain: m.id === id })),
                      })
                    }
                    maxItems={5}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 ml-1">
                    {t.trader.productName}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field shadow-sm"
                    placeholder="e.g. Premium White Rice"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 ml-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field shadow-sm resize-none"
                    rows={3}
                    placeholder="Enter product description..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 ml-1">
                    Category
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field shadow-sm font-bold text-sm"
                  >
                    <option value="">Select Category</option>
                    <option value="Food">Food</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Home">Home</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 ml-1">
                      {t.common.price} (RWF)
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: formatCurrencyInput(e.target.value) })
                      }
                      className="input-field shadow-sm"
                      placeholder="0"
                    />
                    {formData.price && (
                      <div className="mt-2 p-3 bg-orange-50/50 dark:bg-orange-500/5 rounded-xl border border-orange-100 dark:border-orange-500/10 space-y-1">
                        <div className="flex justify-between text-xs font-black pt-1 border-t border-orange-100 dark:border-orange-900/50">
                          <span className="text-neutral-900 dark:text-neutral-100 uppercase tracking-widest">
                            Sale Price:
                          </span>
                          <span className="text-orange-600">
                            RWF {formatCurrency(Number(parseCurrencyInput(formData.price)))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 ml-1">
                      {t.trader.stockQuantity}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="input-field shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-100">
                  <h4 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                    <Plus size={16} className="text-orange-600" /> {t.trader.variants}
                  </h4>

                  <div className="space-y-3 mb-6">
                    {formData.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between bg-neutral-50 p-3 rounded-2xl border border-neutral-100"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold text-neutral-900">{v.name}</p>
                          <p className="text-xs text-neutral-500">
                            {formatCurrency(v.price)} RWF â€¢ {v.stock} {t.trader.stock}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => editVariantInForm(v)}
                            className="p-2 text-neutral-400 hover:text-orange-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVariantFromForm(v.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-4">
                    <div className="space-y-3">
                      {variantError && (
                        <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                          <X size={12} /> {variantError}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {['Small', 'Medium', 'Large', 'Red', 'Blue', 'Black', 'XL', 'XXL'].map(
                          (attr) => (
                            <button
                              key={attr}
                              type="button"
                              onClick={() =>
                                setNewVariant((prev) => ({
                                  ...prev,
                                  name: prev.name ? `${prev.name} - ${attr}` : attr,
                                }))
                              }
                              className="px-2 py-1 bg-white border border-orange-200 rounded-lg text-[10px] font-bold text-orange-400 hover:border-orange-600 hover:text-orange-600 transition-all shadow-sm"
                            >
                              + {attr}
                            </button>
                          )
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={t.trader.variantName}
                        value={newVariant.name}
                        onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                        className="w-full px-4 py-2 text-sm bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder={t.trader.variantPrice}
                            value={newVariant.price}
                            onChange={(e) =>
                              setNewVariant({
                                ...newVariant,
                                price: formatCurrencyInput(e.target.value),
                              })
                            }
                            className="w-full px-4 py-2 text-sm bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          />
                          {newVariant.price && (
                            <p className="text-[10px] text-neutral-500 font-medium px-1">
                              {newVariant.price} RWF
                            </p>
                          )}
                        </div>
                        <input
                          type="number"
                          placeholder={t.trader.variantStock}
                          min="0"
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })}
                          className="w-full px-4 py-2 text-sm bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addVariantToForm}
                      className="w-full py-3 bg-orange-100 text-orange-700 text-sm font-bold rounded-xl hover:bg-orange-200 transition-all flex items-center justify-center gap-2"
                    >
                      {editingVariantId ? (
                        <Edit2 className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {editingVariantId ? t.trader.editVariant : t.trader.addVariant}
                    </button>
                    {editingVariantId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVariantId(null);
                          setVariantError(null);
                          setNewVariant({ name: '', price: '', stock: '' });
                        }}
                        className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                      >
                        {t.common.cancel}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    {t.trader.productCode} ({t.common.optional})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder={`e.g. PRD-${Date.now()}`}
                      className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="px-4 bg-white border border-neutral-200 rounded-xl text-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center"
                      title="Scan Barcode"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 sticky bottom-0 bg-white pt-4 border-t border-neutral-50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingProduct(null);
                      setFormError(null);
                      setFormData({
                        name: '',
                        description: '',
                        price: '',
                        stock: '',
                        code: '',
                        imageUrl: '',
                        category: '',
                        variants: [],
                        mediaItems: [],
                      });
                    }}
                    className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploading}
                    className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" />
                    ) : editingProduct ? (
                      t.common.update
                    ) : (
                      t.trader.addProduct
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-950 w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative border border-neutral-100 dark:border-neutral-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900 dark:text-white leading-tight">
                    Nearby Suppliers
                  </h3>
                  <p className="text-sm text-neutral-500 font-medium">
                    Searching for "{showSupplierModal}"
                  </p>
                </div>
                <button
                  onClick={() => setShowSupplierModal(null)}
                  className="p-3 bg-white dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-full shadow-sm transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                {searchingSuppliers ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                    <p className="text-neutral-500 font-black uppercase tracking-widest text-[10px]">
                      Scanning regional supply chain...
                    </p>
                  </div>
                ) : nearbySuppliers.length > 0 ? (
                  <div className="space-y-6">
                    {nearbySuppliers.map((supplier) => (
                      <motion.div
                        key={supplier.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-neutral-50 dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800 hover:border-orange-500/50 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 flex items-center justify-center text-orange-600 shadow-sm border border-neutral-100 dark:border-neutral-700">
                              <Store size={28} />
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-neutral-900 dark:text-white">
                                {supplier.businessName || supplier.name}
                              </h4>
                              <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs font-bold">
                                <MapPin size={14} />
                                {supplier.distance.toFixed(1)} km away â€¢{' '}
                                {supplier.businessAddress || 'Kigali'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <a
                              href={`tel:${supplier.phone}`}
                              className="px-4 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-md shadow-green-900/10"
                            >
                              <Phone size={14} /> Call
                            </a>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                              Available now
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                            Matching Inventory
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {supplier.matchingProducts.map((p: any) => (
                              <div
                                key={p.id}
                                className="bg-white dark:bg-neutral-800 p-3 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 flex justify-between items-center group-hover:border-orange-500/30 transition-all"
                              >
                                <div>
                                  <p className="text-xs font-black text-neutral-900 dark:text-white">
                                    {p.name}
                                  </p>
                                  <p className="text-[10px] text-neutral-500">
                                    {p.stock} units available
                                  </p>
                                </div>
                                <p className="text-sm font-black text-orange-600">
                                  RWF {p.price?.toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <Navigation
                      className="mx-auto text-neutral-200 dark:text-neutral-800 mb-6"
                      size={64}
                    />
                    <h4 className="text-xl font-black text-neutral-900 dark:text-white mb-2">
                      No Suppliers Found Nearby
                    </h4>
                    <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                      We couldn't find any other traders nearby selling this specific product. Try
                      expanding your search radius or contact us for a direct supplier intro.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] text-center">
                  ESOKO Sourcing Engine â€¢ Real-time Supply Chain
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <QRScanner
            onScan={(data) => {
              setFormData({ ...formData, code: data });
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
            placeholder="Scan product barcode"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
