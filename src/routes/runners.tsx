import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryBoard } from "@/components/terminal/discovery-board";

export const Route = createFileRoute("/runners")({ component: RunnersPage });

function RunnersPage() {
  return <DiscoveryBoard mode="runners" />;
}
