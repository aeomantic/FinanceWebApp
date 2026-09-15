"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function MobileNav({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const isWallets = pathname === "/wallets";
  const isHome = !isWallets;
  const homeHref = demo ? "/preview" : "/dashboard";
  const walletsHref = demo ? "/preview" : "/wallets";
  // Same-page anchor when already on the dashboard; navigate there and
  // scroll once loaded when coming from anywhere else.
  const transactionsHref = isWallets ? `${homeHref}#transactions` : "#transactions";

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link href={transactionsHref} aria-label="Transactions"><Icon name="transfer" /></Link>
      <Link
        href={homeHref}
        className={`mobile-home ${isHome ? "mobile-home-active" : ""}`}
        aria-label="Overview"
        aria-current={isHome ? "page" : undefined}
      >
        <Icon name="home" />
      </Link>
      <Link
        href={walletsHref}
        className={isWallets ? "mobile-wallets-active" : ""}
        aria-label="Wallets"
        aria-current={isWallets ? "page" : undefined}
      >
        <Icon name="wallet" />
      </Link>
    </nav>
  );
}
