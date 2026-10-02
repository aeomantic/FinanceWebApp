import { Clock, Receipt } from "lucide-react";
import { formatMoney } from "@/lib/dashboard/summary";
import type { MonthlySpendForecast } from "@/lib/monthly-expense";

export function MonthlySpendCard({ forecast: f, today, currency }: { forecast: MonthlySpendForecast; today: string; currency: string }) {
  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`));
  const segments = [
    { label: "Spent", value: f.actualSpent, tone: "bg-zinc-800 text-zinc-100 border-zinc-700/60", bar: "bg-[#FEF38B] shadow-[0_0_12px_#FEF38B55]", icon: <span className="h-2 w-2 shrink-0 rounded-full bg-[#FEF38B]" aria-hidden="true" /> },
    { label: "Bills (Upcoming)", value: f.pendingBillsTotal, tone: "text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/10 border-orange-500/20 dark:border-orange-400/20", bar: "bg-[#F97316] shadow-[0_0_12px_#F9731655]", icon: <Receipt size={15} /> },
    { label: "BNPL (Upcoming)", value: f.pendingBNPLTotal, tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-400/10 border-rose-500/20 dark:border-rose-400/20", bar: "bg-[#EF4444] shadow-[0_0_12px_#EF444455]", icon: <Clock size={15} /> },
  ].map(segment => ({ ...segment, percent: f.totalProjectedSpend > 0 ? segment.value / f.totalProjectedSpend * 100 : 0 }));
  return <section className="surface-card rounded-3xl p-5 min-w-0" aria-label="Monthly spending forecast">
    <h2 className="text-sm font-semibold">{month} Forecast</h2>
    <p className="my-3 text-3xl font-semibold break-words">{formatMoney(f.totalProjectedSpend, currency)}</p>
    <p className="text-xs opacity-70">Across all {currency} wallets · recorded expenses and scheduled bills / BNPL</p>
    <div className="my-5 flex flex-col gap-2.5">
      <div role="img" aria-label={`Spending distribution: ${segments.map(s => `${s.label} ${s.percent.toFixed(1)}%`).join(", ")}`} className="flex h-4 w-full gap-1 overflow-hidden rounded-full border border-zinc-700/40 bg-zinc-800/90 p-0.5">
        {segments.filter(s => s.value > 0).map(s => <span key={s.label} title={`${s.label}: ${s.percent.toFixed(1)}%`} className={`h-full min-w-0 rounded-full transition-[flex-grow] duration-500 motion-reduce:transition-none ${s.bar}`} style={{ flexGrow: s.value, flexBasis: 0 }} />)}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {segments.map(s => <span key={s.label}>{s.percent.toFixed(0)}% {s.label.split(" ")[0]}</span>)}
      </div>
      {f.totalProjectedSpend === 0 && <p className="text-xs opacity-60">No spending or scheduled payments this month.</p>}
    </div>
    <div className="flex flex-wrap gap-2">{segments.map(s => <div key={s.label} className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${s.tone}`}>{s.icon}<span>{s.label}</span><strong>{formatMoney(s.value, currency)}</strong></div>)}</div>
  </section>;
}
