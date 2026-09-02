import type { ProjectModel, StageKind, StageModel } from "../core/types.ts";
import { classifyMintStatus, normalizeTimestamp } from "../core/time.ts";

export function deriveStagesFromIntel(input: {
  projectId: string;
  publicStart?: number | null;
  publicEnd?: number | null;
  priceWei?: string | null;
  maxPerWallet?: number | null;
  maxSupply?: number | null;
  seadrop?: boolean;
  merkleRoot?: boolean;
}): StageModel[] {
  const now = Date.now();
  const startTime = normalizeTimestamp(input.publicStart ?? null);
  const endTime = normalizeTimestamp(input.publicEnd ?? null);
  const kind: StageKind = input.seadrop
    ? "SEADROP"
    : input.merkleRoot && startTime == null && input.priceWei == null
      ? "MERKLE"
      : input.priceWei === "0"
        ? "FREE"
        : "PUBLIC";
  const publicStage: StageModel = {
    id: `${input.projectId}:${kind.toLowerCase()}`,
    kind,
    label: input.seadrop ? "SeaDrop public" : kind === "FREE" ? "Free public" : kind === "MERKLE" ? "Merkle / allowlist" : "Public",
    mechanism: kind,
    mechanismConfidence: input.seadrop ? "VERIFIED" : startTime != null || input.merkleRoot ? "DERIVED" : "UNKNOWN",
    startTime,
    endTime,
    priceWei: input.priceWei ?? null,
    maxPerWallet: input.maxPerWallet ?? null,
    maxSupply: input.maxSupply ?? null,
    requiresVerification: kind === "MERKLE",
    provenance: {
      source: input.seadrop || input.merkleRoot ? "ON_CHAIN" : "DERIVED",
      quality: startTime != null ? "LIVE" : "UNKNOWN",
      confidence: input.seadrop ? "HIGH" : input.merkleRoot ? "MEDIUM" : "LOW",
      fetchedAt: now,
      ttlMs: 15_000,
      note: input.seadrop
        ? "SeaDrop getPublicDrop"
        : input.merkleRoot
          ? "Non-zero merkleRoot() view"
          : startTime != null
            ? "On-chain sale window"
            : "Sale window unread — timestamps not inferred",
    },
  };

  if (input.merkleRoot && kind !== "MERKLE") {
    const merkle: StageModel = {
      id: `${input.projectId}:merkle`,
      kind: "MERKLE",
      label: "Merkle / allowlist",
      mechanism: "MERKLE",
      mechanismConfidence: "DERIVED",
      startTime: null,
      endTime: null,
      priceWei: null,
      maxPerWallet: null,
      maxSupply: input.maxSupply ?? null,
      requiresVerification: true,
      provenance: {
        source: "ON_CHAIN",
        quality: "UNKNOWN",
        confidence: "MEDIUM",
        fetchedAt: now,
        ttlMs: 15_000,
        note: "Non-zero merkleRoot() view — proof not available",
      },
    };
    return [publicStage, merkle];
  }

  return [publicStage];
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

export function resolveMintStatus(
  stages: { startTime: number | null; endTime: number | null }[],
  activity: { minted?: number | null; windowMints?: number | null; supply?: number | null },
  now = Date.now(),
): "UPCOMING" | "LIVE" | "ENDED" | "UNKNOWN" {
  const fromStages = classifyMintStatus(stages, now);
  const supply = activity.supply;
  const total = activity.minted;
  if (supply != null && supply > 0 && total != null && total >= supply && fromStages !== "UPCOMING") {
    return "ENDED";
  }
  if (fromStages !== "UNKNOWN") return fromStages;
  if ((activity.windowMints ?? 0) > 0) return "LIVE";
  return "UNKNOWN";
}
