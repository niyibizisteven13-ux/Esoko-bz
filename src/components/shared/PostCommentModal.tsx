import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { createPostComment, getPostComments, MarketplaceComment } from '../../services/postService';

type PostCommentModalProps = {
  open: boolean;
  postId: string | null;
  postCaption?: string;
  onClose: () => void;
  onCommentSaved?: () => void;
};

export default function PostCommentModal({
  open,
  postId,
  postCaption,
  onClose,
  onCommentSaved,
}: PostCommentModalProps) {
  const [comments, setComments] = useState<MarketplaceComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError('');

    try {
      const response = await getPostComments(postId, { limit: 50, offset: 0 });
      setComments(response.comments || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load comments');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (open) {
      loadComments();
    } else {
      setComments([]);
      setCommentText('');
      setError('');
    }
  }, [open, loadComments]);

  const handleSubmit = async () => {
    if (!postId || !commentText.trim()) return;
    setSaving(true);
    setError('');

    try {
      await createPostComment(postId, commentText.trim());
      setCommentText('');
      await loadComments();
      onCommentSaved?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit comment');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="relative w-full max-w-2xl max-h-[calc(100vh-80px)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] shadow-2xl"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-orange-400">
                    <MessageCircle size={16} />
                    Comments
                  </div>
                  <p className="text-sm text-white/80">Public comment thread for this marketplace post.</p>
                  {postCaption && (
                    <p className="text-xs text-white/50 line-clamp-2">{postCaption}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70 hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="flex min-h-[220px] items-center justify-center text-white/60">
                    Loading comments...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {error && (
                      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                        {error}
                      </div>
                    )}

                    {comments.length === 0 && !error ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                        No comments yet. Start the conversation.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <div key={comment.id} className="rounded-3xl border border-white/10 bg-[#0f0f0f] p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white/80">
                                {comment.commenterAvatar ? (
                                  <img
                                    src={comment.commenterAvatar}
                                    alt={comment.commenterName}
                                    className="h-10 w-10 rounded-2xl object-cover"
                                  />
                                ) : (
                                  comment.commenterName?.slice(0, 2).toUpperCase() || '??'
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-black text-white">{comment.commenterName || 'Anonymous'}</p>
                                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                                    {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-white/80 whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[#0f0f0f] p-5">
                <div className="flex flex-col gap-3">
                  <textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={4}
                    placeholder="Write a public comment..."
                    className="min-h-[120px] w-full resize-none rounded-3xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/25"
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving || !commentText.trim()}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-3xl px-5 py-3 text-sm font-black uppercase tracking-[0.2em] transition',
                      saving || !commentText.trim()
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-orange-500 text-white hover:bg-orange-400'
                    )}
                  >
                    <Send size={16} />
                    {saving ? 'Posting...' : 'Post comment'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
