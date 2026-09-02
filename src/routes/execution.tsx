import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ReadyBadge } from "@/components/badges";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/primitives";
import { CHAINS } from "@/chains/registry";
import { applyAuthorizeEvent, canAuthorize, isUserRejection } from "@/execution/state";
import { useCatalog } from "@/state/catalog";
import { useQueue } from "@/state/queue";
import { useWallets } from "@/state/wallets";

export const Route = createFileRoute("/execution")({ component: ExecutionPage });

function ExecutionPage() {
  const items = useQueue((s) => s.items);
  const patch = useQueue((s) => s.patch);
  const remove = useQueue((s) => s.remove);
  const projects = useCatalog((s) => s.projects);
  const wallets = useWallets((s) => s.wallets);
  const [msg, setMsg] = useState<string | null>(null);

  async function authorize(id: string) {
    const item = useQueue.getState().items.find((i) => i.id === id);
    if (!item?.preparedTx) {
      setMsg("Prepare a transaction first.");
      patch(id, { status: "PREPARATION_FAILED" });
      return;
    }
    if (!canAuthorize(item.status)) {
      setMsg(`Cannot authorize from status ${item.status}.`);
      return;
    }
    const named = wallets.find((w) => w.id === item.walletId);
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      patch(id, { status: applyAuthorizeEvent(item.status, { type: "NO_INJECTED_WALLET" }) });
      setMsg("No injected wallet. SENTINEL will not stamp AUTHORIZED without a signature.");
      return;
    }
    patch(id, { status: "AWAITING_WALLET" });
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const from = accounts[0];
      if (!from) {
        patch(id, { status: applyAuthorizeEvent(item.status, { type: "NO_INJECTED_WALLET" }) });
        setMsg("Wallet connected but no account was returned.");
        return;
      }
      if (named && from.toLowerCase() !== named.address.toLowerCase()) {
        patch(id, { status: applyAuthorizeEvent(item.status, { type: "SIGN_FAILED", message: "mismatch" }) });
        setMsg("Injected account does not match the named wallet.");
        return;
      }
      const tx = item.preparedTx;
      const hash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: tx.to,
            data: tx.data,
            value: toHex(BigInt(tx.value)),
            chainId: toHex(BigInt(tx.chainId)),
          },
        ],
      })) as string;
      patch(id, { status: applyAuthorizeEvent(item.status, { type: "SIGNED_AND_BROADCAST", txHash: hash }), txHash: hash });
      setMsg(`Submitted ${hash}`);
    } catch (err) {
      if (isUserRejection(err)) {
        patch(id, { status: applyAuthorizeEvent(item.status, { type: "USER_REJECTED" }) });
        setMsg("User rejected the signature request.");
        return;
      }
      patch(id, { status: applyAuthorizeEvent(item.status, { type: "SIGN_FAILED" }) });
      setMsg(err instanceof Error ? err.message : "Signing failed");
    }
  }

  return (
    <Page>
      <PageHeader kicker="Queue" title="Execution center" />
      <p className="mb-4 text-sm text-muted">
        Prepare and simulate as much as possible before a stage opens. Broadcast only happens after you authorize it in
        a wallet you control. AUTHORIZED is not a SENTINEL state — submission requires a signature.
      </p>
      {msg && <p className="mb-3 text-sm text-warn">{msg}</p>}
      {items.length === 0 ? (
        <EmptyState title="Queue empty" body="Open a project and run Prepare + simulate." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Gas</th>
                <th className="px-3 py-2">Simulation</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const project = projects.find((p) => p.id === item.projectId);
                const wallet = wallets.find((w) => w.id === item.walletId);
                return (
                  <tr key={item.id} className="border-b border-line/70">
                    <td className="px-3 py-2">{project?.name ?? item.projectId}</td>
                    <td className="px-3 py-2">{wallet?.name ?? item.walletId}</td>
                    <td className="px-3 py-2 font-mono">{item.quantity}</td>
                    <td className="px-3 py-2 font-mono">{item.preparedTx?.value ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{item.simulation?.gasEstimate ?? "—"}</td>
                    <td className="px-3 py-2">
                      {item.simulation ? <ReadyBadge status={item.simulation.status} /> : "—"}
                    </td>
                    <td className="px-3 py-2">{item.status.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" onClick={() => void authorize(item.id)} disabled={!canAuthorize(item.status)}>
                        Authorize
                      </Button>
                      <Button variant="quiet" onClick={() => remove(item.id)}>
                        Cancel
                      </Button>
                      {item.txHash && project && (
                        <a
                          className="ml-2 text-[12px] underline"
                          href={`${CHAINS[project.chainKey].explorerTx}${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          tx
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}
