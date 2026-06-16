"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Transaction } from "@/lib/types";

interface Props {
  tx: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  tableRow?: boolean;
}

export function TxMenu({ tx, onEdit, onDelete, tableRow = false }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function computePosition() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    if (window.innerHeight - r.bottom < 120)
      setMenuStyle({ position: "fixed", bottom: window.innerHeight - r.top + 4, right, zIndex: 9999 });
    else
      setMenuStyle({ position: "fixed", top: r.bottom + 4, right, zIndex: 9999 });
  }

  useEffect(() => {
    if (!open) return;
    const onOut = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false); setConfirming(false);
    };
    const onScroll = () => { setOpen(false); setConfirming(false); };
    document.addEventListener("mousedown", onOut);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onOut); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);

  const menu = open ? createPortal(
    <div ref={menuRef} style={menuStyle} className="w-40 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
      {confirming ? (
        <div className="px-3 py-3">
          <p className="mb-2.5 text-xs font-medium text-zinc-300">Delete this transaction?</p>
          <div className="flex gap-2">
            <button onClick={() => { onDelete?.(tx); setOpen(false); setConfirming(false); }} className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white hover:bg-red-500 transition">Yes</button>
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg bg-zinc-800 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition">No</button>
          </div>
        </div>
      ) : (
        <>
          {onEdit && (
            <button onClick={() => { onEdit(tx); setOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </button>
          )}
          {onDelete && (
            <button onClick={() => setConfirming(true)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-zinc-800 transition">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              Delete
            </button>
          )}
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { computePosition(); setOpen((o) => !o); setConfirming(false); }}
        className={`rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300 ${tableRow ? "opacity-0 group-hover:opacity-100" : ""}`}
        aria-label="Transaction actions"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {menu}
    </>
  );
}
