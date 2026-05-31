import React, { useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  Info,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Filter,
  Layers,
  MailOpen,
  MoreVertical,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toDate, cn } from '../lib/utils';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { useNotifications } from '../context/NotificationContext';

interface NotificationsTabProps {
  notifications: any[];
  title?: string;
  dark?: boolean;
}

type FilterType = 'all' | 'transaction' | 'system' | 'promo';

export default function NotificationsTab({
  notifications,
  title = 'Notifications',
  dark = false,
}: NotificationsTabProps) {
  const { markAsRead, markAllAsRead, deleteNotification, clearNotifications } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredNotifications = notifications.filter((n) =>
    filter === 'all' ? true : n.subType === filter
  );

  const groupNotifications = (notifs: any[]) => {
    const groups: { [key: string]: any[] } = {
      Today: [],
      Yesterday: [],
      Older: [],
    };

    notifs.forEach((n) => {
      const date = toDate(n.timestamp);
      if (isToday(date)) {
        groups.Today.push(n);
      } else if (isYesterday(date)) {
        groups.Yesterday.push(n);
      } else {
        groups.Older.push(n);
      }
    });

    return groups;
  };

  const notificationGroups = groupNotifications(filteredNotifications);

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (
      !window.confirm(
        'Are you sure you want to clear all notifications? This action cannot be undone.'
      )
    )
      return;
    await clearNotifications();
  };

  const getIcon = (type: string, subType: string) => {
    if (subType === 'transaction') return <Layers size={18} className="text-orange-500" />;
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'warning':
        return <AlertCircle size={18} className="text-amber-500" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-500" />;
      default:
        return <Info size={18} className="text-blue-500" />;
    }
  };

  const getSubTypeLabel = (subType: string) => {
    switch (subType) {
      case 'transaction':
        return 'Payment';
      case 'promo':
        return 'Offer';
      case 'system':
        return 'System';
      default:
        return 'Alert';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="p-3 rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/20">
              <Bell className="text-white" size={24} />
            </div>
            <h1
              className={cn(
                'text-4xl font-black tracking-tighter uppercase',
                dark ? 'text-white' : 'text-neutral-900'
              )}
            >
              {title}
            </h1>
          </motion.div>
          <p
            className={cn(
              'text-lg font-medium max-w-xl',
              dark ? 'text-neutral-400' : 'text-neutral-500'
            )}
          >
            Stay informed with real-time updates on your transactions, account security, and
            exclusive merchant offers.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={markAllAsRead}
            disabled={!notifications.some((n) => !n.read)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
              dark
                ? 'bg-white/5 text-white hover:bg-white/10 disabled:opacity-30'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-50'
            )}
          >
            <MailOpen size={16} /> Mark All Read
          </button>
          <button
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm',
              dark
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-30 border border-red-500/20'
                : 'bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 border border-red-100'
            )}
          >
            <Trash2 size={16} /> Clear Feed
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
        <Filter
          size={16}
          className={cn('mr-2 shrink-0', dark ? 'text-neutral-500' : 'text-neutral-400')}
        />
        {(['all', 'transaction', 'system', 'promo'] as FilterType[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              'px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all shrink-0 whitespace-nowrap',
              filter === t
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : dark
                  ? 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            )}
          >
            {t === 'all' ? 'All Alerts' : t + 's'}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-12">
        <AnimatePresence mode="popLayout" initial={false}>
          {Object.entries(notificationGroups).some(([_, group]) => group.length > 0) ? (
            Object.entries(notificationGroups).map(
              ([groupName, group]) =>
                group.length > 0 && (
                  <motion.div
                    key={groupName}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    layout
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase tracking-[0.3em]',
                          dark ? 'text-neutral-500' : 'text-neutral-400'
                        )}
                      >
                        {groupName}
                      </span>
                      <div
                        className={cn('h-[1px] flex-1', dark ? 'bg-white/5' : 'bg-neutral-100')}
                      ></div>
                    </div>

                    <div className="grid gap-4">
                      {group.map((n, idx) => (
                        <motion.div
                          key={n.id}
                          layout
                          variants={itemVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                          className={cn(
                            'group relative p-6 rounded-[2rem] border transition-all duration-500',
                            dark
                              ? n.read
                                ? 'bg-white/5 border-white/5 opacity-60'
                                : 'bg-white/10 border-orange-500/20 shadow-xl shadow-black/20'
                              : n.read
                                ? 'bg-white border-neutral-100/50 opacity-80'
                                : 'bg-white border-orange-100 shadow-sm shadow-orange-500/5'
                          )}
                        >
                          {!n.read && (
                            <div className="absolute top-6 left-6 w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
                          )}

                          <div className="flex items-start gap-6">
                            <div
                              className={cn(
                                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden',
                                dark ? 'bg-black/20' : 'bg-neutral-50'
                              )}
                            >
                              <div className="transform group-hover:scale-110 transition-transform duration-300">
                                {getIcon(n.type, n.subType)}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                  <span
                                    className={cn(
                                      'text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md',
                                      dark
                                        ? 'bg-white/5 text-neutral-400'
                                        : 'bg-neutral-100 text-neutral-500'
                                    )}
                                  >
                                    {getSubTypeLabel(n.subType)}
                                  </span>
                                  <h3
                                    className={cn(
                                      'text-lg leading-snug tracking-tight',
                                      dark
                                        ? n.read
                                          ? 'text-neutral-300 font-medium'
                                          : 'text-white font-bold'
                                        : n.read
                                          ? 'text-neutral-600 font-medium'
                                          : 'text-neutral-900 font-bold'
                                    )}
                                  >
                                    {n.message}
                                  </h3>
                                </div>

                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  {!n.read && (
                                    <button
                                      onClick={() => markAsRead(n.id)}
                                      className={cn(
                                        'p-2 rounded-xl transition-colors hover:scale-110 active:scale-95',
                                        dark
                                          ? 'text-emerald-400 hover:bg-emerald-500/10'
                                          : 'text-emerald-600 hover:bg-emerald-50'
                                      )}
                                    >
                                      <Check size={20} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteNotification(n.id)}
                                    className={cn(
                                      'p-2 rounded-xl transition-colors hover:scale-110 active:scale-95',
                                      dark
                                        ? 'text-red-400 hover:bg-red-500/10'
                                        : 'text-red-600 hover:bg-red-50'
                                    )}
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 mt-4 text-[10px] font-bold tracking-widest lowercase opacity-40">
                                <div className="flex items-center gap-1">
                                  <Clock size={12} strokeWidth={3} />
                                  {format(toDate(n.timestamp), 'HH:mm')}
                                </div>
                                <span>â€¢</span>
                                <span>{format(toDate(n.timestamp), 'MMM dd, yyyy')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Hover effect background decoration */}
                          <div
                            className={cn(
                              'absolute -right-10 -bottom-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-3xl pointer-events-none',
                              n.type === 'success'
                                ? 'bg-emerald-500'
                                : n.type === 'error'
                                  ? 'bg-red-500'
                                  : 'bg-orange-500'
                            )}
                          ></div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )
            )
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'py-32 text-center rounded-[3rem] border border-dashed',
                dark ? 'bg-white/5 border-white/10' : 'bg-neutral-50 border-neutral-200'
              )}
            >
              <div
                className={cn(
                  'w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner overflow-hidden',
                  dark ? 'bg-white/5' : 'bg-white'
                )}
              >
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Bell size={44} className="text-neutral-300 opacity-50" />
                </motion.div>
              </div>
              <h2
                className={cn(
                  'text-3xl font-black uppercase tracking-tighter mb-3',
                  dark ? 'text-white' : 'text-neutral-900'
                )}
              >
                Zero Active Alerts
              </h2>
              <p
                className={cn(
                  'text-lg font-medium tracking-tight',
                  dark ? 'text-neutral-500' : 'text-neutral-500'
                )}
              >
                {filter === 'all'
                  ? 'Your feed is perfectly clear. Take this moment to relax.'
                  : `No ${getSubTypeLabel(filter).toLowerCase()} alerts matching your current filter.`}
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-6 text-orange-500 font-bold uppercase text-[10px] tracking-widest hover:underline"
                >
                  Clear filter
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
