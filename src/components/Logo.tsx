import React from 'react';
import makasiLogo from '../../logo/makasi-logo.svg';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  dark?: boolean;
}

export default function Logo({ className, iconOnly, dark }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-10 h-10 overflow-hidden rounded-xl shadow-lg shadow-orange-200">
        <img src={makasiLogo} alt="Makasi logo" className="h-full w-full object-cover" />
      </div>
      {!iconOnly && (
        <span
          className={cn(
            'text-2xl font-black tracking-tighter',
            dark ? 'text-white' : 'text-neutral-900'
          )}
        >
          MAKASI
        </span>
      )}
    </div>
  );
}
