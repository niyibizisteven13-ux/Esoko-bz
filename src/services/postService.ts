import { apiGet, apiPost, authHeaders } from './apiClient';

export interface MarketplacePost {
  id: string;
  traderId: string;
  productId?: string | null;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  caption?: string;
  price?: number;
  stock?: number;
  category?: string;
  likeCount?: number;
  followCount?: number;
  viewCount?: number;
  liked?: boolean;
  favorited?: boolean;
  following?: boolean;
  qualityScore?: number;
  totalSales?: number;
  traderName?: string;
  traderBusinessName?: string;
  createdAt?: string;
}

export async function getMarketplacePosts(params?: { limit?: number; offset?: number }) {
  return apiGet<{ posts: MarketplacePost[] }>('/api/marketplace/posts', {
    params,
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
