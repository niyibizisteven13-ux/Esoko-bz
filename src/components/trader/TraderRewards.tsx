import React, { useEffect, useState } from 'react';
import { Gift, Loader2, Users } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { getTraderRewards } from '../../services/postService';

type TraderRewardsProps = { traderId: string };

export default function TraderRewards({ traderId }: TraderRewardsProps) {
  const [summary, setSummary] = useState<{ conversionCount: number; earned: number; rewardBalance: number } | null>(null);

  useEffect(() => {
    if (!traderId) return;
    void getTraderRewards(traderId).then((response) => setSummary(response.summary)).catch(() => setSummary(null));
  }, [traderId]);

  return (
    <div className="mt-5 rounded-[1.75rem] border border-orange-500/20 bg-orange-500/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-orange-400"><Gift size={17} /><p className="text-[10px] font-black uppercase tracking-[0.22em]">Follower rewards</p></div>
          {summary ? <>
            <p className="mt-3 text-xl font-black text-white"><Users className="mr-2 inline" size={18} />{summary.conversionCount} followers converted this month</p>
            <p className="mt-1 text-sm text-white/60">{formatCurrency(summary.earned)} earned · {formatCurrency(summary.rewardBalance)} pending payout</p>
          </> : <p className="mt-3 flex items-center gap-2 text-sm text-white/50"><Loader2 size={16} className="animate-spin" /> Loading reward activity</p>}
        </div>
      </div>
    </div>
  );
}
