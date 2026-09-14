"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  triggerLabel: string;
  items: DropdownMenuItem[];
  align?: "start" | "end";
}

interface Position {
  top: number;
  left?: number;
  right?: number;
}

/**
 * The menu (action list) pattern, distinct from Select's listbox (bound
 * value) pattern: items trigger side effects rather than setting a value,
 * so this uses role="menu"/"menuitem" instead of role="listbox"/"option".
 * Hand-rolled for the same reason as Select - no UI library dependency yet.
 *
 * The panel is portaled to document.body instead of rendered as a normal
 * absolutely-positioned child: wallet cards live inside a horizontally
 * scrolling container, and a popover clipped to that container's bounds
 * both cuts off its own content and (since overflow-x: auto with no
 * explicit overflow-y computes overflow-y to auto too) can trigger a
 * phantom vertical scrollbar on the scroller whenever the menu is taller
 * than the card. Positioning via getBoundingClientRect sidesteps both.
 */
export function DropdownMenu({ trigger, triggerLabel, items, align = "end" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<Position | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const enabledCount = items.length;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition(
      align === "end"
        ? { top: rect.bottom + 6, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 6, left: rect.left },
    );
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    // A scroll anywhere invalidates the computed position; closing is
    // simpler and safer than continuously re-measuring while open.
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  function openMenu(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation();
    setActiveIndex(items.findIndex((item) => !item.disabled));
    setOpen(true);
  }

  function toggleMenu(event: React.MouseEvent) {
    event.stopPropagation();
    if (open) setOpen(false);
    else openMenu(event);
  }

  function commit(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    setOpen(false);
    item.onSelect();
  }

  function handleListKeyDown(event: React.KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => {
        for (let next = index + 1; next < enabledCount; next += 1) if (!items[next].disabled) return next;
        return index;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => {
        for (let next = index - 1; next >= 0; next -= 1) if (!items[next].disabled) return next;
        return index;
      });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    }
  }

  return (
    <div ref={rootRef} onClick={(event) => event.stopPropagation()} style={{ display: "inline-flex" }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={toggleMenu}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") openMenu(event); }}
        className="menu-trigger"
      >
        {trigger}
      </button>
      {open && position && createPortal(
        <div
          ref={listRef}
          role="menu"
          tabIndex={-1}
          aria-label={triggerLabel}
          id={`${instanceId}-menu`}
          className="select-menu menu-panel-portal"
          style={{ top: position.top, left: position.left ?? "auto", right: position.right ?? "auto" }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleListKeyDown}
          autoFocus
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`select-option ${index === activeIndex ? "select-option-active" : ""} ${item.destructive ? "menu-option-destructive" : ""}`}
              onMouseEnter={() => !item.disabled && setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              {item.icon}
              <span className="select-option-label">{item.label}</span>
              {item.trailing}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
