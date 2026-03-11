import { createFileRoute } from "@tanstack/react-router";
import { FeedReaderApp } from "@/components/feed-reader/feed-reader-app";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return <FeedReaderApp />;
}
