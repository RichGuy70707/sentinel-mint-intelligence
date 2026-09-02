import { normalizeAddress, shortAddress } from "@/core/address";
import type { ChainKey, ProjectModel, Provenance } from "@/core/types";
import { CHAINS, TRANSFER_TOPIC, ZERO_TOPIC } from "@/chains/registry";
import { inspectContract } from "@/contracts/inspect";
import { probeSale } from "@/contracts/sale";
import { alchemyContractMeta, alchemyMintTransfers } from "@/providers/alchemy";
import { blockscoutMintTransfers, tokenAddress, type BlockscoutTransfer } from "@/providers/blockscout";
import { openSeaMarket } from "@/providers/opensea";
import { ethBlockNumber, ethGetLogs, type LogEntry } from "@/providers/rpc";
import { intelCache } from "@/providers/ttl-cache";
import { deriveStagesFromIntel, resolveMintStatus } from "@/stages/engine";
import { isProtocolReceiptNft, receiptLabel } from "./noise";

const SCAN_BLOCKS: Record<ChainKey, number> = {
  eth: 48,
  base: 80,
  rh: 400,
  ink: 400,
};

const LOG_CHUNK: Record<ChainKey, number> = {
  eth: 8,
  base: 16,
  rh: 80,
  ink: 80,
};

const ERC1155_TRANSFER_SINGLE =
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";

export interface DiscoveryReport {
  projects: ProjectModel[];
  scannedAt: number;
  errors: { chainKey: ChainKey; message: string }[];
  scannedBlocks: { chainKey: ChainKey; from: number; to: number }[];
  sources: { chainKey: ChainKey; source: string }[];
}

export async function discoverMints(chains: ChainKey[] = ["eth", "rh", "ink", "base"]): Promise<DiscoveryReport> {
  const scannedAt = Date.now();
  const errors: DiscoveryReport["errors"] = [];
  const scannedBlocks: DiscoveryReport["scannedBlocks"] = [];
  const sources: DiscoveryReport["sources"] = [];
  const groups: ProjectModel[] = [];

  await Promise.all(
    chains.map(async (chainKey) => {
      const slice = await withBudget(scanChain(chainKey, scannedAt), 12_000, {
        projects: [] as ProjectModel[],
        errors: [] as DiscoveryReport["errors"],
        scannedBlocks: [] as DiscoveryReport["scannedBlocks"],
        sources: [] as DiscoveryReport["sources"],
        timedOut: true,
      });
      groups.push(...slice.projects);
      scannedBlocks.push(...slice.scannedBlocks);
      sources.push(...slice.sources);
      if (slice.errors.length) errors.push(...slice.errors);
      else if (slice.timedOut) errors.push({ chainKey, message: "chain budget exceeded" });
    }),
  );

  groups.sort((a, b) => (b.mintVelocityPerMin ?? 0) - (a.mintVelocityPerMin ?? 0));
  return { projects: groups, scannedAt, errors, scannedBlocks, sources };
}

async function scanChain(
  chainKey: ChainKey,
  scannedAt: number,
): Promise<{
  projects: ProjectModel[];
  errors: DiscoveryReport["errors"];
  scannedBlocks: DiscoveryReport["scannedBlocks"];
  sources: DiscoveryReport["sources"];
  timedOut: boolean;
}> {
  const errors: DiscoveryReport["errors"] = [];
  const scannedBlocks: DiscoveryReport["scannedBlocks"] = [];
  const sources: DiscoveryReport["sources"] = [];
  try {
    const latest = await withBudget(ethBlockNumber(chainKey), 4_000, null);
    if (latest != null) scannedBlocks.push({ chainKey, from: Math.max(0, latest - SCAN_BLOCKS[chainKey]), to: latest });

    const scout = await blockscoutMintTransfers(chainKey);
    let logPack: { logs: LogEntry[]; source: string } = { logs: [], source: "none" };
    if (!scout.items.length && latest != null) {
      logPack = await withBudget(
        collectLogs(chainKey, Math.max(0, latest - SCAN_BLOCKS[chainKey]), latest),
        8_000,
        { logs: [], source: "none" },
      );
    }

    const fromLogs = aggregateLogs(chainKey, logPack.logs, scannedAt);
    const fromScout = aggregateBlockscout(chainKey, scout.items, scannedAt);
    const merged = mergeProjects(fromLogs, fromScout).filter((p) => !isProtocolReceiptNft(p));
    if (logPack.source !== "none") sources.push({ chainKey, source: logPack.source });
    if (scout.items.length) sources.push({ chainKey, source: scout.host ? `blockscout:${scout.host}` : "blockscout" });
    if (scout.error && !scout.items.length && !fromLogs.length) {
      errors.push({ chainKey, message: scout.error });
    }
    const enriched = await withBudget(enrichTop(chainKey, merged, 6), 10_000, merged.slice(0, 8));
    const cleaned = enriched.filter((p) => keepDiscovered(p));
    return { projects: cleaned, errors, scannedBlocks, sources, timedOut: false };
  } catch (err) {
    errors.push({
      chainKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return { projects: [], errors, scannedBlocks, sources, timedOut: false };
  }
}

async function collectLogs(
  chainKey: ChainKey,
  from: number,
  latest: number,
): Promise<{ logs: LogEntry[]; source: string }> {
  const alchemy = await alchemyMintTransfers(chainKey, hex(from));
  if (alchemy.used && alchemy.transfers.length) {
    return {
      source: "alchemy_getAssetTransfers",
      logs: alchemy.transfers
        .filter((t) => t.rawContract?.address)
        .map((t) => ({
          address: t.rawContract!.address!,
          topics: [TRANSFER_TOPIC, ZERO_TOPIC, t.to ? padTopic(t.to) : ZERO_TOPIC],
          data: "0x",
          blockNumber: t.blockNum ?? hex(latest),
          transactionHash: t.hash ?? "0x",
        })),
    };
  }

  const chunk = LOG_CHUNK[chainKey];
  const ranges: Array<{ a: number; b: number }> = [];
  for (let start = from; start <= latest; start += chunk) {
    ranges.push({ a: start, b: Math.min(latest, start + chunk - 1) });
  }
  const settled = await Promise.all(
    ranges.map((r) =>
      Promise.all([
        ethGetLogs(chainKey, {
          fromBlock: hex(r.a),
          toBlock: hex(r.b),
          topics: [TRANSFER_TOPIC, ZERO_TOPIC],
        }).catch(() => [] as LogEntry[]),
        ethGetLogs(chainKey, {
          fromBlock: hex(r.a),
          toBlock: hex(r.b),
          topics: [ERC1155_TRANSFER_SINGLE, null, ZERO_TOPIC],
        }).catch(() => [] as LogEntry[]),
      ]),
    ),
  );
  const logs = settled.flatMap(([a, b]) => [...a, ...b]);
  return { logs, source: logs.length ? "eth_getLogs" : "none" };
}

function padTopic(addr: string): string {
  const a = addr.toLowerCase().replace(/^0x/, "");
  return `0x${a.padStart(64, "0")}`;
}

interface Agg {
  contract: string;
  chainKey: ChainKey;
  mints: number;
  minters: Set<string>;
  lastTx: string;
  lastBlock: number;
  name?: string;
  symbol?: string;
  supplyHint?: number | null;
}

function aggregateLogs(chainKey: ChainKey, logs: LogEntry[], scannedAt: number): ProjectModel[] {
  const map = new Map<string, Agg>();
  for (const log of logs) {
    const contract = normalizeAddress(log.address);
    const to = topicAddress(log.topics[2] ?? log.topics[3]);
    const current = map.get(contract) ?? {
      contract,
      chainKey,
      mints: 0,
      minters: new Set<string>(),
      lastTx: log.transactionHash,
      lastBlock: Number.parseInt(log.blockNumber, 16),
    };
    current.mints += 1;
    if (to) current.minters.add(to);
    current.lastTx = log.transactionHash;
    current.lastBlock = Number.parseInt(log.blockNumber, 16);
    map.set(contract, current);
  }
  const windowMin = Math.max(1, SCAN_BLOCKS[chainKey] / 5);
  return [...map.values()].map((agg) => projectFromAgg(agg, scannedAt, windowMin, "Mint Transfer from zero address"));
}

function aggregateBlockscout(chainKey: ChainKey, items: BlockscoutTransfer[], scannedAt: number): ProjectModel[] {
  const map = new Map<string, Agg>();
  for (const item of items) {
    const raw = tokenAddress(item);
    if (!raw) continue;
    const contract = normalizeAddress(raw);
    const to = item.to?.hash ? normalizeAddress(item.to.hash) : null;
    const current = map.get(contract) ?? {
      contract,
      chainKey,
      mints: 0,
      minters: new Set<string>(),
      lastTx: item.transaction_hash ?? "0x",
      lastBlock: item.block_number ?? 0,
      name: item.token?.name ?? undefined,
      symbol: item.token?.symbol ?? undefined,
      supplyHint: item.token?.total_supply ? Number(item.token.total_supply) : null,
    };
    current.mints += 1;
    if (to) current.minters.add(to);
    if (item.transaction_hash) current.lastTx = item.transaction_hash;
    if (item.block_number) current.lastBlock = item.block_number;
    map.set(contract, current);
  }
  return [...map.values()].map((agg) =>
    projectFromAgg(agg, scannedAt, 3, "Blockscout token-transfers (minting / from-zero)"),
  );
}

function mergeProjects(a: ProjectModel[], b: ProjectModel[]): ProjectModel[] {
  const map = new Map<string, ProjectModel>();
  for (const p of [...a, ...b]) {
    const prev = map.get(p.id);
    if (!prev) {
      map.set(p.id, p);
      continue;
    }
    map.set(p.id, {
      ...prev,
      name: looksLikeAddress(prev.name) && !looksLikeAddress(p.name) ? p.name : prev.name,
      symbol: prev.symbol === "UNK" ? p.symbol : prev.symbol,
      minted: Math.max(prev.minted ?? 0, p.minted ?? 0),
      uniqueMinters: Math.max(prev.uniqueMinters ?? 0, p.uniqueMinters ?? 0),
      mintVelocityPerMin: Math.max(prev.mintVelocityPerMin ?? 0, p.mintVelocityPerMin ?? 0),
      supply: prev.supply ?? p.supply,
    });
  }
  return [...map.values()];
}

function looksLikeAddress(name: string): boolean {
  return name.startsWith("0x") || name.includes("…");
}

function projectFromAgg(agg: Agg, scannedAt: number, windowMin: number, note: string): ProjectModel {
  const provenance: Provenance = {
    source: "ON_CHAIN",
    quality: "LIVE",
    confidence: "HIGH",
    fetchedAt: scannedAt,
    ttlMs: 20_000,
    note,
  };
  const stages = deriveStagesFromIntel({
    projectId: `${agg.chainKey}:${agg.contract}`,
    publicStart: null,
    priceWei: null,
  });
  const minted = agg.mints;
  return {
    id: `${agg.chainKey}:${agg.contract}`,
    chainKey: agg.chainKey,
    chainId: CHAINS[agg.chainKey].id,
    name: agg.name?.trim() || shortAddress(agg.contract, 5),
    symbol: agg.symbol?.trim() || "UNK",
    contract: agg.contract,
    collectionSlug: null,
    description: `Detected mint activity on ${CHAINS[agg.chainKey].name}.`,
    imageUrl: null,
    links: [{ label: "Explorer", href: `${CHAINS[agg.chainKey].explorerAddress}${agg.contract}` }],
    stages,
    supply: Number.isFinite(agg.supplyHint ?? NaN) ? agg.supplyHint! : null,
    remaining: null,
    minted,
    priceWei: null,
    status: "UNKNOWN",
    detectedAt: scannedAt,
    lastActivityAt: scannedAt,
    mintVelocityPerMin: Number((agg.mints / windowMin).toFixed(2)),
    uniqueMinters: agg.minters.size,
    verifiedSource: false,
    bytecodePresent: null,
    contractType: null,
    interfaces: [],
    riskFlags: receiptLabel(agg) ? [`Protocol receipt: ${receiptLabel(agg)}`] : ["Metadata pending inspect"],
    market: null,
    deployer: null,
    saleSource: null,
    provenance,
  };
}

async function enrichTop(chainKey: ChainKey, projects: ProjectModel[], limit: number): Promise<ProjectModel[]> {
  const ranked = [...projects].sort((a, b) => (b.minted ?? 0) - (a.minted ?? 0)).slice(0, limit);
  const rest = projects.filter((p) => !ranked.includes(p));
  const enriched = await Promise.all(ranked.map((p) => enrichProject(p)));
  return [...enriched, ...rest];
}

async function enrichProject(p: ProjectModel): Promise<ProjectModel> {
  if (!p.contract) return p;
  const contract = p.contract;
  try {
    const [intel, sale, alchemy, market] = await Promise.all([
      inspectContract(p.chainKey, contract),
      intelCache.wrap(`sale:${p.chainKey}:${contract}`, 30_000, () => probeSale(p.chainKey, contract)),
      alchemyContractMeta(p.chainKey, contract),
      intelCache.wrap(`os:${p.chainKey}:${contract}`, 60_000, () => openSeaMarket(p.chainKey, contract)),
    ]);
    const priceWei = sale.priceWei ?? p.priceWei;
    const stages = deriveStagesFromIntel({
      projectId: p.id,
      publicStart: sale.startTime ?? null,
      publicEnd: sale.endTime ?? null,
      priceWei,
      maxPerWallet: sale.maxPerWallet,
      maxSupply: intel.maxSupply ? Number(intel.maxSupply) : p.supply,
      seadrop: sale.seadrop,
      merkleRoot: sale.merkleRoot,
    });
    const minted = intel.totalSupply ? Number(intel.totalSupply) : p.minted;
    const supply = intel.maxSupply ? Number(intel.maxSupply) : p.supply;
    return {
      ...p,
      name: intel.name || alchemy.name || p.name,
      symbol: intel.symbol || alchemy.symbol || p.symbol,
      supply,
      remaining: supply != null && minted != null ? Math.max(0, supply - minted) : null,
      minted,
      priceWei,
      bytecodePresent: intel.bytecodePresent,
      contractType: intel.contractType || alchemy.tokenType,
      interfaces: intel.interfaces,
      verifiedSource: intel.interfaces.includes("ERC721") || intel.interfaces.includes("ERC1155"),
      stages,
      status: resolveMintStatus(stages, { minted }),
      deployer: sale.owner,
      saleSource: sale.source === "none" ? null : sale.source,
      market,
      riskFlags: [
        ...(intel.bytecodePresent ? [] : ["No bytecode"]),
        ...(priceWei == null ? ["Mint price not exposed as a standard view"] : []),
        ...(sale.seadrop ? [] : ["Mechanism derived from live mint logs"]),
        ...(sale.merkleRoot ? ["Non-zero merkle root — allowlist proof unavailable"] : []),
        ...(market ? [] : ["OpenSea market unread — key missing or collection unindexed"]),
      ],
      description: `${intel.name || alchemy.name || p.name} on ${CHAINS[p.chainKey].name}. ${sale.source !== "none" ? `Price source: ${sale.source}.` : "Price not readable on-chain."}`,
    };
  } catch {
    return p;
  }
}

function keepDiscovered(p: ProjectModel): boolean {
  if (isProtocolReceiptNft(p)) return false;
  if (
    p.interfaces.length > 0 &&
    !p.interfaces.includes("ERC721") &&
    !p.interfaces.includes("ERC1155")
  ) {
    return false;
  }
  return true;
}

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

function withBudget<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

function topicAddress(topic?: string): string | null {
  if (!topic || topic.length < 66) return null;
  return normalizeAddress(`0x${topic.slice(26)}`);
}

export async function inspectAsProject(chainKey: ChainKey, address: string): Promise<ProjectModel> {
  const base: ProjectModel = {
    id: `${chainKey}:${normalizeAddress(address)}`,
    chainKey,
    chainId: CHAINS[chainKey].id,
    name: shortAddress(address),
    symbol: "UNK",
    contract: normalizeAddress(address),
    collectionSlug: null,
    description: "",
    imageUrl: null,
    links: [{ label: "Explorer", href: `${CHAINS[chainKey].explorerAddress}${normalizeAddress(address)}` }],
    stages: [],
    supply: null,
    remaining: null,
    minted: null,
    priceWei: null,
    status: "UNKNOWN",
    detectedAt: Date.now(),
    lastActivityAt: Date.now(),
    mintVelocityPerMin: null,
    uniqueMinters: null,
    verifiedSource: false,
    bytecodePresent: null,
    contractType: null,
    interfaces: [],
    riskFlags: [],
    market: null,
    deployer: null,
    saleSource: null,
    provenance: {
      source: "ON_CHAIN",
      quality: "LIVE",
      confidence: "MEDIUM",
      fetchedAt: Date.now(),
      ttlMs: 30_000,
      note: "Manual inspect",
    },
  };
  return enrichProject(base);
}
