"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * A hand-rolled listbox instead of a UI library: the app has no other
 * component dependency (Modal uses a native <dialog>, forms are plain
 * inputs), and a single-select combobox is small enough to own directly
 * rather than pull in Radix or Headless UI for it.
 */
export function Select({ value, options, onChange, placeholder = "Select...", onCreateNew, createNewLabel = "New", disabled, "aria-label": ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const instanceId = useId();
  const selected = options.find((option) => option.value === value);
  const itemCount = options.length + (onCreateNew ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      listRef.current?.querySelectorAll("[role='option']")[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  // Sets activeIndex as part of the same user-driven event that opens the
  // menu, rather than reacting to `open` becoming true in an effect.
  function openMenu() {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function toggleMenu() {
    if (open) setOpen(false);
    else openMenu();
  }

  function commit(index: number) {
    if (index < options.length) {
      onChange(options[index].value);
      setOpen(false);
    } else if (onCreateNew) {
      onCreateNew();
      setOpen(false);
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  }

  function handleListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(itemCount - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(itemCount - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && toggleMenu()}
        onKeyDown={handleTriggerKeyDown}
        className="select-trigger"
      >
        <span className="select-trigger-content">
          {selected?.icon}
          <span className={selected ? undefined : "select-placeholder"}>{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown size={16} className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          id={`${instanceId}-listbox`}
          className="select-menu"
          onKeyDown={handleListKeyDown}
          autoFocus
        >
          {options.map((option, index) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={`select-option ${index === activeIndex ? "select-option-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
              >
                {option.icon}
                <span className="select-option-label">{option.label}</span>
                {option.value === value && <Check size={15} aria-hidden="true" />}
              </button>
            </li>
          ))}
          {onCreateNew && (
            <li role="option" aria-selected="false" className="select-create-new">
              <button
                type="button"
                className={`select-option ${options.length === activeIndex ? "select-option-active" : ""}`}
                onMouseEnter={() => setActiveIndex(options.length)}
                onClick={() => commit(options.length)}
              >
                <Plus size={15} aria-hidden="true" />
                <span className="select-option-label">{createNewLabel}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
