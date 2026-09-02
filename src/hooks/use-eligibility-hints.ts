import { useEffect, useRef } from "react";
import { walletHintsFn } from "@/server/functions";
import { useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

/** Pulls on-chain hints for the top live projects so eligibility is not pane-only. */
export function useEligibilityHints() {
  const projects = useCatalog((s) => s.projects);
  const sessionFresh = useCatalog((s) => s.sessionFresh);
  const wallets = useWallets((s) => s.wallets);
  const setProjectHints = useHints((s) => s.setProjectHints);
  const token = `${sessionFresh}:${wallets.map((w) => w.id).join("|")}:${projects
    .slice(0, 6)
    .map((p) => p.id)
    .join("|")}`;
  const last = useRef("");

  useEffect(() => {
    if (!sessionFresh || wallets.length === 0) return;
    if (last.current === token) return;
    last.current = token;
    const targets = projects.filter((p) => p.contract).slice(0, 6);
    let cancelled = false;
    void (async () => {
      for (const p of targets) {
        if (cancelled || !p.contract) return;
        try {
          const rows = await walletHintsFn({
            data: { chainKey: p.chainKey, contract: p.contract, wallets: wallets.map((w) => w.address) },
          });
          if (cancelled) return;
          const next: Record<string, { nftBalance?: number; nativeBalanceWei?: string }> = {};
          for (const w of wallets) {
            const row = rows.find((r) => r.address.toLowerCase() === w.address.toLowerCase());
            if (row) next[w.id] = { nftBalance: row.nftBalance ?? undefined, nativeBalanceWei: row.nativeBalanceWei ?? undefined };
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
