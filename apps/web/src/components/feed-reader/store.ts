import { atom } from "jotai";
import { atomWithStorage, createJSONStorage, unstable_withStorageValidator } from "jotai/utils";
import { z } from "zod";
import {
  applyLoadMoreSourceItems,
  applySourceRefresh,
  getLocalFeedCacheForUser,
  getSourceItems,
  markItemRead,
  markItemUnread,
  mergeSourceDiscovery,
  removeSource,
  setLocalFeedCacheForUser,
  setSelectedSource,
  setSourceError,
  syncSourcesFromConvex,
  type ConvexSubscription,
} from "@/lib/feed-reader-state";
import { getBrowserStorage } from "@/lib/browser-storage";
import {
  FEED_READER_PANEL_OPEN_STORAGE_KEY,
  type DiscoveryResult,
  type FeedReaderState,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
  type SavedSource,
} from "@/lib/types";
import {
  LOCAL_FEED_CACHE_STORAGE_KEY,
  localFeedCacheStorageSchema,
  type LocalFeedCacheStorage,
} from "@repo/shared/feed/types";

const FEED_READER_PANEL_STATE_STORAGE_KEY = "papertrail.feed-reader.panel";
const FEED_READER_PANEL_SIZE_STORAGE_KEY = "papertrail.feed-reader.panel-size";

export const MIN_FEED_READER_READER_PANEL_SIZE = 14;
export const MIN_FEED_READER_LIST_PANEL_SIZE = 40;
const DEFAULT_FEED_READER_PANEL_SIZE = 50;
export const MAX_FEED_READER_PANEL_SIZE = 70;

const detailPanelStateSchema = z.union([
  z.object({ mode: z.literal("closed") }),
  z.object({ mode: z.literal("list"), sourceId: z.string().min(1) }),
  z.object({ mode: z.literal("reader"), sourceId: z.string().min(1), itemId: z.string().min(1) }),
]);

const detailPanelSizeSchema = z
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

type ValidatedStorage<Value> = {
  getItem: (key: string, initialValue: Value) => Value;
  setItem: (key: string, value: Value) => void;
  removeItem: (key: string) => void;
};

const isDetailPanelSize = (value: unknown): value is DetailPanelSize =>
  detailPanelSizeSchema.safeParse(value).success;
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

const feedReaderStorage = {
  getItem: (key: string, initialValue: LocalFeedCacheStorage) => {
    const value = baseJsonStorage.getItem(key, initialValue);
    const parsed = localFeedCacheStorageSchema.safeParse(value);

    return parsed.success ? parsed.data : initialValue;
  },
  setItem: (key: string, value: LocalFeedCacheStorage) => {
    baseJsonStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    baseJsonStorage.removeItem(key);
  },
  subscribe: baseJsonStorage.subscribe
    ? (
        key: string,
        callback: (value: LocalFeedCacheStorage) => void,
        initialValue: LocalFeedCacheStorage,
      ) =>
        baseJsonStorage.subscribe?.(
          key,
          (value) => {
            const parsed = localFeedCacheStorageSchema.safeParse(value);
            callback(parsed.success ? parsed.data : initialValue);
          },
          initialValue,
        )
    : undefined,
} satisfies {
  getItem: (key: string, initialValue: LocalFeedCacheStorage) => LocalFeedCacheStorage;
  setItem: (key: string, value: LocalFeedCacheStorage) => void;
  removeItem: (key: string) => void;
  subscribe?: StorageSubscription<LocalFeedCacheStorage>;
};

const detailPanelSizeStorage = createValidatedStorage(isDetailPanelSize);
const detailPanelStateStorage = createValidatedStorage(isDetailPanelState);
const detailPanelOpenStorage = unstable_withStorageValidator(
  (value): value is boolean => typeof value === "boolean",
)(createJSONStorage<unknown>(() => browserStringStorage));

export const currentUserIdAtom = atom<string | null>(null);
export const feedSubscriptionsAtom = atom<SavedSource[]>([]);

const persistedFeedCacheStorageAtom = atomWithStorage<LocalFeedCacheStorage>(
  LOCAL_FEED_CACHE_STORAGE_KEY,
  {
    version: 1,
    users: {},
  },
  feedReaderStorage,
  { getOnInit: true },
);

const getSanitizedDetailPanelState = (
  detailPanel: DetailPanelState,
  sources: SavedSource[],
  state: FeedReaderState,
) => {
  if (detailPanel.mode === "closed") {
    return detailPanel;
  }

  const sourceExists =
    sources.some((source) => source.sourceId === detailPanel.sourceId) ||
    state.sources[detailPanel.sourceId] !== undefined;

  if (!sourceExists) {
    return { mode: "closed" } satisfies DetailPanelState;
  }

  if (detailPanel.mode === "reader") {
    const itemExists = (state.sources[detailPanel.sourceId]?.items ?? []).some(
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

export const feedReaderStateAtom = atom(
  (get) => getLocalFeedCacheForUser(get(persistedFeedCacheStorageAtom), get(currentUserIdAtom)),
  (get, set, nextState: SetAtomAction<FeedReaderState>) => {
    const current = get(feedReaderStateAtom);
    const resolved = typeof nextState === "function" ? nextState(current) : nextState;

    set(persistedFeedCacheStorageAtom, (storage) =>
      setLocalFeedCacheForUser(storage, get(currentUserIdAtom), resolved),
    );
  },
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
  (get) =>
    getSanitizedDetailPanelState(
      get(persistedDetailPanelAtom),
      get(feedSubscriptionsAtom),
      get(feedReaderStateAtom),
    ),
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
export const articleViewModeAtom = atom<"reader" | "site">("reader");
export const isReaderFullScreenAtom = atom(false);

export const sourceSummariesAtom = atom((get) => {
  const subscriptions = get(feedSubscriptionsAtom);
  const state = get(feedReaderStateAtom);

  return subscriptions.map((source) => {
    const items = getSourceItems(state, source.sourceId);

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

  return get(sourceSummariesAtom).find(
    (summary) => summary.source.sourceId === detailPanel.sourceId,
  );
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

export const markItemUnreadAtom = atom(null, (_get, set, itemId: string) => {
  set(feedReaderStateAtom, (state) => markItemUnread(state, itemId));
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
  set(detailPanelAtom, { mode: "list", sourceId: discovery.source.sourceId });
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

export const syncSourcesFromConvexAtom = atom(
  null,
  (_get, set, subscriptions: ConvexSubscription[]) => {
    set(feedReaderStateAtom, (state) => syncSourcesFromConvex(state, subscriptions));
  },
);

export type { DetailPanelState };
