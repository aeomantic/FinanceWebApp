import { getAuthedUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { InvestmentsView } from "@/components/investments/investments-view";
import { investmentDecimal, investmentSchema } from "@/lib/investments/validation";
import type { InvestmentPosition } from "@/lib/portfolio";

export const metadata = { title: "Investments | Folio" };

export default async function InvestmentsPage() {
  const [user, db] = await Promise.all([getAuthedUser(), createClient()]);
  const [holdings, wallets] = await Promise.all([
    db.from("investments").select("id,ticker,name,shares,buy_price,currency,sector,wallet_id,notes", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
    db.from("wallets").select("id,name").eq("user_id", user.id).order("name"),
  ]);
  let error = holdings.error ? "Couldn't load investments. Check that the investments migration has been applied, then refresh." : wallets.error ? "Couldn't load linked wallets. Please refresh." : null;
  const positions: InvestmentPosition[] = [];
  for (const row of holdings.data ?? []) {
    const parsed = investmentSchema.safeParse({ ...row, shares: investmentDecimal(row.shares), buy_price: investmentDecimal(row.buy_price), wallet_id: row.wallet_id ?? "", notes: row.notes ?? "" });
    if (!parsed.success) { error = "Some holdings contain unsupported values. Portfolio totals are unavailable."; break; }
    positions.push({ ...parsed.data, id: row.id });
  }
  if (holdings.count === null || holdings.count > 1000) error ??= "The portfolio exceeds the supported 1,000 holdings or its total could not be verified.";
  return <InvestmentsView positions={error ? [] : positions} wallets={wallets.data ?? []} error={error} />;
}
