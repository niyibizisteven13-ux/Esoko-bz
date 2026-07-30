import React from 'react';
import { ShieldCheck, Star, Crown, Check, Award, Truck } from 'lucide-react';
import { cn } from '../lib/utils';

export type VerifiedBadgeLevel =
  | 'basic'
  | 'verified'
  | 'premium'
  | 'enterprise'
  | 'family'
  | 'organization'
  | 'trader'
  | 'delivery'
  | 'customer-individual'
  | 'customer-organization'
  | 'customer-business';

interface VerifiedBadgeProps {
  level: VerifiedBadgeLevel;
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  showLabel?: boolean;
  className?: string;
  animated?: boolean;
}

const VerifiedBadgeComponent: React.FC<VerifiedBadgeProps> = ({
  level,
  size = 'md',
  showLabel = true,
  className = '',
  animated = false,
}) => {
  const getBadgeConfig = () => {
    switch (level) {
      case 'customer-individual':
        return {
          label: 'Individual',
          fill: '#6D28D9',
          glow: 'rgba(124, 58, 237, 0.3)',
        };
      case 'customer-organization':
        return {
          label: 'Organization',
          fill: '#0F766E',
          glow: 'rgba(16, 185, 129, 0.3)',
        };
      case 'customer-business':
        return {
          label: 'Business',
          fill: '#047857',
          glow: 'rgba(34, 197, 94, 0.3)',
        };
      case 'family':
        return {
          label: 'Family Verified',
          fill: '#0E7490',
          glow: 'rgba(14, 165, 233, 0.35)',
        };
      case 'organization':
        return {
          label: 'Organization',
          fill: '#0B7285',
          glow: 'rgba(20, 184, 166, 0.35)',
        };
      case 'trader':
        return {
          label: 'Trader',
          fill: '#0B3A99',
          glow: 'rgba(59, 130, 246, 0.35)',
        };
      case 'delivery':
        return {
          label: 'Delivery Partner',
          fill: '#115E59',
          glow: 'rgba(16, 185, 129, 0.35)',
        };
      case 'basic':
      case 'verified':
      case 'premium':
      case 'enterprise':
      default:
        return {
          label:
            level === 'verified'
              ? 'Verified Trader'
              : level === 'premium'
                ? 'Premium'
                : level === 'enterprise'
                  ? 'Enterprise'
                  : 'Verified',
          fill: 'url(#verifiedBadgeGradient)',
          glow: 'rgba(59, 130, 246, 0.35)',
        };
    }
  };

  const config = getBadgeConfig();

  const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
    xs: 16,
    sm: 18,
    md: 20,
    lg: 24,
  };

  const badgeSize = typeof size === 'number' ? size : sizeMap[size];
  const labelSizeClasses: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
    xs: 'text-[10px]',
    sm: 'text-[11px]',
    md: 'text-[12px]',
    lg: 'text-sm',
  };

  const spacingClass = showLabel ? 'gap-2' : 'gap-0';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        spacingClass,
        className
      )}
      style={{
        width: showLabel ? 'auto' : badgeSize,
        minWidth: badgeSize,
        height: badgeSize,
        borderColor: '#1E40AF',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: badgeSize, height: badgeSize }}
      >
        <svg
          width={badgeSize}
          height={badgeSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="verifiedBadgeGradient" x1="0" y1="0" x2="100" y2="100">
              <stop offset="0%" stopColor="#0A3B85" />
              <stop offset="100%" stopColor="#0C55B6" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill={config.fill} />
          <circle cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <path
            d="M30 50 L44 64 L70 34"
            stroke="white"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showLabel && (
        <span
          className={cn(
            'leading-none text-white uppercase tracking-[0.08em]',
            labelSizeClasses[typeof size === 'number' ? 'md' : size]
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
};

export const VerifiedBadge = React.memo(VerifiedBadgeComponent);
interface ProfileImageProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  verified?: boolean;
  verificationLevel?:
    | 'basic'
    | 'verified'
    | 'premium'
    | 'enterprise'
    | 'family'
    | 'organization'
    | 'trader'
    | 'delivery';
  fallbackIcon?: React.ReactNode;
  className?: string;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export const ProfileImage: React.FC<ProfileImageProps> = ({
  src,
  alt,
  size = 'md',
  verified = false,
  verificationLevel = 'basic',
  fallbackIcon,
  className = '',
  showOnlineStatus = false,
  isOnline = false,
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const onlineIndicatorSize = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={cn(
          'rounded-full overflow-hidden border-2 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center',
          sizeClasses[size],
          verified ? 'border-green-500' : 'border-neutral-300 dark:border-neutral-600'
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent && fallbackIcon) {
                parent.innerHTML = '';
                parent.appendChild(fallbackIcon as any);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            {fallbackIcon || <Award className="w-1/2 h-1/2" />}
          </div>
        )}
      </div>

      {/* Verification Badge */}
      {verified && (
        <div className="absolute -bottom-1 -right-1">
          <VerifiedBadge level={verificationLevel} size="sm" showLabel={false} />
        </div>
      )}

      {/* Online Status Indicator */}
      {showOnlineStatus && (
        <div
          className={cn(
            'absolute -top-0.5 -right-0.5 rounded-full border-2 border-white dark:border-neutral-900',
            onlineIndicatorSize[size],
            isOnline ? 'bg-green-500' : 'bg-neutral-400'
          )}
        />
      )}
    </div>
  );
};
