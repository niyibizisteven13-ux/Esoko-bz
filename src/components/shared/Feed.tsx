// src/components/shared/Feed.tsx
//
// Mixed feed display showing recent, trending, and following posts.
// Supports infinite scroll, filtering, and engagement tracking.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Flame, TrendingUp, Users, Clock } from 'lucide-react';
import PostCard from './PostCard';
import PostCommentModal from './PostCommentModal';
import { MarketplacePost, getMixedFeed, getRecentPosts, getTrendingPosts, getFollowingPosts } from '../../services/postService';

type FeedFilter = 'mixed' | 'recent' | 'trending' | 'following';

type FeedProps = {
  variant?: 'compact' | 'expanded';
  initialFilter?: FeedFilter;
  showFilters?: boolean;
  onAuthorClick?: (authorId: string, authorType: string) => void;
  onPostCreated?: () => void;
};

const FILTER_OPTIONS: Array<{ id: FeedFilter; label: string; icon: React.ReactNode }> = [
  { id: 'mixed', label: 'For You', icon: <TrendingUp size={14} /> },
  { id: 'recent', label: 'Recent', icon: <Clock size={14} /> },
  { id: 'trending', label: 'Trending', icon: <Flame size={14} /> },
  { id: 'following', label: 'Following', icon: <Users size={14} /> },
];

export default function Feed({
  variant = 'expanded',
  initialFilter = 'mixed',
  showFilters = true,
  onAuthorClick,
  onPostCreated,
}: FeedProps) {
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState<MarketplacePost | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const handleCommentSaved = useCallback(
    (commentCount?: number) => {
      if (!selectedPost) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === selectedPost.id
            ? { ...post, commentCount: commentCount !== undefined ? commentCount : (post.commentCount || 0) + 1 }
            : post
        )
      );
    },
    [selectedPost]
  );

  const fetchPosts = useCallback(
    async (newOffset: number, isInitial: boolean) => {
      try {
        setError('');
        if (isInitial) setLoading(true);

        let data;
        const params = { limit: 20, offset: newOffset };

        switch (filter) {
          case 'recent':
            data = await getRecentPosts(params);
            break;
          case 'trending':
            data = await getTrendingPosts(params);
            break;
          case 'following':
            data = await getFollowingPosts(params);
            break;
          case 'mixed':
          default:
            data = await getMixedFeed(params);
        }

        const newPosts = data?.posts || [];
        if (isInitial) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }

        setHasMore(newPosts.length === 20);
        setOffset(newOffset + newPosts.length);
      } catch (err: any) {
        setError(err?.message || 'Failed to load feed');
        if (!posts.length) {
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [filter, posts.length]
  );

  // Initial load
  useEffect(() => {
    setOffset(0);
    setPosts([]);
    fetchPosts(0, true);
  }, [filter]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchPosts(offset, false);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, offset, fetchPosts]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mb-6 pb-4 border-b border-white/10 overflow-x-auto"
        >
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={
                'flex items-center gap-1.5 px-3 py-2 rounded-full border transition whitespace-nowrap ' +
                (filter === option.id
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10')
              }
            >
              {option.icon}
              <span className="text-xs font-bold uppercase tracking-widest">{option.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Loading state */}
      {loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Loader2 size={32} className="text-orange-400" />
          </motion.div>
          <p className="text-sm font-bold text-white/60">Loading posts...</p>
        </div>
      )}

      {/* Error state */}
      {error && posts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4"
        >
          <p className="text-sm font-bold text-red-300">{error}</p>
          <button
            onClick={() => fetchPosts(0, true)}
            className="mt-2 text-xs font-bold text-orange-400 hover:text-orange-300 uppercase tracking-widest"
          >
            Try again
          </button>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-20"
        >
          <div className="text-4xl">🌾</div>
          <p className="text-sm font-bold text-white/60">No posts yet</p>
          <p className="text-xs text-white/40">Check back soon for fresh posts</p>
        </motion.div>
      )}

      {/* Posts grid */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-4">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <PostCard
                post={post}
                variant={variant}
                onAuthorClick={onAuthorClick}
                onCommentClick={() => setSelectedPost(post)}
                onShareClick={() => {
                  console.log('Share post:', post.id);
                }}
                onReportClick={() => {
                  console.log('Report post:', post.id);
                }}
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Infinite scroll trigger */}
      {hasMore && posts.length > 0 && (
        <div ref={observerTarget} className="py-8 flex justify-center">
          {loading && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Loader2 size={24} className="text-orange-400" />
            </motion.div>
          )}
        </div>
      )}

      {/* End of feed */}
      {!hasMore && posts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">You've reached the end</p>
        </motion.div>
      )}
      <PostCommentModal
        open={Boolean(selectedPost)}
        postId={selectedPost?.id || null}
        postCaption={selectedPost?.caption}
        onClose={() => setSelectedPost(null)}
        onCommentSaved={handleCommentSaved}
      />
    </div>
  );
}
