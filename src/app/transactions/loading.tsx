export default function TransactionsLoading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-label="Loading your transactions">
      <div className="loading-logo">folio<span>.</span></div>
      <p>Lining up your transactions...</p>
      <div className="loading-grid"><div /><div /><div /><div /></div>
    </main>
  );
}
