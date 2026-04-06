import {
  FEED_READER_STATE_VERSION,
  type DiscoveryResult,
  type FeedItem,
  type FeedReaderState,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
  type SavedSource,
  type SourcePagination,
} from "@/lib/types";
import { dedupeItems, sortItemsNewestFirst } from "@/lib/feed/utils";

export const createEmptyFeedReaderState = (): FeedReaderState => ({
  version: FEED_READER_STATE_VERSION,
  sources: [],
  itemsBySource: {},
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

const getInitialLoadedPageUrl = (source: Pick<SavedSource, "feedUrl" | "siteUrl">) =>
  source.feedUrl;

const createSourcePagination = (
  source: Pick<SavedSource, "feedUrl" | "siteUrl">,
  nextPageUrl?: string,
): SourcePagination => ({
  loadedPageUrls: [getInitialLoadedPageUrl(source)],
  nextPageUrl,
});

export const mergeSourceDiscovery = (state: FeedReaderState, discovery: DiscoveryResult) => {
  return {
    ...state,
    sources: upsertSource(state.sources, discovery.source),
    itemsBySource: {
      ...state.itemsBySource,
      [discovery.source.id]: dedupeItems(discovery.items),
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

export const setSelectedSource = (state: FeedReaderState, sourceId: string | null) => ({
  ...state,
  selectedSourceId: sourceId,
});

export const removeSource = (state: FeedReaderState, sourceId: string) => {
  const sources = state.sources.filter((source) => source.id !== sourceId);
  const nextSelectedSourceId =
    state.selectedSourceId === sourceId ? (sources[0]?.id ?? null) : state.selectedSourceId;

  const { [sourceId]: _, ...itemsBySource } = state.itemsBySource;
  const { [sourceId]: __, ...paginationBySource } = state.paginationBySource;

  return {
    ...state,
    sources,
    itemsBySource,
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
  const paginationBySource = Object.fromEntries(
    Object.entries(state.paginationBySource).filter(([sourceId]) => validSourceIds.has(sourceId)),
  );
  const selectedSourceId =
    state.selectedSourceId && validSourceIds.has(state.selectedSourceId)
      ? state.selectedSourceId
      : (sources[0]?.id ?? null);

  return {
    ...state,
    sources,
    itemsBySource,
    paginationBySource,
    selectedSourceId,
  };
};

export type FeedItemStateMap = Record<string, { isRead: boolean; isSeen: boolean }>;

export const getSourceItems = (
  state: FeedReaderState,
  sourceId: string,
  itemStateMap: FeedItemStateMap = {},
): FeedItem[] =>
  (state.itemsBySource[sourceId] ?? []).map((item) => ({
    ...item,
    isNew: !itemStateMap[item.id]?.isSeen,
    isRead: Boolean(itemStateMap[item.id]?.isRead),
  }));
