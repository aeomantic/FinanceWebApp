import type { MetadataRoute } from "next";

// A dark background_color is what turns the PWA cold-start splash from a stark
// white screen (with the default triangle icon) into Folio's dark canvas.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Folio Finance",
    short_name: "Folio",
    description: "A calmer way to money. Track balances, spending, goals, and everyday finances.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#121413",
    theme_color: "#121413",
    icons: [
      { src: "/icons/folio-mark.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
