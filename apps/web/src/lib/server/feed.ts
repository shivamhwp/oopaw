import { createServerFn } from "@tanstack/react-start";
import {
  fetchFeedSourceInputSchema,
  loadMoreSourceItemsInputSchema,
  refreshFeedSourceInputSchema,
} from "@/lib/types";
import {
  discoverFeed,
  loadMoreDiscoveredFeedItems,
  refreshDiscoveredFeed,
} from "@repo/shared/feed/service";

export const fetchFeedSource = createServerFn({ method: "POST" })
  .inputValidator(fetchFeedSourceInputSchema)
  .handler(async ({ data }) => discoverFeed(data.url));

export const refreshFeedSource = createServerFn({ method: "POST" })
  .inputValidator(refreshFeedSourceInputSchema)
  .handler(async ({ data }) =>
    refreshDiscoveredFeed({
      source: {
        sourceId: data.source.sourceId,
        feedUrl: data.source.feedUrl,
      },
      seenItemIds: data.seenItemIds,
    }),
  );

export const loadMoreFeedItems = createServerFn({ method: "POST" })
  .inputValidator(loadMoreSourceItemsInputSchema)
  .handler(async ({ data }) =>
    loadMoreDiscoveredFeedItems({
      sourceId: data.sourceId,
      pageUrl: data.pageUrl,
    }),
  );
