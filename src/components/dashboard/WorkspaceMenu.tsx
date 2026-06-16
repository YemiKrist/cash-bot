"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import ProjectSettings from "@/components/ProjectSettings";

type Mode = "idle" | "renameBiz" | "confirmDeleteBiz" | "renameProj" | "confirmDeleteProj";

interface Props {
  activeProjectId: string | null;
  activeProjectName: string | null;
  onProjectRenamed: (name: string) => void;
  onProjectDeleted: () => void;
  onWorkspaceMutated: () => void;
}

export function WorkspaceMenu({ activeProjectId, activeProjectName, onProjectRenamed, onProjectDeleted, onWorkspaceMutated }: Props) {
  const { activeBusiness, renameBusiness, deleteBusiness } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [showProjSettings, setShowProjSettings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setMode("idle"); setError(null); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!activeBusiness) return null;

  async function handleRenameBiz(e: React.FormEvent) {
    e.preventDefault(); if (!input.trim()) return;
    setWorking(true); setError(null);
    const err = await renameBusiness(activeBusiness!.id, input.trim());
    setWorking(false);
    if (err) { setError(err); return; }
    setOpen(false); setMode("idle");
  }

  async function handleRenameProj(e: React.FormEvent) {
    e.preventDefault(); if (!input.trim() || !activeProjectId) return;
    setWorking(true); setError(null);
    const { error: err } = await supabase.from("projects").update({ name: input.trim() }).eq("id", activeProjectId);
    setWorking(false);
    if (err) { setError(err.message); return; }
    onProjectRenamed(input.trim()); onWorkspaceMutated(); setOpen(false); setMode("idle");
  }

  async function handleDeleteBiz() {
    setWorking(true); await deleteBusiness(activeBusiness!.id); setWorking(false); setOpen(false); setMode("idle");
  }

  async function handleDeleteProj() {
    if (!activeProjectId) return;
    setWorking(true); await supabase.from("projects").delete().eq("id", activeProjectId); setWorking(false);
    onProjectDeleted(); onWorkspaceMutated(); setOpen(false); setMode("idle");
  }

  const inputCls = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition";
  const saveCls = "flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 transition";
  const cancelCls = "flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:text-white transition";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setMode("idle"); setInput(""); setError(null); setOpen((o) => !o); }}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition hover:border-zinc-500 hover:text-white" aria-label="Manage workspace">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.25" /><circle cx="12" cy="12" r="1.25" /><circle cx="12" cy="19" r="1.25" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {mode === "idle" && (
            <div className="p-1.5">
              {activeProjectId && (<>
                <p className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Project: {activeProjectName}</p>
                <button onClick={() => { setMode("renameProj"); setInput(activeProjectName ?? ""); setError(null); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition">Rename Project</button>
                <button onClick={() => { setOpen(false); setShowProjSettings(true); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition">Contract Billing &amp; Compliance</button>
                <button onClick={() => { setMode("confirmDeleteProj"); setError(null); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-950/50 transition">Delete Project</button>
                <div className="my-1 border-t border-zinc-800" />
              </>)}
              <p className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Business: {activeBusiness.name}</p>
              <button onClick={() => { setMode("renameBiz"); setInput(activeBusiness.name); setError(null); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition">Rename Business</button>
              <button onClick={() => { setMode("confirmDeleteBiz"); setError(null); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-950/50 transition">Delete Business</button>
            </div>
          )}
          {(mode === "renameBiz" || mode === "renameProj") && (
            <form onSubmit={mode === "renameBiz" ? handleRenameBiz : handleRenameProj} className="p-3">
              <p className="mb-2 text-xs font-semibold text-zinc-400">{mode === "renameBiz" ? "Rename Business" : "Rename Project"}</p>
              <input autoFocus value={input} onChange={(e) => { setInput(e.target.value); setError(null); }} className={inputCls} />
              {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
              <div className="mt-2 flex gap-1.5">
                <button type="submit" disabled={working || !input.trim()} className={saveCls}>{working ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => { setMode("idle"); setError(null); }} className={cancelCls}>Cancel</button>
              </div>
            </form>
          )}
          {(mode === "confirmDeleteBiz" || mode === "confirmDeleteProj") && (
            <div className="p-3">
              <p className="mb-1 text-xs font-semibold text-zinc-300">{mode === "confirmDeleteBiz" ? `Delete "${activeBusiness.name}"?` : `Delete "${activeProjectName}"?`}</p>
              <p className="mb-3 text-xs text-zinc-500">This cannot be undone.</p>
              {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
              <div className="flex gap-1.5">
                <button onClick={mode === "confirmDeleteBiz" ? handleDeleteBiz : handleDeleteProj} disabled={working} className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition">{working ? "Deleting..." : "Delete"}</button>
                <button onClick={() => { setMode("idle"); setError(null); }} className={cancelCls}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {showProjSettings && activeProjectId && (
        <ProjectSettings projectId={activeProjectId} projectName={activeProjectName ?? ""} onClose={() => setShowProjSettings(false)} />
      )}
    </div>
  );
}
