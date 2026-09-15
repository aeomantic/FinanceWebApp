"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function MobileNav({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const isWallets = pathname === "/wallets";
  const isTransactions = pathname === "/transactions";
  const isHome = !isWallets && !isTransactions;
  const homeHref = demo ? "/preview" : "/dashboard";
  const walletsHref = demo ? "/preview" : "/wallets";
  const transactionsHref = demo ? "/preview" : "/transactions";

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link
        href={transactionsHref}
        className={isTransactions ? "mobile-nav-pill-active" : ""}
        aria-label="Transactions"
        aria-current={isTransactions ? "page" : undefined}
      >
        <Icon name="transfer" />
      </Link>
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
        className={isWallets ? "mobile-nav-pill-active" : ""}
        aria-label="Wallets"
        aria-current={isWallets ? "page" : undefined}
      >
        <Icon name="wallet" />
      </Link>
    </nav>
  );
}
