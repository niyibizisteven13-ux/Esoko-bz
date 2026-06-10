import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getProducts } from '../services/productService';
import { getPurchases } from '../services/purchaseService';
import { getTransactions } from '../services/transactionService';
import { getUser } from '../services/userService';
import { subscribeToLiveUpdates } from '../services/liveSyncService';

interface SyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: Date;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

interface RealTimeSyncContextType {
  syncState: SyncState;
  subscribeToPurchases: (traderId: string, callback: (purchases: any[]) => void) => () => void;
  subscribeToTransactions: (userId: string, callback: (transactions: any[]) => void) => () => void;
  subscribeToProducts: (traderId: string, callback: (products: any[]) => void) => () => void;
  subscribeToUserData: (userId: string, callback: (userData: any) => void) => () => void;
  triggerSync: () => void;
}

type LiveEvent = {
  type?: string;
  collection?: string;
  path?: string;
  actorUserId?: string;
  [key: string]: any;
};

const RealTimeSyncContext = createContext<RealTimeSyncContextType | undefined>(undefined);
const FALLBACK_POLL_MS = 45000;
const REFRESH_DEBOUNCE_MS = 250;

function toDate(value: any) {
  if (value?.toDate) return value.toDate();
  const parsed = value ? new Date(value) : new Date(0);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function sortNewestFirst(items: any[]) {
  return [...items].sort((a, b) => {
    const left = toDate(a.timestamp || a.createdAt || a.updatedAt).getTime();
    const right = toDate(b.timestamp || b.createdAt || b.updatedAt).getTime();
    return right - left;
  });
}

function collectionFromEvent(event: LiveEvent) {
  if (event.collection) return String(event.collection);
  const match = String(event.path || '').match(/^\/api\/([^/?]+)/);
  return match?.[1] || '';
}

function shouldRefresh(event: LiveEvent, watchedCollections: string[]) {
  if (event.type === 'connected') return true;
  if (event.type && event.type !== 'mutation') return false;
  const collection = collectionFromEvent(event);
  return !collection || watchedCollections.includes(collection);
}

export const useRealTimeSync = () => {
  const context = useContext(RealTimeSyncContext);
  if (!context) {
    throw new Error('useRealTimeSync must be used within a RealTimeSyncProvider');
  }
  return context;
};

export const RealTimeSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [syncState, setSyncState] = useState<SyncState>({
    isConnected: typeof navigator === 'undefined' ? true : navigator.onLine,
    isSyncing: false,
    lastSyncTime: new Date(),
    connectionStatus:
      typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'connecting',
  });
  const liveConnectedRef = useRef(false);

  const markFresh = useCallback(() => {
    setSyncState((prev) => ({
      ...prev,
      isConnected: typeof navigator === 'undefined' ? true : navigator.onLine,
      isSyncing: false,
      lastSyncTime: new Date(),
      connectionStatus:
        typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'connected',
    }));
  }, []);

  const markError = useCallback(() => {
    setSyncState((prev) => ({
      ...prev,
      isConnected: false,
      isSyncing: false,
      connectionStatus:
        typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'error',
    }));
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setSyncState((prev) => ({
        ...prev,
        isConnected: true,
        connectionStatus: liveConnectedRef.current ? 'connected' : 'connecting',
      }));
    };
    const handleOffline = () => {
      setSyncState((prev) => ({
        ...prev,
        isConnected: false,
        isSyncing: false,
        connectionStatus: 'disconnected',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    return subscribeToLiveUpdates((event) => {
      liveConnectedRef.current = true;
      if (event.type === 'connected') {
        markFresh();
      }
    });
  }, [markFresh]);

  const createQuietSubscription = useCallback(
    <T,>(
      watchedCollections: string[],
      loader: () => Promise<T>,
      callback: (value: T) => void
    ) => {
      let disposed = false;
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;

      const refresh = async () => {
        if (disposed) return;
        try {
          const value = await loader();
          if (disposed) return;
          callback(value);
          markFresh();
        } catch (error) {
          console.error('Background sync refresh failed:', error);
          if (!disposed) markError();
        }
      };

      const scheduleRefresh = (delay = REFRESH_DEBOUNCE_MS) => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, delay);
      };

      const schedulePoll = () => {
        if (disposed) return;
        pollTimer = setTimeout(async () => {
          await refresh();
          schedulePoll();
        }, FALLBACK_POLL_MS);
      };

      const unsubscribeLive = subscribeToLiveUpdates((event) => {
        if (shouldRefresh(event, watchedCollections)) scheduleRefresh();
      });

      scheduleRefresh(0);
      schedulePoll();

      return () => {
        disposed = true;
        if (refreshTimer) clearTimeout(refreshTimer);
        if (pollTimer) clearTimeout(pollTimer);
        unsubscribeLive();
      };
    },
    [markError, markFresh]
  );

  const subscribeToPurchases = useCallback(
    (traderId: string, callback: (purchases: any[]) => void) => {
      if (!traderId) return () => {};
      return createQuietSubscription(
        ['purchases', 'transactions', 'wallet', 'wallets', 'notifications'],
        async () => {
          const response = await getPurchases({ traderId, limit: 100 });
          return sortNewestFirst(response?.purchases || []);
        },
        callback
      );
    },
    [createQuietSubscription]
  );

  const subscribeToTransactions = useCallback(
    (userId: string, callback: (transactions: any[]) => void) => {
      if (!userId) return () => {};
      return createQuietSubscription(
        ['transactions', 'wallet', 'wallets', 'purchases', 'users'],
        async () => {
          const response = await getTransactions({ userId, limit: 100 });
          return sortNewestFirst(response?.transactions || []);
        },
        callback
      );
    },
    [createQuietSubscription]
  );

  const subscribeToProducts = useCallback(
    (traderId: string, callback: (products: any[]) => void) => {
      if (!traderId) return () => {};
      return createQuietSubscription(
        ['products', 'purchases'],
        async () => {
          const response = await getProducts({ traderId });
          return response?.products || [];
        },
        callback
      );
    },
    [createQuietSubscription]
  );

  const subscribeToUserData = useCallback(
    (userId: string, callback: (userData: any) => void) => {
      if (!userId) return () => {};
      return createQuietSubscription(
        [
          'users',
          'user_accounts',
          'transactions',
          'wallet',
          'wallets',
          'verification',
          'verification_requests',
          'verification_documents',
          'notifications',
        ],
        async () => {
          const response = await getUser(userId);
          return response?.user;
        },
        (user) => {
          if (user) callback(user);
        }
      );
    },
    [createQuietSubscription]
  );

  const triggerSync = useCallback(() => {
    markFresh();
  }, [markFresh]);

  const value: RealTimeSyncContextType = {
    syncState,
    subscribeToPurchases,
    subscribeToTransactions,
    subscribeToProducts,
    subscribeToUserData,
    triggerSync,
  };

  return <RealTimeSyncContext.Provider value={value}>{children}</RealTimeSyncContext.Provider>;
};
