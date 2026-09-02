import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Input } from "@/components/ui/primitives";
import type { ChainKey } from "@/core/types";
import { isHexAddress, normalizeAddress } from "@/core/address";
import type { TerminalPhase } from "@/core/terminal";
import { applyFilters, DEFAULT_FILTERS } from "@/core/filters";
import { useScanner } from "@/hooks/use-scanner";
import { useReceiptTracker } from "@/hooks/use-receipts";
import { cn } from "@/lib/cn";
import { inspectProjectFn } from "@/server/functions";
import { useAlerts } from "@/state/alerts";
import { catalogPhase, useCatalog } from "@/state/catalog";
import { useWallets } from "@/state/wallets";

const PRIMARY = [
  { to: "/", label: "Upcoming Mints" },
  { to: "/trending", label: "Trending" },
  { to: "/new-mints", label: "New Mints" },
  { to: "/runners", label: "Runners" },
];

const TOOLS = [
  { to: "/market", label: "Market" },
  { to: "/projects", label: "Projects" },
  { to: "/wallets", label: "Wallets" },
  { to: "/opportunities", label: "My Opportunities" },
  { to: "/eligibility", label: "Eligibility" },
  { to: "/execution", label: "Execute" },
  { to: "/alerts", label: "Alerts" },
  { to: "/activity", label: "Activity" },
  { to: "/health", label: "Health" },
  { to: "/settings", label: "Settings" },
];

export function TerminalShell({ children }: PropsWithChildren) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const wallets = useWallets((s) => s.wallets);
  const addWallet = useWallets((s) => s.addWallet);
  const unread = useAlerts((s) => s.events.filter((e) => !e.read).length);
  const scanning = useCatalog((s) => s.scanning);
  const query = useCatalog((s) => s.query);
  const setQuery = useCatalog((s) => s.setQuery);
  const chainFilter = useCatalog((s) => s.chainFilter);
  const projects = useCatalog((s) => s.projects);
  const sessionFresh = useCatalog((s) => s.sessionFresh);
  const scanFailed = useCatalog((s) => s.scanFailed);
  const select = useCatalog((s) => s.select);
  const upsert = useCatalog((s) => s.upsert);
  const gasGwei = useCatalog((s) => s.gasGwei);
  const health = useCatalog((s) => s.health);
  const errors = useCatalog((s) => s.errors);
  const scan = useScanner();
  useReceiptTracker();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState(false);
  const [walletNote, setWalletNote] = useState<string | null>(null);

  useEffect(() => {
    let interval: number | undefined;
    const start = () => {
      void scan();
      interval = window.setInterval(() => void scan(), 20_000);
    };
    if (useCatalog.persist.hasHydrated()) start();
    else useCatalog.persist.onFinishHydration(start);
    return () => {
      if (interval != null) window.clearInterval(interval);
    };
  }, [scan]);

  const hits = useMemo(
    () => applyFilters(projects, { ...DEFAULT_FILTERS, query, chain: chainFilter }).slice(0, 8),
    [projects, query, chainFilter],
  );

  const chainMs = useMemo(() => latencyByChain(health?.providers ?? [], errors), [health, errors]);
  const phase = catalogPhase({ scanning, sessionFresh, scanFailed, projects, errors });

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (isHexAddress(q)) {
      const chain = chainFilter === "ALL" ? "eth" : chainFilter;
      try {
        const project = await inspectProjectFn({ data: { chainKey: chain, address: q } });
        upsert(project);
        void navigate({ to: "/" });
        return;
      } catch {
        /* fall through to list */
      }
    }
    const first = hits[0];
    if (first) {
      select(first.id);
      void navigate({ to: "/" });
    } else {
      void navigate({ to: "/projects" });
    }
  }

  async function connectWallet() {
    setWalletNote(null);
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      setWalletNote("No injected wallet");
      void navigate({ to: "/wallets" });
      return;
    }
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const addr = accounts[0];
      if (!addr) throw new Error("No account");
      const normalized = normalizeAddress(addr);
      const existing = wallets.find((w) => w.address === normalized);
      if (!existing) addWallet({ name: wallets.length ? `CONNECTED ${wallets.length + 1}` : "MAIN", address: normalized });
      void navigate({ to: "/wallets" });
    } catch (err) {
      setWalletNote(err instanceof Error ? err.message : "Connect failed");
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="flex h-10 items-center gap-2 px-2 sm:px-3">
          <button type="button" className="lg:hidden text-muted" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <Menu className="size-4" />
          </button>
          <Link to="/" className="flex items-center gap-1.5 pr-1">
            <span className="text-[13px] font-medium tracking-[0.22em]">SENTINEL</span>
            <span className={cn("size-1.5 rounded-full", phaseDot(phase))} />
            <span className={cn("hidden text-[10px] uppercase tracking-[0.12em] sm:inline", phaseTone(phase))}>
              {phase}
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {PRIMARY.map((item) => {
              const active = item.to === "/" ? pathname === "/" || pathname === "/upcoming" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn("h-7 shrink-0 px-2 text-[12px]", active ? "text-fg" : "text-muted hover:text-fg")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form className="relative ml-auto hidden min-w-36 flex-1 max-w-xs sm:block" onSubmit={(e) => void submitSearch(e)}>
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name / symbol / 0x / chain"
              className="h-7 pl-7 text-[12px]"
            />
          </form>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setTools((v) => !v)}
                className="inline-flex h-7 items-center gap-1 px-2 text-[12px] text-muted hover:text-fg"
              >
                Tools
                <ChevronDown className="size-3" />
              </button>
              {tools && (
                <div className="absolute right-0 top-8 z-40 w-44 border border-line bg-surface py-1">
                  {TOOLS.map((t) => (
                    <Link
                      key={t.to}
                      to={t.to}
                      onClick={() => setTools(false)}
                      className="block px-3 py-1.5 text-xs text-muted hover:bg-raised hover:text-fg"
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void connectWallet()}
              className="h-7 border border-line px-2 font-mono text-[10px] text-muted hover:text-fg"
            >
              {wallets.length ? `${wallets.length} WLT` : "Connect Wallet"}
            </button>
            <span className="hidden font-mono text-[10px] text-muted lg:inline">
              {gasGwei != null ? `${gasGwei.toFixed(1)} Gwei` : "— Gwei"}
            </span>
            <Link to="/alerts" className="relative p-1.5 text-muted">
              <Bell className="size-3.5" />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-live" />}
            </Link>
          </div>
        </div>
        <div className="hidden h-6 items-center gap-3 border-t border-line px-3 font-mono text-[10px] text-subtle md:flex">
          {(["eth", "rh", "ink", "base"] as ChainKey[]).map((key) => {
            const row = chainMs[key];
            return (
              <span key={key} className={row?.ok ? "text-muted" : "text-warn"}>
                {key.toUpperCase()} {row?.ms != null ? `${row.ms}ms` : row?.ok === false ? "DEGRADED" : "—"}
              </span>
            );
          })}
        </div>
        {(open || walletNote) && (
          <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-2 lg:hidden">
            {[...PRIMARY, ...TOOLS].map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="px-2 py-1 text-xs text-muted">
                {item.label}
              </Link>
            ))}
            {walletNote && <span className="px-2 text-[10px] text-warn">{walletNote}</span>}
          </div>
        )}
      </header>
      <main className="min-h-[calc(100vh-40px)]">{children}</main>
    </div>
  );
}

function phaseDot(phase: TerminalPhase): string {
  if (phase === "LIVE" || phase === "SCANNING") return "bg-live";
  if (phase === "DEGRADED") return "bg-warn";
  if (phase === "ERROR") return "bg-danger";
  return "bg-subtle";
}

function phaseTone(phase: TerminalPhase): string {
  if (phase === "LIVE" || phase === "SCANNING") return "text-live";
  if (phase === "DEGRADED") return "text-warn";
  if (phase === "ERROR") return "text-danger";
  return "text-subtle";
}

function latencyByChain(
  providers: { chainKey: string; latencyMs: number | null; state: string }[],
  errors: { chainKey: string }[],
): Record<string, { ms: number | null; ok: boolean }> {
  const out: Record<string, { ms: number | null; ok: boolean }> = {};
  for (const p of providers) {
    const prev = out[p.chainKey];
    const ok = p.state === "HEALTHY" || p.state === "DEGRADED" || p.state === "RECOVERING";
    const ms = p.latencyMs;
    if (!prev || (ms != null && (prev.ms == null || ms < prev.ms))) {
      out[p.chainKey] = { ms, ok: prev?.ok === false ? false : ok };
    }
  }
  for (const e of errors) {
    const prev = out[e.chainKey] ?? { ms: null, ok: true };
    out[e.chainKey] = { ...prev, ok: false };
  }
  return out;
}
