import { create } from "zustand";
import { hintsEqual } from "@/core/terminal";
import type { OnChainHints } from "@/eligibility/engine";

interface HintState {
  byProject: Record<string, Record<string, OnChainHints>>;
  setProjectHints: (projectId: string, hints: Record<string, OnChainHints>) => void;
}

export const useHints = create<HintState>((set, get) => ({
  byProject: {},
  setProjectHints: (projectId, hints) => {
    const prev = get().byProject[projectId];
    if (prev && hintsEqual(prev, hints)) return;
    set({ byProject: { ...get().byProject, [projectId]: hints } });
  },
}));
