import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { auth } from '../firebase';
import ToastContainer, { Toast, ToastType } from '../components/ui/Toast';
import {
  getNotifications,
  createNotification,
  markNotificationRead,
  deleteNotification as deleteNotificationApi,
  markAllRead,
  clearAllNotifications,
} from '../services/notificationService';
import { subscribeToLiveUpdates } from '../services/liveSyncService';

interface NotificationContextType {
  notifications: any[];
  unreadCount: number;
  showToast: (message: string, type: ToastType) => void;
  sendNotification: (
    userId: string,
    message: string,
    type: ToastType,
    subType?: 'transaction' | 'promo' | 'system',
    metadata?: any
  ) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function toToastType(type: unknown): ToastType {
  return type === 'success' || type === 'error' || type === 'info' ? type : 'info';
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastProcessedId = useRef<string | null>(null);
  const isFirstLoad = useRef(true);

  const loadNotifications = async ({ toastNew = false } = {}) => {
    try {
      const response = await getNotifications();
      if (response?.notifications) {
        const sortedNotifs = [...response.notifications].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const latest = sortedNotifs[0];
        const previousLatestId = lastProcessedId.current;

        setNotifications(sortedNotifs);
        setUnreadCount(sortedNotifs.filter((notif) => !notif.read).length);

        if (latest?.id) {
          lastProcessedId.current = latest.id;
        }

        if (
          toastNew &&
          latest?.id &&
          previousLatestId &&
          latest.id !== previousLatestId &&
          !latest.read
        ) {
          showToast(latest.message || latest.title || 'New notification', toToastType(latest.type));
        }
      }
    } catch (err: any) {
      console.error('Notification fetch error:', err);
      showToast('Failed to load notifications. Please refresh the page.', 'error');
    }
  };

  useEffect(() => {
    let unsubscribeLiveUpdates: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        unsubscribeLiveUpdates?.();
        unsubscribeLiveUpdates = null;
        setNotifications([]);
        setUnreadCount(0);
        isFirstLoad.current = true;
        return;
      }

      loadNotifications();
      if (!unsubscribeLiveUpdates) {
        unsubscribeLiveUpdates = subscribeToLiveUpdates((event) => {
          if (
            !event.collection ||
            event.collection === 'notifications' ||
            ['purchases', 'transactions', 'wallet'].includes(event.collection)
          ) {
            void loadNotifications({ toastNew: true });
          }
        });
      }
    });

    return () => {
      unsubscribeLiveUpdates?.();
      unsubAuth();
    };
  }, []);

  const showToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const sendNotification = async (
    userId: string,
    message: string,
    type: ToastType,
    subType: 'transaction' | 'promo' | 'system' = 'system',
    metadata?: any
  ) => {
    try {
      await createNotification({ userId, message, type, subType, metadata });
    } catch (err) {
      console.error('Notification send error:', err);
      showToast('Unable to send notification. Try again.', 'error');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark notification read error:', err);
      showToast('Unable to mark notification as read.', 'error');
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all notifications read error:', err);
      showToast('Unable to mark all notifications as read.', 'error');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteNotificationApi(id);
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    } catch (err) {
      console.error('Delete notification error:', err);
      showToast('Unable to delete notification.', 'error');
    }
  };

  const clearNotifications = async () => {
    if (notifications.length === 0) return;
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Clear notifications error:', err);
      showToast('Unable to clear notifications.', 'error');
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        showToast,
        sendNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearNotifications,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
