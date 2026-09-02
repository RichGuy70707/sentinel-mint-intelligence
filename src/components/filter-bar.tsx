import type { ChainKey, MintStatus, StageKind } from "@/core/types";
import type { MintFilters } from "@/core/filters";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const CHAINS: Array<"ALL" | ChainKey> = ["ALL", "eth", "rh", "ink", "base"];
const PRICES = ["ALL", "FREE", "PAID"] as const;
const STAGES: Array<"ALL" | StageKind> = [
  "ALL",
  "PUBLIC",
  "FCFS",
  "ALLOWLIST",
  "TOKEN_GATED",
  "NFT_GATED",
  "OTHER",
];
const STATUSES: Array<"ALL" | MintStatus> = ["ALL", "UPCOMING", "LIVE", "ENDED"];

export function FilterBar({
  filters,
  onChange,
}: {
  filters: MintFilters;
  onChange: (next: MintFilters) => void;
}) {
  return (
    <div className="space-y-3">
      <Input
        value={filters.query}
        placeholder="Search name, symbol, contract, slug, chain"
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />
      <Row label="Chain">
        {CHAINS.map((c) => (
          <Chip key={c} active={filters.chain === c} onClick={() => onChange({ ...filters, chain: c })}>
            {c === "ALL" ? "ALL" : c.toUpperCase()}
          </Chip>
        ))}
      </Row>
      <Row label="Price">
        {PRICES.map((c) => (
          <Chip key={c} active={filters.price === c} onClick={() => onChange({ ...filters, price: c })}>
            {c}
          </Chip>
        ))}
      </Row>
      <Row label="Stage">
        {STAGES.map((c) => (
          <Chip key={c} active={filters.stage === c} onClick={() => onChange({ ...filters, stage: c })}>
            {c === "ALL" ? "ALL" : c.replaceAll("_", " ")}
          </Chip>
        ))}
      </Row>
      <Row label="Status">
        {STATUSES.map((c) => (
          <Chip key={c} active={filters.status === c} onClick={() => onChange({ ...filters, status: c })}>
            {c}
          </Chip>
        ))}
      </Row>
      <Row label="Signals">
        <Chip active={filters.freeMint} onClick={() => onChange({ ...filters, freeMint: !filters.freeMint })}>
          Free mint
        </Chip>
        <Chip
          active={filters.highActivity}
          onClick={() => onChange({ ...filters, highActivity: !filters.highActivity })}
        >
          High activity
        </Chip>
        <Chip active={filters.endingSoon} onClick={() => onChange({ ...filters, endingSoon: !filters.endingSoon })}>
          Ending soon
        </Chip>
        <Chip active={filters.myEligible} onClick={() => onChange({ ...filters, myEligible: !filters.myEligible })}>
          My wallets eligible
        </Chip>
        <Chip active={filters.readyToMint} onClick={() => onChange({ ...filters, readyToMint: !filters.readyToMint })}>
          Ready to mint
        </Chip>
        <Chip
          active={filters.requiresVerification}
          onClick={() => onChange({ ...filters, requiresVerification: !filters.requiresVerification })}
        >
          Requires verification
        </Chip>
        <Chip
          active={filters.unknownEligibility}
          onClick={() => onChange({ ...filters, unknownEligibility: !filters.unknownEligibility })}
        >
          Unknown eligibility
        </Chip>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-16 shrink-0 text-[10px] uppercase tracking-[0.12em] text-subtle">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-sm border px-2 text-[11px] font-medium transition-colors",
        active ? "border-accent bg-accent text-accent-fg" : "border-line bg-raised text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
