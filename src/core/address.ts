const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isHexAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

export function normalizeAddress(value: string): string {
  const trimmed = value.trim();
  if (!isHexAddress(trimmed)) {
    throw new Error("Invalid EVM address");
  }
  return trimmed.toLowerCase();
}

export function shortAddress(value: string, size = 4): string {
  try {
    const addr = normalizeAddress(value);
    return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
  } catch {
    return value;
  }
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isZeroAddress(value: string): boolean {
  try {
    return normalizeAddress(value) === ZERO_ADDRESS;
  } catch {
    return false;
  }
}
