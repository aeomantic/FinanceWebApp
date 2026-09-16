"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Star, Trash2, WalletCards, X } from "lucide-react";
import { deleteWallet, renameWallet, setDefaultWallet } from "@/app/dashboard/actions";
import { ConfirmationDialog } from "./confirmation-dialog";
import type { Wallet } from "@/lib/dashboard/types";
import styles from "./settings.module.css";

export function WalletsCard({ wallets, disabled = false }: { wallets: Wallet[]; disabled?: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Wallet | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function startEdit(wallet: Wallet) {
    if (disabled) return;
    setEditingId(wallet.id);
    setDraftName(wallet.name);
    setError("");
    setNotice("");
  }

  async function saveRename(walletId: string) {
    if (pendingId || !draftName.trim()) return;
    setPendingId(walletId);
    setError("");
    const result = await renameWallet({ walletId, name: draftName });
    setPendingId(null);
    if (!result.success) { setError(result.error); return; }
    setEditingId(null);
    setNotice("Wallet renamed.");
    router.refresh();
  }

  async function makeDefault(walletId: string) {
    if (pendingId || disabled) return;
    setPendingId(walletId);
    setError("");
    const result = await setDefaultWallet(walletId);
    setPendingId(null);
    if (!result.success) { setError(result.error); return; }
    setNotice("Default wallet updated.");
    router.refresh();
  }

  return (
    <section className={styles.card} aria-labelledby="wallets-title">
      <div className={styles.cardHeading}>
        <div><h2 id="wallets-title">Wallets</h2><p className={styles.description}>Rename, manage default status, or delete your existing wallets.</p></div>
        <span className={styles.cardIcon}><WalletCards size={18} aria-hidden="true" /></span>
      </div>
      {wallets.length === 0 ? (
        <p className={styles.empty}>No wallets yet.</p>
      ) : (
        <ul className={styles.list}>
          {wallets.map((wallet) => {
            const isEditing = editingId === wallet.id;
            const isPending = pendingId === wallet.id;
            return (
              <li key={wallet.id} className={styles.item}>
                <div className={styles.row}>
                  <span className={styles.badge} aria-hidden="true">{wallet.name.slice(0, 1).toUpperCase()}</span>
                  <div className={styles.rowContent}>
                    {isEditing ? (
                      <input
                        className={styles.input}
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        maxLength={60}
                        autoFocus
                        disabled={isPending}
                        aria-label={`Rename ${wallet.name}`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveRename(wallet.id);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <span className={styles.name}>{wallet.name}</span>
                    )}
                    <span className={styles.hint}>{wallet.currency}</span>
                  </div>
                </div>
                <div className={`${styles.actions} ${styles.walletActionsRow}`}>
                  {wallet.isDefault ? (
                    <span className={styles.defaultBadge}><Star size={11} aria-hidden="true" />Default</span>
                  ) : (
                    <button type="button" className={styles.textButton} onClick={() => makeDefault(wallet.id)} disabled={disabled || isPending}>Set as default</button>
                  )}
                  <div className={styles.actionsButtons}>
                    {isEditing ? (
                      <>
                        <button type="button" className={styles.iconButton} aria-label="Save name" onClick={() => saveRename(wallet.id)} disabled={isPending || !draftName.trim()}><Check size={16} aria-hidden="true" /></button>
                        <button type="button" className={styles.iconButton} aria-label="Cancel rename" onClick={() => setEditingId(null)} disabled={isPending}><X size={16} aria-hidden="true" /></button>
                      </>
                    ) : (
                      <button type="button" className={styles.iconButton} aria-label={`Rename ${wallet.name}`} onClick={() => startEdit(wallet)} disabled={disabled}><Pencil size={16} aria-hidden="true" /></button>
                    )}
                    <button type="button" className={styles.iconButton} aria-label={`Delete ${wallet.name}`} onClick={() => setDeleteTarget(wallet)} disabled={disabled || wallets.length <= 1}><Trash2 size={16} className={styles.dangerIcon} aria-hidden="true" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {deleteTarget && (
        <ConfirmationDialog
          title={`Delete ${deleteTarget.name}?`}
          description={`This permanently deletes ${deleteTarget.name} and every transaction recorded against it. This can't be undone.${deleteTarget.isDefault ? " Since this is your default wallet, another wallet will be promoted to default." : ""}`}
          onConfirm={() => deleteWallet(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            setNotice(`${deleteTarget.name} deleted.`);
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
