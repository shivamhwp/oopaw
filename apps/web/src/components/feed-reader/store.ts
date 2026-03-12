import { atom } from "jotai";
import { atomWithStorage, createJSONStorage, unstable_withStorageValidator } from "jotai/utils";
import { z } from "zod";
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
  FEED_READER_PANEL_OPEN_STORAGE_KEY,
  FEED_READER_STATE_STORAGE_KEY,
  feedReaderStateV1Schema,
  feedReaderStateV2Schema,
  feedReaderStateSchema,
  type ArticleViewMode,
  type DiscoveryResult,
  type FeedReaderState,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
} from "@/lib/types";
import { getBrowserStorage } from "@/lib/browser-storage";

export const FEED_READER_PANEL_STATE_STORAGE_KEY = "papertrail.feed-reader.panel";
export const FEED_READER_PANEL_SIZE_STORAGE_KEY = "papertrail.feed-reader.panel-size";

export const MIN_FEED_READER_READER_PANEL_SIZE = 14;
export const MIN_FEED_READER_LIST_PANEL_SIZE = 40;
export const DEFAULT_FEED_READER_PANEL_SIZE = 50;
export const MAX_FEED_READER_PANEL_SIZE = 70;

export const detailPanelStateSchema = z.union([
  z.object({ mode: z.literal("closed") }),
  z.object({ mode: z.literal("list"), sourceId: z.string().min(1) }),
  z.object({ mode: z.literal("reader"), sourceId: z.string().min(1), itemId: z.string().min(1) }),
]);

export const detailPanelSizeSchema = z
  .number()
  .min(MIN_FEED_READER_READER_PANEL_SIZE)
  .max(MAX_FEED_READER_PANEL_SIZE);

type DetailPanelState = z.infer<typeof detailPanelStateSchema>;
type DetailPanelSize = z.infer<typeof detailPanelSizeSchema>;
type StorageSubscription<Value> = (
  key: string,
  callback: (value: Value) => void,
  initialValue: Value,
) => (() => void) | undefined;
type SetAtomAction<Value> = Value | ((value: Value) => Value);

type FeedReaderStorage = {
  getItem: (key: string, initialValue: FeedReaderState) => FeedReaderState;
  setItem: (key: string, value: FeedReaderState) => void;
  removeItem: (key: string) => void;
  subscribe?: StorageSubscription<FeedReaderState>;
};

type ValidatedStorage<Value> = {
  getItem: (key: string, initialValue: Value) => Value;
  setItem: (key: string, value: Value) => void;
  removeItem: (key: string) => void;
};

const isDetailPanelSize = (value: unknown): value is DetailPanelSize =>
  detailPanelSizeSchema.safeParse(value).success;
const isArticleViewMode = (value: unknown): value is ArticleViewMode =>
  articleViewModeSchema.safeParse(value).success;
const isDetailPanelState = (value: unknown): value is DetailPanelState =>
  detailPanelStateSchema.safeParse(value).success;

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

  const parsedV2State = feedReaderStateV2Schema.safeParse(value);

  if (parsedV2State.success) {
    return migrateFeedReaderState(parsedV2State.data);
  }

  return initialValue;
};

const getStoredJsonValue = (key: string) => {
  const rawValue = browserStringStorage.getItem(key);

  if (rawValue === null) {
    return undefined;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return undefined;
  }
};

const createValidatedStorage = <Value>(
  isValid: (value: unknown) => value is Value,
): ValidatedStorage<Value> => ({
  getItem: (key, initialValue) => {
    const value = getStoredJsonValue(key);

    if (isValid(value)) {
      return value;
    }

    return initialValue;
  },
  setItem: (key, value) => {
    browserStringStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key) => {
    browserStringStorage.removeItem(key);
  },
});

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

export const detailPanelSizeStorage = createValidatedStorage(isDetailPanelSize);
export const articleViewModeStorage = unstable_withStorageValidator(isArticleViewMode)(
  createJSONStorage<unknown>(() => browserStringStorage),
);
export const detailPanelStateStorage = createValidatedStorage(isDetailPanelState);
export const detailPanelOpenStorage = unstable_withStorageValidator(
  (value): value is boolean => typeof value === "boolean",
)(createJSONStorage<unknown>(() => browserStringStorage));

const getSanitizedDetailPanelState = (detailPanel: DetailPanelState, state: FeedReaderState) => {
  if (detailPanel.mode === "closed") {
    return detailPanel;
  }

  const sourceExists = state.sources.some((source) => source.id === detailPanel.sourceId);

  if (!sourceExists) {
    return { mode: "closed" } satisfies DetailPanelState;
  }

  if (detailPanel.mode === "reader") {
    const itemExists = (state.itemsBySource[detailPanel.sourceId] ?? []).some(
      (item) => item.id === detailPanel.itemId,
    );

    if (!itemExists) {
      return { mode: "list", sourceId: detailPanel.sourceId } satisfies DetailPanelState;
    }
  }

  return detailPanel;
};

const persistedDetailPanelAtom = atomWithStorage<DetailPanelState>(
  FEED_READER_PANEL_STATE_STORAGE_KEY,
  { mode: "closed" },
  detailPanelStateStorage,
  { getOnInit: true },
);

export const feedReaderStateAtom = atomWithStorage<FeedReaderState>(
  FEED_READER_STATE_STORAGE_KEY,
  createEmptyFeedReaderState(),
  feedReaderStorage,
  { getOnInit: true },
);

export const sourceInputAtom = atom("");
export const showAddFormAtom = atom(false);
export const detailPanelOpenAtom = atomWithStorage<boolean>(
  FEED_READER_PANEL_OPEN_STORAGE_KEY,
  false,
  detailPanelOpenStorage,
  { getOnInit: true },
);
export const detailPanelAtom = atom(
  (get) => getSanitizedDetailPanelState(get(persistedDetailPanelAtom), get(feedReaderStateAtom)),
  (get, set, nextDetailPanel: SetAtomAction<DetailPanelState>) => {
    const currentDetailPanel = get(persistedDetailPanelAtom);
    const resolvedDetailPanel =
      typeof nextDetailPanel === "function" ? nextDetailPanel(currentDetailPanel) : nextDetailPanel;

    set(persistedDetailPanelAtom, resolvedDetailPanel);
    set(detailPanelOpenAtom, resolvedDetailPanel.mode !== "closed");
  },
);
export const detailPanelSizeAtom = atomWithStorage<DetailPanelSize>(
  FEED_READER_PANEL_SIZE_STORAGE_KEY,
  DEFAULT_FEED_READER_PANEL_SIZE,
  detailPanelSizeStorage,
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

export const detailPanelSourceSummaryAtom = atom((get) => {
  const detailPanel = get(detailPanelAtom);

  if (detailPanel.mode === "closed") {
    return undefined;
  }

  return get(sourceSummariesAtom).find((summary) => summary.source.id === detailPanel.sourceId);
});

export const detailPanelItemsAtom = atom((get) => get(detailPanelSourceSummaryAtom)?.items ?? []);

export const selectedItemAtom = atom((get) => {
  const detailPanel = get(detailPanelAtom);

  if (detailPanel.mode !== "reader") {
    return undefined;
  }

  return get(detailPanelItemsAtom).find((item) => item.id === detailPanel.itemId);
});

export const totalNewAtom = atom((get) =>
  get(sourceSummariesAtom).reduce((total, summary) => total + summary.newCount, 0),
);

export const openFeedAtom = atom(null, (_get, set, sourceId: string) => {
  set(feedReaderStateAtom, (state) => setSelectedSource(state, sourceId));
  set(detailPanelAtom, { mode: "list", sourceId });
});

export const selectItemAtom = atom(null, (get, set, itemId: string) => {
  const detailPanel = get(detailPanelAtom);

  if (detailPanel.mode === "closed") {
    return;
  }

  set(detailPanelAtom, { mode: "reader", sourceId: detailPanel.sourceId, itemId });
  set(feedReaderStateAtom, (state) => markItemRead(state, detailPanel.sourceId, itemId));
});

export const backToFeedListAtom = atom(null, (get, set) => {
  const detailPanel = get(detailPanelAtom);

  if (detailPanel.mode !== "reader") {
    return;
  }

  set(detailPanelAtom, { mode: "list", sourceId: detailPanel.sourceId });
  set(isReaderFullScreenAtom, false);
});

export const closeDetailPanelAtom = atom(null, (_get, set) => {
  set(detailPanelAtom, { mode: "closed" });
  set(isReaderFullScreenAtom, false);
});

export const toggleReaderFullScreenAtom = atom(null, (get, set) => {
  set(isReaderFullScreenAtom, !get(isReaderFullScreenAtom));
});

export const addSourceSuccessAtom = atom(null, (_get, set, discovery: DiscoveryResult) => {
  set(feedReaderStateAtom, (state) => mergeSourceDiscovery(state, discovery));
  set(sourceInputAtom, "");
  set(showAddFormAtom, false);
  set(detailPanelAtom, { mode: "list", sourceId: discovery.source.id });
});

export const removeSourceAtom = atom(null, (get, set, sourceId: string) => {
  set(feedReaderStateAtom, (state) => removeSource(state, sourceId));

  const detailPanel = get(detailPanelAtom);

  if (detailPanel.mode !== "closed" && detailPanel.sourceId === sourceId) {
    set(detailPanelAtom, { mode: "closed" });
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

export type { DetailPanelSize, DetailPanelState };
