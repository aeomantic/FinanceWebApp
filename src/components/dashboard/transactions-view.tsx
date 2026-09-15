"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon, CalendarClock } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark, Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MobileNav } from "./mobile-nav";
import { dateHeading, MerchantAvatar } from "./transaction-list";
import { formatMoney } from "@/lib/dashboard/summary";
import { DEMO_WALLETS, getDemoTransactions } from "@/lib/dashboard/demo";
import type { Transaction, Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

type Period = "month" | "30d" | "all";
type TypeFilter = "all" | "income" | "expense";
type CategoryTab = "expense" | "income";

interface TransactionsViewProps {
  wallets: Wallet[];
  transactions: Transaction[];
  today: string;
  periodStart: string;
  name: string;
  error?: string | null;
  demo?: boolean;
}

function periodStartFor(period: Period, today: string, allTimeStart: string): string {
  if (period === "month") return `${today.slice(0, 7)}-01`;
  if (period === "30d") {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 29);
    return date.toISOString().slice(0, 10);
  }
  return allTimeStart;
}

function SegmentedControl<T extends string>({ value, onChange, options, "aria-label": ariaLabel }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  "aria-label"?: string;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.segmentedOption} ${value === option.value ? styles.segmentedOptionActive : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TransactionsView({ wallets: initialWallets, transactions: initialTransactions, today, periodStart: allTimeStart, name: fullName, error, demo = false }: TransactionsViewProps) {
  const router = useRouter();
  const wallets = demo ? DEMO_WALLETS : initialWallets;
  const transactions = demo ? getDemoTransactions(today) : initialTransactions;
  const name = fullName.split(" ")[0] || "there";
  const searchId = useId();

  const [period, setPeriod] = useState<Period>("month");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [walletFilter, setWalletFilter] = useState("");
  const [query, setQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("expense");

  const periodStart = periodStartFor(period, today, allTimeStart);
  const inPeriod = useMemo(
    () => transactions.filter((transaction) => transaction.date >= periodStart && transaction.date <= today),
    [transactions, periodStart, today],
  );

  const currencyCounts = new Map<string, number>();
  for (const wallet of wallets) currencyCounts.set(wallet.currency, (currencyCounts.get(wallet.currency) ?? 0) + 1);
  const primaryCurrency = (wallets.find((wallet) => wallet.isDefault) ?? wallets[0])?.currency
    ?? [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? "SGD";
  const otherCurrencyWallets = wallets.filter((wallet) => wallet.currency !== primaryCurrency).length;
  const primaryPeriod = useMemo(
    () => inPeriod.filter((transaction) => transaction.currency === primaryCurrency),
    [inPeriod, primaryCurrency],
  );

  const inflowMinor = primaryPeriod.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const outflowMinor = primaryPeriod.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amountMinor, 0);

  const breakdown = useMemo(() => {
    const totals = new Map<string, { name: string; icon?: string; amountMinor: number }>();
    let total = 0;
    for (const transaction of primaryPeriod) {
      if (transaction.type !== categoryTab) continue;
      if (walletFilter && transaction.walletId !== walletFilter) continue;
      const key = transaction.category ?? "Uncategorized";
      const entry = totals.get(key) ?? { name: key, icon: transaction.categoryIcon, amountMinor: 0 };
      entry.amountMinor += transaction.amountMinor;
      totals.set(key, entry);
      total += transaction.amountMinor;
    }
    return { rows: [...totals.values()].sort((a, b) => b.amountMinor - a.amountMinor), total };
  }, [primaryPeriod, categoryTab, walletFilter]);

  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const ledger = inPeriod
    .filter((transaction) => typeFilter === "all" || transaction.type === typeFilter)
    .filter((transaction) => !walletFilter || transaction.walletId === walletFilter || transaction.destinationWalletId === walletFilter)
    .filter((transaction) => `${transaction.title} ${transaction.category ?? ""}`.toLocaleLowerCase("en-US").includes(normalizedQuery))
    .toSorted((a, b) => b.date.localeCompare(a.date));

  const groups = ledger.reduce<Map<string, Transaction[]>>((result, transaction) => {
    const group = result.get(transaction.date) ?? [];
    group.push(transaction);
    result.set(transaction.date, group);
    return result;
  }, new Map());

  const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  const walletOptions = [
    { value: "", label: "All wallets", icon: <WalletIcon size={16} /> },
    ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name, icon: <WalletIcon size={16} /> })),
  ];

  return (
    <div className="app-frame transactions-frame">
      <a href="#transactions-main" className="skip-link">Skip to transactions</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href={demo ? "/preview" : "/dashboard"} className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <Link href={demo ? "/preview" : "/dashboard"} className="rail-link" aria-label="Overview" title="Overview"><Icon name="home" /></Link>
          <Link href={demo ? "/preview" : "/transactions"} className="rail-link active" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
          <Link href={demo ? "/preview" : "/dashboard"} className="rail-link" aria-label="Activity" title="Activity"><Icon name="activity" /></Link>
          <Link href={demo ? "/preview" : "/wallets"} className="rail-link" aria-label="Wallets" title="Wallets"><Icon name="wallet" /></Link>
        </nav>
        <Link href={demo ? "/login" : "/settings"} className="rail-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href={demo ? "/preview" : "/dashboard"} className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections">
            <Link href={demo ? "/preview" : "/dashboard"}>Overview</Link>
            <Link href={demo ? "/preview" : "/transactions"} className="selected">Transactions</Link>
            <Link href={demo ? "/preview" : "/wallets"}>Wallets</Link>
          </nav>
          <div className="topbar-actions">
            <div className="user-greeting"><Link href={demo ? "/login" : "/settings"} className="user-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link><span>Hi, {name}<span className="user-subtitle">{demo ? "Personal account · Demo" : "Personal account"}</span></span></div>
          </div>
        </header>

        <main id="transactions-main" className="transactions-page">
          <div className="page-heading">
            <div><div className="eyebrow page-eyebrow">EVERY DOLLAR, ACCOUNTED FOR</div><h1>Transactions<span className="heading-spark" aria-hidden="true">✳</span></h1><p>Search, filter, and see where your money goes.</p></div>
            {!demo && <Link href="/commitments" className="commitments-link"><CalendarClock size={16} aria-hidden="true" />Recurring &amp; commitments</Link>}
          </div>

          {demo && <div className="demo-banner"><span><span className="status-dot" />You’re exploring Folio. These are sample transactions.</span><Link href="/login">Make it yours<Icon name="arrow-up-right" size={15} /></Link></div>}
          {error && <div className="dashboard-alert" role="alert">{error}<button onClick={() => router.refresh()}>Try again</button></div>}

          <SegmentedControl
            value={period}
            onChange={setPeriod}
            aria-label="Time period"
            options={[{ value: "month", label: "This month" }, { value: "30d", label: "Last 30 days" }, { value: "all", label: "All time" }]}
          />

          <div className={styles.summaryPills}>
            <div className={styles.summaryPill}>
              <span className={styles.summaryPillLabel}>Total inflow</span>
              <span className={`${styles.summaryPillValue} ${styles.positive}`}>+{formatMoney(inflowMinor, primaryCurrency)}</span>
            </div>
            <div className={styles.summaryPill}>
              <span className={styles.summaryPillLabel}>Total outflow</span>
              <span className={styles.summaryPillValue}>-{formatMoney(outflowMinor, primaryCurrency)}</span>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="transactions-analytics-area">
              <section className={`surface-card ${styles.donutCard}`} aria-labelledby="category-breakdown-heading">
                <div className={styles.cardHeading}>
                  <div><p className={styles.eyebrow}>WHERE IT GOES</p><h2 id="category-breakdown-heading">By category</h2></div>
                </div>
                <SegmentedControl
                  value={categoryTab}
                  onChange={setCategoryTab}
                  aria-label="Category breakdown type"
                  options={[{ value: "expense", label: "Expenses" }, { value: "income", label: "Income" }]}
                />
                {breakdown.rows.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon} aria-hidden="true">↗</span>
                    <h3>Nothing here yet</h3>
                    <p>{categoryTab === "expense" ? "Expenses" : "Income"} for this period will show up here.</p>
                  </div>
                ) : (
                  <ul className={styles.categoryBreakdown}>
                    {breakdown.rows.map((row) => {
                      const percent = breakdown.total > 0 ? Math.round((row.amountMinor / breakdown.total) * 100) : 0;
                      return (
                        <li key={row.name} className={styles.categoryRow}>
                          <div className={styles.categoryRowTop}>
                            <span className={`${styles.avatar} ${categoryTab === "income" ? styles.avatarMint : styles.avatarLavender}`} aria-hidden="true">
                              <CategoryIcon name={row.icon} size={16} />
                            </span>
                            <span className={styles.categoryRowName}>{row.name}</span>
                            <span className={styles.categoryRowAmount}>{formatMoney(row.amountMinor, primaryCurrency)}</span>
                            <span className={styles.categoryRowPercent}>{percent}%</span>
                          </div>
                          <div className={styles.categoryRowMeter} role="meter" aria-label={`${row.name} share`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className={styles.categoryRowMeterFill} style={{ width: `${percent}%` }} /></div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {otherCurrencyWallets > 0 && (
                  <p className={styles.donutNote}>
                    {otherCurrencyWallets} wallet{otherCurrencyWallets === 1 ? "" : "s"} in other currencies {otherCurrencyWallets === 1 ? "isn't" : "aren't"} included in this breakdown.
                  </p>
                )}
              </section>
            </div>

            <div className="transactions-ledger-area">
              <section className={`surface-card ${styles.transactions}`} aria-labelledby="ledger-heading">
                <div className={styles.cardHeading}>
                  <div><p className={styles.eyebrow}>FULL LEDGER</p><h2 id="ledger-heading">All transactions</h2></div>
                  <span className={styles.smallCount}>{ledger.length} total</span>
                </div>

                <div className={styles.filterToolbar}>
                  <div className={styles.transactionSearch}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.7" /><path d="m16 16 4 4" /></svg>
                    <label htmlFor={searchId} className={styles.srOnly}>Search transactions</label>
                    <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by note or category" />
                  </div>
                  <SegmentedControl
                    value={typeFilter}
                    onChange={setTypeFilter}
                    aria-label="Filter by type"
                    options={[{ value: "all", label: "All" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" }]}
                  />
                  <div className={styles.walletFilter}>
                    <Select aria-label="Filter by wallet" value={walletFilter} onChange={setWalletFilter} options={walletOptions} />
                  </div>
                </div>

                <div className={styles.transactionGroups}>
                  {groups.size === 0 ? (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon} aria-hidden="true">↗</span>
                      <h3>No transactions found</h3>
                      <p>No transactions found for this period.</p>
                    </div>
                  ) : Array.from(groups, ([date, rows]) => (
                    <div key={date} className={styles.transactionGroup}>
                      <h3 className={styles.dateHeading}>{dateHeading(date, today)}</h3>
                      <ul className={styles.transactionRows}>
                        {rows.map((transaction) => {
                          const income = transaction.type === "income";
                          const transfer = transaction.type === "transfer";
                          const amount = formatMoney(transaction.amountMinor, transaction.currency);
                          const walletName = walletsById.get(transaction.walletId)?.name ?? "Wallet";
                          return (
                            <li key={transaction.id} className={styles.transactionRow}>
                              <MerchantAvatar type={transaction.type} categoryIcon={transaction.categoryIcon} />
                              <div className={styles.transactionDetails}>
                                <p className={styles.transactionTitle}>{transaction.title}</p>
                                <p className={styles.transactionMeta}>
                                  {transfer ? "Transferred" : income ? "Received" : "Paid"}
                                  {transaction.category ? <span className={styles.category}>{transaction.category}</span> : null}
                                </p>
                              </div>
                              <div className={styles.ledgerRowEnd}>
                                <span className={styles.walletBadge}>{walletName}</span>
                                <span className={`${styles.transactionAmount} ${income ? styles.positive : ""}`}>{transfer ? "" : income ? "+" : "−"}{amount}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>{demo ? "Demo data" : `Recorded activity from ${allTimeStart}. Not a bank balance.`}</span><div>{demo ? <Link href="/login">Sign in<Icon name="arrow-right" size={14} /></Link> : <SignOutButton />}</div></footer>
        </main>
      </div>

      <MobileNav demo={demo} />
    </div>
  );
}
