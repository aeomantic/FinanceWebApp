"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { createWallet, setDefaultWallet } from "@/app/dashboard/actions";
import { formatMoney } from "@/lib/dashboard/summary";
import { SUPPORTED_CURRENCIES } from "@/lib/dashboard/summary";
import type { Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

const TONES = ["mint", "blue", "peach"] as const;

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.3 6.3L12 17.1 6.4 20.3l1.3-6.3-4.7-4.4 6.3-.7Z" />
    </svg>
  );
}

export interface WalletListProps {
  wallets: Wallet[];
  selectedWalletId: string | null;
  onSelect: (walletId: string) => void;
  onCreated: (wallet: Wallet) => void;
  onDefaultChanged: () => void;
  demo?: boolean;
}

export function WalletList({ wallets, selectedWalletId, onSelect, onCreated, onDefaultChanged, demo = false }: WalletListProps) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<string>(SUPPORTED_CURRENCIES[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [, startDefaultTransition] = useTransition();
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const instanceId = useId();

  function openDialog() {
    if (demo) return;
    setName("");
    setCurrency(SUPPORTED_CURRENCIES[0]);
    setError("");
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const result = await createWallet({ name, currency });
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    onCreated(result.wallet);
    dialog.current?.close();
  }

  function handleSetDefault(walletId: string) {
    if (demo) return;
    setPendingWalletId(walletId);
    startDefaultTransition(async () => {
      await setDefaultWallet(walletId);
      onDefaultChanged();
      setPendingWalletId(null);
    });
  }

  return (
    <section className={`surface-card ${styles.currencySection}`} aria-labelledby={`${instanceId}-heading`}>
      <div className={styles.cardHeading}>
        <div><p className={styles.eyebrow}>YOUR WALLETS</p><h2 id={`${instanceId}-heading`}>Your wallets</h2></div>
        <span className={styles.currencyGlobe} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg></span>
      </div>
      <div className={styles.currencyCards} role="group" aria-label="Wallets">
        <div className={styles.currencyScroller}>
          {wallets.map((wallet, index) => (
            <div key={wallet.id} className={`${styles.currencyCard} ${selectedWalletId === wallet.id ? styles.selectedCurrency : ""}`}>
              <button
                type="button"
                className={`${styles.defaultToggle} ${wallet.isDefault ? styles.defaultToggleActive : ""}`}
                onClick={() => handleSetDefault(wallet.id)}
                disabled={demo || wallet.isDefault || pendingWalletId === wallet.id}
                aria-pressed={wallet.isDefault}
                aria-label={wallet.isDefault ? `${wallet.name} is your default wallet` : `Set ${wallet.name} as default wallet`}
              >
                <StarIcon filled={wallet.isDefault} />
              </button>
              <button
                type="button"
                className={styles.currencyCardInner}
                onClick={() => onSelect(wallet.id)}
                aria-pressed={selectedWalletId === wallet.id}
              >
                <span className={styles.currencyTop}>
                  <span className={`${styles.currencySymbol} ${styles[wallet.color && TONES.includes(wallet.color as typeof TONES[number]) ? wallet.color : TONES[index % TONES.length]]}`}>{wallet.name.slice(0, 1).toUpperCase()}</span>
                  <span className={styles.currencyCode}>{wallet.currency}</span>
                </span>
                <span className={styles.currencyName}>{wallet.name}</span>
                <span className={styles.currencyValue}>{formatMoney(wallet.balanceMinor, wallet.currency)}</span>
                {wallet.isDefault && <span className={styles.defaultBadge}><StarIcon filled />Default</span>}
              </button>
            </div>
          ))}
        </div>
        <button type="button" className={styles.addCurrency} onClick={openDialog} disabled={demo} aria-haspopup="dialog">
          <span className={styles.addSymbol} aria-hidden="true">+</span><span>Add<br />wallet</span>
        </button>
      </div>
      <p className={styles.currencyNote}>{demo ? "You're viewing sample wallets." : "Pick a wallet to see its balance and activity, or star one as your default."}</p>
      <dialog ref={dialog} className={styles.currencyDialog} aria-labelledby={`${instanceId}-dialog-title`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <form onSubmit={submit} className={styles.dialogContent}>
          <div className={styles.dialogHeading}><h2 id={`${instanceId}-dialog-title`}>A new wallet.</h2><button type="button" className={styles.closeDialog} onClick={() => dialog.current?.close()} aria-label="Close add wallet dialog">×</button></div>
          <p>Give it a name and a currency. You can track balances separately for each wallet.</p>
          <label htmlFor={`${instanceId}-wallet-name`}>Name</label>
          <input id={`${instanceId}-wallet-name`} required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Food & Groceries" disabled={pending} style={{ width: "100%", padding: 13, border: "1px solid #dfe5da", borderRadius: 12, background: "#fafcf8", font: "inherit", fontSize: 14, marginBottom: 16 }} />
          <label htmlFor={`${instanceId}-wallet-currency`}>Currency</label>
          <select id={`${instanceId}-wallet-currency`} value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={pending}>
            {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          {error && <p role="alert" style={{ color: "#b33b31", fontSize: 12, marginTop: 12 }}>{error}</p>}
          <button type="submit" className={styles.dialogSubmit} disabled={pending}>{pending ? "Creating..." : "Create wallet"}<span aria-hidden="true">↗</span></button>
        </form>
      </dialog>
    </section>
  );
}
