import type { ProjectModel, StageKind, StageModel } from "@/core/types";
import { classifyMintStatus, normalizeTimestamp } from "@/core/time";

export function deriveStagesFromIntel(input: {
  projectId: string;
  publicStart?: number | null;
  publicEnd?: number | null;
  priceWei?: string | null;
  maxPerWallet?: number | null;
  maxSupply?: number | null;
  seadrop?: boolean;
}): StageModel[] {
  const now = Date.now();
  const startTime = normalizeTimestamp(input.publicStart ?? null);
  const endTime = normalizeTimestamp(input.publicEnd ?? null);
  const kind: StageKind = input.seadrop ? "SEADROP" : input.priceWei === "0" ? "FREE" : "PUBLIC";
  return [
    {
      id: `${input.projectId}:${kind.toLowerCase()}`,
      kind,
      label: input.seadrop ? "SeaDrop public" : kind === "FREE" ? "Free public" : "Public",
      mechanism: kind,
      mechanismConfidence: input.seadrop ? "VERIFIED" : startTime != null ? "DERIVED" : "UNKNOWN",
      startTime,
      endTime,
      priceWei: input.priceWei ?? null,
      maxPerWallet: input.maxPerWallet ?? null,
      maxSupply: input.maxSupply ?? null,
      requiresVerification: false,
      provenance: {
        source: input.seadrop ? "ON_CHAIN" : "DERIVED",
        quality: startTime != null ? "LIVE" : "UNKNOWN",
        confidence: input.seadrop ? "HIGH" : "LOW",
        fetchedAt: now,
        ttlMs: 15_000,
        note: input.seadrop ? "SeaDrop getPublicDrop" : "Inferred public window",
      },
    },
  ];
}

export function nextStage(project: ProjectModel, now = Date.now()): StageModel | null {
  const upcoming = project.stages
    .filter((s) => normalizeTimestamp(s.startTime) != null && (normalizeTimestamp(s.startTime) as number) > now)
    .sort((a, b) => (normalizeTimestamp(a.startTime) ?? 0) - (normalizeTimestamp(b.startTime) ?? 0));
  return upcoming[0] ?? null;
}

export function currentStage(project: ProjectModel, now = Date.now()): StageModel | null {
  return (
    project.stages.find((s) => {
      const start = normalizeTimestamp(s.startTime);
      const end = normalizeTimestamp(s.endTime);
      const started = start != null && start <= now;
      const notEnded = end == null || end > now;
      return started && notEnded;
    }) ?? null
  );
}

export function refreshProjectStatus(project: ProjectModel, now = Date.now()): ProjectModel {
  return { ...project, status: classifyMintStatus(project.stages, now) };
}

export function stagePhase(stage: StageModel, now = Date.now()): "completed" | "active" | "next" | "scheduled" | "unknown" {
  const start = normalizeTimestamp(stage.startTime);
  const end = normalizeTimestamp(stage.endTime);
  if (end != null && end < now) return "completed";
  if (start != null && start <= now && (end == null || end > now)) return "active";
  if (start != null && start > now) return "scheduled";
  return "unknown";
}
