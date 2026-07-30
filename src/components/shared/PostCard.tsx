// src/components/shared/PostCard.tsx
//
// Displays a marketplace post card with media carousel, author info, engagement,
// and PostStudio features (overlays, music, multiple media items, hashtags).

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Share2,
  Music2,
  Flag,
  MoreVertical,
  Bookmark,
  Verified,
} from 'lucide-react';
import { MarketplacePost, togglePostLike, togglePostFavorite, recordPostView } from '../../services/postService';

type PostCardProps = {
  post: MarketplacePost;
  onAuthorClick?: (authorId: string, authorType: string) => void;
  onCommentClick?: (postId: string) => void;
  onShareClick?: (postId: string) => void;
  onReportClick?: (postId: string) => void;
  variant?: 'compact' | 'expanded';
};

export default function PostCardComponent({
  post,
  onAuthorClick,
  onCommentClick,
  onShareClick,
  onReportClick,
  variant = 'expanded',
}: PostCardProps) {
  const isCompact = variant === 'compact';
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLiked, setIsLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isFavorited, setIsFavorited] = useState(post.favorited);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  const mediaItems = post.mediaItems || [{ type: post.mediaType as 'image' | 'video', url: post.mediaUrl }];

  // Record view once when component mounts
  useEffect(() => {
    if (!hasViewed && post.id) {
      recordPostView(post.id).catch(() => {
        // Silently fail - view tracking not critical
      });
      setHasViewed(true);
    }
  }, [post.id, hasViewed]);

  const handleLike = useCallback(async () => {
    try {
      setIsLiked(!isLiked);
      setLikeCount((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1));
      await togglePostLike(post.id);
    } catch (error) {
      // Revert on error
      setIsLiked(!isLiked);
      setLikeCount((prev) => (isLiked ? prev + 1 : Math.max(0, prev - 1)));
    }
  }, [isLiked, post.id]);

  const handleFavorite = useCallback(async () => {
    try {
      setIsFavorited(!isFavorited);
      await togglePostFavorite(post.id);
    } catch (error) {
      setIsFavorited(!isFavorited);
    }
  }, [isFavorited, post.id]);

  const handleNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % mediaItems.length);
  }, [mediaItems.length]);

  const handlePrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  }, [mediaItems.length]);

  const activeMedia = useMemo(() => mediaItems[activeSlide], [mediaItems, activeSlide]);
  const createdDate = useMemo(() => {
    return post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  }, [post.createdAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'w-full rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden shadow-lg',
        isCompact && 'max-w-[28rem] text-sm'
      )}
    >
      {/* Header: Author Info */}
      <div className={cn('flex items-center justify-between border-b border-white/5', isCompact ? 'px-3 py-2' : 'px-4 py-3')}>
        <button
          type="button"
          onClick={() => onAuthorClick?.(post.authorId, post.authorType)}
          className="flex items-center gap-3 flex-1 hover:opacity-80 transition"
        >
          {post.authorAvatar && (
            <img
              src={post.authorAvatar}
              alt={post.authorName}
              className="h-10 w-10 rounded-full object-cover border border-white/10"
            />
          )}
          <div className="text-left">
            <div className="flex items-center gap-1">
              <p className={cn('font-black text-white', isCompact ? 'text-[12px]' : 'text-sm')}>{post.authorName || post.traderName || 'Unknown'}</p>
              {post.qualityScore !== undefined && post.qualityScore > 4 && (
                <Verified size={12} className="text-blue-400" />
              )}
            </div>
            <p className="text-[11px] text-white/50 uppercase tracking-widest">
              {post.authorType === 'trader' ? 'Trader' : 'Customer'}
            </p>
          </div>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <MoreVertical size={16} className="text-white/60" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-lg z-10">
              <button
                type="button"
                onClick={() => {
                  onReportClick?.(post.id);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 hover:bg-white/5 w-full text-left"
              >
                <Flag size={12} /> Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Media Carousel */}
      <div
        className={cn(
          'relative bg-black overflow-hidden',
          isCompact ? 'aspect-[4/3]' : 'aspect-square'
        )}
      >
        {activeMedia.type === 'image' ? (
          <img src={activeMedia.url} alt="Post media" className="w-full h-full object-cover" />
        ) : (
          <video src={activeMedia.url} className="w-full h-full object-cover" loop muted autoPlay playsInline />
        )}

        {/* Overlays (text on media) */}
        {post.overlays && post.overlays.length > 0 && (
          <>
            {post.overlays
              .filter((overlay) => overlay.zone === 'top')
              .map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute left-3 top-4 right-3 flex justify-center pointer-events-none"
                >
                  <span
                    className={
                      'max-w-full truncate rounded-full px-3 py-1.5 text-[11px] font-black ' +
                      (overlay.tone === 'dark' ? 'bg-black/60 text-white' : 'text-white drop-shadow-lg')
                    }
                  >
                    {overlay.text}
                  </span>
                </div>
              ))}
            {post.overlays
              .filter((overlay) => overlay.zone === 'bottom')
              .map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute left-3 bottom-14 right-3 flex justify-center pointer-events-none"
                >
                  <span
                    className={
                      'max-w-full truncate rounded-full px-3 py-1.5 text-[11px] font-black ' +
                      (overlay.tone === 'dark' ? 'bg-black/60 text-white' : 'text-white drop-shadow-lg')
                    }
                  >
                    {overlay.text}
                  </span>
                </div>
              ))}
          </>
        )}

        {/* Slide indicators */}
        {mediaItems.length > 1 && (
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 gap-1 z-10">
            {mediaItems.map((_, index) => (
              <span
                key={index}
                className={
                  'h-1 w-5 rounded-full transition-colors ' + (index === activeSlide ? 'bg-orange-500' : 'bg-white/25')
                }
              />
            ))}
          </div>
        )}

        {/* Navigation */}
        {mediaItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white z-10 hover:bg-black/60"
              aria-label="Previous slide"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white z-10 hover:bg-black/60"
              aria-label="Next slide"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Music indicator */}
        {post.musicTrack && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 z-10">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="shrink-0 text-orange-400"
            >
              <Music2 size={12} />
            </motion.span>
            <span className="truncate text-[10px] font-black text-white">{post.musicTrack.title}</span>
          </div>
        )}
      </div>

      {/* Engagement buttons */}
      <div className={cn('flex items-center justify-between border-b border-white/5', isCompact ? 'px-3 py-2' : 'px-4 py-3')}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 rounded-lg hover:bg-white/10 transition group',
              isCompact ? 'px-2 py-1' : 'px-3 py-1.5'
            )}
          >
            <Heart
              size={16}
              className={`transition ${isLiked ? 'fill-red-500 text-red-500' : 'text-white/60 group-hover:text-white'}`}
            />
            <span className="text-xs font-bold text-white/70">{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onCommentClick?.(post.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg hover:bg-white/10 transition group',
              isCompact ? 'px-2 py-1' : 'px-3 py-1.5'
            )}
          >
            <MessageCircle size={16} className="text-white/60 group-hover:text-white transition" />
            <span className="text-xs font-bold text-white/70">{post.commentCount || 0}</span>
          </button>

          <button
            type="button"
            onClick={() => onShareClick?.(post.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg hover:bg-white/10 transition group',
              isCompact ? 'px-2 py-1' : 'px-3 py-1.5'
            )}
          >
            <Share2 size={16} className="text-white/60 group-hover:text-white transition" />
            <span className="text-xs font-bold text-white/70">{post.shareCount || 0}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleFavorite}
          className="p-1.5 rounded-lg hover:bg-white/10 transition"
        >
          <Bookmark
            size={16}
            className={`transition ${isFavorited ? 'fill-orange-500 text-orange-500' : 'text-white/60 hover:text-white'}`}
          />
        </button>
      </div>

      {/* Caption and details */}
      <div className={cn('space-y-2', isCompact ? 'px-3 py-2' : 'px-4 py-3')}>
        {post.caption && (
          <p className={cn('leading-relaxed text-white/90', isCompact ? 'text-[12px]' : 'text-sm')}>
            <span className="font-black text-white">{post.authorName || post.traderName}</span> {post.caption}
          </p>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-xs font-bold text-orange-400 hover:text-orange-300 cursor-pointer">
                {tag}
              </span>
            ))}
          </div>
        )}

        {(post.price || post.category) && variant === 'expanded' && (
          <div className="flex items-center gap-3 text-[11px] text-white/60 pt-2">
            {post.category && <span className="uppercase tracking-widest">{post.category}</span>}
            {post.price && (
              <>
                <span className="text-white/20">•</span>
                <span className="font-bold text-orange-400">RWF {post.price.toLocaleString()}</span>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] text-white/40 uppercase tracking-widest pt-1">{createdDate}</p>
      </div>
    </motion.div>
  );
}
