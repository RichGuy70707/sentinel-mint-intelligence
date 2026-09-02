import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryBoard } from "@/components/terminal/discovery-board";

export const Route = createFileRoute("/upcoming")({ component: UpcomingPage });

function UpcomingPage() {
  return <DiscoveryBoard mode="upcoming" />;
}
