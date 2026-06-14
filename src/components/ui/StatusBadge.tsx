import React from 'react';
import { cn } from '../../lib/utils';

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<StatusTone, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
  danger: 'border-red-500/20 bg-red-500/10 text-red-500',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
  neutral: 'border-neutral-500/20 bg-neutral-500/10 text-neutral-500',
};

export default function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
