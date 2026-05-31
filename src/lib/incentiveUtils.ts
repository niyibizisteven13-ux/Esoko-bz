export interface IncentiveProgram {
  id: string;
  traderId: string;
  name: string;
  description: string;
  type: 'points' | 'bulk_discount' | 'tiered_loyalty';
  config: any;
  active: boolean;
  createdAt: any;
}

export function calculateIncentives(
  amount: number,
  quantity: number,
  programs: IncentiveProgram[],
  user: any
) {
  let finalAmount = amount;
  let pointsEarned = 0;
  let appliedIncentives: string[] = [];
  const userTier = user.tier || 'free';
  const userPoints = user.points || 0;

  // 1. Bulk Discount
  const bulkProgram = programs.find((p) => p.type === 'bulk_discount' && p.active);
  if (bulkProgram && quantity >= bulkProgram.config.minBulkQuantity) {
    const discount = (finalAmount * bulkProgram.config.bulkDiscountPercent) / 100;
    finalAmount -= discount;
    appliedIncentives.push(`Bulk Discount (${bulkProgram.config.bulkDiscountPercent}%)`);
  }

  // 2. Tiered Loyalty
  const loyaltyProgram = programs.find((p) => p.type === 'tiered_loyalty' && p.active);
  if (loyaltyProgram && loyaltyProgram.config.tiers) {
    const applicableTier = [...loyaltyProgram.config.tiers]
      .sort((a, b) => b.minPoints - a.minPoints)
      .find((t) => userPoints >= t.minPoints);

    if (applicableTier && applicableTier.discountPercent > 0) {
      const discount = (finalAmount * applicableTier.discountPercent) / 100;
      finalAmount -= discount;
      appliedIncentives.push(
        `${applicableTier.name} Tier Discount (${applicableTier.discountPercent}%)`
      );
    }
  }

  // 3. Points Calculation
  const pointsProgram = programs.find((p) => p.type === 'points' && p.active);
  if (pointsProgram) {
    const multiplier = userTier === 'premium' ? 2 : 1;
    pointsEarned = Math.floor(finalAmount / 1000) * pointsProgram.config.pointsPerRwf * multiplier;
  } else {
    const multiplier = userTier === 'premium' ? 2 : 1;
    pointsEarned = Math.floor(finalAmount / 1000) * multiplier;
  }

  return {
    finalAmount: Math.round(finalAmount),
    pointsEarned,
    appliedIncentives,
  };
}
