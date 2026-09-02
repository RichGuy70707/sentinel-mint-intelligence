import { useCallback, useRef } from "react";
import { SCAN_CLIENT_BUDGET_MS } from "@/core/terminal";
import { scanLiveMints, systemHealthFn } from "@/server/functions";
import { useAlerts } from "@/state/alerts";
import { useCatalog } from "@/state/catalog";

export function useScanner() {
  const inflight = useRef<Promise<void> | null>(null);

  return useCallback(async () => {
    if (inflight.current) return inflight.current;
    const catalog = useCatalog.getState();
    catalog.setScanning(true);
    const run = (async () => {
      try {
        const report = await withTimeout(scanLiveMints(), SCAN_CLIENT_BUDGET_MS);
        useCatalog.getState().setScan({
          projects: report.projects,
          scannedAt: report.scannedAt,
          errors: report.errors,
          mintgoNote: report.mintgo.reason,
        });
        useCatalog.getState().setGasGwei(report.gasGwei ?? null);
        const live = report.projects.filter((p) => p.status === "LIVE");
        if (live.length) useAlerts.getState().push("MINT_LIVE", "Live mints", `${live.length} collection(s) currently minting.`);
        const hot = report.projects.filter((p) => (p.mintVelocityPerMin ?? 0) >= 2);
        if (hot.length) {
          useAlerts.getState().push(
            "ACTIVITY_SPIKE",
            "Mint velocity",
            `${hot.length} collection(s) showing elevated mint Transfer activity.`,
          );
        }
        void systemHealthFn()
          .then((health) => {
            useCatalog.getState().setHealth({
              scannedAt: health.scannedAt,
              providers: health.providers,
              discoveryOk: health.discoveryOk,
              notes: health.notes,
            });
          })
          .catch(() => undefined);
      } catch {
        const cur = useCatalog.getState();
        cur.setScan({
          projects: cur.projects,
          scannedAt: cur.scannedAt ?? Date.now(),
          errors: cur.errors,
          failed: true,
        });
      } finally {
        useCatalog.getState().setScanning(false);
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, []);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SCAN_TIMEOUT")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
