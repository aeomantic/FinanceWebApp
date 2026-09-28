"use client";
export default function InvestmentsError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-4 py-16"><div className="dashboard-alert" role="alert">Couldn&apos;t load your portfolio.<button onClick={reset}>Try again</button></div></main>;
}
