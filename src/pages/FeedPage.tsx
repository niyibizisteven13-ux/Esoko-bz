// src/pages/FeedPage.tsx
//
// Dedicated feed page for browsing marketplace posts from traders and customers.
// Accessible from both trader and customer dashboards.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import Feed from '../components/shared/Feed';
import { auth } from '../firebase';

export default function FeedPage() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#0a0a0a] text-white"
    >
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/70 hover:text-white transition"
            aria-label="Go back"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-bold">Back</span>
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 font-black text-lg">Marketplace Feed</h1>
          <div className="w-12" />
        </div>
      </div>

      {/* Feed content */}
      <main className="p-4 md:p-6">
        <Feed
          variant="expanded"
          initialFilter="mixed"
          showFilters={true}
          onAuthorClick={(authorId, authorType) => {
            // TODO: Navigate to trader or customer profile
            console.log('Navigate to', authorType, 'profile:', authorId);
          }}
          onPostCreated={() => {
            // Refresh the feed if user creates a post from another tab
            console.log('Post created, consider refreshing feed');
          }}
        />
      </main>
    </motion.div>
  );
}
