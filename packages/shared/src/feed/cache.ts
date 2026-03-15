import {
  LOCAL_FEED_CACHE_STORAGE_VERSION,
  LOCAL_FEED_CACHE_VERSION,
  legacyFeedReaderStateV1Schema,
  legacyFeedReaderStateV2Schema,
  legacyFeedReaderStateV3Schema,
  type DiscoveryResult,
  type DiscoveredFeedSubscription,
  type FeedItem,
  type LegacyFeedReaderStateV1,
  type LegacyFeedReaderStateV2,
  type LegacyFeedReaderStateV3,
  type LocalFeedCache,
  type LocalFeedCacheSourceState,
  type LocalFeedCacheStorage,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
  type SourcePagination,
} from "./types";
import { dedupeItems, sortItemsNewestFirst } from "./utils";

type LegacyFeedReaderState =
  | LegacyFeedReaderStateV1
  | LegacyFeedReaderStateV2
  | LegacyFeedReaderStateV3;

const isLegacyFeedSource = (
  source: LegacyFeedReaderState["sources"][number],
): source is LegacyFeedReaderStateV3["sources"][number] =>
  source.kind !== "scrape" && typeof source.feedUrl === "string";

const getOptionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

export const createEmptyLocalFeedCache = (): LocalFeedCache => ({
  version: LOCAL_FEED_CACHE_VERSION,
  sources: {},
  selectedSourceId: null,
});

export const createEmptyLocalFeedCacheStorage = (): LocalFeedCacheStorage => ({
  version: LOCAL_FEED_CACHE_STORAGE_VERSION,
  users: {},
});

export const getLocalFeedCacheForUser = (
  storage: LocalFeedCacheStorage,
  userId: string | null | undefined,
) => {
  if (!userId) {
    return createEmptyLocalFeedCache();
  }

  return storage.users[userId] ?? createEmptyLocalFeedCache();
};

export const setLocalFeedCacheForUser = (
  storage: LocalFeedCacheStorage,
  userId: string | null | undefined,
  cache: LocalFeedCache,
) => {
  if (!userId) {
    return storage;
  }

  return {
    ...storage,
    users: {
      ...storage.users,
      [userId]: cache,
    },
  };
};

export const getInitialLoadedPageUrl = (
  source: Pick<DiscoveredFeedSubscription, "feedUrl" | "siteUrl">,
) => source.feedUrl;

const createSourcePagination = (
  source: Pick<DiscoveredFeedSubscription, "feedUrl" | "siteUrl">,
  nextPageUrl?: string,
): SourcePagination => ({
  loadedPageUrls: [getInitialLoadedPageUrl(source)],
  nextPageUrl,
});

const getLocalSourceState = (
  cache: LocalFeedCache,
  sourceId: string,
): LocalFeedCacheSourceState => {
  const current = cache.sources[sourceId];

  return {
    items: current?.items ?? [],
    readItemIds: current?.readItemIds ?? [],
    seenItemIds: current?.seenItemIds ?? [],
    pagination: current?.pagination,
    lastCheckedAt: current?.lastCheckedAt,
    lastError: current?.lastError,
  };
};

export const parseLegacyFeedReaderState = (value: unknown) => {
  const parsedV3 = legacyFeedReaderStateV3Schema.safeParse(value);

  if (parsedV3.success) {
    return parsedV3.data;
  }

  const parsedV2 = legacyFeedReaderStateV2Schema.safeParse(value);

  if (parsedV2.success) {
    return parsedV2.data;
  }

  const parsedV1 = legacyFeedReaderStateV1Schema.safeParse(value);

  if (parsedV1.success) {
    return parsedV1.data;
  }

  return undefined;
};

export const extractLegacyFeedSubscriptions = (state: LegacyFeedReaderState) =>
  state.sources.filter(isLegacyFeedSource).flatMap((source) => {
    if (!source.feedUrl) {
      return [];
    }

    return [
      {
        sourceId: source.id,
        label: source.label,
        inputUrl: source.inputUrl,
        siteUrl: source.siteUrl,
        feedUrl: source.feedUrl,
      } satisfies DiscoveredFeedSubscription,
    ];
  });

export const migrateLegacyFeedReaderState = (state: LegacyFeedReaderState): LocalFeedCache => {
  const subscriptions = extractLegacyFeedSubscriptions(state);
  const validSourceIds = new Set(subscriptions.map((source) => source.sourceId));
  const readItemIds = new Set(state.readItemIds);
  const sourceMap = new Map(state.sources.map((source) => [source.id, source]));
  const sources = Object.fromEntries(
    subscriptions.map((source) => {
      const legacySource = sourceMap.get(source.sourceId);
      const items = (state.itemsBySource[source.sourceId] ?? []).map((item) => ({
        ...item,
        contentHtml: getOptionalString("contentHtml" in item ? item.contentHtml : undefined),
        contentText: getOptionalString("contentText" in item ? item.contentText : undefined),
      }));
      const pagination =
        "paginationBySource" in state
          ? state.paginationBySource[source.sourceId]
          : createSourcePagination(source);

      return [
        source.sourceId,
        {
          items,
          readItemIds: items.filter((item) => readItemIds.has(item.id)).map((item) => item.id),
          seenItemIds: state.seenItemIdsBySource[source.sourceId] ?? [],
          pagination,
          lastCheckedAt: legacySource?.lastCheckedAt,
          lastError: legacySource?.lastError,
        } satisfies LocalFeedCacheSourceState,
      ];
    }),
  );
  const selectedSourceId =
    state.selectedSourceId && validSourceIds.has(state.selectedSourceId)
      ? state.selectedSourceId
      : null;

  return {
    version: LOCAL_FEED_CACHE_VERSION,
    sources,
    selectedSourceId,
  };
};

export const reconcileLocalFeedCache = (cache: LocalFeedCache, sourceIds: string[]) => {
  const validSourceIds = new Set(sourceIds);
  const sources = Object.fromEntries(
    Object.entries(cache.sources).filter(([sourceId]) => validSourceIds.has(sourceId)),
  );

  return {
    ...cache,
    sources,
    selectedSourceId:
      cache.selectedSourceId && validSourceIds.has(cache.selectedSourceId)
        ? cache.selectedSourceId
        : null,
  };
};

export const mergeSourceDiscovery = (cache: LocalFeedCache, discovery: DiscoveryResult) => ({
  ...cache,
  sources: {
    ...cache.sources,
    [discovery.source.sourceId]: {
      items: dedupeItems(discovery.items),
      readItemIds: [],
      seenItemIds: discovery.items.map((item) => item.id),
      pagination: createSourcePagination(discovery.source, discovery.nextPageUrl),
      lastCheckedAt: discovery.checkedAt,
      lastError: undefined,
    },
  },
  selectedSourceId: discovery.source.sourceId,
});

export const applySourceRefresh = (cache: LocalFeedCache, refresh: RefreshResult) => {
  const previous = getLocalSourceState(cache, refresh.sourceId);
  const mergedItems = dedupeItems([...refresh.items, ...previous.items]);
  const nextPagination =
    previous.pagination &&
    previous.pagination.loadedPageUrls.length <= 1 &&
    refresh.nextPageUrl !== previous.pagination.nextPageUrl
      ? {
          ...previous.pagination,
          nextPageUrl: refresh.nextPageUrl,
        }
      : previous.pagination;

  return {
    ...cache,
    sources: {
      ...cache.sources,
      [refresh.sourceId]: {
        ...previous,
        items: sortItemsNewestFirst(mergedItems),
        pagination: nextPagination,
        lastCheckedAt: refresh.checkedAt,
        lastError: undefined,
      },
    },
  };
};

export const applyLoadMoreSourceItems = (
  cache: LocalFeedCache,
  result: LoadMoreSourceItemsResult,
) => {
  const previous = getLocalSourceState(cache, result.sourceId);
  const pagination = previous.pagination;

  if (!pagination) {
    return cache;
  }

  const mergedItems = dedupeItems([...previous.items, ...result.items]);
  const loadedPageUrls = pagination.loadedPageUrls.includes(result.pageUrl)
    ? pagination.loadedPageUrls
    : [...pagination.loadedPageUrls, result.pageUrl];
  const nextPageUrl =
    result.nextPageUrl && !loadedPageUrls.includes(result.nextPageUrl)
      ? result.nextPageUrl
      : undefined;

  return {
    ...cache,
    sources: {
      ...cache.sources,
      [result.sourceId]: {
        ...previous,
        items: sortItemsNewestFirst(mergedItems),
        pagination: {
          ...pagination,
          loadedPageUrls,
          nextPageUrl,
        },
      },
    },
  };
};

export const setSourceError = (cache: LocalFeedCache, sourceId: string, message: string) => {
  const previous = getLocalSourceState(cache, sourceId);

  return {
    ...cache,
    sources: {
      ...cache.sources,
      [sourceId]: {
        ...previous,
        lastError: message,
      },
    },
  };
};

export const markItemRead = (cache: LocalFeedCache, sourceId: string, itemId: string) => {
  const previous = getLocalSourceState(cache, sourceId);
  const readItemIds = previous.readItemIds.includes(itemId)
    ? previous.readItemIds
    : [...previous.readItemIds, itemId];
  const seenItemIds = previous.seenItemIds.includes(itemId)
    ? previous.seenItemIds
    : [...previous.seenItemIds, itemId];

  return {
    ...cache,
    sources: {
      ...cache.sources,
      [sourceId]: {
        ...previous,
        readItemIds,
        seenItemIds,
      },
    },
  };
};

export const setSelectedSource = (cache: LocalFeedCache, sourceId: string | null) => ({
  ...cache,
  selectedSourceId: sourceId,
});

export const removeSource = (cache: LocalFeedCache, sourceId: string) => {
  const { [sourceId]: _removed, ...sources } = cache.sources;

  return {
    ...cache,
    sources,
    selectedSourceId: cache.selectedSourceId === sourceId ? null : cache.selectedSourceId,
  };
};

export const getSourceItems = (cache: LocalFeedCache, sourceId: string): FeedItem[] => {
  const source = getLocalSourceState(cache, sourceId);
  const readIds = new Set(source.readItemIds);
  const seenIds = new Set(source.seenItemIds);

  return sortItemsNewestFirst(source.items).map((item) => ({
    ...item,
    isNew: !seenIds.has(item.id),
    isRead: readIds.has(item.id),
  }));
};
