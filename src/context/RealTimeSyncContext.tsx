import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  orderBy,
  limit,
} from '../services/firestoreBridge';
import { useNotifications } from './NotificationContext';
const db = undefined;

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

const RealTimeSyncContext = createContext<RealTimeSyncContextType | undefined>(undefined);

export const useRealTimeSync = () => {
  const context = useContext(RealTimeSyncContext);
  if (!context) {
    throw new Error('useRealTimeSync must be used within a RealTimeSyncProvider');
  }
  return context;
};

interface RealTimeSyncProviderProps {
  children: ReactNode;
}

export const RealTimeSyncProvider: React.FC<RealTimeSyncProviderProps> = ({ children }) => {
  const [syncState, setSyncState] = useState<SyncState>({
    isConnected: false,
    isSyncing: false,
    lastSyncTime: new Date(),
    connectionStatus: 'connecting',
  });

  const { showToast } = useNotifications();

  // Connection monitoring
  useEffect(() => {
    let connectionCheckInterval: NodeJS.Timeout;

    const checkConnection = async () => {
      try {
        // Simple connection check by trying to read a document
        const testDoc = await getDoc(doc(db, 'system', 'connection_test'));
        setSyncState((prev) => ({
          ...prev,
          isConnected: true,
          connectionStatus: 'connected',
        }));
      } catch (error) {
        setSyncState((prev) => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'error',
        }));
      }
    };

    checkConnection();
    connectionCheckInterval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => {
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
    };
  }, []);

  const triggerSync = () => {
    setSyncState((prev) => ({ ...prev, isSyncing: true, lastSyncTime: new Date() }));
    setTimeout(() => {
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    }, 2000);
  };

  const subscribeToPurchases = (traderId: string, callback: (purchases: any[]) => void) => {
    if (!traderId) return () => {};

    const q = query(
      collection(db, 'purchases'),
      where('traderId', '==', traderId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const purchases: any[] = [];
        querySnapshot.forEach((doc: any) => {
          purchases.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp (newest first)
        purchases.sort((a, b) => {
          const timeA = a.timestamp?.toDate?.() || new Date(a.createdAt);
          const timeB = b.timestamp?.toDate?.() || new Date(b.createdAt);
          return timeB.getTime() - timeA.getTime();
        });

        callback(purchases);
        triggerSync();

        // Send notification for new purchases
        const newPurchases = purchases.filter((p) => {
          const purchaseTime = p.timestamp?.toDate?.() || new Date(p.createdAt);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return purchaseTime > fiveMinutesAgo;
        });

        if (newPurchases.length > 0) {
          showToast(
            `You have ${newPurchases.length} new purchase${newPurchases.length > 1 ? 's' : ''}.`,
            'success'
          );
        }
      },
      (error) => {
        console.error('Error listening to purchases:', error);
        setSyncState((prev) => ({ ...prev, connectionStatus: 'error' }));
      }
    );

    return unsubscribe;
  };

  const subscribeToTransactions = (userId: string, callback: (transactions: any[]) => void) => {
    if (!userId) return () => {};

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const transactions: any[] = [];
        querySnapshot.forEach((doc: any) => {
          transactions.push({ id: doc.id, ...doc.data() });
        });

        transactions.sort((a, b) => {
          const timeA = a.timestamp?.toDate?.() || new Date(a.createdAt);
          const timeB = b.timestamp?.toDate?.() || new Date(b.createdAt);
          return timeB.getTime() - timeA.getTime();
        });

        callback(transactions);
        triggerSync();
      },
      (error) => {
        console.error('Error listening to transactions:', error);
      }
    );

    return unsubscribe;
  };

  const subscribeToProducts = (traderId: string, callback: (products: any[]) => void) => {
    if (!traderId) return () => {};

    const q = query(collection(db, 'products'), where('traderId', '==', traderId));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const products: any[] = [];
        querySnapshot.forEach((doc: any) => {
          products.push({ id: doc.id, ...doc.data() });
        });
        callback(products);
        triggerSync();
      },
      (error) => {
        console.error('Error listening to products:', error);
      }
    );

    return unsubscribe;
  };

  const subscribeToUserData = (userId: string, callback: (userData: any) => void) => {
    if (!userId) return () => {};

    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() });
          triggerSync();
        }
      },
      (error) => {
        console.error('Error listening to user data:', error);
      }
    );

    return unsubscribe;
  };

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
