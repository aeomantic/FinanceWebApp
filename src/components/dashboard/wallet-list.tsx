"use client";

import { useId } from "react";
import { WalletCardMenu } from "./wallet-card-menu";
import { AddWalletDialog } from "./add-wallet-dialog";
import { formatMoney, maskMoney } from "@/lib/dashboard/summary";
import type { Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

const TONES = ["mint", "blue", "peach"] as const;

export interface WalletListProps {
  wallets: Wallet[];
  selectedWalletId: string | null;
  onSelect: (walletId: string) => void;
  onCreated: (wallet: Wallet) => void;
  onChanged: () => void;
  hiddenWalletIds: Set<string>;
  onToggleHideBalance: (walletId: string) => void;
  demo?: boolean;
}

export function WalletList({ wallets, selectedWalletId, onSelect, onCreated, onChanged, hiddenWalletIds, onToggleHideBalance, demo = false }: WalletListProps) {
  const instanceId = useId();

  return (
    <section className={`surface-card ${styles.currencySection}`} aria-labelledby={`${instanceId}-heading`}>
      <div className={styles.cardHeading}>
        <div><p className={styles.eyebrow}>YOUR WALLETS</p><h2 id={`${instanceId}-heading`}>Your wallets</h2></div>
        <span className={styles.currencyGlobe} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg></span>
      </div>
      <div className={styles.currencyCards} role="group" aria-label="Wallets">
        <div className={styles.currencyScroller}>
          {wallets.map((wallet, index) => (
            <div
              key={wallet.id}
              className={`${styles.currencyCard} ${selectedWalletId === wallet.id ? styles.selectedCurrency : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={selectedWalletId === wallet.id}
              onClick={() => onSelect(wallet.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(wallet.id); }
              }}
            >
              <span className={styles.currencyTop}>
                <span className={`${styles.currencySymbol} ${styles[wallet.color && TONES.includes(wallet.color as typeof TONES[number]) ? wallet.color : TONES[index % TONES.length]]}`}>{wallet.name.slice(0, 1).toUpperCase()}</span>
                <span className={styles.currencyTopRight}>
                  <span className={styles.currencyCode}>{wallet.currency}</span>
                  <WalletCardMenu
                    wallet={wallet}
                    demo={demo}
                    canDelete={wallets.length > 1}
                    isBalanceHidden={hiddenWalletIds.has(wallet.id)}
                    onToggleHideBalance={onToggleHideBalance}
                    onChanged={onChanged}
                  />
                </span>
              </span>
              <span className={styles.currencyName}>{wallet.name}{wallet.isDefault && <span className={styles.defaultLabel}>Default</span>}</span>
              <span className={styles.currencyValue}>{hiddenWalletIds.has(wallet.id) ? maskMoney(wallet.currency) : formatMoney(wallet.balanceMinor, wallet.currency)}</span>
            </div>
          ))}
        </div>
        <AddWalletDialog demo={demo} onCreated={onCreated}>
          {(open) => (
            <button type="button" className={styles.addCurrency} onClick={open} disabled={demo} aria-haspopup="dialog">
              <span className={styles.addSymbol} aria-hidden="true">+</span><span>Add<br />wallet</span>
            </button>
          )}
        </AddWalletDialog>
      </div>
      <p className={styles.currencyNote}>{demo ? "You're viewing sample wallets." : "Pick a wallet to see its balance and activity, or use the menu to manage wallet settings."}</p>
    </section>
  );
}
