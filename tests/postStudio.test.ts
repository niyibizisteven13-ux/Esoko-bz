// tests/postStudio.test.ts
//
// Written for vitest. If this project uses Jest instead, swap the `vitest`
// import for '@jest/globals', or drop it — describe/it/expect are globals
// under Jest.
import { describe, expect, it } from 'vitest';
import {
  MAX_MEDIA_ITEMS,
  MAX_OVERLAYS,
  MUSIC_LIBRARY,
  STUDIO_TEMPLATES,
  buildCaption,
  canAddMoreMedia,
  createOverlay,
  normalizeHashtagInput,
  reorder,
  suggestHashtags,
  suggestMusic,
  templatesFor,
} from '../src/lib/postStudio';

describe('templatesFor', () => {
  it('returns only trader templates for the trader variant', () => {
    const templates = templatesFor('trader');
    expect(templates.every((t) => t.variant === 'trader' || t.variant === 'both')).toBe(true);
    expect(templates.some((t) => t.id === 'spotlight')).toBe(true);
  });

  it('returns only customer templates for the customer variant', () => {
    const templates = templatesFor('customer');
    expect(templates.every((t) => t.variant === 'customer' || t.variant === 'both')).toBe(true);
    expect(templates.some((t) => t.id === 'unboxing')).toBe(true);
  });

  it('every template id is unique', () => {
    const ids = STUDIO_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('suggestHashtags', () => {
  it('falls back to default category tags for an unknown category', () => {
    const tags = suggestHashtags({ category: 'unknown-category', variant: 'trader' });
    expect(tags).toContain('#EsokoMarket');
    expect(tags).toContain('#TraderSpotlight');
  });

  it('uses category-specific tags when known', () => {
    const tags = suggestHashtags({ category: 'Electronics', variant: 'trader' });
    expect(tags).toContain('#TechDeals');
  });

  it('adds the customer variant tag for customer posts', () => {
    const tags = suggestHashtags({ variant: 'customer' });
    expect(tags).toContain('#CustomerLove');
  });

  it('derives keyword hashtags from the item label, skipping stopwords', () => {
    const tags = suggestHashtags({ keywords: ['the', 'Fresh', 'Mangoes'], variant: 'trader' });
    expect(tags).toContain('#Fresh');
    expect(tags).toContain('#Mangoes');
    expect(tags).not.toContain('#the');
  });

  it('never returns duplicate tags', () => {
    const tags = suggestHashtags({ category: 'default', keywords: ['EsokoMarket'], variant: 'trader' });
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('normalizeHashtagInput', () => {
  it('splits comma and space separated text into hashtags', () => {
    expect(normalizeHashtagInput('fresh, organic mangoes')).toEqual(['#fresh', '#organic', '#mangoes']);
  });

  it('leaves already-prefixed tags alone', () => {
    expect(normalizeHashtagInput('#fresh #organic')).toEqual(['#fresh', '#organic']);
  });

  it('strips punctuation but keeps the leading #', () => {
    expect(normalizeHashtagInput('fresh! organic?')).toEqual(['#fresh', '#organic']);
  });

  it('returns an empty array for blank input', () => {
    expect(normalizeHashtagInput('   ')).toEqual([]);
  });
});

describe('buildCaption', () => {
  const template = STUDIO_TEMPLATES.find((t) => t.id === 'unboxing')!;

  it('prefers free text over the template when both are present', () => {
    const result = buildCaption(template, { product: 'Mangoes' }, 'My own words here', []);
    expect(result).toBe('My own words here');
  });

  it('falls back to the template when free text is empty', () => {
    const result = buildCaption(template, { product: 'Mangoes', trader: 'Kigali Fresh' }, '', []);
    expect(result).toContain('Mangoes');
    expect(result).toContain('Kigali Fresh');
  });

  it('appends hashtags on a new paragraph', () => {
    const result = buildCaption(undefined, {}, 'Base caption', ['#EsokoMarket', '#Fresh']);
    expect(result).toBe('Base caption\n\n#EsokoMarket #Fresh');
  });

  it('trims trailing whitespace when there are no hashtags', () => {
    const result = buildCaption(undefined, {}, '  Base caption  ', []);
    expect(result).toBe('Base caption');
  });
});

describe('canAddMoreMedia', () => {
  it('allows adding while under the max', () => {
    expect(canAddMoreMedia(0)).toBe(true);
    expect(canAddMoreMedia(MAX_MEDIA_ITEMS - 1)).toBe(true);
  });

  it('blocks adding once the max is reached', () => {
    expect(canAddMoreMedia(MAX_MEDIA_ITEMS)).toBe(false);
    expect(canAddMoreMedia(MAX_MEDIA_ITEMS + 1)).toBe(false);
  });
});

describe('reorder', () => {
  it('moves an item from one index to another', () => {
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op for out-of-range indices', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, -1, 2)).toBe(list);
    expect(reorder(list, 0, 5)).toBe(list);
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 1, 1)).toBe(list);
  });

  it('does not mutate the original array', () => {
    const list = ['a', 'b', 'c'];
    reorder(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});

describe('createOverlay', () => {
  it('defaults to a bottom, dark-pill overlay', () => {
    const overlay = createOverlay('20% OFF');
    expect(overlay.zone).toBe('bottom');
    expect(overlay.tone).toBe('dark');
    expect(overlay.text).toBe('20% OFF');
  });

  it('generates a unique id per call', () => {
    const a = createOverlay('One');
    const b = createOverlay('Two');
    expect(a.id).not.toBe(b.id);
  });
});

describe('suggestMusic', () => {
  it('surfaces trader-suited tracks first for the trader variant', () => {
    const [first] = suggestMusic('trader');
    expect(['trader', 'both']).toContain(first.bestFor);
  });

  it('surfaces customer-suited tracks first for the customer variant', () => {
    const [first] = suggestMusic('customer');
    expect(['customer', 'both']).toContain(first.bestFor);
  });

  it('includes every track from the library exactly once', () => {
    const result = suggestMusic('trader');
    expect(result.length).toBe(MUSIC_LIBRARY.length);
    expect(new Set(result.map((t) => t.id)).size).toBe(MUSIC_LIBRARY.length);
  });
});

describe('MAX_OVERLAYS', () => {
  it('is a small, sane cap so the media stays readable', () => {
    expect(MAX_OVERLAYS).toBeGreaterThan(0);
    expect(MAX_OVERLAYS).toBeLessThanOrEqual(4);
  });
}); 