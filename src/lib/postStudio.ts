// src/lib/postStudio.ts
//
// Shared logic for the marketplace "studio" — the multi-media composer used
// by both the trader post flow and the customer "share your purchase" flow.
// Kept free of React/lucide imports so it's trivial to unit test.

export type StudioVariant = 'trader' | 'customer';

/**
 * A normalized thing a post can be about — a trader's product, or a
 * customer's past purchase. Callers (TraderDashboard / CustomerDashboard)
 * map their own data into this shape before handing it to <PostStudioModal />.
 */
export type StudioItem = {
  id: string;
  label: string;
  traderId?: string;
  traderName?: string;
  price?: number;
  stock?: number;
  category?: string;
  description?: string;
};

/** One slide in the studio's media carousel. */
export type StudioMedia = {
  id: string;
  kind: 'image' | 'video';
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
};

export const MAX_MEDIA_ITEMS = 10;

export function canAddMoreMedia(currentCount: number): boolean {
  return currentCount < MAX_MEDIA_ITEMS;
}

/** Repositions an item in an array without mutating the original. */
export function reorder<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export type OverlayZone = 'top' | 'bottom';
export type OverlayTone = 'light' | 'dark';

export type TextOverlay = {
  id: string;
  text: string;
  zone: OverlayZone;
  tone: OverlayTone;
};

export const MAX_OVERLAYS = 2;

export function createOverlay(text: string, zone: OverlayZone = 'bottom', tone: OverlayTone = 'dark'): TextOverlay {
  return { id: `overlay-${Date.now()}-${Math.round(Math.random() * 1000)}`, text, zone, tone };
}

export type StudioTemplate = {
  id: string;
  label: string;
  variant: StudioVariant | 'both';
  icon: 'sparkles' | 'flame' | 'book-open' | 'message-circle' | 'megaphone' | 'package';
  promptHint: string;
  captionTemplate: (input: { product?: string; trader?: string }) => string;
};

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  // Trader-facing
  {
    id: 'spotlight',
    label: 'Product Spotlight',
    variant: 'trader',
    icon: 'sparkles',
    promptHint: 'Highlight what makes this product special',
    captionTemplate: ({ product }) =>
      `✨ Spotlight: ${product || 'this product'} is here! Quality you can trust, prices you'll love.`,
  },
  {
    id: 'offer',
    label: 'Special Offer',
    variant: 'trader',
    icon: 'flame',
    promptHint: 'Announce a deal or discount',
    captionTemplate: ({ product }) =>
      `🔥 Limited offer on ${product || 'this item'} — grab it before stock runs out!`,
  },
  {
    id: 'brand-story',
    label: 'Brand Story',
    variant: 'trader',
    icon: 'book-open',
    promptHint: 'Share the story behind your business',
    captionTemplate: ({ trader }) =>
      `Every purchase supports ${trader || 'our shop'} — here's a bit about why we do what we do.`,
  },
  {
    id: 'behind-scenes',
    label: 'Behind the Scenes',
    variant: 'trader',
    icon: 'package',
    promptHint: 'Show how the product is made, packed, or sourced',
    captionTemplate: ({ product }) =>
      `Ever wondered how ${product || 'this product'} gets to you? Here's a look behind the scenes.`,
  },
  // Customer-facing
  {
    id: 'unboxing',
    label: 'Unboxing',
    variant: 'customer',
    icon: 'package',
    promptHint: 'Show off what just arrived',
    captionTemplate: ({ product, trader }) =>
      `Just unboxed my ${product || 'order'}${trader ? ` from ${trader}` : ''}! 📦✨`,
  },
  {
    id: 'review',
    label: 'Quick Review',
    variant: 'customer',
    icon: 'message-circle',
    promptHint: 'Share your honest thoughts',
    captionTemplate: ({ product }) => `My honest take on ${product || 'this purchase'}: `,
  },
  {
    id: 'shoutout',
    label: 'Shop Shoutout',
    variant: 'customer',
    icon: 'megaphone',
    promptHint: 'Give credit to a trader you love',
    captionTemplate: ({ trader }) => `Shoutout to ${trader || 'this seller'} for the great service! 🙌`,
  },
];

export function templatesFor(variant: StudioVariant): StudioTemplate[] {
  return STUDIO_TEMPLATES.filter((template) => template.variant === variant || template.variant === 'both');
}

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  produce: ['#FreshProduce', '#FarmToTable', '#BwengeMarket'],
  electronics: ['#TechDeals', '#Electronics', '#BwengeMarket'],
  fashion: ['#Fashion', '#Style', '#BwengeMarket'],
  home: ['#HomeGoods', '#BwengeMarket'],
  default: ['#BwengeMarket', '#SupportLocal', '#ShopLocal'],
};

/** Skip filler words when turning an item's label into hashtag candidates. */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'of', 'to', 'in']);

export function suggestHashtags(input: {
  category?: string;
  keywords?: string[];
  variant?: StudioVariant;
}): string[] {
  const base = CATEGORY_HASHTAGS[(input.category || '').toLowerCase()] || CATEGORY_HASHTAGS.default;
  const variantTag = input.variant === 'customer' ? '#CustomerLove' : '#TraderSpotlight';

  const keywordTags = (input.keywords || [])
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => `#${word.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter((tag) => tag.length > 1);

  return Array.from(new Set([...base, variantTag, ...keywordTags]));
}

/** Turn free text like "fresh, organic mangoes" into ['#fresh', '#organic', '#mangoes']. */
export function normalizeHashtagInput(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/[^a-zA-Z0-9#]/g, ''))
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
}

export function buildCaption(
  template: StudioTemplate | undefined,
  vars: { product?: string; trader?: string },
  freeText: string,
  hashtags: string[]
): string {
  const base = freeText.trim() || (template ? template.captionTemplate(vars) : '');
  const tagLine = hashtags.length ? `\n\n${hashtags.join(' ')}` : '';
  return `${base}${tagLine}`.trim();
}

/**
 * Preset soundtrack "vibes" traders/customers can tag a post with. These are
 * mood presets, not licensed audio — the studio can't legally bundle real
 * songs, so selecting one just tags the post's vibe for the feed/algorithm.
 * Anyone who wants an actual audio track attaches their own file separately
 * (see StudioAudio below), which really does play back.
 */
export type MusicTrack = {
  id: string;
  title: string;
  mood: 'energetic' | 'chill' | 'emotional' | 'festive';
  bestFor: StudioVariant | 'both';
};

export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: 'golden-hour', title: 'Golden Hour Groove', mood: 'chill', bestFor: 'both' },
  { id: 'market-morning', title: 'Market Morning', mood: 'energetic', bestFor: 'trader' },
  { id: 'upbeat-hustle', title: 'Upbeat Hustle', mood: 'energetic', bestFor: 'trader' },
  { id: 'chill-afternoon', title: 'Chill Afternoon', mood: 'chill', bestFor: 'both' },
  { id: 'festival-energy', title: 'Festival Energy', mood: 'festive', bestFor: 'both' },
  { id: 'first-impressions', title: 'First Impressions', mood: 'emotional', bestFor: 'customer' },
  { id: 'unbox-and-vibe', title: 'Unbox & Vibe', mood: 'energetic', bestFor: 'customer' },
  { id: 'slow-appreciation', title: 'Slow Appreciation', mood: 'emotional', bestFor: 'both' },
];

export function suggestMusic(variant: StudioVariant): MusicTrack[] {
  const matching = MUSIC_LIBRARY.filter((track) => track.bestFor === variant || track.bestFor === 'both');
  const rest = MUSIC_LIBRARY.filter((track) => !matching.includes(track));
  return [...matching, ...rest];
}

export type StudioAudio = {
  file: File;
  previewUrl: string;
};
