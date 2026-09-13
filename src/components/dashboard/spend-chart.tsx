"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./components.module.css";

export interface SpendPoint {
  label: string;
  amountMinor: number;
}

export interface SpendChartProps {
  points: SpendPoint[];
  currency: string;
}

type ChartRange = "year" | "half" | "quarter";
const RANGE_LENGTHS: Record<ChartRange, number> = { year: 12, half: 6, quarter: 3 };

export function SpendChart({ points, currency }: SpendChartProps) {
  const [range, setRange] = useState<ChartRange>("year");
  const [activeLabel, setActiveLabel] = useState<string | null>(points[Math.min(4, points.length - 1)]?.label ?? null);
  const bars = useRef<Array<SVGRectElement | null>>([]);
  const instanceId = useId().replaceAll(":", "");
  const titleId = `${instanceId}-title`;
  const regularPatternId = `${instanceId}-dots`;
  const selectedPatternId = `${instanceId}-selected`;
  const visiblePoints = points.slice(-RANGE_LENGTHS[range]);
  const selectedIndex = Math.max(0, visiblePoints.findIndex((point) => point.label === activeLabel));
  const selected = visiblePoints[selectedIndex];
  const totalMinor = visiblePoints.reduce((sum, point) => sum + Math.max(0, point.amountMinor), 0);
  const maxMinor = Math.max(1, ...visiblePoints.map((point) => point.amountMinor));
  const money = (amountMinor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
  const plotWidth = 624;
  const plotHeight = 114;
  const plotTop = 48;
  const plotBottom = plotTop + plotHeight;
  const columnWidth = plotWidth / Math.max(1, visiblePoints.length);
  const barWidth = Math.min(36, columnWidth - 10);
  const activeX = 8 + columnWidth * (selectedIndex + 0.5);
  const tooltipWidth = 158;
  const tooltipX = Math.min(640 - tooltipWidth - 8, Math.max(8, activeX + 12));

  function navigateBar(event: KeyboardEvent<SVGRectElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % visiblePoints.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + visiblePoints.length) % visiblePoints.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visiblePoints.length - 1;
    else if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setActiveLabel(visiblePoints[nextIndex].label);
    bars.current[nextIndex]?.focus();
  }

  return (
    <section className={`surface-card ${styles.spendCard}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div><p className={styles.eyebrow}>THE BIG PICTURE</p><h2 id={titleId}>Total Rate</h2></div>
        <div className={styles.rangeSelect}>
          <label htmlFor={`${instanceId}-range`} className={styles.srOnly}>Spending time range</label>
          <select id={`${instanceId}-range`} value={range} onChange={(event) => setRange(event.target.value as ChartRange)}>
            <option value="year">Yearly</option><option value="half">6 months</option><option value="quarter">3 months</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
        </div>
      </div>
      <div className={styles.spendSummary}><span className={styles.totalSpend}>{money(totalMinor)}</span><span className={styles.totalSpendLabel}>Total spend</span></div>
      {visiblePoints.length === 0 || totalMinor === 0 ? (
        <div className={`${styles.emptyState} ${styles.chartEmpty}`}><span className={styles.emptyIcon} aria-hidden="true">↗</span><h3>Your spending story starts here</h3><p>Add an expense to see your activity over time.</p></div>
      ) : (
        <figure className={styles.chartFigure}>
          <svg className={styles.chart} viewBox="0 0 640 192" role="group" aria-label={`Spending chart, ${visiblePoints.length} periods. Use the arrow keys to explore each period.`}>
            <defs>
              <pattern id={regularPatternId} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.5" fill="#a0a59f" /></pattern>
              <pattern id={selectedPatternId} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.65" fill="#d6d929" /></pattern>
            </defs>
            {[0.33, 0.66, 1].map((fraction) => <line key={fraction} x1="8" x2="632" y1={plotBottom - fraction * plotHeight} y2={plotBottom - fraction * plotHeight} stroke="#f0f1ee" strokeDasharray="3 6" />)}
            {visiblePoints.map((point, index) => {
              const height = Math.max(0, point.amountMinor) / maxMinor * plotHeight;
              const x = 8 + columnWidth * (index + 0.5) - barWidth / 2;
              const isSelected = index === selectedIndex;
              return <g key={`${point.label}-${index}`}>
                <rect x={x} y={plotBottom - height} width={barWidth} height={height} rx="3" fill={`url(#${isSelected ? selectedPatternId : regularPatternId})`} />
                <text x={x + barWidth / 2} y="184" textAnchor="middle" className={isSelected ? styles.activeAxisLabel : styles.axisLabel}>{point.label}</text>
                <rect
                  ref={(element) => { bars.current[index] = element; }}
                  x={8 + columnWidth * index + 2} y={plotTop} width={columnWidth - 4} height={plotHeight + 3} rx="5"
                  fill="transparent" className={styles.chartBarTarget} role="button" tabIndex={isSelected ? 0 : -1}
                  aria-label={`${point.label}: ${money(point.amountMinor)} spent`} aria-pressed={isSelected}
                  onPointerEnter={() => setActiveLabel(point.label)} onFocus={() => setActiveLabel(point.label)}
                  onClick={() => setActiveLabel(point.label)} onKeyDown={(event) => navigateBar(event, index)}
                />
              </g>;
            })}
            {selected ? <g className={styles.chartTooltip} aria-hidden="true">
              <line x1={activeX} x2={activeX} y1="25" y2={plotBottom} stroke="#d6d929" strokeWidth="1.5" strokeDasharray="3 4" />
              <circle cx={activeX} cy="25" r="5" fill="white" stroke="#d6d929" strokeWidth="2.5" />
              <rect x={tooltipX} y="4" width={tooltipWidth} height="42" rx="11" fill="#fef38b" />
              <text x={tooltipX + 12} y="23" className={styles.tooltipValue}>{money(selected.amountMinor)}</text>
              <text x={tooltipX + 12} y="37" className={styles.tooltipLabel}>{selected.label} · Total spend</text>
            </g> : null}
          </svg>
          <figcaption className={styles.chartCaption}><span><span className={styles.chartLegendDot} />Spending activity</span><span>Explore each month</span></figcaption>
        </figure>
      )}
    </section>
  );
}
