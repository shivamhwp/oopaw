import { atom } from "jotai";
import { atomWithStorage, createJSONStorage, unstable_withStorageValidator } from "jotai/utils";
import {
  applyLoadMoreSourceItems,
  applySourceRefresh,
  createEmptyFeedReaderState,
  getSourceItems,
  markItemRead,
  migrateFeedReaderState,
  mergeSourceDiscovery,
  removeSource,
  setSelectedSource,
  setSourceError,
} from "@/lib/feed-reader-state";
import {
  articleViewModeSchema,
  FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY,
  DEFAULT_FEED_READER_SIDEBAR_SIZE,
  FEED_READER_SIDEBAR_SIZE_STORAGE_KEY,
  FEED_READER_STORAGE_KEY,
  feedReaderStateV1Schema,
  feedReaderStateSchema,
  sidebarSizeSchema,
  type DiscoveryResult,
  type FeedReaderState,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
  type ArticleViewMode,
  type SidebarSize,
} from "@/lib/types";
import { getBrowserStorage } from "@/lib/browser-storage";

export type SidebarState =
  | { mode: "closed" }
  | { mode: "list"; sourceId: string }
  | { mode: "reader"; sourceId: string; itemId: string };

const isSidebarSize = (value: unknown): value is SidebarSize =>
  sidebarSizeSchema.safeParse(value).success;
const isArticleViewMode = (value: unknown): value is ArticleViewMode =>
  articleViewModeSchema.safeParse(value).success;

type StorageSubscription<Value> = (
  key: string,
  callback: (value: Value) => void,
  initialValue: Value,
) => (() => void) | undefined;

type FeedReaderStorage = {
  getItem: (key: string, initialValue: FeedReaderState) => FeedReaderState;
  setItem: (key: string, value: FeedReaderState) => void;
  removeItem: (key: string) => void;
  subscribe?: StorageSubscription<FeedReaderState>;
};

const browserStringStorage = {
  getItem: (key: string) => getBrowserStorage()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => {
    getBrowserStorage()?.setItem(key, value);
  },
  removeItem: (key: string) => {
    getBrowserStorage()?.removeItem(key);
  },
};

const baseJsonStorage = createJSONStorage<unknown>(() => browserStringStorage);

const getValidatedFeedReaderState = (value: unknown, initialValue: FeedReaderState) => {
  const parsedState = feedReaderStateSchema.safeParse(value);

  if (parsedState.success) {
    return parsedState.data;
  }

  const parsedLegacyState = feedReaderStateV1Schema.safeParse(value);

  if (parsedLegacyState.success) {
    return migrateFeedReaderState(parsedLegacyState.data);
  }

  return initialValue;
};

export const feedReaderStorage: FeedReaderStorage = {
  getItem: (key, initialValue) =>
    getValidatedFeedReaderState(baseJsonStorage.getItem(key, initialValue), initialValue),
  setItem: (key, value) => {
    baseJsonStorage.setItem(key, value);
  },
  removeItem: (key) => {
    baseJsonStorage.removeItem(key);
  },
  subscribe: baseJsonStorage.subscribe
    ? (key, callback, initialValue) =>
        baseJsonStorage.subscribe?.(
          key,
          (value) => callback(getValidatedFeedReaderState(value, initialValue)),
          initialValue,
        )
    : undefined,
};

export const sidebarSizeStorage = unstable_withStorageValidator(isSidebarSize)(
  createJSONStorage<unknown>(() => browserStringStorage),
);
export const articleViewModeStorage = unstable_withStorageValidator(isArticleViewMode)(
  createJSONStorage<unknown>(() => browserStringStorage),
);

export const feedReaderStateAtom = atomWithStorage<FeedReaderState>(
  FEED_READER_STORAGE_KEY,
  createEmptyFeedReaderState(),
  feedReaderStorage,
  { getOnInit: true },
);

export const sourceInputAtom = atom("");
export const showAddFormAtom = atom(false);
export const sidebarAtom = atom<SidebarState>({ mode: "closed" });
export const sidebarSizeAtom = atomWithStorage<SidebarSize>(
  FEED_READER_SIDEBAR_SIZE_STORAGE_KEY,
  DEFAULT_FEED_READER_SIDEBAR_SIZE,
  sidebarSizeStorage,
  { getOnInit: true },
);
export const articleViewModeAtom = atomWithStorage<ArticleViewMode>(
  FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY,
  "reader",
  articleViewModeStorage,
  { getOnInit: true },
);
export const isReaderFullScreenAtom = atom(false);

export const sourceSummariesAtom = atom((get) => {
  const state = get(feedReaderStateAtom);

  return state.sources.map((source) => {
    const items = getSourceItems(state, source.id);

    return {
      source,
      items,
      unreadCount: items.filter((item) => !item.isRead).length,
      newCount: items.filter((item) => item.isNew).length,
      itemCount: items.length,
    };
  });
});

export const sidebarSourceSummaryAtom = atom((get) => {
  const sidebar = get(sidebarAtom);

  if (sidebar.mode === "closed") {
    return undefined;
  }

  return get(sourceSummariesAtom).find((summary) => summary.source.id === sidebar.sourceId);
});

export const sidebarItemsAtom = atom((get) => get(sidebarSourceSummaryAtom)?.items ?? []);

export const selectedItemAtom = atom((get) => {
  const sidebar = get(sidebarAtom);

  if (sidebar.mode !== "reader") {
    return undefined;
  }

  return get(sidebarItemsAtom).find((item) => item.id === sidebar.itemId);
});

export const totalNewAtom = atom((get) =>
  get(sourceSummariesAtom).reduce((total, summary) => total + summary.newCount, 0),
);

export const openFeedAtom = atom(null, (_get, set, sourceId: string) => {
  set(feedReaderStateAtom, (state) => setSelectedSource(state, sourceId));
  set(sidebarAtom, { mode: "list", sourceId });
});

export const selectItemAtom = atom(null, (get, set, itemId: string) => {
  const sidebar = get(sidebarAtom);

  if (sidebar.mode === "closed") {
    return;
  }

  set(sidebarAtom, { mode: "reader", sourceId: sidebar.sourceId, itemId });
  set(feedReaderStateAtom, (state) => markItemRead(state, sidebar.sourceId, itemId));
});

export const backToListAtom = atom(null, (get, set) => {
  const sidebar = get(sidebarAtom);

  if (sidebar.mode !== "reader") {
    return;
  }

  set(sidebarAtom, { mode: "list", sourceId: sidebar.sourceId });
  set(isReaderFullScreenAtom, false);
});

export const closeSidebarAtom = atom(null, (_get, set) => {
  set(sidebarAtom, { mode: "closed" });
  set(isReaderFullScreenAtom, false);
});

export const toggleReaderFullScreenAtom = atom(null, (get, set) => {
  set(isReaderFullScreenAtom, !get(isReaderFullScreenAtom));
});

export const addSourceSuccessAtom = atom(null, (_get, set, discovery: DiscoveryResult) => {
  set(feedReaderStateAtom, (state) => mergeSourceDiscovery(state, discovery));
  set(sourceInputAtom, "");
  set(showAddFormAtom, false);
  set(sidebarAtom, { mode: "list", sourceId: discovery.source.id });
});

export const removeSourceAtom = atom(null, (get, set, sourceId: string) => {
  set(feedReaderStateAtom, (state) => removeSource(state, sourceId));

  const sidebar = get(sidebarAtom);

  if (sidebar.mode !== "closed" && sidebar.sourceId === sourceId) {
    set(sidebarAtom, { mode: "closed" });
  }
});

export const applySourceRefreshAtom = atom(null, (_get, set, refresh: RefreshResult) => {
  set(feedReaderStateAtom, (state) => applySourceRefresh(state, refresh));
});

export const applyLoadMoreSourceItemsAtom = atom(
  null,
  (_get, set, result: LoadMoreSourceItemsResult) => {
    set(feedReaderStateAtom, (state) => applyLoadMoreSourceItems(state, result));
  },
);

export const setSourceErrorAtom = atom(
  null,
  (_get, set, payload: { sourceId: string; message: string }) => {
    set(feedReaderStateAtom, (state) => setSourceError(state, payload.sourceId, payload.message));
  },
);
