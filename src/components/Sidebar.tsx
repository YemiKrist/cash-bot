"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";

// ── Icons (inline SVG, zero dependencies) ──────────────────────────────────

function WalletIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { businesses, activeBusiness, setActiveBusiness, createBusiness } =
    useWorkspace();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setCreateError(null);
    const err = await createBusiness(newName);
    setSaving(false);
    if (err) {
      setCreateError(err);
      return;
    }
    setNewName("");
    setAdding(false);
  }

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 px-3 py-5">
      {/* Wordmark */}
      <div className="mb-6 px-2">
        <span className="text-lg font-bold tracking-tight text-white">
          Cash<span className="text-emerald-400">Bot</span>
        </span>
      </div>

      {/* Workspace list */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Workspaces
        </p>

        {/* Personal Ledger */}
        <button
          onClick={() => setActiveBusiness(null)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
            activeBusiness === null
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
          }`}
        >
          <span
            className={
              activeBusiness === null ? "text-emerald-400" : "text-zinc-500"
            }
          >
            <WalletIcon />
          </span>
          Personal Ledger
        </button>

        {/* Business entities */}
        {businesses.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveBusiness(b)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
              activeBusiness?.id === b.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
            }`}
          >
            <span
              className={
                activeBusiness?.id === b.id ? "text-emerald-400" : "text-zinc-500"
              }
            >
              <BuildingIcon />
            </span>
            <span className="truncate">{b.name}</span>
          </button>
        ))}

        {/* Add Business */}
        {adding ? (
          <form onSubmit={handleCreate} className="mt-1 px-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setCreateError(null);
              }}
              placeholder="Business name"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
            {createError && (
              <p className="mt-1.5 rounded-lg border border-red-800 bg-red-950/60 px-2.5 py-1.5 text-[11px] leading-snug text-red-400">
                {createError}
              </p>
            )}
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setCreateError(null);
                }}
                className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition"
          >
            <span className="text-base leading-none">＋</span>
            Add Business
          </button>
        )}
      </nav>

      {/* Sign out */}
      <div className="border-t border-zinc-800 pt-3">
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-red-400 transition"
        >
          <LogOutIcon />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
