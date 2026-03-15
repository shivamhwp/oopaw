import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { FeedReaderApp } from "@/components/feed-reader/feed-reader-app";

const indexSearchSchema = z.object({
  auth: z.enum(["sign-in"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  component: App,
});

function App() {
  const search = Route.useSearch();

  return <FeedReaderApp authIntent={search.auth} authRedirect={search.redirect} />;
}
