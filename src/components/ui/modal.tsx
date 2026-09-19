"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

export function Modal({ title, children, onClose, className, busy = false }: { title: string; children: ReactNode; onClose: () => void; className?: string; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return (
    <dialog ref={dialog} className={className ? `app-modal ${className}` : "app-modal"} aria-labelledby="modal-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => {
      if (!busy && event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }
    }}>
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>
      {children}
    </dialog>
  );
}
