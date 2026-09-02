import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryBoard } from "@/components/terminal/discovery-board";

export const Route = createFileRoute("/new-mints")({ component: NewMintsPage });

function NewMintsPage() {
  return <DiscoveryBoard mode="new" />;
}
