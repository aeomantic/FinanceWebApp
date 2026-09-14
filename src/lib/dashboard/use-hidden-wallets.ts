"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "folio:hidden-wallets";
const listeners = new Set<() => void>();
const EMPTY_IDS: string[] = [];
let cachedIds: string[] | null = null;

function readStoredIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]) {
  cachedIds = ids;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Best-effort persistence; the in-memory snapshot still updates for this session.
  }
  listeners.forEach((listener) => listener());
}

function getSnapshot(): string[] {
  cachedIds ??= readStoredIds();
  return cachedIds;
}

function getServerSnapshot(): string[] {
  // Must be a stable reference across calls, or useSyncExternalStore treats
  // every render as a change and warns about a possible infinite loop.
  return EMPTY_IDS;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Per-wallet balance privacy is a per-viewer display preference, not
 * account data - localStorage instead of a database column.
 * useSyncExternalStore (rather than useState synced in an effect) keeps a
 * consistent snapshot across every mounted instance and avoids a hydration
 * mismatch: getServerSnapshot returns empty, since localStorage doesn't
 * exist during SSR.
 */
export function useHiddenWallets() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hiddenIds = new Set(ids);

  function toggle(walletId: string) {
    const next = new Set(ids);
    if (next.has(walletId)) next.delete(walletId);
    else next.add(walletId);
    writeStoredIds([...next]);
  }

  return { hiddenIds, toggle };
}
