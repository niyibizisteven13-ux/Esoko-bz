export type AssistantRole = 'customer' | 'trader' | 'admin';

export interface AssistantContext {
  businessName?: string;
  accountName?: string;
  accountEmail?: string;
  accountPhone?: string;
  accountLocation?: string;
  accountRole?: string;
  productCount?: number;
  lowStockProductsCount?: number;
  recentTransactionCount?: number;
  loyaltyPoints?: number;
  analytics?: string;
  marketplaceSummary?: string;
}

export interface AssistantReply {
  reply: string;
  suggestions: string[];
  mode: 'local' | 'remote';
  actionType?: 'navigate' | 'none';
  targetTab?: string;
  searchQuery?: string;
}

function normalizePrompt(message: string) {
  return message.trim().toLowerCase();
}

function resolveNavigationTarget(prompt: string, role: AssistantRole): { targetTab: string; label: string } | null {
  const normalized = prompt.toLowerCase();
  const explicitNavigation = normalized.includes('go to') || normalized.includes('take me to') || normalized.includes('open') || normalized.includes('show me');

  if (!explicitNavigation) {
    return null;
  }

  if (role === 'trader') {
    if (normalized.includes('products') || normalized.includes('inventory') || normalized.includes('stock')) {
      return { targetTab: 'products', label: 'products' };
    }
    if (normalized.includes('orders') || normalized.includes('sales')) {
      return { targetTab: 'orders', label: 'orders' };
    }
    if (normalized.includes('wallet') || normalized.includes('payment') || normalized.includes('funds') || normalized.includes('balance')) {
      return { targetTab: 'wallet', label: 'wallet' };
    }
    if (normalized.includes('chat') || normalized.includes('messages') || normalized.includes('conversation')) {
      return { targetTab: 'chat', label: 'chat' };
    }
    if (normalized.includes('report') || normalized.includes('reports') || normalized.includes('analytics')) {
      return { targetTab: 'reports', label: 'reports' };
    }
    if (normalized.includes('setting') || normalized.includes('settings') || normalized.includes('profile')) {
      return { targetTab: 'settings', label: 'settings' };
    }
  }

  if (normalized.includes('market') || normalized.includes('marketplace') || normalized.includes('shop')) {
    return { targetTab: 'marketplace', label: 'marketplace' };
  }
  if (normalized.includes('orders') || normalized.includes('purchase')) {
    return { targetTab: 'orders', label: 'orders' };
  }
  if (normalized.includes('wallet') || normalized.includes('payment') || normalized.includes('balance')) {
    return { targetTab: 'wallet', label: 'wallet' };
  }
  if (normalized.includes('chat') || normalized.includes('messages') || normalized.includes('conversation')) {
    return { targetTab: 'chat', label: 'chat' };
  }
  if (normalized.includes('profile') || normalized.includes('account')) {
    return { targetTab: 'profile', label: 'profile' };
  }

  return null;
}

export function buildLocalAssistantReply(
  message: string,
  role: AssistantRole,
  context: AssistantContext = {}
): AssistantReply {
  const prompt = normalizePrompt(message);
  const productCount = context.productCount || 0;
  const navigationTarget = resolveNavigationTarget(prompt, role);

  if (navigationTarget) {
    return {
      reply: `I can take you to your ${navigationTarget.label} view so you can continue from there.`,
      suggestions: [
        `Open ${navigationTarget.label}`,
        'Show me the latest details first',
        'Help me with the next best action',
      ],
      mode: 'local',
      actionType: 'navigate',
      targetTab: navigationTarget.targetTab,
    };
  }

  if (role === 'trader') {
    if (prompt.includes('stock') || prompt.includes('inventory') || prompt.includes('restock')) {
      const lowStock = context.lowStockProductsCount || 0;
      return {
        reply: `${context.businessName ? `${context.businessName} ` : ''}should focus on replenishing ${lowStock || 1} low-stock items first and prioritizing fast-moving products to protect cash flow.`,
        suggestions: [
          'Restock the fastest-selling SKUs this week',
          'Bundle slow-moving products with promos',
          'Review your low-stock alerts before the next delivery',
        ],
        mode: 'local',
      };
    }

    return {
      reply: `I can help you review ${productCount || 0} products, track recent activity, and spot growth opportunities for ${context.businessName || 'your shop'}.`,
      suggestions: [
        'Check your inventory gaps',
        'Highlight your best-selling products',
        'Prepare a small customer promotion',
      ],
      mode: 'local',
    };
  }

  if (prompt.includes('find') || prompt.includes('good') || prompt.includes('search') || prompt.includes('product')) {
    const loyaltyPoints = context.loyaltyPoints || 0;
    return {
      reply: `I can help you discover reliable products and offers that suit your budget. You currently have ${loyaltyPoints} loyalty points to unlock better deals.`,
      suggestions: [
        'Explore fresh offers from nearby traders',
        'Compare top-rated products before you buy',
        'Use your loyalty balance for better discounts',
      ],
      mode: 'local',
    };
  }

  return {
    reply: 'I can help you discover products, manage your business, and improve your next move with simple guided suggestions.',
    suggestions: [
      'Browse the marketplace for trusted items',
      'Review your recent activity',
      'Ask for a business tip or a shopping recommendation',
    ],
    mode: 'local',
  };
}
