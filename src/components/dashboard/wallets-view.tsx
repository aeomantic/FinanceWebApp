"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark, Icon } from "@/components/ui/icon";
import { WalletList } from "./wallet-list";
import { WalletDistributionChart } from "./wallet-distribution-chart";
import { setDefaultWallet } from "@/app/dashboard/actions";
import { formatMoney } from "@/lib/dashboard/summary";
import { DEMO_WALLETS } from "@/lib/dashboard/demo";
import type { Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

interface WalletsViewProps {
  wallets: Wallet[];
  name: string;
  email: string;
  error?: string | null;
  demo?: boolean;
}

export function WalletsView({ wallets: initialWallets, name: fullName, error, demo = false }: WalletsViewProps) {
  const router = useRouter();
  const wallets = demo ? DEMO_WALLETS : initialWallets;
  const name = fullName.split(" ")[0] || "there";
  const currencyCounts = new Map<string, number>();
  for (const wallet of wallets) currencyCounts.set(wallet.currency, (currencyCounts.get(wallet.currency) ?? 0) + 1);
  const primaryCurrency = (wallets.find((wallet) => wallet.isDefault) ?? wallets[0])?.currency
    ?? [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? "SGD";
  const primaryWallets = wallets.filter((wallet) => wallet.currency === primaryCurrency);
  const otherCurrencyCount = wallets.length - primaryWallets.length;

  return (
    <div className="app-frame">
      <a href="#wallets-main" className="skip-link">Skip to wallets</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href={demo ? "/preview" : "/dashboard"} className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <Link href={demo ? "/preview" : "/dashboard"} className="rail-link" aria-label="Overview" title="Overview"><Icon name="home" /></Link>
          <Link href={demo ? "/preview" : "/dashboard"} className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
          <Link href={demo ? "/preview" : "/dashboard"} className="rail-link" aria-label="Activity" title="Activity"><Icon name="activity" /></Link>
          <Link href={demo ? "/preview" : "/wallets"} className="rail-link active" aria-label="Wallets" title="Wallets"><Icon name="wallet" /></Link>
        </nav>
        <span className="rail-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href={demo ? "/preview" : "/dashboard"} className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections">
            <Link href={demo ? "/preview" : "/dashboard"}>Overview</Link>
            <Link href={demo ? "/preview" : "/dashboard"}>Transactions</Link>
            <Link href={demo ? "/preview" : "/wallets"} className="selected">Wallets</Link>
          </nav>
          <div className="topbar-actions">
            <div className="user-greeting"><span className="user-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><span>Hi, {name}<span className="user-subtitle">{demo ? "Personal account · Demo" : "Personal account"}</span></span></div>
          </div>
        </header>

        <main id="wallets-main">
          <div className="page-heading">
            <div><div className="eyebrow page-eyebrow">YOUR MONEY, MAPPED</div><h1>Wallets<span className="heading-spark" aria-hidden="true">✳</span></h1><p>See how your balance is spread across every wallet.</p></div>
          </div>

          {demo && <div className="demo-banner"><span><span className="status-dot" />You’re exploring Folio. These are sample wallets.</span><Link href="/login">Make it yours<Icon name="arrow-up-right" size={15} /></Link></div>}
          {error && <div className="dashboard-alert" role="alert">{error}<button onClick={() => router.refresh()}>Try again</button></div>}

          <div className="dashboard-grid">
            <div style={{ gridColumn: "span 5" }}>
              <WalletDistributionChart wallets={primaryWallets} currency={primaryCurrency} otherCurrencyCount={otherCurrencyCount} />
            </div>
            <div style={{ gridColumn: "span 7" }}>
              <WalletGrid wallets={wallets} demo={demo} onChanged={() => router.refresh()} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <WalletList wallets={wallets} selectedWalletId={null} onSelect={() => {}} onCreated={() => router.refresh()} onDefaultChanged={() => router.refresh()} demo={demo} />
            </div>
          </div>

          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>{demo ? "Demo data" : "Balances shown are recorded activity, not a bank feed."}</span><div>{demo ? <Link href="/login">Sign in<Icon name="arrow-right" size={14} /></Link> : <SignOutButton />}</div></footer>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link href={demo ? "/preview" : "/dashboard"} aria-label="Transactions"><Icon name="transfer" /></Link>
        <Link href={demo ? "/preview" : "/dashboard"} className="mobile-home" aria-label="Overview"><Icon name="home" /></Link>
        <Link href={demo ? "/preview" : "/wallets"} aria-label="Wallets"><Icon name="wallet" /></Link>
      </nav>
    </div>
  );
}

function WalletGrid({ wallets, demo, onChanged }: { wallets: Wallet[]; demo: boolean; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleSetDefault(walletId: string) {
    if (demo) return;
    setPendingId(walletId);
    startTransition(async () => {
      await setDefaultWallet(walletId);
      onChanged();
      setPendingId(null);
    });
  }

  return (
    <section className={`surface-card ${styles.walletGridCard}`} aria-label="All wallets">
      <div className={styles.cardHeading}>
        <div><p className={styles.eyebrow}>EVERY WALLET</p><h2>Balances</h2></div>
      </div>
      <ul className={styles.walletGrid}>
        {wallets.map((wallet) => (
          <li key={wallet.id} className={styles.walletGridItem}>
            <div className={styles.walletGridTop}>
              <span className={styles.walletGridName}>{wallet.name}</span>
              <button
                type="button"
                className={`${styles.defaultToggle} ${wallet.isDefault ? styles.defaultToggleActive : ""}`}
                onClick={() => handleSetDefault(wallet.id)}
                disabled={demo || wallet.isDefault || (pending && pendingId === wallet.id)}
                aria-pressed={wallet.isDefault}
                aria-label={wallet.isDefault ? `${wallet.name} is your default wallet` : `Set ${wallet.name} as default wallet`}
                style={{ position: "static" }}
              >
                <Star size={13} fill={wallet.isDefault ? "currentColor" : "none"} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <p className={styles.walletGridBalance}>{formatMoney(wallet.balanceMinor, wallet.currency)}</p>
            <p className={styles.walletGridCurrency}>{wallet.currency}{wallet.isDefault ? " · Default" : ""}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
