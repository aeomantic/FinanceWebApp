"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Laptop, Moon, Palette, Sun } from "lucide-react";
import { saveThemePreference } from "@/app/settings/actions";
import type { ThemePreference } from "@/lib/settings/types";
import styles from "./settings.module.css";

const THEMES = [{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Laptop }] as const;
const subscribe = () => () => {};

export function AppearanceCard({ preference, disabled = false }: { preference: ThemePreference; disabled?: boolean }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!disabled) setTheme(preference); }, [preference, setTheme, disabled]);
  const selectedTheme = mounted ? theme ?? preference : preference;

  async function chooseTheme(value: ThemePreference) {
    if (pending || disabled) return;
    const previous = theme ?? preference;
    setPending(true);
    setError("");
    setNotice("");
    setTheme(value);
    try {
      const result = await saveThemePreference(value);
      if (!result.success) { setTheme(previous); setError(result.error); return; }
      setNotice("Appearance saved.");
      router.refresh();
    } catch {
      setTheme(previous);
      setError("We couldn't save your appearance. Please try again.");
    } finally { setPending(false); }
  }

  return <section className={styles.card} aria-labelledby="appearance-title">
    <div className={styles.cardHeading}><div><h2 id="appearance-title">Appearance</h2><p className={styles.description}>Select your preferred application interface theme.</p></div><span className={styles.cardIcon}><Palette size={18} aria-hidden="true" /></span></div>
    <div className={styles.themeButtons} role="group" aria-label="Application theme" aria-busy={pending}>
      {THEMES.map(({ value, label, icon: ThemeIcon }) => <button type="button" key={value} className={styles.themeButton} disabled={pending || disabled || !mounted} aria-pressed={selectedTheme === value} onClick={() => chooseTheme(value)}><ThemeIcon size={18} aria-hidden="true" />{label}</button>)}
    </div>
    <p className={`${styles.hint} mt-4`}>System follows your device&apos;s appearance setting.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>;
}
