import type { SimulationKind } from "../core/types.ts";

export function classifySimFailure(message: string): SimulationKind {
  if (/timeout|ECONN|network|HTTP 5|provider/i.test(message)) return "SIMULATION_PROVIDER_ERROR";
  if (/revert|execution reverted|out of gas/i.test(message)) return "SIMULATION_REVERT";
  return "SIMULATION_REVERT";
}
