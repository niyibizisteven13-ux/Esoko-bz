import React from 'react';
import { Package } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  dark?: boolean;
}

export default function Logo({ className, iconOnly, dark }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
        <Package className="text-white" size={24} />
      </div>
      {!iconOnly && (
        <span
          className={cn(
            'text-2xl font-black tracking-tighter',
            dark ? 'text-white' : 'text-neutral-900'
          )}
        >
          ESOKO
        </span>
      )}
    </div>
  );
}
