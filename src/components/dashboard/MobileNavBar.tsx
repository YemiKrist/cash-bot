"use client";

type Tab = "transactions" | "invoices" | "analytics";

interface NavTabProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function NavTab({ label, active, disabled = false, onClick, children }: NavTabProps) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-1 pb-1 pt-2 transition-colors ${disabled ? "cursor-not-allowed opacity-30" : active ? "text-emerald-400" : "text-zinc-500 active:text-zinc-300"}`}>
      <span className={`transition-transform duration-150 ${active ? "scale-110" : ""}`}>{children}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
    </button>
  );
}

interface Props {
  activeTab: Tab;
  hasBusiness: boolean;
  onTab: (tab: Tab) => void;
  onAdd: () => void;
  onOpenSidebar: () => void;
}

export function MobileNavBar({ activeTab, hasBusiness, onTab, onAdd, onOpenSidebar }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-[#0f172a]/95 backdrop-blur-md lg:hidden">
      <div className="relative flex items-end">
        <NavTab label="Ledger" active={activeTab === "transactions"} onClick={() => onTab("transactions")}>
          <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </NavTab>
        <NavTab label="Bills" active={activeTab === "invoices"} disabled={!hasBusiness} onClick={() => { if (hasBusiness) onTab("invoices"); }}>
          <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="12" y2="17" />
          </svg>
        </NavTab>
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={onAdd} className="relative -translate-y-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30 transition-transform active:scale-95" aria-label="Add Transaction">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <NavTab label="Analytics" active={activeTab === "analytics"} onClick={() => onTab(activeTab === "analytics" ? "transactions" : "analytics")}>
          <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
          </svg>
        </NavTab>
        <NavTab label="Menu" active={false} onClick={onOpenSidebar}>
          <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </NavTab>
      </div>
      <div className="h-5" />
    </nav>
  );
}
