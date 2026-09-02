import type { CanonicalTx, ChainKey, ReadinessStatus, SimulationResult } from "@/core/types";
import { CHAINS, chainById } from "@/chains/registry";
import { ethCall, ethEstimateGas, ethGasPrice, ethGetBalance, ethGetCode } from "@/providers/rpc";
import { assertSafeTx } from "@/transactions/builder";

export async function simulateTransaction(chainKey: ChainKey, tx: CanonicalTx): Promise<SimulationResult> {
  const checks: SimulationResult["checks"] = [];
  const timestamp = Date.now();
  try {
    assertSafeTx(tx);
    checks.push({ name: "tx-shape", ok: true, detail: "Canonical transaction passed validation" });
  } catch (err) {
    return {
      status: "NOT_READY",
      explanation: err instanceof Error ? err.message : "Invalid transaction",
      gasEstimate: null,
      feeWei: null,
      balanceWei: null,
      revertData: null,
      checks: [{ name: "tx-shape", ok: false, detail: String(err) }],
      timestamp,
    };
  }

  const expected = CHAINS[chainKey];
  if (tx.chainId !== expected.id) {
    checks.push({
      name: "chain",
      ok: false,
      detail: `Transaction chainId ${tx.chainId} does not match ${expected.name}`,
    });
    return fail("NOT_READY", "Chain mismatch", checks, timestamp);
  }
  checks.push({ name: "chain", ok: true, detail: expected.name });

  let bytecode = "0x";
  try {
    bytecode = await ethGetCode(chainKey, tx.to);
  } catch (err) {
    checks.push({ name: "bytecode", ok: false, detail: err instanceof Error ? err.message : "code lookup failed" });
    return fail("UNKNOWN", "Could not read contract bytecode", checks, timestamp);
  }
  const present = bytecode !== "0x" && bytecode !== "0x0";
  checks.push({
    name: "bytecode",
    ok: present,
    detail: present ? `${Math.floor((bytecode.length - 2) / 2)} bytes` : "No code at destination",
  });
  if (!present) return fail("NOT_READY", "Destination has no bytecode", checks, timestamp);

  let balance = 0n;
  try {
    balance = await ethGetBalance(chainKey, tx.wallet);
    checks.push({ name: "balance", ok: true, detail: `${balance.toString()} wei` });
  } catch (err) {
    checks.push({ name: "balance", ok: false, detail: err instanceof Error ? err.message : "balance failed" });
  }

  const value = BigInt(tx.value);
  if (balance < value) {
    checks.push({ name: "funds", ok: false, detail: `Need ${value.toString()} wei, have ${balance.toString()}` });
    return {
      status: "INSUFFICIENT_FUNDS",
      explanation: "Wallet native balance is below mint value",
      gasEstimate: null,
      feeWei: null,
      balanceWei: balance.toString(),
      revertData: null,
      checks,
      timestamp,
    };
  }
  checks.push({ name: "funds", ok: true, detail: "Native value covered" });

  try {
    await ethCall(chainKey, tx.to, tx.data, tx.wallet);
    checks.push({ name: "eth_call", ok: true, detail: "eth_call did not revert" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.push({ name: "eth_call", ok: false, detail: msg });
    return {
      status: "SIMULATION_FAILED",
      explanation: `Simulation reverted: ${msg}`,
      gasEstimate: null,
      feeWei: null,
      balanceWei: balance.toString(),
      revertData: msg,
      checks,
      timestamp,
    };
  }

  let gasEstimate: string | null = null;
  let feeWei: string | null = null;
  try {
    const gas = await ethEstimateGas(chainKey, {
      to: tx.to,
      data: tx.data,
      value: toHex(value),
      from: tx.wallet,
    });
    gasEstimate = BigInt(gas).toString();
    const price = await ethGasPrice(chainKey);
    feeWei = (BigInt(gas) * price).toString();
    checks.push({ name: "gas", ok: true, detail: `${gasEstimate} gas` });
  } catch (err) {
    checks.push({ name: "gas", ok: false, detail: err instanceof Error ? err.message : "estimate failed" });
  }

  const status: ReadinessStatus = "READY";
  return {
    status,
    explanation: "Read-only checks passed. User authorization is still required to send.",
    gasEstimate,
    feeWei,
    balanceWei: balance.toString(),
    revertData: null,
    checks,
    timestamp,
  };
}

function fail(
  status: ReadinessStatus,
  explanation: string,
  checks: SimulationResult["checks"],
  timestamp: number,
): SimulationResult {
  return {
    status,
    explanation,
    gasEstimate: null,
    feeWei: null,
    balanceWei: null,
    revertData: null,
    checks,
    timestamp,
  };
}

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

export function explorerForTx(chainId: number, hash: string): string | null {
  const chain = chainById(chainId);
  if (!chain) return null;
  return `${chain.explorerTx}${hash}`;
}
