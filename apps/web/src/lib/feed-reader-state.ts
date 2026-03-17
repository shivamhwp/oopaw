import {
  applyLoadMoreSourceItems,
  applySourceRefresh,
  createEmptyLocalFeedCache,
  extractLegacyFeedSubscriptions,
  getInitialLoadedPageUrl,
  getLocalFeedCacheForUser,
  getSourceItems,
  markItemRead,
  mergeSourceDiscovery,
  migrateLegacyFeedReaderState,
  parseLegacyFeedReaderState,
  reconcileLocalFeedCache,
  removeSource,
  setLocalFeedCacheForUser,
  setSelectedSource,
  setSourceError,
} from "@repo/shared/feed/cache";
import type { FeedReaderState, SavedSource } from "@/lib/types";

export {
  applyLoadMoreSourceItems,
  applySourceRefresh,
  createEmptyLocalFeedCache as createEmptyFeedReaderState,
  extractLegacyFeedSubscriptions,
  getInitialLoadedPageUrl,
  getLocalFeedCacheForUser,
  getSourceItems,
  markItemRead,
  mergeSourceDiscovery,
  migrateLegacyFeedReaderState,
  parseLegacyFeedReaderState,
  reconcileLocalFeedCache,
  removeSource,
  setLocalFeedCacheForUser,
  setSelectedSource,
  setSourceError,
};

export type ConvexSubscription = SavedSource;

export const markItemUnread = (state: FeedReaderState, itemId: string) => {
  let didChange = false;

  const sources = Object.fromEntries(
    Object.entries(state.sources).map(([sourceId, sourceState]) => {
      if (!sourceState.readItemIds.includes(itemId)) {
        return [sourceId, sourceState];
      }

      didChange = true;

      return [
        sourceId,
        {
          ...sourceState,
          readItemIds: sourceState.readItemIds.filter((id) => id !== itemId),
        },
      ];
    }),
  );

  return didChange ? { ...state, sources } : state;
};

export const syncSourcesFromConvex = (
  state: FeedReaderState,
  subscriptions: ConvexSubscription[],
): FeedReaderState => {
  const reconciled = reconcileLocalFeedCache(
    state,
    subscriptions.map((subscription) => subscription.sourceId),
  );

  if (reconciled.selectedSourceId || subscriptions.length === 0) {
    return reconciled;
  }

  return {
    ...reconciled,
    selectedSourceId: subscriptions[0]?.sourceId ?? null,
  };
};
