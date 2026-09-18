export default function WishlistLoading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-label="Loading your wishlist">
      <div className="loading-logo">folio<span>.</span></div>
      <p>Gathering your wishlist...</p>
      <div className="loading-grid"><div /><div /><div /><div /></div>
    </main>
  );
}
