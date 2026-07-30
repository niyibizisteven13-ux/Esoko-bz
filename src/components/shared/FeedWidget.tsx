// src/components/shared/FeedWidget.tsx
//
// Compact feed widget for embedding in dashboards (trader/customer).
// Shows recent posts with a link to view full feed.

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Flame, ArrowRight } from 'lucide-react';
import PostCard from './PostCard';
import PostCommentModal from './PostCommentModal';
import { MarketplacePost, getRecentPosts } from '../../services/postService';

type FeedWidgetProps = {
  maxPosts?: number;
  onPostCreated?: () => void;
};

export default function FeedWidget({ maxPosts = 3, onPostCreated }: FeedWidgetProps) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState<MarketplacePost | null>(null);

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

  useEffect(() => {
    const loadPosts = async () => {
      try {
        setLoading(true);
        const data = await getRecentPosts({ limit: maxPosts, offset: 0 });
        setPosts(data?.posts || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [maxPosts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Loader2 size={20} className="text-orange-400" />
        </motion.div>
        <p className="text-sm font-bold text-white/60">Loading posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4"
      >
        <p className="text-sm font-bold text-red-300">{error}</p>
      </motion.div>
    );
  }

  if (posts.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
        <p className="text-sm font-bold text-white/60">No posts yet</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-black text-white">
          <Flame size={16} className="text-orange-400" />
          Marketplace pulse
        </h3>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <PostCard
              post={post}
              variant="compact"
              onCommentClick={() => setSelectedPost(post)}
              onShareClick={() => {
                console.log('Share post:', post.id);
              }}
            />
          </motion.div>
        ))}
      </div>
      <PostCommentModal
        open={Boolean(selectedPost)}
        postId={selectedPost?.id || null}
        postCaption={selectedPost?.caption}
        onClose={() => setSelectedPost(null)}
        onCommentSaved={handleCommentSaved}
      />

      {posts.length > 0 && (
        <button
          onClick={() => navigate('/feed')}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-400 hover:bg-orange-500/20 transition"
        >
          View all posts <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
