import type { SaleIntel } from "@/contracts/sale";

export function saleWindowGate(
  sale: Pick<SaleIntel, "startTime" | "endTime" | "seadrop" | "priceWei">,
  now = Date.now(),
): { ok: true } | { ok: false; code: "SALE_NOT_ACTIVE"; reason: string } {
  if (sale.endTime != null && sale.endTime < now) {
    return { ok: false, code: "SALE_NOT_ACTIVE", reason: "Evidenced sale window has ended." };
  }
  if (sale.startTime != null && sale.startTime > now) {
    return { ok: false, code: "SALE_NOT_ACTIVE", reason: "Evidenced sale window has not started." };
  }
  return { ok: true };
}

export function injectedMatchesNamed(injected: string | null | undefined, named: string | null | undefined): boolean {
  if (!injected || !named) return false;
  return injected.toLowerCase() === named.toLowerCase();
}
