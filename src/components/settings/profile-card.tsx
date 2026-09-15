"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, UserRound } from "lucide-react";
import { saveProfile } from "@/app/settings/actions";
import styles from "./settings.module.css";

export function ProfileCard({ email, displayName, disabled = false }: { email: string; displayName: string; disabled?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await saveProfile({ displayName: name });
      if (!result.success) { setError(result.error); return; }
      setName(name.trim());
      setNotice("Profile saved. Your greeting is updated across Folio.");
      router.refresh();
    } catch { setError("We couldn't save your profile. Please try again."); }
    finally { setPending(false); }
  }

  return <section className={styles.card} aria-labelledby="profile-title">
    <div className={styles.cardHeading}><div><h2 id="profile-title">Profile information</h2><p className={styles.description}>A little more you. Choose the name we greet you with.</p></div><span className={styles.cardIcon}><UserRound size={18} aria-hidden="true" /></span></div>
    <form onSubmit={save} className={styles.stack} aria-busy={pending}>
      <label className={styles.field}>Email<input className={styles.input} type="email" value={email} readOnly autoComplete="email" /></label>
      <label className={styles.field}>Display name<input className={styles.input} value={name} onChange={(event) => { setName(event.target.value); setNotice(""); }} maxLength={60} autoComplete="nickname" placeholder="e.g. Leandro" disabled={pending || disabled} required /></label>
      <div><button className={styles.primary} disabled={pending || disabled || !name.trim()} type="submit">{pending ? "Saving..." : "Save profile"}<ArrowUpRight size={14} aria-hidden="true" /></button></div>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>;
}
