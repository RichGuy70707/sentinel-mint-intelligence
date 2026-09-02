import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChainKey } from "@/core/types";
import { discoverMints, inspectAsProject } from "@/discovery/engine";
import { fetchMintGoPublic } from "@/discovery/mintgo";
import { openSeaPoolSnapshot } from "@/providers/opensea";
import { getPool } from "@/providers/pool";
import { ethBlockNumber, ethChainId, ethGasPrice, ethGetBalance, ethGetTransactionReceipt } from "@/providers/rpc";
import { inspectContract } from "@/contracts/inspect";
import { prepareMintFromEvidence } from "@/transactions/prepare";
import { simulateTransaction } from "@/simulation/engine";
import { CHAINS } from "@/chains/registry";
import { providerAvailability } from "@/providers/secrets";
import { readWalletHints } from "@/providers/wallet-hints";

const chainKey = z.enum(["eth", "rh", "ink", "base"]);

export const scanLiveMints = createServerFn({ method: "POST" }).handler(async () => {
  const report = await discoverMints();
  const [mintgo, gas] = await Promise.all([
    fetchMintGoPublic(),
    ethGasPrice("eth")
      .then((wei) => Number(wei) / 1e9)
      .catch(() => null),
  ]);
  return {
    ...report,
    mintgo,
    providers: getPool().snapshot(),
    gasGwei: gas,
  };
});

export const inspectProjectFn = createServerFn({ method: "POST" })
  .validator(z.object({ chainKey, address: z.string() }))
  .handler(async ({ data }) => inspectAsProject(data.chainKey, data.address));

export const inspectContractFn = createServerFn({ method: "POST" })
  .validator(z.object({ chainKey, address: z.string() }))
  .handler(async ({ data }) => inspectContract(data.chainKey, data.address));

export const probeChainFn = createServerFn({ method: "POST" })
  .validator(z.object({ chainKey }))
  .handler(async ({ data }) => {
    const started = Date.now();
    const [chainId, block] = await Promise.all([ethChainId(data.chainKey), ethBlockNumber(data.chainKey)]);
    return {
      chainKey: data.chainKey,
      expectedId: CHAINS[data.chainKey].id,
      chainId,
      block,
      latencyMs: Date.now() - started,
      aligned: chainId === CHAINS[data.chainKey].id,
    };
  });

export const readBalanceFn = createServerFn({ method: "POST" })
  .validator(z.object({ chainKey, address: z.string() }))
  .handler(async ({ data }) => {
    const wei = await ethGetBalance(data.chainKey, data.address);
    return { wei: wei.toString() };
  });

export const walletHintsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      chainKey,
      contract: z.string(),
      wallets: z.array(z.string()).max(20),
    }),
  )
  .handler(async ({ data }) => readWalletHints(data.chainKey, data.contract, data.wallets));

export const prepareMintFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      chainKey,
      contract: z.string(),
      wallet: z.string(),
      quantity: z.number().int().min(1).max(20),
      priceWeiPerMint: z.string().nullable(),
      fn: z.enum(["mint", "publicMint", "mintPublic"]).optional(),
    }),
  )
  .handler(async ({ data }) =>
    prepareMintFromEvidence({
      chainKey: data.chainKey,
      contract: data.contract,
      wallet: data.wallet,
      quantity: data.quantity,
      priceWeiPerMint: data.priceWeiPerMint,
    }),
  );

export const simulateMintFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      chainKey,
      tx: z.object({
        to: z.string(),
        data: z.string(),
        value: z.string(),
        chainId: z.number(),
        contract: z.string(),
        wallet: z.string(),
        quantity: z.number(),
        source: z.string(),
        timestamp: z.number(),
        confidence: z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]),
      }),
    }),
  )
  .handler(async ({ data }) => simulateTransaction(data.chainKey as ChainKey, data.tx));

export const receiptFn = createServerFn({ method: "POST" })
  .validator(z.object({ chainKey, hash: z.string() }))
  .handler(async ({ data }) => {
    try {
      const rec = await ethGetTransactionReceipt(data.chainKey, data.hash);
      if (!rec) return { kind: "PENDING" as const };
      if (rec.status === "0x1") return { kind: "CONFIRMED" as const, blockNumber: rec.blockNumber };
      if (rec.status === "0x0") return { kind: "REVERTED" as const, blockNumber: rec.blockNumber };
      return { kind: "PENDING" as const };
    } catch (err) {
      return {
        kind: "PROVIDER_ERROR" as const,
        reason: err instanceof Error ? err.message : "receipt lookup failed",
      };
    }
  });

export const systemHealthFn = createServerFn({ method: "GET" }).handler(async () => {
  const pool = getPool();
  await pool.probeTransport();
  const providers = pool.snapshot();
  const availability = providerAvailability();
  const probes = await Promise.all(
    (["eth", "rh", "ink", "base"] as ChainKey[]).map(async (key) => {
      const started = Date.now();
      try {
        const block = await ethBlockNumber(key);
        return { chainKey: key, ok: true, block, latencyMs: Date.now() - started, error: null as string | null };
      } catch (err) {
        return {
          chainKey: key,
          ok: false,
          block: null as number | null,
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
  return {
    scannedAt: Date.now(),
    providers,
    probes,
    discoveryOk: probes.some((p) => p.ok),
    availability,
    notes: [
      ...probes.filter((p) => !p.ok).map((p) => `${p.chainKey}: ${p.error}`),
      availability.opensea
        ? `OpenSea: ${availability.openseaSlotCount} key slot(s) configured`
        : "OpenSea keys not configured — floor/volume stay UNKNOWN",
      availability.alchemySlotCount > 0
        ? `Alchemy: ${availability.alchemySlotCount} key slot(s) configured for eth/base/ink`
        : "Alchemy keys not configured — Blockscout + public RPC discovery",
    ],
    credentialSlots: {
      alchemy: availability.alchemySlotCount,
      opensea: openSeaPoolSnapshot().map((s) => ({ id: s.id, state: s.state, successes: s.successes, failures: s.failures })),
    },
  };
});
