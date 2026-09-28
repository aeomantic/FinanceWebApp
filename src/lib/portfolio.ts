export interface InvestmentPosition {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  buy_price: number;
  currency: string;
  sector: string;
  wallet_id?: string | null;
  notes?: string | null;
  current_price?: number;
  daily_change_percent?: number;
}

/** Call once per currency: no implicit exchange-rate conversion. */
export function calculatePortfolioMetrics(positions: InvestmentPosition[]) {
  if (new Set(positions.map(p => p.currency)).size > 1) throw new Error("Group holdings by currency before calculating totals.");
  let totalInvested = 0;
  let totalCurrentValue = 0;
  const enrichedPositions = positions.map(pos => {
    if (!Number.isFinite(pos.shares) || pos.shares <= 0 || !Number.isFinite(pos.buy_price) || pos.buy_price < 0) throw new Error("Invalid holding amount.");
    const hasQuote = typeof pos.current_price === "number" && Number.isFinite(pos.current_price) && pos.current_price > 0;
    const costBasis = pos.shares * pos.buy_price;
    const marketValue = pos.shares * (hasQuote ? pos.current_price! : pos.buy_price);
    const unrealizedGain = marketValue - costBasis;
    totalInvested += costBasis;
    totalCurrentValue += marketValue;
    if (!Number.isFinite(totalInvested) || !Number.isFinite(totalCurrentValue)) throw new Error("Portfolio exceeds supported values.");
    return { ...pos, hasQuote, costBasis, marketValue, unrealizedGain, gainPercent: costBasis > 0 ? unrealizedGain / costBasis * 100 : 0 };
  });
  const allocate = (key: "sector" | "ticker") => {
    const totals = new Map<string, number>();
    for (const pos of enrichedPositions) {
      const name = pos[key] || "Other";
      totals.set(name, (totals.get(name) ?? 0) + pos.marketValue);
    }
    return [...totals].map(([name, value]) => ({ name, sector: name, value, percentage: totalCurrentValue > 0 ? value / totalCurrentValue * 100 : 0 })).sort((a, b) => b.value - a.value);
  };
  const totalGain = totalCurrentValue - totalInvested;
  return { totalInvested, totalCurrentValue, totalGain, totalGainPercent: totalInvested > 0 ? totalGain / totalInvested * 100 : 0,
    enrichedPositions, sectorAllocation: allocate("sector"), tickerAllocation: allocate("ticker"),
    unavailableCount: enrichedPositions.filter(p => !p.hasQuote).length };
}
