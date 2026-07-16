import React from 'react';

interface RunwayProps {
  balance: number;
  avgMonthlyOutflow: number;
  runwayMonths: number | null;
}

export default function RunwayCard({ balance, avgMonthlyOutflow, runwayMonths }: RunwayProps) {
  const colorClass =
    runwayMonths === null
      ? 'text-neutral-400'
      : runwayMonths > 6
      ? 'text-emerald-400'
      : runwayMonths >= 2
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="rounded-2xl bg-white/5 border border-white/5 p-3 flex-1">
        <p className="text-xs font-black text-white/40 uppercase">Runway (est.)</p>
        <div className="flex items-center justify-between mt-1">
          <h4 className={`text-lg font-black ${colorClass}`}>{runwayMonths === null ? '—' : `${runwayMonths} mo`}</h4>
          <div className="text-xs text-white/40 text-right">
            <div>Balance: RWF {balance?.toLocaleString()}</div>
            <div>Avg outflow: RWF {avgMonthlyOutflow?.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
