import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConvexAuth } from "convex/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startTransition, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import {
  addSourceSuccessAtom,
  applyLoadMoreSourceItemsAtom,
  applySourceRefreshAtom,
  articleViewModeAtom,
  backToFeedListAtom,
  closeDetailPanelAtom,
  currentUserIdAtom,
  detailPanelAtom,
  detailPanelItemsAtom,
  detailPanelSourceSummaryAtom,
  feedReaderStateAtom,
  feedSubscriptionsAtom,
  isReaderFullScreenAtom,
  markItemUnreadAtom,
  openFeedAtom,
  removeSourceAtom,
  selectItemAtom,
  selectedItemAtom,
  setSourceErrorAtom,
  showAddFormAtom,
  sourceInputAtom,
  sourceSummariesAtom,
  syncSourcesFromConvexAtom,
  toggleReaderFullScreenAtom,
  totalNewAtom,
} from "@/components/feed-reader/store";
import { api } from "@/lib/convex";
import { defaultUserPreferences } from "@/lib/preferences";
import { queryKeys } from "@/lib/query/keys";
import {
  extractLegacyFeedSubscriptions,
  migrateLegacyFeedReaderState,
  parseLegacyFeedReaderState,
  reconcileLocalFeedCache,
} from "@/lib/feed-reader-state";
import { normalizeInputUrl } from "@/lib/feed/utils";
import { getBrowserStorage } from "@/lib/browser-storage";
import { discoverFeed, loadMoreDiscoveredFeedItems } from "@repo/shared/feed/service";
import { FEED_READER_STATE_STORAGE_KEY, type FeedItem } from "@/lib/types";

export function useFeedReader() {
  const convexAuth = useConvexAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const state = useAtomValue(feedReaderStateAtom);
  const [sourceInput, setSourceInput] = useAtom(sourceInputAtom);
  const [showAddForm, setShowAddForm] = useAtom(showAddFormAtom);
  const [articleViewMode, setLocalArticleViewMode] = useAtom(articleViewModeAtom);
  const detailPanel = useAtomValue(detailPanelAtom);
  const isReaderFullScreen = useAtomValue(isReaderFullScreenAtom);
  const sourceSummaries = useAtomValue(sourceSummariesAtom);
  const detailPanelSourceSummary = useAtomValue(detailPanelSourceSummaryAtom);
  const detailPanelItems = useAtomValue(detailPanelItemsAtom);
  const selectedItem = useAtomValue(selectedItemAtom);
  const totalNew = useAtomValue(totalNewAtom);
  const openFeed = useSetAtom(openFeedAtom);
  const selectItem = useSetAtom(selectItemAtom);
  const markItemUnread = useSetAtom(markItemUnreadAtom);
  const backToFeedList = useSetAtom(backToFeedListAtom);
  const closeDetailPanel = useSetAtom(closeDetailPanelAtom);
  const toggleReaderFullScreen = useSetAtom(toggleReaderFullScreenAtom);
  const addSourceSuccess = useSetAtom(addSourceSuccessAtom);
  const removeFeedSource = useSetAtom(removeSourceAtom);
  const syncSourcesFromConvex = useSetAtom(syncSourcesFromConvexAtom);
  const applyLoadMore = useSetAtom(applyLoadMoreSourceItemsAtom);
  const applyRefresh = useSetAtom(applySourceRefreshAtom);
  const setFeedSourceError = useSetAtom(setSourceErrorAtom);
  const setCurrentUserId = useSetAtom(currentUserIdAtom);
  const setFeedSubscriptions = useSetAtom(feedSubscriptionsAtom);
  const setFeedReaderState = useSetAtom(feedReaderStateAtom);
  const previousSignedInRef = useRef(false);
  const isMigrationInFlightRef = useRef(false);
  const detailPanelPagination =
    detailPanel.mode === "closed" ? undefined : state.sources[detailPanel.sourceId]?.pagination;
  const canReadUserData = convexAuth.isAuthenticated;
  const userId = canReadUserData ? (user?.id ?? null) : null;
  const preferencesQuery = useQuery(
    convexQuery(api.preferences.queries.getForCurrentUser, canReadUserData ? {} : "skip"),
  );
  const subscriptionsQuery = useQuery(
    convexQuery(api.feedSubscriptions.queries.listForCurrentUser, canReadUserData ? {} : "skip"),
  );
  const bookmarksQuery = useQuery(
    convexQuery(api.bookmarks.queries.listForCurrentUser, canReadUserData ? {} : "skip"),
  );
  const feedSubscriptionsQuery = useQuery({
    ...convexQuery(api.feedSubscriptions.queries.listForCurrentUser, canReadUserData ? {} : "skip"),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const upsertPreferences = useConvexMutation(api.preferences.mutations.upsertForCurrentUser);
  const toggleBookmark = useConvexMutation(api.bookmarks.mutations.toggleForCurrentUser);
  const createSubscription = useConvexMutation(
    api.feedSubscriptions.mutations.createForCurrentUser,
  );
  const removeSubscription = useConvexMutation(
    api.feedSubscriptions.mutations.removeForCurrentUser,
  );
  const importSubscriptions = useConvexMutation(
    api.feedSubscriptions.mutations.importForCurrentUser,
  );
  const preferenceMutation = useMutation({ mutationFn: upsertPreferences });
  const bookmarkMutation = useMutation({ mutationFn: toggleBookmark });
  const removeSubscriptionMutation = useMutation({
    mutationFn: removeSubscription,
    onSuccess: (_result, { sourceId }) => {
      startTransition(() => {
        removeFeedSource(sourceId);
      });
      void queryClient.removeQueries({ queryKey: queryKeys.sourceItems(sourceId) });
    },
  });
  const effectivePreferences = preferencesQuery.data ?? defaultUserPreferences;
  const effectivePollingIntervalMs = effectivePreferences.pollingIntervalMinutes * 60_000;
  const selectedSource =
    detailPanel.mode === "closed" ? undefined : detailPanelSourceSummary?.source;
  const bookmarkedUrls = new Set(bookmarksQuery.data?.map((bookmark) => bookmark.url) ?? []);

  useEffect(() => {
    setCurrentUserId(userId);

    return () => {
      setCurrentUserId(null);
    };
  }, [setCurrentUserId, userId]);

  useEffect(() => {
    setFeedSubscriptions(subscriptionsQuery.data ?? []);
  }, [setFeedSubscriptions, subscriptionsQuery.data]);

  useEffect(() => {
    if (!subscriptionsQuery.data) {
      return;
    }

    startTransition(() => {
      setFeedReaderState((current) =>
        reconcileLocalFeedCache(
          current,
          subscriptionsQuery.data.map((subscription) => subscription.sourceId),
        ),
      );
    });
  }, [setFeedReaderState, subscriptionsQuery.data]);

  useEffect(() => {
    if (previousSignedInRef.current && !canReadUserData) {
      setLocalArticleViewMode(defaultUserPreferences.defaultView);
      setFeedSubscriptions([]);
    }

    previousSignedInRef.current = canReadUserData;
  }, [canReadUserData, setFeedSubscriptions, setLocalArticleViewMode]);

  useEffect(() => {
    if (
      !canReadUserData ||
      !userId ||
      subscriptionsQuery.isPending ||
      isMigrationInFlightRef.current ||
      Object.keys(state.sources).length > 0
    ) {
      return;
    }

    const browserStorage = getBrowserStorage();
    const rawValue = browserStorage?.getItem(FEED_READER_STATE_STORAGE_KEY);

    if (!rawValue) {
      return;
    }

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      return;
    }

    const legacyState = parseLegacyFeedReaderState(parsedValue);

    if (!legacyState) {
      return;
    }

    const migratedState = migrateLegacyFeedReaderState(legacyState);
    const legacySubscriptions = extractLegacyFeedSubscriptions(legacyState);

    isMigrationInFlightRef.current = true;

    void (async () => {
      try {
        if (legacySubscriptions.length > 0) {
          await importSubscriptions({
            subscriptions: legacySubscriptions,
          });
        }

        startTransition(() => {
          setFeedReaderState(migratedState);
        });
        browserStorage?.removeItem(FEED_READER_STATE_STORAGE_KEY);
      } finally {
        isMigrationInFlightRef.current = false;
      }
    })();
  }, [
    canReadUserData,
    importSubscriptions,
    setFeedReaderState,
    state.sources,
    subscriptionsQuery.isPending,
    userId,
  ]);

  useEffect(() => {
    if (!canReadUserData || !feedSubscriptionsQuery.data) return;
    syncSourcesFromConvex(feedSubscriptionsQuery.data);
  }, [canReadUserData, feedSubscriptionsQuery.data, syncSourcesFromConvex]);

  const addSourceMutation = useMutation({
    mutationFn: async (input: string) => {
      if (!canReadUserData) {
        throw new Error("Authentication required.");
      }

      const discovery = await discoverFeed(normalizeInputUrl(input));

      await createSubscription(discovery.source);

      return discovery;
    },
    onSuccess: (discovery) => {
      startTransition(() => {
        addSourceSuccess(discovery);
      });
    },
  });

  const loadMoreSourceItemsMutation = useMutation({
    mutationFn: ({ sourceId, pageUrl }: { sourceId: string; pageUrl: string }) =>
      loadMoreDiscoveredFeedItems({ sourceId, pageUrl }),
    onSuccess: (result) => {
      startTransition(() => {
        applyLoadMore(result);
      });
    },
  });

  const refreshingSourceIds = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["source-items"] })
    .filter((query) => query.state.fetchStatus === "fetching")
    .map((query) => String(query.queryKey[1]));

  const handleAddSource = () => {
    if (!sourceInput.trim()) {
      return;
    }

    addSourceMutation.mutate(sourceInput);
  };

  const handleSetCurrentArticleViewMode = (mode: typeof articleViewMode) => {
    setLocalArticleViewMode(mode);
  };

  const handleSetDefaultArticleViewMode = async (mode: typeof articleViewMode) => {
    if (!canReadUserData) {
      setLocalArticleViewMode(mode);
      return;
    }

    await preferenceMutation.mutateAsync({
      pollingIntervalMinutes: effectivePreferences.pollingIntervalMinutes,
      defaultView: mode,
    });
  };

  const handleSetPollingIntervalMinutes = async (pollingIntervalMinutes: number) => {
    if (
      !canReadUserData ||
      !Number.isInteger(pollingIntervalMinutes) ||
      pollingIntervalMinutes < 1
    ) {
      return;
    }

    await preferenceMutation.mutateAsync({
      pollingIntervalMinutes,
      defaultView: effectivePreferences.defaultView,
    });
  };

  const handleOpenFeed = (sourceId: string) => {
    openFeed(sourceId);
  };

  const handleSelectItem = (itemId: string) => {
    setLocalArticleViewMode(effectivePreferences.defaultView);
    selectItem(itemId);
  };

  const handleBackToList = () => {
    backToFeedList();
  };

  const handleCloseDetailPanel = () => {
    closeDetailPanel();
  };

  const handleToggleFullScreen = () => {
    toggleReaderFullScreen();
  };

  const handleRefreshSource = async (sourceId: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sourceItems(sourceId) });
  };

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);

    try {
      await queryClient.invalidateQueries({ queryKey: ["source-items"] });
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    await removeSubscriptionMutation.mutateAsync({ sourceId });
  };

  const handleLoadMoreDetailPanelItems = async (sourceId: string) => {
    const pagination = state.sources[sourceId]?.pagination;
    const pageUrl = pagination?.nextPageUrl;

    if (
      !pageUrl ||
      loadMoreSourceItemsMutation.isPending ||
      pagination.loadedPageUrls.includes(pageUrl)
    ) {
      return;
    }

    await loadMoreSourceItemsMutation.mutateAsync({ sourceId, pageUrl });
  };

  const handleSourceRefresh = (result: Parameters<typeof applyRefresh>[0], _sourceId: string) => {
    applyRefresh(result);
  };

  const handleSourceError = (sourceId: string, message: string) => {
    setFeedSourceError({ sourceId, message });
  };

  const handleToggleBookmark = async () => {
    if (!canReadUserData || !selectedItem || !selectedSource || bookmarkMutation.isPending) {
      return;
    }

    await bookmarkMutation.mutateAsync({
      sourceId: selectedSource.sourceId,
      itemId: selectedItem.id,
      url: selectedItem.url,
      title: selectedItem.title,
      excerpt: selectedItem.excerpt,
      imageUrl: selectedItem.imageUrl,
      sourceLabel: selectedSource.label,
      sourceSiteUrl: selectedSource.siteUrl,
      publishedAt: selectedItem.publishedAt,
    });
  };

  const handleBookmarkItem = async (
    item: { url: string; title: string; excerpt?: string; imageUrl?: string; publishedAt?: string },
    source: { label: string; siteUrl: string },
  ) => {
    if (!canReadUserData || bookmarkMutation.isPending) {
      return;
    }

    await bookmarkMutation.mutateAsync({
      url: item.url,
      title: item.title,
      excerpt: item.excerpt,
      imageUrl: item.imageUrl,
      sourceLabel: source.label,
      sourceSiteUrl: source.siteUrl,
      publishedAt: item.publishedAt,
    });
  };

  return {
    state,
    sourceInput,
    showAddForm,
    detailPanel,
    sourceSummaries,
    detailPanelSourceSummary,
    detailPanelItems,
    detailPanelPagination,
    selectedItem,
    selectedSource,
    articleViewMode,
    preferences: effectivePreferences,
    isPreferencesPending: preferenceMutation.isPending,
    effectivePollingIntervalMs,
    isAuthLoading: convexAuth.isLoading,
    isSignedIn: canReadUserData,
    isBookmarked: selectedItem ? bookmarkedUrls.has(selectedItem.url) : false,
    isItemBookmarked: (item: FeedItem) => bookmarkedUrls.has(item.url),
    isBookmarkPending: bookmarkMutation.isPending,
    refreshingSourceIds,
    isRefreshingAll,
    isLoadingMoreDetailPanelItems: loadMoreSourceItemsMutation.isPending,
    totalNew,
    addSourceError:
      addSourceMutation.error instanceof Error ? addSourceMutation.error.message : undefined,
    isAddingSource: addSourceMutation.isPending,
    isReaderFullScreen,
    setSourceInput,
    setShowAddForm,
    setArticleViewMode: handleSetCurrentArticleViewMode,
    setDefaultArticleViewMode: handleSetDefaultArticleViewMode,
    setPollingIntervalMinutes: handleSetPollingIntervalMinutes,
    handleAddSource,
    handleOpenFeed,
    handleSelectItem,
    handleBackToList,
    handleCloseDetailPanel,
    handleRefreshSource,
    handleRefreshAll,
    handleRemoveSource,
    handleLoadMoreDetailPanelItems,
    handleToggleFullScreen,
    handleSourceRefresh,
    handleSourceError,
    handleToggleBookmark,
    handleBookmarkItem,
    handleMarkUnread: (itemId: string) => markItemUnread(itemId),
  };
}
