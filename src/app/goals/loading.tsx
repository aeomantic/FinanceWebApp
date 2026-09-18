export default function GoalsLoading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-label="Loading your goals">
      <div className="loading-logo">folio<span>.</span></div>
      <p>Gathering your goals...</p>
      <div className="loading-grid"><div /><div /><div /><div /></div>
    </main>
  );
}
