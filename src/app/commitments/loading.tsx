export default function CommitmentsLoading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-label="Loading your commitments">
      <div className="loading-logo">folio<span>.</span></div>
      <p>Gathering your commitments...</p>
      <div className="loading-grid"><div /><div /><div /><div /></div>
    </main>
  );
}
