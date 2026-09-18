// Root-level splash shown during navigation/Suspense and, importantly, on PWA
// cold start. It is always the dark Folio canvas (matching the manifest
// background_color) so the app never flashes a white screen before it renders.
// Hand-authored classes, not Tailwind utilities, per the project's CSS convention.
export default function Loading() {
  return (
    <div className="folio-splash" role="status" aria-live="polite">
      <div className="folio-splash-mark">
        <span className="folio-splash-word">folio<span className="folio-splash-dot">.</span></span>
        <span className="folio-splash-spark" aria-hidden="true">✻</span>
      </div>
      <p className="folio-splash-caption">Loading your finances</p>
    </div>
  );
}
