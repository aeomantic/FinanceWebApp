"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { saveInvestment } from "@/app/investments/actions";
import { SECTORS, investmentDecimal, type InvestmentInput } from "@/lib/investments/validation";
import type { InvestmentPosition } from "@/lib/portfolio";

export function InvestmentDialog({ position, wallets, onClose, onSaved }: {
  position?: InvestmentPosition; wallets: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const input: InvestmentInput = { id: position?.id, ticker: value("ticker"), name: value("name"), shares: value("shares"), buy_price: value("buy_price"),
      currency: value("currency") as InvestmentInput["currency"], sector: value("sector") as InvestmentInput["sector"], wallet_id: value("wallet_id"), notes: value("notes") };
    startTransition(async () => {
      setError("");
      try {
        const result = await saveInvestment(input);
        if (!result.success) { setError(result.error ?? "Couldn't save this holding."); return; }
        onSaved();
      } catch { setError("Couldn't save this holding. Please try again."); }
    });
  }
  return <Modal title={position ? "Edit holding" : "Add stock"} busy={pending} onClose={onClose}>
    <form onSubmit={submit} className="investment-form">
      <fieldset disabled={pending}>
        <label>Ticker symbol<input name="ticker" required autoFocus maxLength={25} placeholder="AAPL" defaultValue={position?.ticker} autoCapitalize="characters" /></label>
        <label>Company / asset name<input name="name" required maxLength={100} placeholder="Apple Inc." defaultValue={position?.name} /></label>
        <div className="investment-form-grid">
          <label>Number of shares<input name="shares" required type="number" inputMode="decimal" min="0.00000001" max="1000000000" step="any" placeholder="10.5" defaultValue={position ? investmentDecimal(position.shares) : undefined} /></label>
          <label>Average purchase price<input name="buy_price" required type="number" inputMode="decimal" min="0" max="1000000000" step="any" placeholder="150.00" defaultValue={position ? investmentDecimal(position.buy_price) : undefined} /></label>
        </div>
        <div className="investment-form-grid">
          <label>Currency<select name="currency" defaultValue={position?.currency ?? "USD"}>{["USD", "SGD", "MYR", "EUR", "GBP", "JPY", "AUD", "CAD", "HKD"].map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Sector<select name="sector" defaultValue={position?.sector ?? "Technology"}>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></label>
        </div>
        <label>Linked wallet (optional)<select name="wallet_id" defaultValue={position?.wallet_id ?? ""}><option value="">No linked wallet</option>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>Notes (optional)<textarea name="notes" maxLength={1000} rows={2} defaultValue={position?.notes ?? ""} /></label>
      </fieldset>
      <p className="investment-muted text-xs">Wallet links are for tracking. Saving a holding does not change your cash balance. Live quotes cover USD US-listed stocks and ETFs.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" disabled={pending} className="primary-button">{pending ? "Saving…" : position ? "Save changes" : "Add holding"}</button>
    </form>
  </Modal>;
}
