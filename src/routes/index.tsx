import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryBoard } from "@/components/terminal/discovery-board";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DiscoveryBoard mode="home" />;
}
