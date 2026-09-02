export type TransportCause =
  | "ACCESS_DENIED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "APPLICATION"
  | "UNKNOWN";

export class RpcError extends Error {
  readonly causeKind: TransportCause;
  readonly httpStatus: number | null;

  constructor(message: string, causeKind: TransportCause, httpStatus: number | null = null) {
    super(message);
    this.name = "RpcError";
    this.causeKind = causeKind;
    this.httpStatus = httpStatus;
  }
}

export function classifyHttpStatus(status: number): TransportCause {
  if (status === 401) return "AUTH_FAILED";
  if (status === 403) return "ACCESS_DENIED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "NETWORK_ERROR";
  if (status === 408) return "TIMEOUT";
  return "UNKNOWN";
}

export function classifyFailure(err: unknown): TransportCause {
  if (err instanceof RpcError) return err.causeKind;
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout after|Provider timeout|AbortError|aborted/i.test(msg)) return "TIMEOUT";
  const http = msg.match(/HTTP (\d{3})/i);
  if (http) return classifyHttpStatus(Number(http[1]));
  if (/execution reverted|revert(?:ed)?|out of gas|invalid opcode/i.test(msg)) return "APPLICATION";
  if (/fetch failed|ECONN|ENOTFOUND|network|Failed to fetch/i.test(msg)) return "NETWORK_ERROR";
  return "UNKNOWN";
}

export function isTransportFailure(cause: TransportCause): boolean {
  return cause !== "APPLICATION";
}

export function opensCircuitImmediately(cause: TransportCause): boolean {
  return cause === "ACCESS_DENIED" || cause === "AUTH_FAILED" || cause === "RATE_LIMITED";
}
