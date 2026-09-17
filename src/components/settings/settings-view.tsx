"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { AppearanceCard } from "./appearance-card";
import { ProfileCard } from "./profile-card";
import { WalletsCard } from "./wallets-card";
import { CategoriesCard } from "./categories-card";
import type { SettingsData } from "@/lib/settings/types";
import styles from "./settings.module.css";

export function SettingsView({ data }: { data: SettingsData }) {
  const disabled = Boolean(data.error);

  return (
    <>
      <main className={styles.main}>
        <div className={styles.inner}>
          <div className={styles.header}>
            <Link href="/dashboard" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to dashboard</Link>
            <h1>Settings</h1>
            <p>Manage your appearance, profile, wallets, and categories.</p>
          </div>
          {data.error && <p className={`${styles.error} ${styles.alert}`} role="alert">{data.error}</p>}
          <div className={styles.grid}>
            <AppearanceCard preference={data.themePreference} disabled={disabled} />
            <ProfileCard email={data.email} displayName={data.displayName} disabled={disabled} />
            <WalletsCard wallets={data.wallets} disabled={disabled} />
            <CategoriesCard categories={data.categories} disabled={disabled} />
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
