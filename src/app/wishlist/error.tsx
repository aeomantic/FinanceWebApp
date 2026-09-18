"use client";

export default function WishlistError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="dashboard-loading"><div className="surface-card error-card"><h1>Your wishlist needs a moment.</h1><p>We could not load your data. Please try again.</p><button className="primary-button" onClick={reset}>Try again</button></div></main>;
}
