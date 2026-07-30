# Feed Integration Guide

## Overview
A complete feed system has been created for the esoko-nexus marketplace. Posts can now be displayed with support for:
- Multiple media items (images/videos with carousel)
- Text overlays on media
- Soundtrack/music tags
- Hashtags
- Author information and engagement metrics (likes, comments, shares)
- Mixed feed (recent, trending, following)

## New Components

### 1. PostCard Component
**File:** `src/components/shared/PostCard.tsx`
- Displays individual marketplace posts
- Shows media carousel, overlays, music indicators
- Engagement buttons (like, comment, share, bookmark)
- Author info with verification badge
- Caption and hashtags

**Usage:**
```tsx
import PostCard from '../components/shared/PostCard';

<PostCard
  post={marketplacePost}
  variant="expanded" // or "compact"
  onAuthorClick={(authorId, authorType) => navigate(`/profile/${authorId}`)}
  onCommentClick={(postId) => openCommentModal(postId)}
  onShareClick={(postId) => openShareModal(postId)}
  onReportClick={(postId) => openReportModal(postId)}
/>
```

### 2. Feed Component
**File:** `src/components/shared/Feed.tsx`
- Full-featured feed with infinite scroll
- Filter options: Mixed (For You), Recent, Trending, Following
- Engagement tracking and view recording
- Loading and error states

**Usage:**
```tsx
import Feed from '../components/shared/Feed';

<Feed
  variant="expanded" // or "compact"
  initialFilter="mixed" // or "recent", "trending", "following"
  showFilters={true}
  onAuthorClick={(authorId, authorType) => {...}}
  onPostCreated={() => {...}}
/>
```

### 3. FeedWidget Component
**File:** `src/components/shared/FeedWidget.tsx`
- Compact feed widget for embedding in dashboards
- Shows recent posts with link to full feed
- Perfect for trader/customer dashboard sidebars

**Usage:**
```tsx
import FeedWidget from '../components/shared/FeedWidget';

<FeedWidget maxPosts={3} onPostCreated={() => {...}} />
```

### 4. FeedPage
**File:** `src/pages/FeedPage.tsx`
- Dedicated standalone feed page
- Full-screen feed with back navigation
- Can be accessed from `/feed` route

## Updated Services

### postService.ts
Enhanced with new fields and functions:

**New MarketplacePost fields:**
- `authorId`, `authorType` - Distinguishes trader vs customer posts
- `purchaseId` - For customer purchase posts
- `mediaItems` - Multiple media for carousel
- `overlays` - Text overlays on media
- `musicTrack` - Vibe/mood tagging
- `audioUrl` - Custom audio upload
- `hashtags` - Array of hashtags
- `authorName`, `authorAvatar` - For display
- `commentCount`, `shareCount` - Engagement metrics

**New feed functions:**
- `getRecentPosts(params)` - Latest posts first
- `getTrendingPosts(params)` - Most engaged posts
- `getFollowingPosts(params)` - Posts from followed users
- `getMixedFeed(params)` - Blended algorithm feed

## Integration Steps

### Step 1: Add route to FeedPage
In your router/App.tsx:

```tsx
import FeedPage from '../pages/FeedPage';

// Add to routes
{
  path: '/feed',
  element: <FeedPage />,
}
```

### Step 2: Add Feed to Trader Dashboard
In `src/components/trader/TraderOverview.tsx`:

```tsx
import Feed from '../shared/Feed';

// Inside TraderOverview component JSX:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Existing content */}
  
  {/* New Feed section */}
  <div className="lg:col-span-2">
    <Feed
      variant="expanded"
      initialFilter="mixed"
      onAuthorClick={(authorId, authorType) => {
        // Navigate to profile
      }}
    />
  </div>
</div>
```

### Step 3: Add Feed Widget to Trader Dashboard
In `src/components/trader/TraderOverview.tsx` or `TraderAnalytics.tsx`:

```tsx
import FeedWidget from '../shared/FeedWidget';

// Inside the dashboard JSX:
<section className="space-y-4">
  <h2 className="font-black text-white">Marketplace Activity</h2>
  <FeedWidget maxPosts={3} />
</section>
```

### Step 4: Add Feed to Customer Marketplace
In `src/components/customer/Marketplace.tsx`:

```tsx
import Feed from '../shared/Feed';

// Inside Marketplace component, add a tab or section:
{activeTab === 'feed' && (
  <Feed
    variant="expanded"
    initialFilter="mixed"
    onAuthorClick={navigateToTraderProfile}
  />
)}

// Or use FeedWidget for a compact view:
<FeedWidget maxPosts={3} />
```

### Step 5: Add Navigation Link
Add a link to `/feed` in your main navigation:

```tsx
<Link to="/feed" className="...">
  <Flame size={16} /> Feed
</Link>
```

## Post Creation Flow

Users can create posts using `PostStudioModal` which now integrates with the feed:

```tsx
import PostStudioModal from '../components/shared/PostStudioModal';

// When user clicks "Create Post" or "Share Purchase":
<PostStudioModal
  variant="trader" // or "customer"
  authorId={currentUserId}
  items={productsOrPurchases}
  defaultTraderId={currentTraderIdIfApplicable}
  onClose={() => setShowStudio(false)}
  onCreated={() => {
    setShowStudio(false);
    refreshFeed(); // Reload the feed
  }}
/>
```

## Database Schema Addition

The backend needs to support the new post fields. Update your post handler to accept:

```typescript
interface CreateMarketplacePostInput {
  traderId: string;
  authorId: string;
  authorType: 'trader' | 'customer';
  productId?: string;
  purchaseId?: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaItems?: Array<{ type: 'image' | 'video'; url: string }>;
  overlays?: TextOverlay[];
  musicTrack?: MusicTrack;
  audioUrl?: string;
  caption: string;
  hashtags: string[];
  price?: number;
  stock?: number;
  category?: string;
}
```

## API Endpoints Required

The backend should implement these endpoints:

- `GET /api/marketplace/posts/feed/recent` - Recent posts
- `GET /api/marketplace/posts/feed/trending` - Trending posts
- `GET /api/marketplace/posts/feed/following` - Following posts
- `GET /api/marketplace/posts/feed/mixed` - Mixed algorithm feed
- `POST /api/marketplace/posts` - Create post (supports new fields)
- `GET /api/marketplace/posts/{postId}/view` - Record view
- `POST /api/marketplace/posts/{postId}/like` - Like/unlike post
- `POST /api/marketplace/posts/{postId}/favorite` - Favorite/unfavorite

## Styling Notes

- All components use the existing orange/black design language
- Components are fully responsive (mobile, tablet, desktop)
- Framer-motion for smooth animations
- Lucide-react for icons
- Tailwind CSS for styling

## Next Steps

1. ✅ Create PostCard component
2. ✅ Create Feed component with infinite scroll
3. ✅ Create FeedWidget for dashboards
4. ✅ Create dedicated FeedPage
5. ⏳ Add route to FeedPage
6. ⏳ Update backend API endpoints
7. ⏳ Integrate feed into dashboards
8. ⏳ Test engagement tracking
9. ⏳ Monitor feed performance

## Features Coming Soon

- Comment threads on posts
- Post sharing (native share + message)
- Post reporting and moderation
- Trending hashtags
- "Explore" page with category filtering
- User follow/unfollow from feed
- Post editing and deletion
- Analytics dashboard for creators
