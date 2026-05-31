import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  X,
  Clock,
  Info,
  AlertCircle,
  CheckCircle2,
  Package,
  Trash2,
} from 'lucide-react';
import { toDate } from '../lib/utils';
import { format } from 'date-fns';
import { useNotifications } from '../context/NotificationContext';

interface NotificationCenterProps {
  notifications: any[];
  onClose: () => void;
}

export default function NotificationCenter({ notifications, onClose }: NotificationCenterProps) {
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'warning':
        return <AlertCircle size={16} className="text-amber-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'low_stock':
        return <Package size={16} className="text-red-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute right-0 mt-2 w-[22rem] bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden z-[100]"
    >
      <div className="p-6 border-b border-neutral-50 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-600/10">
            <Bell size={16} className="text-orange-600" />
          </div>
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-neutral-100">
            Alert Center
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {notifications.some((n) => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="text-[10px] font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
          >
            <X size={14} className="text-neutral-400" />
          </button>
        </div>
      </div>

      <div className="max-h-[30rem] overflow-y-auto no-scrollbar">
        <AnimatePresence mode="popLayout" initial={false}>
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all group relative border-b border-neutral-50/50 dark:border-neutral-800/50"
              >
                <div className="flex items-start gap-4 pr-12">
                  <div className="mt-1 shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm tracking-tight leading-snug mb-2 ${n.read ? 'text-neutral-500 font-medium' : 'text-slate-900 dark:text-neutral-100 font-bold'}`}
                    >
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 font-bold tracking-widest uppercase">
                      <Clock size={10} strokeWidth={3} />
                      {format(toDate(n.timestamp), 'MMM dd, HH:mm')}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="p-2 text-neutral-400 hover:text-emerald-500 transition-colors bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-700"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 transition-colors bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {!n.read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-600"></div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Bell size={32} className="text-neutral-200 dark:text-neutral-700" />
              </div>
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-[0.2em]">
                All Caught Up
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {notifications.length > 0 && (
        <div className="p-5 border-t border-neutral-50 dark:border-neutral-800 text-center bg-neutral-50/30 dark:bg-neutral-800/30">
          <button
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
            className="text-[10px] font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest transition-all hover:scale-105"
          >
            Open Alerts Inbox
          </button>
        </div>
      )}
    </motion.div>
  );
}
