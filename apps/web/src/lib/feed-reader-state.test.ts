import { describe, expect, it } from "vitest";
import {
  applyLoadMoreSourceItems,
  applySourceRefresh,
  createEmptyFeedReaderState,
  getSourceItems,
  migrateFeedReaderState,
  markItemRead,
  mergeSourceDiscovery,
} from "@/lib/feed-reader-state";
import type {
  DiscoveryResult,
  FeedReaderStateV1,
  LoadMoreSourceItemsResult,
  RefreshResult,
} from "@/lib/types";

const discovery: DiscoveryResult = {
  source: {
    id: "source_alpha",
    label: "Alpha",
    inputUrl: "https://example.com/blog",
    siteUrl: "https://example.com/blog",
    kind: "feed",
    feedUrl: "https://example.com/feed.xml",
    pollingEnabled: true,
    pollIntervalMs: 300000,
    lastCheckedAt: "2025-03-07T00:00:00.000Z",
  },
  checkedAt: "2025-03-07T00:00:00.000Z",
  nextPageUrl: "https://example.com/feed.xml?page=2",
  items: [
    {
      id: "item_old",
      sourceId: "source_alpha",
      title: "Old",
      url: "https://example.com/blog/old",
      publishedAt: "2025-03-06T00:00:00.000Z",
    },
  ],
};

describe("feed reader state", () => {
  it("hydrates newly discovered sources as selected and seen", () => {
    const state = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);

    expect(state.selectedSourceId).toBe("source_alpha");
    expect(state.seenItemIdsBySource.source_alpha).toEqual(["item_old"]);
    expect(state.paginationBySource.source_alpha).toEqual({
      loadedPageUrls: ["https://example.com/feed.xml"],
      nextPageUrl: "https://example.com/feed.xml?page=2",
    });
  });

  it("keeps new items marked as new until they are opened", () => {
    const state = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    const refresh: RefreshResult = {
      sourceId: "source_alpha",
      checkedAt: "2025-03-08T00:00:00.000Z",
      newCount: 1,
      nextPageUrl: "https://example.com/feed.xml?page=2",
      items: [
        {
          id: "item_new",
          sourceId: "source_alpha",
          title: "New",
          url: "https://example.com/blog/new",
          publishedAt: "2025-03-08T00:00:00.000Z",
        },
      ],
    };
    const refreshed = applySourceRefresh(state, refresh);

    expect(getSourceItems(refreshed, "source_alpha")[0]?.isNew).toBe(true);

    const read = markItemRead(refreshed, "source_alpha", "item_new");

    expect(getSourceItems(read, "source_alpha")[0]).toMatchObject({
      id: "item_new",
      isNew: false,
      isRead: true,
    });
  });

  it("migrates v1 state without losing sources or items", () => {
    const state = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    const legacyState: FeedReaderStateV1 = {
      version: 1,
      sources: state.sources,
      itemsBySource: state.itemsBySource,
      readItemIds: state.readItemIds,
      seenItemIdsBySource: state.seenItemIdsBySource,
      selectedSourceId: state.selectedSourceId,
    };

    expect(migrateFeedReaderState(legacyState)).toEqual({
      ...state,
      paginationBySource: {
        source_alpha: {
          loadedPageUrls: ["https://example.com/feed.xml"],
          nextPageUrl: undefined,
        },
      },
    });
  });

  it("appends paged items and advances the cursor", () => {
    const state = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    const loadMoreResult: LoadMoreSourceItemsResult = {
      sourceId: "source_alpha",
      pageUrl: "https://example.com/feed.xml?page=2",
      nextPageUrl: "https://example.com/feed.xml?page=3",
      items: [
        {
          id: "item_older",
          sourceId: "source_alpha",
          title: "Older",
          url: "https://example.com/blog/older",
          publishedAt: "2025-03-05T00:00:00.000Z",
        },
      ],
    };

    const nextState = applyLoadMoreSourceItems(state, loadMoreResult);

    expect(nextState.itemsBySource.source_alpha).toHaveLength(2);
    expect(nextState.paginationBySource.source_alpha).toEqual({
      loadedPageUrls: ["https://example.com/feed.xml", "https://example.com/feed.xml?page=2"],
      nextPageUrl: "https://example.com/feed.xml?page=3",
    });
  });

  it("does not rewind the cursor after older pages are already loaded", () => {
    const state = applyLoadMoreSourceItems(
      mergeSourceDiscovery(createEmptyFeedReaderState(), discovery),
      {
        sourceId: "source_alpha",
        pageUrl: "https://example.com/feed.xml?page=2",
        nextPageUrl: "https://example.com/feed.xml?page=3",
        items: [
          {
            id: "item_older",
            sourceId: "source_alpha",
            title: "Older",
            url: "https://example.com/blog/older",
            publishedAt: "2025-03-05T00:00:00.000Z",
          },
        ],
      },
    );

    const refreshed = applySourceRefresh(state, {
      sourceId: "source_alpha",
      checkedAt: "2025-03-09T00:00:00.000Z",
      newCount: 0,
      nextPageUrl: "https://example.com/feed.xml?page=2",
      items: state.itemsBySource.source_alpha.slice(0, 1),
    });

    expect(refreshed.paginationBySource.source_alpha.nextPageUrl).toBe(
      "https://example.com/feed.xml?page=3",
    );
  });
});
