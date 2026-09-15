import type { SVGProps } from "react";

export type IconName = "home" | "activity" | "wallet" | "arrow-up-right" | "arrow-down-left" | "transfer" | "search" | "bell" | "chevron-down" | "arrow-right" | "plus" | "close" | "eye" | "eye-off" | "logout" | "help" | "check" | "download" | "calendar" | "shield" | "settings" | "trash" | "pencil";
const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  activity: <><path d="M4 20V10m8 10V4m8 16v-7" /><path d="M2 20h20" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 8V5a2 2 0 0 1 2-2h12m4 8h-6v5h6" /><circle cx="16" cy="13.5" r=".5" /></>,
  "arrow-up-right": <path d="M6 18 18 6M6 6h12v12" />,
  "arrow-down-left": <path d="M18 6 6 18M6 6v12h12" />,
  transfer: <><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="m3 3 18 18M9 5.5A12 12 0 0 1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 4M6 6C3.5 8.3 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.2-1.5M10 10a3 3 0 0 0 4 4" /></>,
  logout: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.3a2 2 0 0 1-2 1.7H9.7a2 2 0 0 1-2-1.7L7 7" /><path d="M10 11v6M14 11v6" /></>,
  pencil: <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 6.5 3 3" /></>,
};

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 28 28" fill="none"><path d="M7 21V7h6l8 14h-6L7 7m14 0v9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}
