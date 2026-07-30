import { describe, it, expect } from 'vitest';
import { buildLocalAssistantReply } from './aiAssistant';

describe('buildLocalAssistantReply', () => {
  it('creates trader-focused inventory guidance when stock issues are present', () => {
    const reply = buildLocalAssistantReply('help me with my stock', 'trader', {
      productCount: 14,
      lowStockProductsCount: 3,
      recentTransactionCount: 8,
      businessName: 'Mikondo Shop',
    });

    expect(reply.reply).toContain('Mikondo Shop');
    expect(reply.suggestions).toEqual(
      expect.arrayContaining([expect.stringContaining('Restock'), expect.stringContaining('Bundle')])
    );
  });

  it('creates customer-focused shopping suggestions for product discovery', () => {
    const reply = buildLocalAssistantReply('find good products for my family', 'customer', {
      productCount: 42,
      recentTransactionCount: 2,
      loyaltyPoints: 180,
    });

    expect(reply.reply).toContain('products');
    expect(reply.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('offers')]));
  });

  it('adds navigation guidance when the user asks to open an in-app section', () => {
    const reply = buildLocalAssistantReply('take me to my products', 'trader', {
      businessName: 'Mikondo Shop',
      productCount: 14,
      lowStockProductsCount: 3,
      recentTransactionCount: 8,
    });

    expect(reply.actionType).toBe('navigate');
    expect(reply.targetTab).toBe('products');
    expect(reply.reply).toContain('products');
  });
});
