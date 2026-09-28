"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, Plus, MoreVertical, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BrandMark, Icon } from "@/components/ui/icon";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { InvestmentDialog } from "./investment-dialog";
import { deleteInvestment } from "@/app/investments/actions";
import { calculatePortfolioMetrics, type InvestmentPosition } from "@/lib/portfolio";
import type { StockQuote } from "@/lib/investments/quotes";
import "./investments.css";

const COLORS = ["#FEF38B", "#86EFAC", "#93C5FD", "#C4B5FD", "#94A3B8", "#FDBA74", "#F9A8D4", "#67E8F9"];
const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const signedMoney = (n: number, currency: string) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n), currency)}`;
const percent = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function InvestmentsView({ positions, wallets, error = null }: {
  positions: InvestmentPosition[]; wallets: { id: string; name: string }[]; error?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<InvestmentPosition | "new" | null>(null);
  const [deleting, setDeleting] = useState<InvestmentPosition | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [currencyChoice, setCurrencyChoice] = useState("USD");
  const currencies = [...new Set(positions.map(p => p.currency))].sort();
  const currency = currencies.includes(currencyChoice) ? currencyChoice : currencies[0] ?? "USD";
  const [groupBy, setGroupBy] = useState<"sector" | "ticker">("sector");
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [quoteError, setQuoteError] = useState("");
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const symbols = [...new Set(positions.filter(p => p.currency === "USD" && p.sector !== "Crypto").map(p => p.ticker))].sort().join(",");

  useEffect(() => {
    if (!symbols) return;
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || document.hidden) return;
      busy = true;
      setLoadingQuotes(true);
      const next: Record<string, StockQuote> = {};
      let failed = false;
      const tickers = symbols.split(",");
      try {
        for (let i = 0; i < tickers.length; i += 20) {
          const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(tickers.slice(i, i + 20).join(","))}`, { signal: controller.signal });
          if (!response.ok) { failed = true; continue; }
          const payload = await response.json();
          if (!Array.isArray(payload.quotes)) { failed = true; continue; }
          for (const quote of payload.quotes as StockQuote[]) next[quote.ticker] = quote;
        }
        if (!controller.signal.aborted) { setQuotes(next); setQuoteError(failed ? "Some prices are unavailable. Cost basis is used for those holdings." : ""); }
      } catch {
        if (!controller.signal.aborted) { setQuotes({}); setQuoteError("Live prices are unavailable. Showing cost basis until the next refresh."); }
      } finally { busy = false; if (!controller.signal.aborted) setLoadingQuotes(false); }
    }
    void load();
    const interval = setInterval(() => void load(), 60_000);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", load); };
  }, [symbols]);

  const enriched = positions.filter(p => p.currency === currency).map(p => {
    const quote = p.currency === "USD" && p.sector !== "Crypto" ? quotes[p.ticker] : undefined;
    return { ...p, current_price: quote?.status === "available" ? quote.price ?? undefined : undefined,
      daily_change_percent: quote?.status === "available" ? quote.dailyChangePercent ?? undefined : undefined };
  });
  const metrics = calculatePortfolioMetrics(enriched);
  const allocation = (groupBy === "sector" ? metrics.sectorAllocation : metrics.tickerAllocation).filter(a => a.value > 0);
  const unconfigured = Object.values(quotes).some(q => q.status === "not_configured");
  const rateLimited = Object.values(quotes).some(q => q.status === "rate_limited");
  const gainClass = metrics.totalGain >= 0 ? "investment-positive" : "investment-negative";

  function remove() {
    if (!deleting || pending) return;
    startTransition(async () => {
      setActionError("");
      try {
        const result = await deleteInvestment(deleting.id);
        if (!result.success) { setActionError(result.error ?? "Couldn't delete this holding."); return; }
        setDeleting(null); setNotice("Holding deleted."); router.refresh();
      } catch { setActionError("Couldn't delete this holding. Please try again."); }
    });
  }

  return <div className="app-frame investment-frame">
    <a href="#investments-main" className="skip-link">Skip to investments</a>
    <aside className="side-rail" aria-label="Main navigation">
      <Link href="/dashboard" className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
      <nav className="rail-nav">
        <Link href="/dashboard" className="rail-link" aria-label="Overview"><Icon name="home" /></Link>
        <Link href="/transactions" className="rail-link" aria-label="Transactions"><Icon name="transfer" /></Link>
        <Link href="/goals" className="rail-link" aria-label="Goals"><Icon name="target" /></Link>
        <Link href="/wallets" className="rail-link" aria-label="Wallets"><Icon name="wallet" /></Link>
        <Link href="/investments" className="rail-link active" aria-label="Investments" aria-current="page"><TrendingUp /></Link>
      </nav>
      <Link href="/settings" className="rail-avatar" aria-label="Settings"><Icon name="settings" /></Link>
    </aside>
    <div className="app-content min-w-0">
      <header className="topbar"><Link href="/dashboard" className="wordmark">folio<span>.</span></Link><Link href="/settings" className="investment-muted text-sm">Account settings</Link></header>
      <main id="investments-main" className="mx-auto max-w-2xl px-4 pb-44 pt-8">
        <div className="investment-heading">
          <div><p className="investment-eyebrow">PORTFOLIO INTELLIGENCE</p><h1>Investments <span className="heading-spark">✻</span></h1><p className="investment-muted text-sm">A clearer view of what you own.</p></div>
          <button type="button" onClick={() => setEditing("new")} className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#FEF38B] px-4 py-2.5 font-semibold text-zinc-950"><Plus size={17} />Add stock</button>
        </div>
        {error && <div role="alert" className="dashboard-alert">{error}<button onClick={() => router.refresh()}>Refresh</button></div>}
        {notice && <div role="status" className="success-notice">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
        {!error && positions.length === 0 ? <section className="surface-card investment-empty">
          <span className="investment-empty-icon"><TrendingUp size={28} /></span><h2>Your portfolio starts here</h2>
          <p className="investment-muted">Add a stock or fund to track its value, returns, and place in your portfolio.</p>
          <button className="primary-button" onClick={() => setEditing("new")}><Plus size={17} />Add your first holding</button>
        </section> : !error && <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm">Currency <select aria-label="Portfolio currency" className="investment-select ml-2" value={currency} onChange={e => setCurrencyChoice(e.target.value)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
            <span className="investment-muted flex items-center gap-1.5 text-xs"><RefreshCw size={12} className={loadingQuotes ? "animate-spin" : ""} />{loadingQuotes ? "Updating prices…" : "Prices refresh every minute"}</span>
          </div>
          <section className="surface-card investment-summary" aria-label="Portfolio summary">
            <p className="investment-eyebrow">{metrics.unavailableCount ? "ESTIMATED PORTFOLIO VALUE" : "PORTFOLIO VALUE"}</p>
            <div className="investment-value">{money(metrics.totalCurrentValue, currency)} <span>{currency}</span></div>
            <p className={`${gainClass} investment-return`}>{signedMoney(metrics.totalGain, currency)} ({percent(metrics.totalGainPercent)})</p>
            <p className="investment-muted text-sm">{money(metrics.totalInvested, currency)} invested · Unrealized returns</p>
            {metrics.unavailableCount > 0 && <p className="investment-muted mt-4 text-xs">{metrics.unavailableCount} holding{metrics.unavailableCount === 1 ? " uses" : "s use"} purchase cost because a live price is unavailable.</p>}
          </section>
          {(quoteError || unconfigured || rateLimited) && <p role="status" className="investment-muted my-4 text-sm">{quoteError || (unconfigured ? "Live quotes are not configured yet. Holdings remain valued at purchase cost." : "The quote provider is busy. Prices will retry automatically; unavailable holdings use purchase cost.")}</p>}
          <section className="surface-card investment-allocation" aria-labelledby="allocation-title">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="allocation-title">Asset allocation</h2><select className="investment-select" aria-label="Group allocation by" value={groupBy} onChange={e => setGroupBy(e.target.value as "sector" | "ticker")}><option value="sector">By sector</option><option value="ticker">By ticker</option></select></div>
            <div className="investment-chart" role="img" aria-label={`Allocation by ${groupBy}; ${enriched.length} holdings. Values listed below.`}>
              {allocation.length > 0 && <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="85%" stroke="none" paddingAngle={allocation.length > 1 ? 3 : 0} isAnimationActive={false}>
                {allocation.map((a, i) => <Cell key={a.name} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip formatter={value => money(Number(value), currency)} contentStyle={{ borderRadius: 14, background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }} /></PieChart></ResponsiveContainer>}
              <div className="investment-chart-center"><strong>{enriched.length}</strong><span>holding{enriched.length === 1 ? "" : "s"}</span></div>
            </div>
            {allocation.length === 0 && <p className="investment-muted text-center text-sm">Allocation will appear when holdings have a value.</p>}
            <ul className="investment-legend">{allocation.map((a, i) => <li key={a.name}><span className="investment-dot" style={{ background: COLORS[i % COLORS.length] }} /><span className="min-w-0 break-words">{a.name}</span><strong>{money(a.value, currency)}</strong><span className="investment-muted">{a.percentage.toFixed(1)}%</span></li>)}</ul>
          </section>
          <section className="mt-7" aria-labelledby="holdings-title"><div className="mb-3 flex justify-between"><h2 id="holdings-title">Your holdings</h2><span className="investment-muted text-sm">{enriched.length} total</span></div>
            <ul className="investment-holdings">{metrics.enrichedPositions.map(p => <li className="surface-card investment-holding" key={p.id}>
              <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><span className="investment-ticker">{p.ticker}</span><h3 className="mt-2 break-words">{p.name}</h3><p className="investment-muted mt-1 text-xs">{p.sector}</p></div>
                <DropdownMenu trigger={<MoreVertical size={18} />} triggerLabel={`Actions for ${p.ticker}`} items={[
                  { key: "edit", label: "Edit shares / price", icon: <Pencil size={15} />, onSelect: () => setEditing(p) },
                  { key: "delete", label: "Delete position", icon: <Trash2 size={15} />, destructive: true, onSelect: () => { setActionError(""); setDeleting(p); } },
                ]} />
              </div>
              <div className="investment-holding-grid"><div><p className="investment-muted text-xs">Shares · Average cost</p><p>{p.shares.toLocaleString("en-US", { maximumFractionDigits: 8 })} · {money(p.buy_price, currency)}</p><p className="investment-muted mt-2 text-xs">Cost basis {money(p.costBasis, currency)}</p></div>
                <div className="investment-holding-price"><p className="investment-muted text-xs">Market price</p><p>{p.hasQuote ? money(p.current_price!, currency) : <span className="investment-muted">Unavailable</span>} {p.hasQuote && p.daily_change_percent !== undefined && <span className={`text-xs ${p.daily_change_percent >= 0 ? "investment-positive" : "investment-negative"}`}>{percent(p.daily_change_percent)} today</span>}</p>
                  {p.hasQuote && quotes[p.ticker]?.asOf && <p className="investment-muted mt-1 text-xs">As of {new Date(quotes[p.ticker].asOf!).toLocaleString()}</p>}
                </div>
              </div>
              <div className="investment-holding-footer"><strong>{money(p.marketValue, currency)}</strong><span className={p.unrealizedGain >= 0 ? "investment-positive" : "investment-negative"}>{signedMoney(p.unrealizedGain, currency)} ({percent(p.gainPercent)})</span></div>
            </li>)}</ul>
          </section>
          <p className="investment-muted mt-5 text-xs">Latest available USD quotes for US-listed stocks and ETFs. Market timestamps may reflect the last trading session. Each currency is valued separately.</p>
        </>}
      </main>
    </div>
    <MobileNav />
    {editing && <InvestmentDialog position={editing === "new" ? undefined : editing} wallets={wallets} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice("Holding saved."); router.refresh(); }} />}
    {deleting && <Modal title={`Delete ${deleting.ticker}?`} busy={pending} onClose={() => setDeleting(null)}><p>This position will be permanently removed from your portfolio. Your wallet balance will stay unchanged.</p>{actionError && <p role="alert" className="form-error">{actionError}</p>}<div className="mt-5 flex justify-end gap-3"><button autoFocus disabled={pending} onClick={() => setDeleting(null)} className="rounded-xl border px-4 py-2">Cancel</button><button disabled={pending} onClick={remove} className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">{pending ? "Deleting…" : "Delete position"}</button></div></Modal>}
  </div>;
}
