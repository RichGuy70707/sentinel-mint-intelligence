import { useEffect, useRef } from "react";
import { walletHintsFn } from "@/server/functions";
import type { OnChainHints } from "@/eligibility/engine";
import { useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

/** Pulls on-chain hints for the top live projects so eligibility is not pane-only. */
export function useEligibilityHints() {
  const projects = useCatalog((s) => s.projects);
  const sessionFresh = useCatalog((s) => s.sessionFresh);
  const wallets = useWallets((s) => s.wallets);
  const setProjectHints = useHints((s) => s.setProjectHints);
  const scannedAt = useCatalog((s) => s.scannedAt);
  const token = `${sessionFresh}:${scannedAt}:${wallets.map((w) => w.id).join("|")}:${projects
    .slice(0, 8)
    .map((p) => p.id)
    .join("|")}`;
  const last = useRef("");

  useEffect(() => {
    if (!sessionFresh || wallets.length === 0) return;
    if (last.current === token) return;
    last.current = token;
    const targets = projects.filter((p) => p.contract).slice(0, 8);
    let cancelled = false;
    void (async () => {
      for (const p of targets) {
        if (cancelled || !p.contract) continue;
        try {
          const rows = await walletHintsFn({
            data: { chainKey: p.chainKey, contract: p.contract, wallets: wallets.map((w) => w.address) },
          });
          if (cancelled) return;
          const next: Record<string, OnChainHints> = {};
          for (const w of wallets) {
            const row = rows.find((r) => r.address.toLowerCase() === w.address.toLowerCase());
            if (row) next[w.id] = {
              nftBalance: row.nftBalance ?? undefined,
              nativeBalanceWei: row.nativeBalanceWei ?? undefined,
              gateTokenBalance: row.gateTokenBalance ?? undefined,
            };
          }
          setProjectHints(p.id, next);
        } catch {
          /* keep prior hints */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sessionFresh, projects, wallets, setProjectHints]);
}
