"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import styles from "./components.module.css";

export interface CurrencySelectorProps {
  selectedCurrency: string;
  onSelect: (currency: string) => void;
  demo?: boolean;
}

const CURRENCIES = [
  { code: "USD", name: "US dollar", symbol: "$", demoRate: "1.00", tone: "mint" },
  { code: "EUR", name: "Euro", symbol: "€", demoRate: "0.95", tone: "mint" },
  { code: "GBP", name: "British pound", symbol: "£", demoRate: "0.82", tone: "blue" },
  { code: "SGD", name: "Singapore dollar", symbol: "S$", demoRate: "1.30", tone: "peach" },
  { code: "AUD", name: "Australian dollar", symbol: "A$", demoRate: "1.50", tone: "blue" },
  { code: "CAD", name: "Canadian dollar", symbol: "C$", demoRate: "1.36", tone: "peach" },
  { code: "CHF", name: "Swiss franc", symbol: "Fr", demoRate: "0.88", tone: "peach" },
] as const;

export function CurrencySelector({ selectedCurrency, onSelect, demo = false }: CurrencySelectorProps) {
  const [addedCurrencies, setAddedCurrencies] = useState<string[]>(["USD", "EUR", "GBP"]);
  const [currencyToAdd, setCurrencyToAdd] = useState("SGD");
  const dialog = useRef<HTMLDialogElement>(null);
  const instanceId = useId();
  const currencyCodes = [...new Set([...addedCurrencies, selectedCurrency])];
  const visible = CURRENCIES.filter((currency) => currencyCodes.includes(currency.code));
  const available = CURRENCIES.filter((currency) => !currencyCodes.includes(currency.code));

  function openCurrencyDialog() {
    if (!available[0]) return;
    setCurrencyToAdd(available[0].code);
    dialog.current?.showModal();
  }

  function addCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available.some((currency) => currency.code === currencyToAdd)) return;
    setAddedCurrencies([...currencyCodes, currencyToAdd]);
    onSelect(currencyToAdd);
    dialog.current?.close();
  }

  return (
    <section className={`surface-card ${styles.currencySection}`} aria-labelledby={`${instanceId}-heading`}>
      <div className={styles.cardHeading}>
        <div><p className={styles.eyebrow}>A WORLD OF POSSIBILITIES</p><h2 id={`${instanceId}-heading`}>Your currencies</h2></div>
        <span className={styles.currencyGlobe} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 7h14M5 17h14" /></svg></span>
      </div>
      <div className={styles.currencyCards} role="group" aria-label="Display currency">
        <div className={styles.currencyScroller}>
        {visible.map((currency) => (
          <button type="button" key={currency.code} className={`${styles.currencyCard} ${selectedCurrency === currency.code ? styles.selectedCurrency : ""}`} onClick={() => onSelect(currency.code)} aria-pressed={selectedCurrency === currency.code}>
            <span className={styles.currencyTop}><span className={`${styles.currencySymbol} ${styles[currency.tone]}`}>{currency.symbol}</span><span className={styles.currencyCode}>{currency.code}</span></span>
            <span className={styles.currencyName}>{currency.name}</span>
            <span className={styles.currencyValue}>{demo ? `${currency.symbol} ${currency.demoRate}` : currency.symbol}<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" /></svg></span>
          </button>
        ))}
        </div>
        <button type="button" className={styles.addCurrency} onClick={openCurrencyDialog} disabled={available.length === 0} aria-haspopup="dialog"><span className={styles.addSymbol} aria-hidden="true">+</span><span>{available.length ? <>Add<br />currency</> : <>All currencies<br />added</>}</span></button>
      </div>
      <p className={styles.currencyNote}>{demo ? "Illustrative rates per 1 USD · Not live exchange rates" : "Choose the currency used to display your overview."}</p>
      <dialog ref={dialog} className={styles.currencyDialog} aria-labelledby={`${instanceId}-dialog-title`} aria-describedby={`${instanceId}-dialog-description`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <form onSubmit={addCurrency} className={styles.dialogContent}>
          <div className={styles.dialogHeading}><h2 id={`${instanceId}-dialog-title`}>A little more global.</h2><button type="button" className={styles.closeDialog} onClick={() => dialog.current?.close()} aria-label="Close add currency dialog">×</button></div>
          <p id={`${instanceId}-dialog-description`}>Add a currency to your overview and make it your display currency.</p>
          <label htmlFor={`${instanceId}-new-currency`}>Currency</label>
          <select id={`${instanceId}-new-currency`} value={currencyToAdd} onChange={(event) => setCurrencyToAdd(event.target.value)}>
            {available.map((currency) => <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>)}
          </select>
          <button type="submit" className={styles.dialogSubmit}>Add currency<span aria-hidden="true">↗</span></button>
        </form>
      </dialog>
    </section>
  );
}
