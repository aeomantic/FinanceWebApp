export default function SettingsLoading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-label="Loading your settings">
      <div className="loading-logo">folio<span>.</span></div>
      <p>Getting your settings ready...</p>
      <div className="loading-grid"><div /><div /><div /><div /></div>
    </main>
  );
}
