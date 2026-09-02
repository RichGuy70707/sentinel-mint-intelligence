import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryBoard } from "@/components/terminal/discovery-board";

export const Route = createFileRoute("/trending")({ component: TrendingPage });

function TrendingPage() {
  return <DiscoveryBoard mode="trending" />;
}
