import {
  FEED_READER_STATE_VERSION,
  POLL_INTERVAL_MS,
  type DiscoveryResult,
  type FeedItem,
  type FeedReaderState,
  type FeedReaderStateV1,
  type FeedReaderStateV2,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
  type SavedSource,
  type SourcePagination,
  type StoredFeedItem,
} from "@/lib/types";
import { dedupeItems, sortItemsNewestFirst } from "@/lib/feed/utils";

export const createEmptyFeedReaderState = (): FeedReaderState => ({
  version: FEED_READER_STATE_VERSION,
  sources: [],
  itemsBySource: {},
  readItemIds: [],
  seenItemIdsBySource: {},
  selectedSourceId: null,
  paginationBySource: {},
});

const upsertSource = (sources: SavedSource[], source: SavedSource) => {
  const existing = sources.find((entry) => entry.id === source.id);

  if (!existing) {
    return [source, ...sources];
  }

  return sources.map((entry) => (entry.id === source.id ? { ...existing, ...source } : entry));
};

export const getInitialLoadedPageUrl = (source: Pick<SavedSource, "feedUrl" | "siteUrl">) =>
  source.feedUrl;

const createSourcePagination = (
  source: Pick<SavedSource, "feedUrl" | "siteUrl">,
  nextPageUrl?: string,
): SourcePagination => ({
  loadedPageUrls: [getInitialLoadedPageUrl(source)],
  nextPageUrl,
});

const isLegacyFeedSource = (
  source: FeedReaderStateV1["sources"][number] | FeedReaderStateV2["sources"][number],
): source is SavedSource & { kind: "feed" } =>
  source.kind === "feed" && typeof source.feedUrl === "string";

const getOptionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

export const migrateFeedReaderState = (
  state: FeedReaderState | FeedReaderStateV1 | FeedReaderStateV2,
): FeedReaderState => {
  if (state.version === FEED_READER_STATE_VERSION) {
    return state;
  }

  const sources = state.sources.filter(isLegacyFeedSource).map(
    (source) =>
      ({
        id: source.id,
        label: source.label,
        inputUrl: source.inputUrl,
        siteUrl: source.siteUrl,
        feedUrl: source.feedUrl,
        pollingEnabled: source.pollingEnabled,
        pollIntervalMs: source.pollIntervalMs || POLL_INTERVAL_MS,
        lastCheckedAt: source.lastCheckedAt,
        lastError: source.lastError,
      }) satisfies SavedSource,
  );
  const validSourceIds = new Set(sources.map((source) => source.id));
  const itemsBySource = Object.fromEntries(
    Object.entries(state.itemsBySource)
      .filter(([sourceId]) => validSourceIds.has(sourceId))
      .map(([sourceId, items]) => [
        sourceId,
        items.map(
          (item) =>
            ({
              ...item,
              contentHtml: getOptionalString("contentHtml" in item ? item.contentHtml : undefined),
              contentText: getOptionalString("contentText" in item ? item.contentText : undefined),
            }) satisfies StoredFeedItem,
        ),
      ]),
  );
  const seenItemIdsBySource = Object.fromEntries(
    Object.entries(state.seenItemIdsBySource).filter(([sourceId]) => validSourceIds.has(sourceId)),
  );
  const paginationBySource =
    "paginationBySource" in state
      ? Object.fromEntries(
          Object.entries(state.paginationBySource).filter(([sourceId]) =>
            validSourceIds.has(sourceId),
          ),
        )
      : Object.fromEntries(sources.map((source) => [source.id, createSourcePagination(source)]));
  const selectedSourceId =
    state.selectedSourceId && validSourceIds.has(state.selectedSourceId)
      ? state.selectedSourceId
      : null;

  return {
    version: FEED_READER_STATE_VERSION,
    sources,
    itemsBySource,
    readItemIds: state.readItemIds,
    seenItemIdsBySource,
    selectedSourceId,
    paginationBySource,
  };
};

export const mergeSourceDiscovery = (state: FeedReaderState, discovery: DiscoveryResult) => {
  const itemIds = discovery.items.map((item) => item.id);

  return {
    ...state,
    sources: upsertSource(state.sources, discovery.source),
    itemsBySource: {
      ...state.itemsBySource,
      [discovery.source.id]: dedupeItems(discovery.items),
    },
    seenItemIdsBySource: {
      ...state.seenItemIdsBySource,
      [discovery.source.id]: itemIds,
    },
    selectedSourceId: discovery.source.id,
    paginationBySource: {
      ...state.paginationBySource,
      [discovery.source.id]: createSourcePagination(discovery.source, discovery.nextPageUrl),
    },
  };
};

export const applySourceRefresh = (state: FeedReaderState, refresh: RefreshResult) => {
  const previousItems = state.itemsBySource[refresh.sourceId] ?? [];
  const mergedItems = dedupeItems([...refresh.items, ...previousItems]);
  const previousPagination = state.paginationBySource[refresh.sourceId];
  const nextSources = state.sources.map((source) =>
    source.id === refresh.sourceId
      ? {
          ...source,
          lastCheckedAt: refresh.checkedAt,
          lastError: undefined,
        }
      : source,
  );

  return {
    ...state,
    sources: nextSources,
    itemsBySource: {
      ...state.itemsBySource,
      [refresh.sourceId]: sortItemsNewestFirst(mergedItems),
    },
    paginationBySource: {
      ...state.paginationBySource,
      ...(previousPagination &&
      previousPagination.loadedPageUrls.length <= 1 &&
      refresh.nextPageUrl !== previousPagination.nextPageUrl
        ? {
            [refresh.sourceId]: {
              ...previousPagination,
              nextPageUrl: refresh.nextPageUrl,
            },
          }
        : {}),
    },
  };
};

export const applyLoadMoreSourceItems = (
  state: FeedReaderState,
  result: LoadMoreSourceItemsResult,
) => {
  const previousItems = state.itemsBySource[result.sourceId] ?? [];
  const mergedItems = dedupeItems([...previousItems, ...result.items]);
  const previousPagination = state.paginationBySource[result.sourceId];

  if (!previousPagination) {
    return state;
  }

  const loadedPageUrls = previousPagination.loadedPageUrls.includes(result.pageUrl)
    ? previousPagination.loadedPageUrls
    : [...previousPagination.loadedPageUrls, result.pageUrl];
  const nextPageUrl =
    result.nextPageUrl && !loadedPageUrls.includes(result.nextPageUrl)
      ? result.nextPageUrl
      : undefined;

  return {
    ...state,
    itemsBySource: {
      ...state.itemsBySource,
      [result.sourceId]: sortItemsNewestFirst(mergedItems),
    },
    paginationBySource: {
      ...state.paginationBySource,
      [result.sourceId]: {
        ...previousPagination,
        loadedPageUrls,
        nextPageUrl,
      },
    },
  };
};

export const setSourceError = (state: FeedReaderState, sourceId: string, message: string) => ({
  ...state,
  sources: state.sources.map((source) =>
    source.id === sourceId
      ? {
          ...source,
          lastError: message,
        }
      : source,
  ),
});

export const markItemRead = (state: FeedReaderState, sourceId: string, itemId: string) => {
  const readItemIds = state.readItemIds.includes(itemId)
    ? state.readItemIds
    : [...state.readItemIds, itemId];
  const sourceSeenIds = state.seenItemIdsBySource[sourceId] ?? [];
  const seenItemIds = sourceSeenIds.includes(itemId) ? sourceSeenIds : [...sourceSeenIds, itemId];

  return {
    ...state,
    readItemIds,
    seenItemIdsBySource: {
      ...state.seenItemIdsBySource,
      [sourceId]: seenItemIds,
    },
  };
};

export const setSelectedSource = (state: FeedReaderState, sourceId: string | null) => ({
  ...state,
  selectedSourceId: sourceId,
});

export const toggleSourcePolling = (
  state: FeedReaderState,
  sourceId: string,
  enabled: boolean,
) => ({
  ...state,
  sources: state.sources.map((source) =>
    source.id === sourceId
      ? {
          ...source,
          pollingEnabled: enabled,
          pollIntervalMs: source.pollIntervalMs || POLL_INTERVAL_MS,
        }
      : source,
  ),
});

export const removeSource = (state: FeedReaderState, sourceId: string) => {
  const sources = state.sources.filter((source) => source.id !== sourceId);
  const nextSelectedSourceId =
    state.selectedSourceId === sourceId ? (sources[0]?.id ?? null) : state.selectedSourceId;

  const { [sourceId]: _, ...itemsBySource } = state.itemsBySource;
  const { [sourceId]: __, ...seenItemIdsBySource } = state.seenItemIdsBySource;
  const { [sourceId]: ___, ...paginationBySource } = state.paginationBySource;

  return {
    ...state,
    sources,
    itemsBySource,
    seenItemIdsBySource,
    selectedSourceId: nextSelectedSourceId,
    paginationBySource,
  };
};

export type ConvexSubscription = {
  id: string;
  label: string;
  inputUrl: string;
  siteUrl: string;
  feedUrl: string;
  pollingEnabled: boolean;
  pollIntervalMs: number;
};

export const syncSourcesFromConvex = (
  state: FeedReaderState,
  subscriptions: ConvexSubscription[],
): FeedReaderState => {
  const validSourceIds = new Set(subscriptions.map((s) => s.id));

  const sources = subscriptions.map((sub) => ({
    id: sub.id,
    label: sub.label,
    inputUrl: sub.inputUrl,
    siteUrl: sub.siteUrl,
    feedUrl: sub.feedUrl,
    pollingEnabled: sub.pollingEnabled,
    pollIntervalMs: sub.pollIntervalMs,
    lastCheckedAt: state.sources.find((s) => s.id === sub.id)?.lastCheckedAt,
    lastError: state.sources.find((s) => s.id === sub.id)?.lastError,
  }));

  const itemsBySource = Object.fromEntries(
    Object.entries(state.itemsBySource).filter(([sourceId]) => validSourceIds.has(sourceId)),
  );
  const seenItemIdsBySource = Object.fromEntries(
    Object.entries(state.seenItemIdsBySource).filter(([sourceId]) => validSourceIds.has(sourceId)),
  );
  const paginationBySource = Object.fromEntries(
    Object.entries(state.paginationBySource).filter(([sourceId]) => validSourceIds.has(sourceId)),
  );
  const readItemIds = state.readItemIds.filter((id) =>
    Object.values(itemsBySource).some((items) => items.some((item) => item.id === id)),
  );
  const selectedSourceId =
    state.selectedSourceId && validSourceIds.has(state.selectedSourceId)
      ? state.selectedSourceId
      : (sources[0]?.id ?? null);

  return {
    ...state,
    sources,
    itemsBySource,
    seenItemIdsBySource,
    readItemIds,
    paginationBySource,
    selectedSourceId,
  };
};

export const getSourceItems = (state: FeedReaderState, sourceId: string): FeedItem[] => {
  const readIds = new Set(state.readItemIds);
  const seenIds = new Set(state.seenItemIdsBySource[sourceId] ?? []);

  return sortItemsNewestFirst(state.itemsBySource[sourceId] ?? []).map((item) => ({
    ...item,
    isNew: !seenIds.has(item.id),
    isRead: readIds.has(item.id),
  }));
};
