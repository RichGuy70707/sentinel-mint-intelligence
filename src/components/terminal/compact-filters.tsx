import { useState } from "react";
import type { ChainKey, MintStatus, StageKind } from "@/core/types";
import { cn } from "@/lib/cn";
import { useCatalog, type SignalKey } from "@/state/catalog";

const CHAINS: Array<"ALL" | ChainKey> = ["ALL", "eth", "rh", "ink", "base"];
const PRICES = ["ALL", "FREE", "PAID"] as const;
const STAGES: Array<"ALL" | StageKind> = ["ALL", "PUBLIC", "FCFS", "ALLOWLIST", "MERKLE", "SEADROP", "OTHER"];
const STATUSES: Array<"ALL" | MintStatus> = ["ALL", "UPCOMING", "LIVE", "ENDED"];
const SIGNALS: Array<{ key: SignalKey; label: string }> = [
  { key: "myEligible", label: "Eligible" },
  { key: "readyToMint", label: "Ready" },
  { key: "requiresVerification", label: "Needs proof" },
  { key: "unknownEligibility", label: "Unknown" },
];

export function CompactFilters() {
  const chainFilter = useCatalog((s) => s.chainFilter);
  const setChainFilter = useCatalog((s) => s.setChainFilter);
  const priceFilter = useCatalog((s) => s.priceFilter);
  const stageFilter = useCatalog((s) => s.stageFilter);
  const statusFilter = useCatalog((s) => s.statusFilter);
  const signals = useCatalog((s) => s.signals);
  const setPriceFilter = useCatalog((s) => s.setPriceFilter);
  const setStageFilter = useCatalog((s) => s.setStageFilter);
  const setStatusFilter = useCatalog((s) => s.setStatusFilter);
  const toggleSignal = useCatalog((s) => s.toggleSignal);
  const [open, setOpen] = useState(false);
  const extraOn =
    priceFilter !== "ALL" ||
    stageFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    Object.values(signals).some(Boolean);

  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        {CHAINS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChainFilter(c)}
            className={cn(
              "h-6 px-1.5 font-mono text-[10px]",
              chainFilter === c ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {c === "ALL" ? "ALL" : c.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn("ml-auto h-6 px-1.5 text-[10px]", extraOn || open ? "text-live" : "text-subtle hover:text-fg")}
        >
          Filters{extraOn ? " •" : ""}
        </button>
      </div>
      {open && (
        <div className="space-y-1 border-t border-line px-2 py-1.5">
          <Row label="Price">
            {PRICES.map((c) => (
              <Chip key={c} active={priceFilter === c} onClick={() => setPriceFilter(c)}>
                {c}
              </Chip>
            ))}
          </Row>
          <Row label="Stage">
            {STAGES.map((c) => (
              <Chip key={c} active={stageFilter === c} onClick={() => setStageFilter(c)}>
                {c === "ALL" ? "ALL" : c.replaceAll("_", " ")}
              </Chip>
            ))}
          </Row>
          <Row label="Status">
            {STATUSES.map((c) => (
              <Chip key={c} active={statusFilter === c} onClick={() => setStatusFilter(c)}>
                {c}
              </Chip>
            ))}
          </Row>
          <Row label="Wallet">
            {SIGNALS.map((s) => (
              <Chip key={s.key} active={signals[s.key]} onClick={() => toggleSignal(s.key)}>
                {s.label}
              </Chip>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-9 shrink-0 text-[9px] uppercase tracking-[0.12em] text-subtle">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-5 border px-1.5 text-[10px]",
        active ? "border-accent bg-accent text-accent-fg" : "border-line text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
