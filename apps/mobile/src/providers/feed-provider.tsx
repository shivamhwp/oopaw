import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import { api, type Doc } from "@/lib/convex";
import { defaultUserPreferences } from "@/lib/preferences";
import {
  applyLoadMoreSourceItems,
  applySourceRefresh,
  createEmptyLocalFeedCache,
  getSourceItems,
  markItemRead,
  mergeSourceDiscovery,
  reconcileLocalFeedCache,
  removeSource,
  setSourceError,
} from "@repo/shared/feed/cache";
import {
  discoverFeed,
  loadMoreDiscoveredFeedItems,
  refreshDiscoveredFeed,
} from "@repo/shared/feed/service";
import {
  localFeedCacheSchema,
  type FeedSubscription,
  type FeedItem,
  type LocalFeedCache,
} from "@repo/shared/feed/types";

const createStorageKey = (userId: string) => `papertrail.mobile.feed-cache.${userId}`;

type FeedContextValue = {
  cache: LocalFeedCache;
  isCacheReady: boolean;
  subscriptions: FeedSubscription[];
  preferences: typeof defaultUserPreferences;
  sourceSummaries: Array<{
    source: FeedSubscription;
    items: FeedItem[];
    unreadCount: number;
    newCount: number;
  }>;
  addFeed: (inputUrl: string) => Promise<string>;
  removeFeed: (sourceId: string) => Promise<void>;
  refreshSource: (sourceId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  loadMore: (sourceId: string) => Promise<void>;
  markRead: (sourceId: string, itemId: string) => void;
  getSource: (sourceId: string) => FeedSubscription | undefined;
  getSourceItems: (sourceId: string) => FeedItem[];
  getItem: (sourceId: string, itemId: string) => FeedItem | undefined;
  ensureItem: (sourceId: string, itemId: string) => Promise<FeedItem | undefined>;
  updatePreferences: (values: typeof defaultUserPreferences) => Promise<void>;
};

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const subscriptions = (useQuery(
    api.feedSubscriptions.queries.listForCurrentUser,
    isSignedIn ? {} : "skip",
  ) ?? []) as Doc<"feedSubscriptions">[];
  const preferences =
    useQuery(api.preferences.queries.getForCurrentUser, isSignedIn ? {} : "skip") ??
    defaultUserPreferences;
  const createSubscription = useMutation(api.feedSubscriptions.mutations.createForCurrentUser);
  const removeSubscription = useMutation(api.feedSubscriptions.mutations.removeForCurrentUser);
  const upsertPreferences = useMutation(api.preferences.mutations.upsertForCurrentUser);
  const [cache, setCache] = useState<LocalFeedCache>(createEmptyLocalFeedCache());
  const [isCacheReady, setIsCacheReady] = useState(false);
  const cacheRef = useRef(cache);

  cacheRef.current = cache;

  useEffect(() => {
    if (!userId) {
      setCache(createEmptyLocalFeedCache());
      setIsCacheReady(true);
      return;
    }

    let cancelled = false;

    setIsCacheReady(false);

    void (async () => {
      try {
        const rawValue = await AsyncStorage.getItem(createStorageKey(userId));

        if (cancelled) {
          return;
        }

        if (!rawValue) {
          setCache(createEmptyLocalFeedCache());
          return;
        }

        const parsed = localFeedCacheSchema.safeParse(JSON.parse(rawValue));

        if (cancelled) {
          return;
        }

        setCache(parsed.success ? parsed.data : createEmptyLocalFeedCache());
      } catch {
        if (cancelled) {
          return;
        }

        setCache(createEmptyLocalFeedCache());
      } finally {
        if (!cancelled) {
          setIsCacheReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !isCacheReady) {
      return;
    }

    void AsyncStorage.setItem(createStorageKey(userId), JSON.stringify(cache));
  }, [cache, isCacheReady, userId]);

  useEffect(() => {
    setCache((current) =>
      reconcileLocalFeedCache(
        current,
        subscriptions.map((subscription) => subscription.sourceId),
      ),
    );
  }, [subscriptions]);

  useEffect(() => {
    if (!isSignedIn || !isCacheReady || subscriptions.length === 0) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      interval = setInterval(() => {
        void Promise.allSettled(
          subscriptions.map((subscription) => refreshSourceById(subscription.sourceId)),
        );
      }, preferences.pollingIntervalMinutes * 60_000);
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !interval) {
        start();
        return;
      }

      if (state !== "active" && interval) {
        clearInterval(interval);
        interval = undefined;
      }
    });

    start();

    return () => {
      subscription.remove();
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isCacheReady, isSignedIn, preferences.pollingIntervalMinutes, subscriptions]);

  const refreshSourceById = async (sourceId: string) => {
    const source = subscriptions.find((subscription) => subscription.sourceId === sourceId);

    if (!source) {
      return;
    }

    try {
      const result = await refreshDiscoveredFeed({
        source: {
          sourceId: source.sourceId,
          feedUrl: source.feedUrl,
        },
        seenItemIds: cacheRef.current.sources[sourceId]?.seenItemIds ?? [],
      });

      setCache((current) => applySourceRefresh(current, result));
    } catch (error) {
      setCache((current) =>
        setSourceError(
          current,
          sourceId,
          error instanceof Error ? error.message : "This source could not be refreshed.",
        ),
      );
    }
  };

  const value = useMemo<FeedContextValue>(
    () => ({
      cache,
      isCacheReady,
      subscriptions,
      preferences,
      sourceSummaries: subscriptions.map((source) => {
        const items = getSourceItems(cache, source.sourceId);

        return {
          source,
          items,
          unreadCount: items.filter((item) => !item.isRead).length,
          newCount: items.filter((item) => item.isNew).length,
        };
      }),
      addFeed: async (inputUrl) => {
        const discovery = await discoverFeed(inputUrl);

        await createSubscription(discovery.source);
        setCache((current) => mergeSourceDiscovery(current, discovery));

        return discovery.source.sourceId;
      },
      removeFeed: async (sourceId) => {
        await removeSubscription({ sourceId });
        setCache((current) => removeSource(current, sourceId));
      },
      refreshSource: (sourceId) => refreshSourceById(sourceId),
      refreshAll: async () => {
        await Promise.all(
          subscriptions.map((subscription) => refreshSourceById(subscription.sourceId)),
        );
      },
      loadMore: async (sourceId) => {
        const pageUrl = cacheRef.current.sources[sourceId]?.pagination?.nextPageUrl;

        if (!pageUrl) {
          return;
        }

        const result = await loadMoreDiscoveredFeedItems({ sourceId, pageUrl });

        setCache((current) => applyLoadMoreSourceItems(current, result));
      },
      markRead: (sourceId, itemId) => {
        setCache((current) => markItemRead(current, sourceId, itemId));
      },
      getSource: (sourceId) =>
        subscriptions.find((subscription) => subscription.sourceId === sourceId),
      getSourceItems: (sourceId) => getSourceItems(cacheRef.current, sourceId),
      getItem: (sourceId, itemId) =>
        getSourceItems(cacheRef.current, sourceId).find((item) => item.id === itemId),
      ensureItem: async (sourceId, itemId) => {
        const existing = getSourceItems(cacheRef.current, sourceId).find(
          (item) => item.id === itemId,
        );

        if (existing) {
          return existing;
        }

        await refreshSourceById(sourceId);

        return getSourceItems(cacheRef.current, sourceId).find((item) => item.id === itemId);
      },
      updatePreferences: async (values) => {
        await upsertPreferences(values);
      },
    }),
    [
      cache,
      createSubscription,
      isCacheReady,
      preferences,
      removeSubscription,
      subscriptions,
      upsertPreferences,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export const useFeedData = () => {
  const value = useContext(FeedContext);

  if (!value) {
    throw new Error("useFeedData must be used within FeedProvider.");
  }

  return value;
};
