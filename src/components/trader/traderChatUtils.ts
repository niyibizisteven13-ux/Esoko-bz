export interface PickerTrader {
  id: string;
  name?: string;
  initials?: string;
  avatar_color?: string;
  last_seen?: number;
  online?: boolean;
  business_name?: string;
  source?: string;
}

export type TraderMap = Record<string, Partial<PickerTrader>>;

function initialsForName(name: string) {
  const value = String(name || '').trim();
  if (!value) return 'TR';
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getVisiblePickerTraders(
  traders: TraderMap | Array<Partial<PickerTrader>> | null | undefined,
  currentTraderId?: string
): PickerTrader[] {
  const normalized = Array.isArray(traders)
    ? traders
    : Object.entries(traders ?? {}).map(([id, trader]) => ({ id, ...trader }));

  return normalized
    .filter((trader): trader is Partial<PickerTrader> & { id: string } => Boolean(trader.id && trader.id !== currentTraderId))
    .map((trader) => {
      const displayName = trader.name || trader.business_name || trader.id || 'Trader';
      return {
        id: trader.id,
        name: displayName,
        initials: trader.initials || initialsForName(displayName),
        avatar_color: trader.avatar_color,
        last_seen: trader.last_seen,
        online: trader.online,
        business_name: trader.business_name,
        source: trader.source,
      } satisfies PickerTrader;
    });
}
