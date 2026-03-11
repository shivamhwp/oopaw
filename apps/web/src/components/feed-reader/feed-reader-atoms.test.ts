/** @vitest-environment jsdom */

import { createStore } from "jotai/vanilla";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSourceSuccessAtom,
  articleViewModeAtom,
  articleViewModeStorage,
  feedReaderStateAtom,
  feedReaderStorage,
  removeSourceAtom,
  selectItemAtom,
  showAddFormAtom,
  sidebarAtom,
  sidebarSizeAtom,
  sidebarSizeStorage,
  sourceInputAtom,
} from "@/components/feed-reader/feed-reader-atoms";
import { createEmptyFeedReaderState, mergeSourceDiscovery } from "@/lib/feed-reader-state";
import {
  FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY,
  DEFAULT_FEED_READER_SIDEBAR_SIZE,
  FEED_READER_SIDEBAR_SIZE_STORAGE_KEY,
  FEED_READER_STORAGE_KEY,
  type FeedReaderStateV1,
  type DiscoveryResult,
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

const createMockStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => {
      values.clear();
    },
  };
};

describe("feed reader atoms", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates valid persisted state", () => {
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    localStorage.setItem(FEED_READER_STORAGE_KEY, JSON.stringify(persistedState));

    expect(
      feedReaderStorage.getItem(FEED_READER_STORAGE_KEY, createEmptyFeedReaderState()),
    ).toEqual(persistedState);
  });

  it("reads persisted feed-reader state on first atom access", async () => {
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    localStorage.setItem(FEED_READER_STORAGE_KEY, JSON.stringify(persistedState));
    vi.resetModules();

    const { createStore } = await import("jotai/vanilla");
    const { feedReaderStateAtom } = await import("@/components/feed-reader/feed-reader-atoms");
    const store = createStore();

    expect(store.get(feedReaderStateAtom)).toEqual(persistedState);
  });

  it("falls back when persisted state is invalid", () => {
    localStorage.setItem(FEED_READER_STORAGE_KEY, JSON.stringify({ version: 999, nope: true }));

    expect(
      feedReaderStorage.getItem(FEED_READER_STORAGE_KEY, createEmptyFeedReaderState()),
    ).toEqual(createEmptyFeedReaderState());
  });

  it("migrates v1 persisted state", () => {
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    const legacyState: FeedReaderStateV1 = {
      version: 1,
      sources: persistedState.sources,
      itemsBySource: persistedState.itemsBySource,
      readItemIds: persistedState.readItemIds,
      seenItemIdsBySource: persistedState.seenItemIdsBySource,
      selectedSourceId: persistedState.selectedSourceId,
    };
    localStorage.setItem(FEED_READER_STORAGE_KEY, JSON.stringify(legacyState));

    expect(
      feedReaderStorage.getItem(FEED_READER_STORAGE_KEY, createEmptyFeedReaderState()),
    ).toEqual({
      ...persistedState,
      paginationBySource: {
        source_alpha: {
          loadedPageUrls: ["https://example.com/feed.xml"],
          nextPageUrl: undefined,
        },
      },
    });
  });

  it("persists feed-reader state through atomWithStorage", () => {
    const store = createStore();
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);

    store.set(feedReaderStateAtom, persistedState);

    expect(JSON.parse(localStorage.getItem(FEED_READER_STORAGE_KEY) ?? "null")).toEqual(
      persistedState,
    );
  });

  it("hydrates valid persisted sidebar size", () => {
    localStorage.setItem(FEED_READER_SIDEBAR_SIZE_STORAGE_KEY, JSON.stringify(42));

    expect(
      sidebarSizeStorage.getItem(
        FEED_READER_SIDEBAR_SIZE_STORAGE_KEY,
        DEFAULT_FEED_READER_SIDEBAR_SIZE,
      ),
    ).toBe(42);
  });

  it("reads persisted sidebar size on first atom access", async () => {
    localStorage.setItem(FEED_READER_SIDEBAR_SIZE_STORAGE_KEY, JSON.stringify(42));
    vi.resetModules();

    const { createStore } = await import("jotai/vanilla");
    const { sidebarSizeAtom } = await import("@/components/feed-reader/feed-reader-atoms");
    const store = createStore();

    expect(store.get(sidebarSizeAtom)).toBe(42);
  });

  it("falls back when persisted sidebar size is invalid", () => {
    localStorage.setItem(FEED_READER_SIDEBAR_SIZE_STORAGE_KEY, JSON.stringify(10));

    expect(
      sidebarSizeStorage.getItem(
        FEED_READER_SIDEBAR_SIZE_STORAGE_KEY,
        DEFAULT_FEED_READER_SIDEBAR_SIZE,
      ),
    ).toBe(DEFAULT_FEED_READER_SIDEBAR_SIZE);
  });

  it("persists sidebar size through atomWithStorage", () => {
    const store = createStore();

    store.set(sidebarSizeAtom, 42);

    expect(JSON.parse(localStorage.getItem(FEED_READER_SIDEBAR_SIZE_STORAGE_KEY) ?? "null")).toBe(
      42,
    );
  });

  it("hydrates valid persisted article view mode", () => {
    localStorage.setItem(FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY, JSON.stringify("reader"));

    expect(articleViewModeStorage.getItem(FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY, "site")).toBe(
      "reader",
    );
  });

  it("defaults article view mode to reader", () => {
    const store = createStore();

    expect(store.get(articleViewModeAtom)).toBe("reader");
  });

  it("persists article view mode through atomWithStorage", () => {
    const store = createStore();

    store.set(articleViewModeAtom, "reader");

    expect(
      JSON.parse(localStorage.getItem(FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY) ?? "null"),
    ).toBe("reader");
  });

  it("updates feed and ui state together after source discovery", () => {
    const store = createStore();

    store.set(sourceInputAtom, discovery.source.siteUrl);
    store.set(showAddFormAtom, true);
    store.set(addSourceSuccessAtom, discovery);

    expect(store.get(sourceInputAtom)).toBe("");
    expect(store.get(showAddFormAtom)).toBe(false);
    expect(store.get(sidebarAtom)).toEqual({ mode: "list", sourceId: discovery.source.id });
    expect(store.get(feedReaderStateAtom).selectedSourceId).toBe(discovery.source.id);
  });

  it("opens reader mode and marks items read when selecting an item", () => {
    const store = createStore();

    store.set(feedReaderStateAtom, mergeSourceDiscovery(createEmptyFeedReaderState(), discovery));
    store.set(sidebarAtom, { mode: "list", sourceId: discovery.source.id });
    store.set(selectItemAtom, discovery.items[0]!.id);

    expect(store.get(sidebarAtom)).toEqual({
      mode: "reader",
      sourceId: discovery.source.id,
      itemId: discovery.items[0]!.id,
    });
    expect(store.get(feedReaderStateAtom).readItemIds).toContain(discovery.items[0]!.id);
  });

  it("closes the sidebar when removing the active source", () => {
    const store = createStore();

    store.set(feedReaderStateAtom, mergeSourceDiscovery(createEmptyFeedReaderState(), discovery));
    store.set(sidebarAtom, { mode: "list", sourceId: discovery.source.id });
    store.set(removeSourceAtom, discovery.source.id);

    expect(store.get(sidebarAtom)).toEqual({ mode: "closed" });
    expect(store.get(feedReaderStateAtom).sources).toEqual([]);
  });
});
