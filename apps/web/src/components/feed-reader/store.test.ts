/** @vitest-environment jsdom */

import { createStore } from "jotai/vanilla";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSourceSuccessAtom,
  articleViewModeAtom,
  articleViewModeStorage,
  DEFAULT_FEED_READER_PANEL_SIZE,
  detailPanelAtom,
  detailPanelSizeAtom,
  detailPanelSizeStorage,
  detailPanelStateStorage,
  FEED_READER_PANEL_SIZE_STORAGE_KEY,
  FEED_READER_PANEL_STATE_STORAGE_KEY,
  feedReaderStateAtom,
  feedReaderStorage,
  MIN_FEED_READER_READER_PANEL_SIZE,
  removeSourceAtom,
  selectItemAtom,
  showAddFormAtom,
  sourceInputAtom,
} from "@/components/feed-reader/store";
import { createEmptyFeedReaderState, mergeSourceDiscovery } from "@/lib/feed-reader-state";
import {
  FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY,
  FEED_READER_STATE_STORAGE_KEY,
  type DiscoveryResult,
  type FeedReaderStateV1,
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

describe("feed reader store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates valid persisted state", () => {
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    localStorage.setItem(FEED_READER_STATE_STORAGE_KEY, JSON.stringify(persistedState));

    expect(
      feedReaderStorage.getItem(FEED_READER_STATE_STORAGE_KEY, createEmptyFeedReaderState()),
    ).toEqual(persistedState);
  });

  it("reads persisted feed-reader state on first atom access", async () => {
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    localStorage.setItem(FEED_READER_STATE_STORAGE_KEY, JSON.stringify(persistedState));
    vi.resetModules();

    const { createStore } = await import("jotai/vanilla");
    const { feedReaderStateAtom } = await import("@/components/feed-reader/store");
    const store = createStore();

    expect(store.get(feedReaderStateAtom)).toEqual(persistedState);
  });

  it("falls back when persisted state is invalid", () => {
    localStorage.setItem(
      FEED_READER_STATE_STORAGE_KEY,
      JSON.stringify({ version: 999, nope: true }),
    );

    expect(
      feedReaderStorage.getItem(FEED_READER_STATE_STORAGE_KEY, createEmptyFeedReaderState()),
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
    localStorage.setItem(FEED_READER_STATE_STORAGE_KEY, JSON.stringify(legacyState));

    expect(
      feedReaderStorage.getItem(FEED_READER_STATE_STORAGE_KEY, createEmptyFeedReaderState()),
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

    expect(JSON.parse(localStorage.getItem(FEED_READER_STATE_STORAGE_KEY) ?? "null")).toEqual(
      persistedState,
    );
  });

  it("hydrates valid persisted detail panel state", () => {
    const persistedPanel = { mode: "list", sourceId: discovery.source.id } as const;
    localStorage.setItem(FEED_READER_PANEL_STATE_STORAGE_KEY, JSON.stringify(persistedPanel));

    expect(
      detailPanelStateStorage.getItem(FEED_READER_PANEL_STATE_STORAGE_KEY, { mode: "closed" }),
    ).toEqual(persistedPanel);
  });

  it("reads persisted detail panel state on first atom access", async () => {
    const persistedState = mergeSourceDiscovery(createEmptyFeedReaderState(), discovery);
    const persistedPanel = { mode: "list", sourceId: discovery.source.id } as const;
    localStorage.setItem(FEED_READER_STATE_STORAGE_KEY, JSON.stringify(persistedState));
    localStorage.setItem(FEED_READER_PANEL_STATE_STORAGE_KEY, JSON.stringify(persistedPanel));
    vi.resetModules();

    const { createStore } = await import("jotai/vanilla");
    const { detailPanelAtom } = await import("@/components/feed-reader/store");
    const store = createStore();

    expect(store.get(detailPanelAtom)).toEqual(persistedPanel);
  });

  it("falls back when persisted detail panel state is invalid", () => {
    localStorage.setItem(FEED_READER_PANEL_STATE_STORAGE_KEY, JSON.stringify({ mode: "oops" }));

    expect(
      detailPanelStateStorage.getItem(FEED_READER_PANEL_STATE_STORAGE_KEY, { mode: "closed" }),
    ).toEqual({
      mode: "closed",
    });
  });

  it("closes a persisted detail panel when the source no longer exists", () => {
    const store = createStore();

    localStorage.setItem(
      FEED_READER_PANEL_STATE_STORAGE_KEY,
      JSON.stringify({ mode: "list", sourceId: discovery.source.id }),
    );

    expect(store.get(detailPanelAtom)).toEqual({ mode: "closed" });
  });

  it("falls back to source list when the persisted reader item is missing", () => {
    const store = createStore();

    store.set(feedReaderStateAtom, mergeSourceDiscovery(createEmptyFeedReaderState(), discovery));
    store.set(detailPanelAtom, {
      mode: "reader",
      sourceId: discovery.source.id,
      itemId: "missing_item",
    });

    expect(store.get(detailPanelAtom)).toEqual({ mode: "list", sourceId: discovery.source.id });
  });

  it("persists detail panel state through atomWithStorage", () => {
    const store = createStore();
    const persistedPanel = { mode: "list", sourceId: discovery.source.id } as const;

    store.set(detailPanelAtom, persistedPanel);

    expect(JSON.parse(localStorage.getItem(FEED_READER_PANEL_STATE_STORAGE_KEY) ?? "null")).toEqual(
      persistedPanel,
    );
  });

  it("hydrates valid persisted detail panel size", () => {
    localStorage.setItem(FEED_READER_PANEL_SIZE_STORAGE_KEY, JSON.stringify(42));

    expect(
      detailPanelSizeStorage.getItem(
        FEED_READER_PANEL_SIZE_STORAGE_KEY,
        DEFAULT_FEED_READER_PANEL_SIZE,
      ),
    ).toBe(42);
  });

  it("reads persisted detail panel size on first atom access", async () => {
    localStorage.setItem(FEED_READER_PANEL_SIZE_STORAGE_KEY, JSON.stringify(42));
    vi.resetModules();

    const { createStore } = await import("jotai/vanilla");
    const { detailPanelSizeAtom } = await import("@/components/feed-reader/store");
    const store = createStore();

    expect(store.get(detailPanelSizeAtom)).toBe(42);
  });

  it("falls back when persisted detail panel size is invalid", () => {
    localStorage.setItem(FEED_READER_PANEL_SIZE_STORAGE_KEY, JSON.stringify(10));

    expect(
      detailPanelSizeStorage.getItem(
        FEED_READER_PANEL_SIZE_STORAGE_KEY,
        DEFAULT_FEED_READER_PANEL_SIZE,
      ),
    ).toBe(DEFAULT_FEED_READER_PANEL_SIZE);
  });

  it("persists detail panel size through atomWithStorage", () => {
    const store = createStore();

    store.set(detailPanelSizeAtom, 42);

    expect(JSON.parse(localStorage.getItem(FEED_READER_PANEL_SIZE_STORAGE_KEY) ?? "null")).toBe(42);
  });

  it("accepts the smaller reader panel width", () => {
    localStorage.setItem(
      FEED_READER_PANEL_SIZE_STORAGE_KEY,
      JSON.stringify(MIN_FEED_READER_READER_PANEL_SIZE),
    );

    expect(
      detailPanelSizeStorage.getItem(
        FEED_READER_PANEL_SIZE_STORAGE_KEY,
        DEFAULT_FEED_READER_PANEL_SIZE,
      ),
    ).toBe(MIN_FEED_READER_READER_PANEL_SIZE);
  });

  it("hydrates valid persisted article view mode", () => {
    localStorage.setItem(FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY, JSON.stringify("reader"));

    expect(articleViewModeStorage.getItem(FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY, "site")).toBe(
      "reader",
    );
  });

  it("reads persisted article view mode on first atom access", async () => {
    localStorage.setItem(FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY, JSON.stringify("site"));
    vi.resetModules();

    const { createStore } = await import("jotai/vanilla");
    const { articleViewModeAtom } = await import("@/components/feed-reader/store");
    const store = createStore();

    expect(store.get(articleViewModeAtom)).toBe("site");
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
    expect(store.get(detailPanelAtom)).toEqual({ mode: "list", sourceId: discovery.source.id });
    expect(store.get(feedReaderStateAtom).selectedSourceId).toBe(discovery.source.id);
  });

  it("opens reader mode and marks items read when selecting an item", () => {
    const store = createStore();

    store.set(feedReaderStateAtom, mergeSourceDiscovery(createEmptyFeedReaderState(), discovery));
    store.set(detailPanelAtom, { mode: "list", sourceId: discovery.source.id });
    store.set(selectItemAtom, discovery.items[0]!.id);

    expect(store.get(detailPanelAtom)).toEqual({
      mode: "reader",
      sourceId: discovery.source.id,
      itemId: discovery.items[0]!.id,
    });
    expect(store.get(feedReaderStateAtom).readItemIds).toContain(discovery.items[0]!.id);
  });

  it("closes the detail panel when removing the active source", () => {
    const store = createStore();

    store.set(feedReaderStateAtom, mergeSourceDiscovery(createEmptyFeedReaderState(), discovery));
    store.set(detailPanelAtom, { mode: "list", sourceId: discovery.source.id });
    store.set(removeSourceAtom, discovery.source.id);

    expect(store.get(detailPanelAtom)).toEqual({ mode: "closed" });
    expect(store.get(feedReaderStateAtom).sources).toEqual([]);
  });
});
