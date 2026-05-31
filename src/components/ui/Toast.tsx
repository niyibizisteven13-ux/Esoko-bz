import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, Bell, Package } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'low_stock';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastProps) {
  return (
    <div className="fixed top-24 right-4 z-[200] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} className="text-emerald-500" />;
      case 'warning':
        return <AlertCircle size={20} className="text-amber-500" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-500" />;
      case 'low_stock':
        return <Package size={20} className="text-red-500" />;
      default:
        return <Info size={20} className="text-blue-500" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/20 bg-white dark:bg-emerald-950/20 shadow-emerald-500/10';
      case 'warning':
        return 'border-amber-500/20 bg-white dark:bg-amber-950/20 shadow-amber-500/10';
      case 'error':
        return 'border-red-500/20 bg-white dark:bg-red-950/20 shadow-red-500/10';
      case 'low_stock':
        return 'border-red-500/20 bg-white dark:bg-red-950/20 shadow-red-500/10';
      default:
        return 'border-blue-500/20 bg-white dark:bg-blue-950/20 shadow-blue-500/10';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)', transition: { duration: 0.2 } }}
      className={cn(
        'pointer-events-auto flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl',
        getStyles(toast.type)
      )}
    >
      <div className="shrink-0 mt-0.5">{getIcon(toast.type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-neutral-100 leading-tight">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors text-neutral-400"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
