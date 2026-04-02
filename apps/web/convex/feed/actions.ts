import { v } from "convex/values";
import { action } from "../_generated/server";
import {
  fetchFeedSourceResult,
  loadMoreFeedItemsResult,
  refreshFeedSourceResult,
} from "@/lib/feed/ingestion.server";

export const fetchSource = action({
  args: {
    url: v.string(),
    pollIntervalMs: v.optional(v.number()),
  },
  handler: async (_ctx, args) => fetchFeedSourceResult(args),
});

export const refreshSource = action({
  args: {
    sourceId: v.string(),
    feedUrl: v.string(),
    seenItemIds: v.array(v.string()),
  },
  handler: async (_ctx, args) => refreshFeedSourceResult(args),
});

export const loadMoreItems = action({
  args: {
    sourceId: v.string(),
    pageUrl: v.string(),
  },
  handler: async (_ctx, args) => loadMoreFeedItemsResult(args),
});
