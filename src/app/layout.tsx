import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/auth/auth-session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Folio",
  title: "Folio | A calmer way to money",
  description: "Your personal money journal. A clearer view of your balance, spending, and everyday finances.",
  manifest: "/manifest.webmanifest",
  // Makes the installed PWA open standalone with a Folio title bar instead of
  // browser chrome, and use the dark status bar that matches the splash.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Folio" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/folio-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

// A dark theme-color keeps the mobile browser/PWA status bar area from flashing
// white on launch; viewportFit: "cover" lets the app paint under the notch.
export const viewport: Viewport = {
  themeColor: "#121413",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body className="min-h-full"><ThemeProvider><AuthSessionProvider>{children}</AuthSessionProvider></ThemeProvider></body>
    </html>
  );
}
