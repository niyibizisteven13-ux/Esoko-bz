import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ActionTone = 'default' | 'danger' | 'warning';

const buttonTone: Record<ActionTone, string> = {
  default: 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20',
};

export default function ActionModal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  disabled = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ActionTone;
  loading?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl dark:bg-[#111]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                    tone === 'danger'
                      ? 'bg-red-500/10 text-red-500'
                      : tone === 'warning'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-orange-500/10 text-orange-500'
                  )}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-neutral-900 dark:text-white">{title}</h2>
                  {description && (
                    <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {children && <div className="space-y-4">{children}</div>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-2xl border border-neutral-200 px-5 py-3 text-sm font-black text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading || disabled}
                className={cn(
                  'rounded-2xl px-5 py-3 text-sm font-black shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50',
                  buttonTone[tone]
                )}
              >
                {loading ? 'Working...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
