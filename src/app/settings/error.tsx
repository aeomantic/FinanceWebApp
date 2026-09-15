"use client";

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="dashboard-loading"><div className="surface-card error-card"><h1>Your settings need a moment.</h1><p>We couldn’t load your data. Please try again.</p><button className="primary-button" onClick={reset}>Try again</button></div></main>;
}
