"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { createMerchant, loadMerchants } from "@/app/transactions/merchant-actions";
import { matchMerchants, suggestMerchants, type Merchant } from "@/lib/merchants/model";
import { MerchantIcon } from "./MerchantIcon";
import styles from "./merchants.module.css";

export interface MerchantPickerProps {
  selectedCategoryId: string | null;
  selectedMerchantId: string | null;
  onSelect: (merchant: Merchant | null) => void;
  categoryName?: string;
  initialMerchant?: Merchant;
  disabled?: boolean;
  demo?: boolean;
  onPendingChange?: (pending: boolean) => void;
}
export function MerchantPicker({ selectedCategoryId, selectedMerchantId, onSelect, categoryName = "", initialMerchant, disabled = false, demo = false, onPendingChange }: MerchantPickerProps) {
  const id = useId();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(!demo);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const creatingRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const blocked = disabled || demo || creating;
  useEffect(() => {
    if (demo) return;
    let live = true;
    loadMerchants().then((result) => {
      if (!live) return;
      if (result.success) { setMerchants(result.merchants); setError(""); }
      else setError(result.error);
      setLoading(false);
    }).catch(() => { if (live) { setError("Couldn't load merchants. Try again."); setLoading(false); } });
    return () => { live = false; };
  }, [demo, retry]);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  const selected = merchants.find((m) => m.id === selectedMerchantId) ?? (initialMerchant?.id === selectedMerchantId ? initialMerchant : undefined);
  const suggestions = suggestMerchants(merchants, selectedCategoryId, categoryName);
  const matches = matchMerchants(merchants, query).slice(0, 20);
  const trimmed = query.trim();
  const canCreate = !loading && !error && trimmed.length > 0 && trimmed.length <= 80 && !merchants.some((m) => m.name.trim().toLowerCase() === trimmed.toLowerCase());
  const optionCount = matches.length + (canCreate ? 1 : 0);
  function choose(merchant: Merchant | null) { onSelect(merchant); setQuery(""); setOpen(false); setActive(-1); }
  async function create() {
    if (!canCreate || blocked || creatingRef.current) return;
    creatingRef.current = true; setCreating(true); onPendingChange?.(true); setError("");
    try {
      const result = await createMerchant({ name: trimmed, categoryId: selectedCategoryId });
      if (!result.success) { setError(result.error); return; }
      // No cross-user module cache: update this directory immediately; future mounts refetch.
      setMerchants((previous) => [...previous.filter((m) => m.id !== result.merchant.id), result.merchant]);
      choose(result.merchant);
    } catch { setError("Couldn't add this merchant. Try again."); }
    finally { creatingRef.current = false; setCreating(false); onPendingChange?.(false); input.current?.focus(); }
  }
  return <div className={styles.picker} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
    <label htmlFor={`${id}-input`} className={styles.label}>Merchant / payee <span>(optional)</span></label>
    {suggestions.length > 0 && <div className={styles.chips} aria-label={`${categoryName} merchant suggestions`}>
      {suggestions.map((m) => <button key={m.id} type="button" className={styles.chip} aria-pressed={selectedMerchantId === m.id} disabled={blocked} onClick={() => choose(selectedMerchantId === m.id ? null : m)}>
        <MerchantIcon merchant={m} small /><span>{m.name}</span>
      </button>)}
    </div>}
    {selected && <div className={styles.selection}><MerchantIcon merchant={selected} small /><span>{selected.name}</span><button type="button" aria-label="Remove merchant" disabled={blocked} onClick={() => choose(null)}><X size={15} /></button></div>}
    <div className={styles.search}>
      <Search size={16} aria-hidden="true" />
      <input ref={input} id={`${id}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open && !blocked}
        aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 && active < optionCount ? `${id}-option-${active}` : undefined}
        autoComplete="off" placeholder={loading ? "Loading merchants..." : "Search or add shop / merchant..."} value={query} maxLength={80} disabled={blocked}
        onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive((previous) => optionCount ? (previous < 0 ? (event.key === "ArrowDown" ? 0 : optionCount - 1) : (previous + (event.key === "ArrowDown" ? 1 : -1) + optionCount) % optionCount) : -1);
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && active >= 0 && active < matches.length) choose(matches[active]);
            else if (open && canCreate && active === matches.length) void create();
          } else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
        }} />
    </div>
    {open && !blocked && <div id={`${id}-list`} role="listbox" aria-label="Merchants" className={styles.results}>
      {matches.map((m, index) => <button key={m.id} id={`${id}-option-${index}`} type="button" role="option" aria-selected={selectedMerchantId === m.id} tabIndex={-1}
        className={`${styles.option} ${active === index ? styles.active : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(m)}>
        <MerchantIcon merchant={m} small /><span>{m.name}</span>
      </button>)}
      {canCreate && <button id={`${id}-option-${matches.length}`} type="button" role="option" aria-selected={false} tabIndex={-1}
        className={`${styles.option} ${styles.create} ${active === matches.length ? styles.active : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => void create()}>
        <Plus size={16} /><span>Add &quot;{trimmed}&quot; to {categoryName || "merchants"}</span>
      </button>}
      {!loading && !error && optionCount === 0 && <p className={styles.hint}>Type a name to add a merchant.</p>}
    </div>}
    {creating && <p className={styles.hint} role="status">Adding merchant...</p>}
    {error && <div className={styles.error} role="alert">{error} <button type="button" disabled={blocked} onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>Try again</button></div>}
  </div>;
}
