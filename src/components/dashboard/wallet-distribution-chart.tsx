"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts";
import { formatMoney } from "@/lib/dashboard/summary";
import type { Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

const SLICE_COLORS = ["#fef38b", "#a9c6ab", "#a9c3db", "#e3b9a0", "#c6b3db", "#dba9bd"];

function ShareTooltip({ active, payload, currency }: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className={styles.donutTooltip}>
      {formatMoney(Number(entry.value ?? 0), currency)} <span>&middot;</span> {entry.name}
    </div>
  );
}

export interface WalletDistributionChartProps {
  wallets: Wallet[];
  currency: string;
  otherCurrencyCount: number;
}

export function WalletDistributionChart({ wallets, currency, otherCurrencyCount }: WalletDistributionChartProps) {
  const data = wallets.filter((wallet) => wallet.balanceMinor > 0).map((wallet) => ({ name: wallet.name, value: wallet.balanceMinor }));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className={`surface-card ${styles.donutCard}`} aria-labelledby="assets-heading">
      <div className={styles.cardHeading}>
        <div>
          <p className={styles.eyebrow}>YOUR ASSETS</p>
          <h2 id="assets-heading">{formatMoney(total, currency)}</h2>
        </div>
      </div>
      {data.length === 0 ? (
        <div className={`${styles.emptyState} ${styles.chartEmpty}`}>
          <p>Add a balance to a {currency} wallet to see how your money is spread out.</p>
        </div>
      ) : (
        <>
          <div className={styles.donutChartArea}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={64} outerRadius={92} paddingAngle={data.length > 1 ? 3 : 0} stroke="none">
                  {data.map((entry, index) => <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={(props) => <ShareTooltip {...props} currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutCenter} aria-hidden="true">
              <strong>{wallets.length}</strong>
              <span>wallet{wallets.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <ul className={styles.donutLegend}>
            {data.map((entry, index) => (
              <li key={entry.name}>
                <span className={styles.donutLegendDot} style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }} aria-hidden="true" />
                <span className={styles.donutLegendName}>{entry.name}</span>
                <span className={styles.donutLegendShare}>{total > 0 ? Math.round((entry.value / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {otherCurrencyCount > 0 && (
        <p className={styles.donutNote}>
          {otherCurrencyCount} wallet{otherCurrencyCount === 1 ? "" : "s"} in other currencies {otherCurrencyCount === 1 ? "isn't" : "aren't"} shown here — currencies aren&apos;t converted or mixed together.
        </p>
      )}
    </section>
  );
}
