import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';
import NotificationsTab from '../components/NotificationsTab';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount } = useNotifications();

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-neutral-500 hover:text-orange-600 font-black text-[10px] uppercase tracking-widest mb-8 transition-all group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
      </button>

      <NotificationsTab notifications={notifications} title="Alert Center" />
    </div>
  );
}
