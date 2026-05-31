import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rwfFormatter = new Intl.NumberFormat('en-RW', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number | string) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return rwfFormatter.format(num);
}

export function formatCurrencyInput(value: string) {
  if (!value) return '';
  const numericValue = value.replace(/[^0-9.]/g, '');
  const parts = numericValue.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 2) return parts[0] + '.' + parts[1];
  return parts.join('.');
}

export function parseCurrencyInput(value: string) {
  return value.replace(/,/g, '');
}

export function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

export function toMillis(timestamp: any): number {
  if (!timestamp) return Date.now();
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp.seconds !== undefined) return timestamp.seconds * 1000;
  return new Date(timestamp).getTime();
}

const getSendFeeRate = (amount: number): number => {
  if (amount <= 5000) return 0.015;
  if (amount <= 20000) return 0.013;
  if (amount <= 100000) return 0.012;
  return 0.01;
};

const getWithdrawalFeeRate = (amount: number): number => {
  return getSendFeeRate(amount) + 0.002; // 0.2% additional withdrawal fee
};

export function calculateFees(amount: number, operationType: 'send' | 'withdrawal' = 'send') {
  const cleanedAmount = Math.max(0, amount);
  const feeRate =
    operationType === 'withdrawal'
      ? getWithdrawalFeeRate(cleanedAmount)
      : getSendFeeRate(cleanedAmount);
  const totalFee = Math.round(cleanedAmount * feeRate);
  const cashback = Math.floor(cleanedAmount * 0.001); // 0.1% cashback in points for send operations
  const pointsEarned = Math.floor(cleanedAmount / 100); // 1 point per 100 RWF

  return {
    totalFee,
    cashback: operationType === 'send' ? cashback : 0,
    pointsEarned,
  };
}

// Phase 2: Trust & Authenticity Helpers
export function getTimeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!dateObj) return 'unknown';

  const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getAccountAge(createdAt: Date | string | undefined): string {
  if (!createdAt) return 'unknown';

  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;

  return `${Math.floor(days / 365)} years`;
}
