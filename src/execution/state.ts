export type ExecutionStatus =
  | "IDLE"
  | "PREPARED"
  | "SIMULATED"
  | "READY"
  | "PREPARATION_FAILED"
  | "SIMULATION_FAILED"
  | "AWAITING_WALLET"
  | "NOT_AUTHORIZED"
  | "REJECTED"
  | "SIGN_FAILED"
  | "SUBMITTED"
  | "PENDING"
  | "BROADCAST"
  | "CONFIRMED"
  | "REVERTED"
  | "FAILED"
  | "CANCELLED";

export type AuthorizeEvent =
  | { type: "NO_INJECTED_WALLET" }
  | { type: "USER_REJECTED" }
  | { type: "SIGN_FAILED"; message?: string }
  | { type: "SIGNED_AND_BROADCAST"; txHash: string }
  | { type: "RECEIPT_PENDING" }
  | { type: "RECEIPT_CONFIRMED" }
  | { type: "RECEIPT_REVERTED" }
  | { type: "RECEIPT_FAILED" };

export function applyAuthorizeEvent(current: ExecutionStatus, event: AuthorizeEvent): ExecutionStatus {
  if (current === "CANCELLED") return current;
  switch (event.type) {
    case "NO_INJECTED_WALLET":
      return "NOT_AUTHORIZED";
    case "USER_REJECTED":
      return "REJECTED";
    case "SIGN_FAILED":
      return "SIGN_FAILED";
    case "SIGNED_AND_BROADCAST":
      return "SUBMITTED";
    case "RECEIPT_PENDING":
      return current === "SUBMITTED" || current === "BROADCAST" ? "PENDING" : current;
    case "RECEIPT_CONFIRMED":
      return current === "SUBMITTED" || current === "PENDING" || current === "BROADCAST" ? "CONFIRMED" : current;
    case "RECEIPT_REVERTED":
      return current === "SUBMITTED" || current === "PENDING" || current === "BROADCAST" ? "REVERTED" : current;
    case "RECEIPT_FAILED":
      return "FAILED";
    default:
      return current;
  }
}

export function isUserRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = typeof err === "object" && err && "code" in err ? Number((err as { code: unknown }).code) : null;
  return code === 4001 || /user rejected|denied|rejected the request/i.test(msg);
}

export function canAuthorize(status: ExecutionStatus): boolean {
  return status === "READY" || status === "SIMULATED" || status === "PREPARED";
}
