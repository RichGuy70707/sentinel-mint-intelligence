import type { EligibilityResult, ProjectModel, StageModel, WalletRecord } from "../core/types.ts";
import { normalizeAddress } from "../core/address.ts";
import { normalizeTimestamp } from "../core/time.ts";

export interface OnChainHints {
  nativeBalanceWei?: string;
  nftBalance?: number;
  gateTokenBalance?: number;
}

export function evaluateWalletStage(
  wallet: WalletRecord,
  project: ProjectModel,
  stage: StageModel,
  hints: OnChainHints = {},
  now = Date.now(),
): EligibilityResult {
  const start = normalizeTimestamp(stage.startTime);
  const end = normalizeTimestamp(stage.endTime);
  const base = {
    walletId: wallet.id,
    walletAddress: normalizeAddress(wallet.address),
    projectId: project.id,
    stageId: stage.id,
    maxQuantity: stage.maxPerWallet,
    evidence: hints.nftBalance != null || hints.gateTokenBalance != null ? ("ON_CHAIN" as const) : ("DERIVED" as const),
    timestamp: now,
    expiresAt: now + 15_000,
    requiresVerification: stage.requiresVerification,
  };

  if (!wallet.enabled) {
    return {
      ...base,
      status: "NOT_ELIGIBLE",
      reason: "Wallet is disabled in the registry",
      confidence: "HIGH",
      requiresVerification: false,
    };
  }

  if (end != null && end < now) {
    return { ...base, status: "ENDED", reason: "Stage has ended", confidence: "HIGH" };
  }
  if (start != null && start > now) {
    return {
      ...base,
      status: "NOT_STARTED",
      reason: "Stage has not started",
      confidence: "HIGH",
    };
  }

  switch (stage.kind) {
    case "SERVER_SIGNED":
      return {
        ...base,
        status: "REQUIRES_VERIFICATION",
        reason: "Server-signed mint. Proof cannot be derived on-chain.",
        confidence: "NONE",
        evidence: "UNKNOWN",
        requiresVerification: true,
      };
    case "MERKLE":
    case "ALLOWLIST":
    case "PRESALE":
    case "WL":
    case "GUARANTEED":
      return {
        ...base,
        status: "REQUIRES_PROOF",
        reason: "Allowlist / Merkle proof is not available to this terminal.",
        confidence: "NONE",
        evidence: "UNKNOWN",
        requiresVerification: true,
      };
    case "NFT_GATED":
      if (!stage.gateContract) {
        return {
          ...base,
          status: "REQUIRES_VERIFICATION",
          reason: "NFT gate collection is not evidenced. Collection balanceOf is not sufficient.",
          confidence: "NONE",
          evidence: "UNKNOWN",
          requiresVerification: true,
        };
      }
      if (hints.nftBalance == null) {
        return {
          ...base,
          status: "UNKNOWN",
          reason: "Gate NFT balance not read",
          confidence: "LOW",
          evidence: "UNKNOWN",
        };
      }
      if (hints.nftBalance <= 0) {
        return {
          ...base,
          status: "NOT_ELIGIBLE",
          reason: "Wallet holds 0 gate NFTs",
          confidence: "HIGH",
          evidence: "ON_CHAIN",
        };
      }
      return {
        ...base,
        status: "ELIGIBLE",
        reason: `Holds ${hints.nftBalance} gate NFT(s)`,
        confidence: "HIGH",
        evidence: "ON_CHAIN",
      };
    case "TOKEN_GATED":
      if (hints.gateTokenBalance == null) {
        return {
          ...base,
          status: "UNKNOWN",
          reason: "Gate token balance not read",
          confidence: "LOW",
          evidence: "UNKNOWN",
        };
      }
      if (hints.gateTokenBalance <= 0) {
        return {
          ...base,
          status: "NOT_ELIGIBLE",
          reason: "Wallet holds 0 gate tokens",
          confidence: "HIGH",
          evidence: "ON_CHAIN",
        };
      }
      return {
        ...base,
        status: "ELIGIBLE",
        reason: `Holds ${hints.gateTokenBalance} gate token units`,
        confidence: "HIGH",
        evidence: "ON_CHAIN",
      };
    case "PUBLIC":
    case "FCFS":
    case "SEADROP":
    case "FREE":
    case "PAID":
    case "DUTCH_AUCTION": {
      if (stage.maxPerWallet != null && hints.nftBalance != null && hints.nftBalance >= stage.maxPerWallet) {
        return {
          ...base,
          status: "NOT_ELIGIBLE",
          reason: `Already holds ${hints.nftBalance} (cap ${stage.maxPerWallet})`,
          confidence: "HIGH",
          evidence: "ON_CHAIN",
        };
      }
      const held = hints.nftBalance != null ? `; holds ${hints.nftBalance} already` : "";
      return {
        ...base,
        status: "ELIGIBLE",
        reason: `${stage.kind} stage does not require a private proof${held}`,
        confidence: stage.mechanismConfidence === "VERIFIED" ? "HIGH" : "MEDIUM",
      };
    }
    default:
      return {
        ...base,
        status: "UNKNOWN",
        reason: "Mechanism is unclassified. Eligibility cannot be asserted.",
        confidence: "NONE",
        evidence: "UNKNOWN",
      };
  }
}

export function evaluateProjectWallets(
  project: ProjectModel,
  wallets: WalletRecord[],
  hintMap: Record<string, OnChainHints> = {},
  now = Date.now(),
): EligibilityResult[] {
  const stage = pickRelevantStage(project, now);
  if (!stage) return [];
  return wallets.map((w) => evaluateWalletStage(w, project, stage, hintMap[w.id] ?? {}, now));
}

export function pickRelevantStage(project: ProjectModel, now = Date.now()): StageModel | null {
  const live = project.stages.find((s) => {
    const start = normalizeTimestamp(s.startTime);
    const end = normalizeTimestamp(s.endTime);
    const started = start != null && start <= now;
    const notEnded = end == null || end > now;
    return started && notEnded;
  });
  if (live) return live;
  const next = project.stages
    .filter((s) => {
      const start = normalizeTimestamp(s.startTime);
      return start != null && start > now;
    })
    .sort((a, b) => (normalizeTimestamp(a.startTime) ?? 0) - (normalizeTimestamp(b.startTime) ?? 0))[0];
  return next ?? project.stages[0] ?? null;
}

export function isolateCacheKey(chainId: number, projectId: string, walletAddress: string, stageId: string): string {
  return `${chainId}:${projectId}:${normalizeAddress(walletAddress)}:${stageId}`;
}
