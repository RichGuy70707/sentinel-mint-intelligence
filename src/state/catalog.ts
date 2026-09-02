import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeTimestamp } from "@/core/time";
import { deriveTerminalPhase, DISCOVERY_CHAIN_COUNT, type TerminalPhase } from "@/core/terminal";
import type { ChainKey, MintStatus, ProjectModel, StageKind, SystemHealth } from "@/core/types";
import { resolveMintStatus } from "@/stages/engine";

export type SignalKey = "myEligible" | "readyToMint" | "requiresVerification" | "unknownEligibility";

interface CatalogState {
  projects: ProjectModel[];
  scannedAt: number | null;
  scanning: boolean;
  sessionFresh: boolean;
  scanFailed: boolean;
  errors: { chainKey: string; message: string }[];
  mintgoNote: string | null;
  health: SystemHealth | null;
  selectedId: string | null;
  query: string;
  chainFilter: "ALL" | ChainKey;
  priceFilter: "ALL" | "FREE" | "PAID";
  stageFilter: "ALL" | StageKind;
  statusFilter: "ALL" | MintStatus;
  signals: Record<SignalKey, boolean>;
  gasGwei: number | null;
  setScan: (data: {
    projects: ProjectModel[];
    scannedAt: number;
    errors: { chainKey: string; message: string }[];
    mintgoNote?: string;
    failed?: boolean;
  }) => void;
  upsert: (project: ProjectModel) => void;
  setScanning: (v: boolean) => void;
  setHealth: (health: SystemHealth) => void;
  select: (id: string | null) => void;
  setQuery: (q: string) => void;
  setChainFilter: (c: "ALL" | ChainKey) => void;
  setPriceFilter: (c: "ALL" | "FREE" | "PAID") => void;
  setStageFilter: (c: "ALL" | StageKind) => void;
  setStatusFilter: (c: "ALL" | MintStatus) => void;
  toggleSignal: (k: SignalKey) => void;
  setGasGwei: (n: number | null) => void;
}

const EMPTY_SIGNALS: Record<SignalKey, boolean> = {
  myEligible: false,
  readyToMint: false,
  requiresVerification: false,
  unknownEligibility: false,
};

export function sanitizeProject(project: ProjectModel): ProjectModel {
  const stages = project.stages.map((s) => ({
    ...s,
    startTime: normalizeTimestamp(s.startTime),
    endTime: normalizeTimestamp(s.endTime),
  }));
  return {
    ...project,
    stages,
    status: resolveMintStatus(stages, { minted: project.minted }),
  };
}

function dedupeProjects(projects: ProjectModel[]): ProjectModel[] {
  const map = new Map<string, ProjectModel>();
  for (const raw of projects) {
    const p = sanitizeProject(raw);
    const prev = map.get(p.id);
    if (!prev) {
      map.set(p.id, p);
      continue;
    }
    map.set(p.id, {
      ...prev,
      ...p,
      name: looksLikeAddress(p.name) && !looksLikeAddress(prev.name) ? prev.name : p.name,
      minted: Math.max(prev.minted ?? 0, p.minted ?? 0),
      uniqueMinters: Math.max(prev.uniqueMinters ?? 0, p.uniqueMinters ?? 0),
      mintVelocityPerMin: Math.max(prev.mintVelocityPerMin ?? 0, p.mintVelocityPerMin ?? 0),
      supply: p.supply ?? prev.supply,
      priceWei: p.priceWei ?? prev.priceWei,
      market: p.market ?? prev.market,
      deployer: p.deployer ?? prev.deployer,
    });
  }
  return [...map.values()];
}

function looksLikeAddress(name: string): boolean {
  return name.startsWith("0x") || name.includes("…");
}

export function catalogPhase(state: {
  scanning: boolean;
  sessionFresh: boolean;
  scanFailed: boolean;
  projects: ProjectModel[];
  errors: { chainKey: string }[];
}): TerminalPhase {
  const liveCount = state.projects.filter((p) => p.status === "LIVE").length;
  const covered = new Set(state.projects.map((p) => p.chainKey));
  const materialErrors = state.errors.filter((e) => !covered.has(e.chainKey as typeof state.projects[number]["chainKey"])).length;
  return deriveTerminalPhase({
    scanning: state.scanning,
    sessionFresh: state.sessionFresh,
    scanFailed: state.scanFailed,
    liveCount,
    errorCount: materialErrors,
    chainCount: DISCOVERY_CHAIN_COUNT,
  });
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      projects: [],
      scannedAt: null,
      scanning: false,
      sessionFresh: false,
      scanFailed: false,
      errors: [],
      mintgoNote: null,
      health: null,
      selectedId: null,
      query: "",
      chainFilter: "ALL",
      priceFilter: "ALL",
      stageFilter: "ALL",
      statusFilter: "ALL",
      signals: EMPTY_SIGNALS,
      gasGwei: null,
      setScan: ({ projects, scannedAt, errors, mintgoNote, failed }) => {
        if (failed) {
          set({
            scanFailed: true,
            scanning: false,
            scannedAt,
            errors,
            mintgoNote: mintgoNote ?? get().mintgoNote,
          });
          return;
        }
        const prevById = new Map(get().projects.map((p) => [p.id, p]));
        const next = dedupeProjects(projects).map((p) => {
          const prev = prevById.get(p.id);
          if (!prev) return p;
          return {
            ...p,
            detectedAt: Math.min(prev.detectedAt ?? p.detectedAt, p.detectedAt),
            lastActivityAt: Math.max(prev.lastActivityAt ?? 0, p.lastActivityAt ?? 0) || p.lastActivityAt,
          };
        });
        set({
          projects: next,
          scannedAt,
          errors,
          mintgoNote: mintgoNote ?? get().mintgoNote,
          sessionFresh: true,
          scanFailed: false,
          scanning: false,
          selectedId:
            get().selectedId && next.some((p) => p.id === get().selectedId) ? get().selectedId : (next[0]?.id ?? null),
        });
      },
      upsert: (project) => {
        const cleaned = sanitizeProject(project);
        const rest = get().projects.filter((p) => p.id !== cleaned.id);
        set({ projects: dedupeProjects([cleaned, ...rest]), selectedId: cleaned.id });
      },
      setScanning: (scanning) => {
        if (get().scanning === scanning) return;
        set({ scanning });
      },
      setHealth: (health) => set({ health }),
      select: (selectedId) => set({ selectedId }),
      setQuery: (query) => set({ query }),
      setChainFilter: (chainFilter) => set({ chainFilter }),
      setPriceFilter: (priceFilter) => set({ priceFilter }),
      setStageFilter: (stageFilter) => set({ stageFilter }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      toggleSignal: (k) => set({ signals: { ...get().signals, [k]: !get().signals[k] } }),
      setGasGwei: (gasGwei) => set({ gasGwei }),
    }),
    {
      name: "sentinel.catalog.v3",
      partialize: (s) => ({
        projects: s.projects,
        scannedAt: s.scannedAt,
        selectedId: s.selectedId,
        chainFilter: s.chainFilter,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.sessionFresh = false;
        state.scanFailed = false;
        state.scanning = false;
        state.projects = state.projects.map(sanitizeProject);
      },
    },
  ),
);
