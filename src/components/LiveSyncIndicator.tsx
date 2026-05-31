import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2, CheckCircle } from 'lucide-react';
import { useRealTimeSync } from '../context/RealTimeSyncContext';
import { format } from 'date-fns';

interface LiveSyncIndicatorProps {
  showTime?: boolean;
  compact?: boolean;
  className?: string;
}

export const LiveSyncIndicator: React.FC<LiveSyncIndicatorProps> = ({
  showTime = true,
  compact = false,
  className = '',
}) => {
  const { syncState } = useRealTimeSync();

  const getStatusColor = () => {
    switch (syncState.connectionStatus) {
      case 'connected':
        return syncState.isSyncing ? 'text-orange-500' : 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'error':
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-neutral-400';
    }
  };

  const getStatusIcon = () => {
    if (syncState.isSyncing) {
      return <Loader2 className="w-3 h-3 animate-spin" />;
    }

    switch (syncState.connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-3 h-3" />;
      case 'connecting':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'error':
      case 'disconnected':
        return <WifiOff className="w-3 h-3" />;
      default:
        return <Wifi className="w-3 h-3" />;
    }
  };

  const getStatusText = () => {
    if (syncState.isSyncing) {
      return 'Syncing...';
    }

    switch (syncState.connectionStatus) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      case 'disconnected':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  if (compact) {
    return (
      <motion.div
        className={`flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 ${className}`}
        animate={syncState.isSyncing ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.5, repeat: syncState.isSyncing ? Infinity : 0 }}
      >
        <div className={getStatusColor()}>{getStatusIcon()}</div>
        {showTime && (
          <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
            {format(syncState.lastSyncTime, 'HH:mm')}
          </span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 ${className}`}
      animate={syncState.isSyncing ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.8, repeat: syncState.isSyncing ? Infinity : 0 }}
    >
      <motion.div
        className={getStatusColor()}
        animate={
          syncState.isSyncing
            ? {
                rotate: [0, 360],
                scale: [1, 1.1, 1],
              }
            : {}
        }
        transition={{
          rotate: { duration: 2, repeat: syncState.isSyncing ? Infinity : 0, ease: 'linear' },
          scale: { duration: 0.5, repeat: syncState.isSyncing ? Infinity : 0 },
        }}
      >
        {getStatusIcon()}
      </motion.div>

      <div className="flex flex-col">
        <span className={`text-xs font-semibold ${getStatusColor()}`}>{getStatusText()}</span>
        {showTime && (
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {format(syncState.lastSyncTime, 'MMM dd, HH:mm')}
          </span>
        )}
      </div>

      {syncState.isSyncing && (
        <motion.div
          className="absolute inset-0 bg-orange-500/10 rounded-lg"
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};
