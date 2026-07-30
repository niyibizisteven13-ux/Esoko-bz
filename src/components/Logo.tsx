import React from 'react';
import { cn } from '../lib/utils';

// Use public path for logo to ensure it loads correctly in all environments
const bwengeLogo = '/bwenge-logo.svg';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  dark?: boolean;
}

export default function Logo({ className, iconOnly, dark }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-10 h-10 overflow-hidden rounded-xl shadow-lg shadow-orange-200">
        <img 
          src={bwengeLogo}
          alt="Bwenge logo"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      {!iconOnly && (
        <span
          className={cn(
            'text-2xl font-black tracking-tighter',
            dark ? 'text-white' : 'text-neutral-900'
          )}
        >
          BWENGE
        </span>
      )}
    </div>
  );
}
