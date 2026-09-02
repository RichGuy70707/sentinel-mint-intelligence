export type ChainKey = "eth" | "rh" | "ink" | "base";

export type DataQuality = "LIVE" | "VERIFIED" | "ESTIMATED" | "STALE" | "UNKNOWN";
export type EvidenceSource =
  | "ON_CHAIN"
  | "OPEN_SEA_API"
  | "MINTGO_API"
  | "WALLET_DATA"
  | "DERIVED"
  | "USER"
  | "UNKNOWN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type MintStatus = "UPCOMING" | "LIVE" | "ENDED" | "UNKNOWN";

export type StageKind =
  | "PUBLIC"
  | "FCFS"
  | "ALLOWLIST"
  | "PRESALE"
  | "WL"
  | "GUARANTEED"
  | "MERKLE"
  | "TOKEN_GATED"
  | "NFT_GATED"
  | "SERVER_SIGNED"
  | "DUTCH_AUCTION"
  | "SEADROP"
  | "FREE"
  | "PAID"
  | "OTHER"
  | "UNKNOWN";

export type MechanismConfidence = "VERIFIED" | "DERIVED" | "UNKNOWN";

export type EligibilityStatus =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "UNKNOWN"
  | "REQUIRES_PROOF"
  | "REQUIRES_VERIFICATION"
  | "EXPIRED"
  | "NOT_STARTED"
  | "ENDED";

export type ReadinessStatus =
  | "READY"
  | "NOT_READY"
  | "SIMULATION_FAILED"
  | "INSUFFICIENT_FUNDS"
  | "STAGE_NOT_ACTIVE"
  | "UNKNOWN";

export type ProviderHealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "UNHEALTHY"
  | "OPEN"
  | "HALF_OPEN"
  | "RECOVERING";

export interface Provenance {
  source: EvidenceSource;
  quality: DataQuality;
  confidence: Confidence;
  fetchedAt: number;
  ttlMs: number;
  note?: string;
}

export interface ChainDescriptor {
  key: ChainKey;
  id: number;
  name: string;
  shortName: string;
  nativeSymbol: string;
  explorerTx: string;
  explorerAddress: string;
  adapters: string[];
}

export interface StageModel {
  id: string;
  kind: StageKind;
  label: string;
  mechanism: StageKind;
  mechanismConfidence: MechanismConfidence;
  startTime: number | null;
  endTime: number | null;
  priceWei: string | null;
  maxPerWallet: number | null;
  maxSupply: number | null;
  requiresVerification: boolean;
  provenance: Provenance;
}

export interface ProjectModel {
  id: string;
  chainKey: ChainKey;
  chainId: number;
  name: string;
  symbol: string;
  contract: string | null;
  collectionSlug: string | null;
  description: string;
  imageUrl: string | null;
  links: { label: string; href: string }[];
  stages: StageModel[];
  supply: number | null;
  remaining: number | null;
  minted: number | null;
  priceWei: string | null;
  status: MintStatus;
  detectedAt: number;
  lastActivityAt: number | null;
  mintVelocityPerMin: number | null;
  uniqueMinters: number | null;
  verifiedSource: boolean;
  bytecodePresent: boolean | null;
  contractType: string | null;
  interfaces: string[];
  riskFlags: string[];
  market: MarketSnapshot | null;
  deployer: string | null;
  saleSource: string | null;
  provenance: Provenance;
}

export interface MarketSnapshot {
  volumeWei: string | null;
  floorWei: string | null;
  floorChangePct: number | null;
  sales: number | null;
  quality: DataQuality;
  provenance: Provenance;
}

export interface WalletRecord {
  id: string;
  name: string;
  address: string;
  notes: string;
  tags: string[];
  enabled: boolean;
  favorite: boolean;
  priority: number;
  createdAt: number;
}

export interface EligibilityResult {
  walletId: string;
  walletAddress: string;
  projectId: string;
  stageId: string;
  status: EligibilityStatus;
  maxQuantity: number | null;
  reason: string;
  evidence: EvidenceSource;
  confidence: Confidence;
  requiresVerification: boolean;
  timestamp: number;
  expiresAt: number;
}

export interface CanonicalTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  contract: string;
  wallet: string;
  quantity: number;
  source: string;
  timestamp: number;
  confidence: Confidence;
}

export interface SimulationResult {
  status: ReadinessStatus;
  explanation: string;
  gasEstimate: string | null;
  feeWei: string | null;
  balanceWei: string | null;
  revertData: string | null;
  checks: { name: string; ok: boolean; detail: string }[];
  timestamp: number;
}

export interface AlertRule {
  id: string;
  type: AlertType;
  enabled: boolean;
  threshold?: number;
}

export type AlertType =
  | "MINT_STARTING_SOON"
  | "MINT_LIVE"
  | "WALLET_ELIGIBLE"
  | "STAGE_CHANGED"
  | "FCFS_STARTING"
  | "PUBLIC_STARTING"
  | "MINT_ENDED"
  | "SUPPLY_THRESHOLD"
  | "ACTIVITY_SPIKE"
  | "PRICE_THRESHOLD"
  | "TX_READY"
  | "SIMULATION_FAILURE"
  | "PROVIDER_FAILURE"
  | "INSUFFICIENT_FUNDS";

export interface AlertEvent {
  id: string;
  type: AlertType;
  title: string;
  body: string;
  projectId?: string;
  walletId?: string;
  createdAt: number;
  read: boolean;
}

export interface QueueItem {
  id: string;
  projectId: string;
  walletId: string;
  stageId: string;
  quantity: number;
  preparedTx: CanonicalTx | null;
  simulation: SimulationResult | null;
  status: "IDLE" | "PREPARED" | "SIMULATED" | "READY" | "AUTHORIZED" | "BROADCAST" | "CONFIRMED" | "FAILED" | "CANCELLED";
  txHash: string | null;
  updatedAt: number;
}

export interface ProviderSnapshot {
  id: string;
  chainKey: ChainKey;
  url: string;
  state: ProviderHealthState;
  latencyMs: number | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  failures: number;
}

export interface SystemHealth {
  scannedAt: number;
  providers: ProviderSnapshot[];
  discoveryOk: boolean;
  notes: string[];
}
