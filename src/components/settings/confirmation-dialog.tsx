"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { SettingsResult } from "@/lib/settings/types";
import styles from "./settings.module.css";

export function ConfirmationDialog({ title, description, onConfirm, onClose, onSuccess }: {
  title: string;
  description: string;
  onConfirm: () => Promise<SettingsResult>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await onConfirm();
      if (!result.success) { setError(result.error); return; }
      onSuccess();
    } catch {
      setError("We couldn't save this change. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return <Modal title={title} onClose={() => { if (!pending) onClose(); }}>
    <p className={styles.modalText}>{description}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.modalActions}>
      <button type="button" className={styles.secondary} onClick={onClose} disabled={pending} autoFocus>Keep it</button>
      <button type="button" className={styles.danger} onClick={confirm} disabled={pending}>{pending ? "Deleting..." : "Delete"}</button>
    </div>
  </Modal>;
}
