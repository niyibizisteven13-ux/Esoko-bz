import { apiGet, apiPost, authHeaders } from './apiClient';
import { TextOverlay, MusicTrack } from '../lib/postStudio';

export interface MarketplacePost {
  id: string;
  traderId: string;
  authorId: string;
  authorType: 'trader' | 'customer';
  productId?: string | null;
  purchaseId?: string | null;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  mediaItems?: Array<{ type: 'image' | 'video'; url: string }>;
  overlays?: TextOverlay[];
  musicTrack?: MusicTrack;
  audioUrl?: string;
  caption?: string;
  hashtags?: string[];
  price?: number;
  stock?: number;
  category?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  liked?: boolean;
  favorited?: boolean;
  following?: boolean;
  qualityScore?: number;
  totalSales?: number;
  traderName?: string;
  traderBusinessName?: string;
  authorName?: string;
  authorAvatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketplaceComment {
  id: string;
  postId: string;
  commenterId: string;
  commenterName?: string;
  commenterAvatar?: string;
  content: string;
  createdAt?: string;
}

export async function getMarketplacePosts(params?: { limit?: number; offset?: number }) {
  return apiGet<{ posts: MarketplacePost[] }>('/api/marketplace/posts', {
    params,
    headers: authHeaders(),
  });
}

/** Get recent posts (latest first) */
export async function getRecentPosts(params?: { limit?: number; offset?: number }) {
  return apiGet<{ posts: MarketplacePost[] }>('/api/marketplace/posts/feed/recent', {
    params: { limit: 20, offset: 0, ...params },
    headers: authHeaders(),
  });
}

/** Get trending posts (most engaged) */
export async function getTrendingPosts(params?: { limit?: number; offset?: number }) {
  return apiGet<{ posts: MarketplacePost[] }>('/api/marketplace/posts/feed/trending', {
    params: { limit: 20, offset: 0, ...params },
    headers: authHeaders(),
  });
}

/** Get posts from traders/customers you follow */
export async function getFollowingPosts(params?: { limit?: number; offset?: number }) {
  return apiGet<{ posts: MarketplacePost[] }>('/api/marketplace/posts/feed/following', {
    params: { limit: 20, offset: 0, ...params },
    headers: authHeaders(),
  });
}

/** Get mixed feed: combination of recent, trending, and following */
export async function getMixedFeed(params?: { limit?: number; offset?: number }) {
  return apiGet<{ posts: MarketplacePost[] }>('/api/marketplace/posts/feed/mixed', {
    params: { limit: 20, offset: 0, ...params },
    headers: authHeaders(),
  });
}

export async function togglePostLike(postId: string) {
  return apiPost<{ liked: boolean; likeCount: number }>(`/api/marketplace/posts/${postId}/like`, {}, { headers: authHeaders() });
}

export async function toggleTraderFollow(traderId: string, sourcePostId?: string) {
  return apiPost<{ following: boolean }>(`/api/marketplace/traders/${traderId}/follow`, { sourcePostId }, { headers: authHeaders() });
}

export async function togglePostFavorite(postId: string) {
  return apiPost<{ favorited: boolean }>(`/api/marketplace/posts/${postId}/favorite`, {}, { headers: authHeaders() });
}

export async function recordPostView(postId: string) {
  return apiPost(`/api/marketplace/posts/${postId}/view`, {}, { headers: authHeaders() });
}

export async function reportMarketplacePost(postId: string, reason: string) {
  return apiPost(`/api/marketplace/posts/${postId}/report`, { reason }, { headers: authHeaders() });
}

export async function getPostComments(postId: string, params?: { limit?: number; offset?: number }) {
  return apiGet<{ comments: MarketplaceComment[] }>(`/api/marketplace/posts/${postId}/comments`, {
    params,
    headers: authHeaders(),
  });
}

export async function createPostComment(postId: string, content: string) {
  return apiPost<{ comment: MarketplaceComment; commentCount: number }>(
    `/api/marketplace/posts/${postId}/comments`,
    { content },
    { headers: authHeaders() }
  );
}

export async function createMarketplacePost(payload: Partial<MarketplacePost>) {
  return apiPost<{ post: MarketplacePost }>('/api/marketplace/posts', payload, { headers: authHeaders() });
}

export async function getTraderStats(traderId: string) {
  return apiGet<{ stats: { traderId: string; qualityScore: number; ratingCount: number; totalSales: number } }>(
    `/api/traders/${traderId}/stats`
  );
}

export async function getTraderRewards(traderId: string) {
  return apiGet<{
    summary: { conversionCount: number; earned: number; rewardBalance: number };
    rewards: Array<{ id: string; amount: number; status: 'pending' | 'paid'; followerName?: string; createdAt: string }>;
  }>(`/api/traders/${traderId}/rewards`, { headers: authHeaders() });
}

export async function getTransactionRating(transactionId: string) {
  return apiGet<{ rating: any | null }>('/api/ratings', {
    params: { transactionId },
    headers: authHeaders(),
  });
}

export async function submitTransactionRating(payload: {
  transactionId: string;
  stars: number;
  tags?: string[];
  comment?: string;
}) {
  return apiPost('/api/ratings', payload, { headers: authHeaders() });
}
