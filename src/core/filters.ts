import type { ChainKey, MintStatus, ProjectModel, StageKind } from "./types";
import { classifyMintStatus, normalizeTimestamp } from "./time.ts";

export interface MintFilters {
  chain: "ALL" | ChainKey;
  price: "ALL" | "FREE" | "PAID";
  stage: "ALL" | StageKind;
  status: "ALL" | MintStatus;
  query: string;
  myEligible: boolean;
  readyToMint: boolean;
  requiresVerification: boolean;
  unknownEligibility: boolean;
  freeMint: boolean;
  highActivity: boolean;
  endingSoon: boolean;
  eligibleIds?: Set<string>;
  readyIds?: Set<string>;
  requiresVerificationIds?: Set<string>;
  unknownEligibilityIds?: Set<string>;
}

export const DEFAULT_FILTERS: MintFilters = {
  chain: "ALL",
  price: "ALL",
  stage: "ALL",
  status: "ALL",
  query: "",
  myEligible: false,
  readyToMint: false,
  requiresVerification: false,
  unknownEligibility: false,
  freeMint: false,
  highActivity: false,
  endingSoon: false,
};

export function fuzzyScore(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 1;
  if (h.includes(n)) return n.length / Math.max(h.length, 1) + 1;
  let hi = 0;
  let hits = 0;
  for (const ch of n) {
    const idx = h.indexOf(ch, hi);
    if (idx === -1) continue;
    hits += 1;
    hi = idx + 1;
  }
  return hits / n.length;
}

export function matchesQuery(project: ProjectModel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [
    project.name,
    project.symbol,
    project.contract ?? "",
    project.collectionSlug ?? "",
    project.chainKey,
    project.id,
  ];
  return fields.some((f) => fuzzyScore(f, q) >= 0.6 || f.toLowerCase().includes(q));
}

export function isFreeMint(project: ProjectModel): boolean {
  if (project.priceWei === "0") return true;
  return project.stages.some((s) => s.priceWei === "0" || s.kind === "FREE");
}

export function currentStageKind(project: ProjectModel, now = Date.now()): StageKind | "UNKNOWN" {
  const live = project.stages.find((s) => {
    const start = normalizeTimestamp(s.startTime);
    const end = normalizeTimestamp(s.endTime);
    const started = start != null && start <= now;
    const notEnded = end == null || end > now;
    return started && notEnded;
  });
  return live?.kind ?? project.stages[0]?.kind ?? "UNKNOWN";
}

export function applyFilters(projects: ProjectModel[], filters: MintFilters, now = Date.now()): ProjectModel[] {
  return projects.filter((p) => {
    if (filters.chain !== "ALL" && p.chainKey !== filters.chain) return false;
    if (filters.price === "FREE" && !isFreeMint(p)) return false;
    if (filters.price === "PAID" && isFreeMint(p)) return false;
    if (filters.stage !== "ALL") {
      const kinds = new Set(p.stages.map((s) => s.kind));
      if (!kinds.has(filters.stage) && currentStageKind(p, now) !== filters.stage) return false;
    }
    const status = p.status === "UNKNOWN" ? classifyMintStatus(p.stages, now) : p.status;
    if (filters.status !== "ALL" && status !== filters.status) return false;
    if (!matchesQuery(p, filters.query)) return false;
    if (filters.freeMint && !isFreeMint(p)) return false;
    if (filters.highActivity && (p.mintVelocityPerMin == null || p.mintVelocityPerMin < 1)) return false;
    if (filters.endingSoon) {
      const ends = p.stages.map((s) => normalizeTimestamp(s.endTime)).filter((n): n is number => n != null);
      if (!ends.length || Math.min(...ends) - now > 30 * 60 * 1000) return false;
    }
    if (filters.myEligible && filters.eligibleIds && !filters.eligibleIds.has(p.id)) return false;
    if (filters.readyToMint && filters.readyIds && !filters.readyIds.has(p.id)) return false;
    if (filters.requiresVerification && filters.requiresVerificationIds && !filters.requiresVerificationIds.has(p.id))
      return false;
    if (filters.unknownEligibility && filters.unknownEligibilityIds && !filters.unknownEligibilityIds.has(p.id))
      return false;
    return true;
  });
}
