import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { Button, Input } from "@/components/ui/primitives";
import { shortAddress } from "@/core/address";
import { useWallets } from "@/state/wallets";

export const Route = createFileRoute("/wallets")({ component: WalletsPage });

function WalletsPage() {
  const wallets = useWallets((s) => s.wallets);
  const addWallet = useWallets((s) => s.addWallet);
  const updateWallet = useWallets((s) => s.updateWallet);
  const removeWallet = useWallets((s) => s.removeWallet);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function onAdd() {
    setErr(null);
    try {
      addWallet({ name, address, notes });
      setName("");
      setAddress("");
      setNotes("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add wallet");
    }
  }

  return (
    <Page>
      <PageHeader kicker="Registry" title="Wallet center" />
      <p className="mb-4 text-sm text-muted">
        Addresses stay in this browser. Seed phrases and private keys are never collected.
      </p>
      <div className="mb-6 grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — MAIN, BURNER 1" />
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x address" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
        <Button onClick={onAdd}>Add wallet</Button>
      </div>
      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      {wallets.length === 0 ? (
        <EmptyState title="No wallets yet" body="Add every address you mint from. Eligibility runs against the full registry." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.id} className="border-b border-line/70">
                  <td className="px-3 py-2">
                    <Link to="/wallets/$id" params={{ id: w.id }} className="underline">
                      {w.name}
                    </Link>
                    {w.favorite ? <span className="ml-2 text-[10px] text-accent">FAV</span> : null}
                  </td>
                  <td className="px-3 py-2 font-mono">{shortAddress(w.address, 6)}</td>
                  <td className="px-3 py-2">{w.enabled ? "Enabled" : "Disabled"}</td>
                  <td className="px-3 py-2 font-mono">{w.priority}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="quiet" onClick={() => updateWallet(w.id, { favorite: !w.favorite })}>
                      Favorite
                    </Button>
                    <Button variant="quiet" onClick={() => updateWallet(w.id, { enabled: !w.enabled })}>
                      {w.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="danger" onClick={() => removeWallet(w.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
