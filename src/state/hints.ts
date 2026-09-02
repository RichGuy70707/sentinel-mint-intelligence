import { create } from "zustand";
import type { OnChainHints } from "@/eligibility/engine";

interface HintState {
  byProject: Record<string, Record<string, OnChainHints>>;
  setProjectHints: (projectId: string, hints: Record<string, OnChainHints>) => void;
}

export const useHints = create<HintState>((set) => ({
  byProject: {},
  setProjectHints: (projectId, hints) =>
    set((s) => ({ byProject: { ...s.byProject, [projectId]: hints } })),
}));
