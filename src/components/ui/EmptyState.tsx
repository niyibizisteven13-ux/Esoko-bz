import React from 'react';
import { cn } from '../../lib/utils';

export default function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-neutral-200 bg-white p-10 text-center dark:border-white/10 dark:bg-white/5',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
        {icon}
      </div>
      <h3 className="text-base font-black text-neutral-900 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-sm text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {message}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
