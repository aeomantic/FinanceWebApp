"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/dashboard/summary";

export type BalanceAction = "pay" | "transfer" | "receive";
export interface BalanceCardProps {
  currency: string;
  balanceMinor: number;
  deltaMinor: number;
  demo?: boolean;
  onAction: (action: BalanceAction) => void;
}

export function BalanceCard({ currency, balanceMinor, deltaMinor, demo = false, onAction }: BalanceCardProps) {
  const [hidden, setHidden] = useState(false);
  return (
    <section className="balance-card" aria-labelledby="balance-heading">
      <div className="balance-topline">
        <span className="eyebrow" id="balance-heading">{demo ? "TOTAL BALANCE" : "NET RECORDED CASHFLOW"}</span>
        <button className="balance-visibility" aria-label={hidden ? "Show balance" : "Hide balance"} onClick={() => setHidden(!hidden)}><Icon name={hidden ? "eye-off" : "eye"} size={18} /></button>
      </div>
      <div className="balance-currency"><span className="currency-flag">{currency === "USD" ? "🇺🇸" : currency === "EUR" ? "🇪🇺" : currency === "GBP" ? "🇬🇧" : "◉"}</span>{currency}<span className="exchange-badge">{demo && currency === "USD" ? "1 USD = EUR 0.95" : "Your currency, your clarity"}</span></div>
      <div className="balance-amount tabular" aria-live="polite">{hidden ? "••,•••.••" : formatMoney(balanceMinor, currency)}</div>
      <div className="balance-change"><span className="delta-badge"><Icon name={deltaMinor >= 0 ? "arrow-up-right" : "arrow-down-left"} size={13} />{hidden ? "•••" : `${deltaMinor >= 0 ? "+" : ""}${formatMoney(deltaMinor, currency)}`}</span><span>{demo ? "this month" : "recorded this month"}</span></div>
      <div className="balance-actions">
        <button onClick={() => onAction("pay")}><Icon name="arrow-up-right" size={18} />Pay</button>
        <button onClick={() => onAction("transfer")}><Icon name="transfer" size={18} />Transfer</button>
        <button onClick={() => onAction("receive")}><Icon name="arrow-down-left" size={18} />Receive</button>
      </div>
      <span className="balance-art" aria-hidden="true" />
    </section>
  );
}
