"use client";

import { Check, Eye, EyeOff, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { deleteWallet, renameWallet, setDefaultWallet } from "@/app/dashboard/actions";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import type { Wallet } from "@/lib/dashboard/types";

export interface WalletCardMenuProps {
  wallet: Wallet;
  demo: boolean;
  canDelete: boolean;
  isBalanceHidden: boolean;
  onToggleHideBalance: (walletId: string) => void;
  onChanged: () => void;
}

export function WalletCardMenu({ wallet, demo, canDelete, isBalanceHidden, onToggleHideBalance, onChanged }: WalletCardMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [defaultPending, startDefaultTransition] = useTransition();

  function handleSetDefault() {
    if (demo || wallet.isDefault) return;
    startDefaultTransition(async () => {
      const result = await setDefaultWallet(wallet.id);
      if (result.success) onChanged();
    });
  }

  const items: DropdownMenuItem[] = [
    {
      key: "default",
      label: wallet.isDefault ? "Current default" : "Set as default",
      icon: <Star size={15} aria-hidden="true" />,
      onSelect: handleSetDefault,
      disabled: demo || wallet.isDefault || defaultPending,
      trailing: wallet.isDefault ? <Check size={14} aria-hidden="true" /> : undefined,
    },
    {
      key: "rename",
      label: "Rename",
      icon: <Pencil size={15} aria-hidden="true" />,
      onSelect: () => setRenameOpen(true),
      disabled: demo,
    },
    {
      key: "hide-balance",
      label: isBalanceHidden ? "Show balance" : "Hide balance",
      icon: isBalanceHidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />,
      onSelect: () => onToggleHideBalance(wallet.id),
    },
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 size={15} aria-hidden="true" />,
      onSelect: () => setDeleteOpen(true),
      disabled: demo || !canDelete,
      destructive: true,
    },
  ];

  return (
    <>
      <DropdownMenu trigger={<MoreVertical size={16} aria-hidden="true" />} triggerLabel={`${wallet.name} actions`} items={items} />
      {renameOpen && (
        <RenameWalletModal
          wallet={wallet}
          onClose={() => setRenameOpen(false)}
          onRenamed={onChanged}
        />
      )}
      {deleteOpen && (
        <DeleteWalletModal
          wallet={wallet}
          onClose={() => setDeleteOpen(false)}
          onDeleted={onChanged}
        />
      )}
    </>
  );
}

function RenameWalletModal({ wallet, onClose, onRenamed }: { wallet: Wallet; onClose: () => void; onRenamed: () => void }) {
  const [name, setName] = useState(wallet.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const result = await renameWallet({ walletId: wallet.id, name });
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    onRenamed();
    onClose();
  }

  return (
    <Modal title="Rename wallet" onClose={onClose}>
      <form className="transaction-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required disabled={pending} autoFocus />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving..." : "Save name"}</button>
      </form>
    </Modal>
  );
}

function DeleteWalletModal({ wallet, onClose, onDeleted }: { wallet: Wallet; onClose: () => void; onDeleted: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError("");
    const result = await deleteWallet(wallet.id);
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    onDeleted();
    onClose();
  }

  return (
    <Modal title="Delete this wallet?" onClose={onClose}>
      <div className="modal-copy">
        <p>This permanently deletes <strong>{wallet.name}</strong> and every transaction recorded against it. This can&apos;t be undone.</p>
        {wallet.isDefault && <p>Since this is your default wallet, another wallet will be promoted to default.</p>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onClose} disabled={pending} style={{ flex: 1, padding: "13px 16px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13, color: "var(--color-ink)" }}>Cancel</button>
        <button type="button" onClick={handleConfirm} disabled={pending} style={{ flex: 1, padding: "13px 16px", borderRadius: 14, border: 0, background: "#b33b31", color: "#fff", fontSize: 13, fontWeight: 500 }}>{pending ? "Deleting..." : "Delete wallet"}</button>
      </div>
    </Modal>
  );
}
