"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createWallet } from "@/app/dashboard/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/dashboard/summary";
import type { Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

export interface AddWalletDialogProps {
  demo?: boolean;
  onCreated: (wallet: Wallet) => void;
  /** Render-prop for the trigger, so each caller can use its own trigger
   * markup (a compact "+" tile, a full-width card, ...) while sharing the
   * same dialog/form/validation logic underneath. */
  children: (open: () => void) => ReactNode;
}

export function AddWalletDialog({ demo = false, onCreated, children }: AddWalletDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<string>(SUPPORTED_CURRENCIES[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const instanceId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (isOpen) element.showModal();
    else if (element.open) element.close();
  }, [isOpen]);

  function openDialog() {
    if (demo) return;
    setName("");
    setCurrency(SUPPORTED_CURRENCIES[0]);
    setError("");
    setIsOpen(true);
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
    setIsOpen(false);
  }

  return (
    <>
      {children(openDialog)}
      <dialog
        ref={dialog}
        className={styles.currencyDialog}
        aria-labelledby={`${instanceId}-dialog-title`}
        onClose={() => setIsOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}
      >
        <form onSubmit={submit} className={styles.dialogContent}>
          <div className={styles.dialogHeading}><h2 id={`${instanceId}-dialog-title`}>A new wallet.</h2><button type="button" className={styles.closeDialog} onClick={() => setIsOpen(false)} aria-label="Close add wallet dialog">×</button></div>
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
    </>
  );
}
