"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark, Icon } from "@/components/ui/icon";
import { MobileNav } from "./mobile-nav";
import { WalletCardMenu } from "./wallet-card-menu";
import { AddWalletDialog } from "./add-wallet-dialog";
import { WalletDistributionChart } from "./wallet-distribution-chart";
import { formatMoney, maskMoney } from "@/lib/dashboard/summary";
import { DEMO_WALLETS } from "@/lib/dashboard/demo";
import { useHiddenWallets } from "@/lib/dashboard/use-hidden-wallets";
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
  const [wallets, setWallets] = useState(demo ? DEMO_WALLETS : initialWallets);
  const name = fullName.split(" ")[0] || "there";
  const { hiddenIds, toggle } = useHiddenWallets();
  const currencyCounts = new Map<string, number>();
  for (const wallet of wallets) currencyCounts.set(wallet.currency, (currencyCounts.get(wallet.currency) ?? 0) + 1);
  const primaryCurrency = (wallets.find((wallet) => wallet.isDefault) ?? wallets[0])?.currency
    ?? [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? "SGD";
  const primaryWallets = wallets.filter((wallet) => wallet.currency === primaryCurrency);
  const otherCurrencyCount = wallets.length - primaryWallets.length;

  function handleChanged() {
    router.refresh();
  }

  return (
    <div className="app-frame">
      <a href="#wallets-main" className="skip-link">Skip to wallets</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href={demo ? "/preview" : "/dashboard"} className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <Link href={demo ? "/preview" : "/dashboard"} className="rail-link" aria-label="Overview" title="Overview"><Icon name="home" /></Link>
          <Link href={demo ? "/preview" : "/transactions"} className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
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
            <Link href={demo ? "/preview" : "/transactions"}>Transactions</Link>
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
            <div className="wallets-donut-area">
              <WalletDistributionChart wallets={primaryWallets} currency={primaryCurrency} otherCurrencyCount={otherCurrencyCount} />
            </div>
            <div className="wallets-grid-area">
              <WalletGrid
                wallets={wallets}
                demo={demo}
                hiddenIds={hiddenIds}
                onToggleHideBalance={toggle}
                onChanged={handleChanged}
                onCreated={(wallet) => { setWallets((previous) => [...previous, wallet]); router.refresh(); }}
              />
            </div>
          </div>

          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>{demo ? "Demo data" : "Balances shown are recorded activity, not a bank feed."}</span><div>{demo ? <Link href="/login">Sign in<Icon name="arrow-right" size={14} /></Link> : <SignOutButton />}</div></footer>
        </main>
      </div>

      <MobileNav demo={demo} />
    </div>
  );
}

function WalletGrid({ wallets, demo, hiddenIds, onToggleHideBalance, onChanged, onCreated }: {
  wallets: Wallet[];
  demo: boolean;
  hiddenIds: Set<string>;
  onToggleHideBalance: (walletId: string) => void;
  onChanged: () => void;
  onCreated: (wallet: Wallet) => void;
}) {
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
              <WalletCardMenu
                wallet={wallet}
                demo={demo}
                canDelete={wallets.length > 1}
                isBalanceHidden={hiddenIds.has(wallet.id)}
                onToggleHideBalance={onToggleHideBalance}
                onChanged={onChanged}
              />
            </div>
            <p className={styles.walletGridBalance}>{hiddenIds.has(wallet.id) ? maskMoney(wallet.currency) : formatMoney(wallet.balanceMinor, wallet.currency)}</p>
            <p className={styles.walletGridCurrency}>{wallet.currency}{wallet.isDefault ? " · Default" : ""}</p>
          </li>
        ))}
        <li>
          <AddWalletDialog demo={demo} onCreated={onCreated}>
            {(open) => (
              <button type="button" className={styles.walletGridAdd} onClick={open} disabled={demo} aria-haspopup="dialog">
                <span aria-hidden="true">+</span> Add wallet
              </button>
            )}
          </AddWalletDialog>
        </li>
      </ul>
    </section>
  );
}
