import { useCallback, useRef } from "react";
import { scanLiveMints, systemHealthFn } from "@/server/functions";
import { useAlerts } from "@/state/alerts";
import { useCatalog } from "@/state/catalog";
import { useWatchlist } from "@/state/watchlist";

export function useScanner() {
  const setScan = useCatalog((s) => s.setScan);
  const setScanning = useCatalog((s) => s.setScanning);
  const setHealth = useCatalog((s) => s.setHealth);
  const setGasGwei = useCatalog((s) => s.setGasGwei);
  const mergeLive = useWatchlist((s) => s.mergeLive);
  const push = useAlerts((s) => s.push);
  const inflight = useRef<Promise<void> | null>(null);

  return useCallback(async () => {
    if (inflight.current) return inflight.current;
    setScanning(true);
    const run = (async () => {
      try {
        const report = await scanLiveMints();
        const merged = mergeLive(report.projects);
        setScan({
          projects: merged,
          scannedAt: report.scannedAt,
          errors: report.errors,
          mintgoNote: report.mintgo.reason,
        });
        setGasGwei(report.gasGwei ?? null);
        if (report.errors.length) {
          push("PROVIDER_FAILURE", "Scan incomplete", report.errors.map((e) => `${e.chainKey}: ${e.message}`).join(" · "));
        }
        const hot = merged.filter((p) => (p.mintVelocityPerMin ?? 0) >= 2);
        if (hot.length) {
          push("ACTIVITY_SPIKE", "Mint velocity", `${hot.length} collection(s) showing elevated mint Transfer activity.`);
        }
        const live = merged.filter((p) => p.status === "LIVE");
        if (live.length) push("MINT_LIVE", "Live mints", `${live.length} collection(s) currently minting.`);
        void systemHealthFn()
          .then((health) => {
            setHealth({
              scannedAt: health.scannedAt,
              providers: health.providers,
              discoveryOk: health.discoveryOk,
              notes: health.notes,
            });
          })
          .catch(() => undefined);
      } finally {
        setScanning(false);
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [mergeLive, push, setGasGwei, setHealth, setScan, setScanning]);
}