import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useConvexAuth, useQuery as useConvexQuery } from "convex/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import {
  addSourceSuccessAtom,
  applyLoadMoreSourceItemsAtom,
  backToFeedListAtom,
  closeHomePanelAtom,
  currentBlogViewModeAtom,
  detailPanelAtom,
  feedReaderStateAtom,
  isReaderFullScreenAtom,
  openFeedAtom,
  openItemAtom,
  removeSourceAtom,
  setCurrentBlogViewModeAtom,
  showAddFormAtom,
  sourceInputAtom,
  toggleReaderFullScreenAtom,
} from "@/components/feed-reader/store";
import {
  applySourceRefresh,
  getSourceItems,
  markItemRead,
  markItemUnread,
  setSourceError,
  syncSourcesFromConvex,
} from "@/lib/feed-reader-state";
import { api } from "@/lib/convex";
import { defaultUserPreferences } from "@/lib/preferences";
import { queryKeys } from "@/lib/query/keys";
import { recoverFromStaleDeployment } from "@/lib/deployment-recovery";
import { normalizeInputUrl } from "@/lib/feed/utils";
import { fetchFeedSource, loadMoreFeedItems, refreshFeedSource } from "@/lib/server/feed";
import {
  discoveryResultSchema,
  type ArticleViewMode,
  type FeedItem,
  type FeedReaderState,
  type RefreshResult,
  type SavedSource,
} from "@/lib/types";

const withStaleDeploymentRecovery = async <Value>(load: () => Promise<Value>) => {
  try {
    return await load();
  } catch (error) {
    recoverFromStaleDeployment(error);
    throw error;
  }
};

const assertDiscoveryResult = (value: unknown) => discoveryResultSchema.parse(value);

export function useFeedReader() {
  const convexAuth = useConvexAuth();
  const queryClient = useQueryClient();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const baseState = useAtomValue(feedReaderStateAtom);
  const setFeedReaderState = useSetAtom(feedReaderStateAtom);
  const [sourceInput, setSourceInput] = useAtom(sourceInputAtom);
  const [showAddForm, setShowAddForm] = useAtom(showAddFormAtom);
  const detailPanel = useAtomValue(detailPanelAtom);
  const currentBlogViewMode = useAtomValue(currentBlogViewModeAtom);
  const isReaderFullScreen = useAtomValue(isReaderFullScreenAtom);
  const openFeed = useSetAtom(openFeedAtom);
  const openItem = useSetAtom(openItemAtom);
  const backToFeedList = useSetAtom(backToFeedListAtom);
  const closeHomePanel = useSetAtom(closeHomePanelAtom);
  const setCurrentBlogViewMode = useSetAtom(setCurrentBlogViewModeAtom);
  const toggleReaderFullScreen = useSetAtom(toggleReaderFullScreenAtom);
  const addSourceSuccess = useSetAtom(addSourceSuccessAtom);
  const removeFeedSource = useSetAtom(removeSourceAtom);
  const applyLoadMore = useSetAtom(applyLoadMoreSourceItemsAtom);
  const canReadUserData = !convexAuth.isLoading && convexAuth.isAuthenticated;
  const preferences = useConvexQuery(
    api.preferences.queries.getForCurrentUser,
    canReadUserData ? {} : "skip",
  );
  const bookmarks = useConvexQuery(
    api.bookmarks.queries.listForCurrentUser,
    canReadUserData ? {} : "skip",
  );
  const feedSubscriptions = useConvexQuery(
    api.feedSubscriptions.queries.listForCurrentUser,
    canReadUserData ? {} : "skip",
  );
  const upsertPreferences = useConvexMutation(api.preferences.mutations.upsertForCurrentUser);
  const addFeedSubscription = useConvexMutation(api.feedSubscriptions.mutations.addForCurrentUser);
  const removeFeedSubscription = useConvexMutation(
    api.feedSubscriptions.mutations.removeForCurrentUser,
  );
  const toggleBookmark = useConvexMutation(api.bookmarks.mutations.toggleForCurrentUser);
  const preferenceMutation = useMutation({ mutationFn: upsertPreferences });
  const bookmarkMutation = useMutation({ mutationFn: toggleBookmark });
  const effectivePreferences = preferences ?? defaultUserPreferences;
  const effectivePollingIntervalMs = effectivePreferences.pollingIntervalMinutes * 60_000;
  const syncedState =
    canReadUserData && feedSubscriptions
      ? syncSourcesFromConvex(baseState, feedSubscriptions)
      : baseState;
  const sourceRefreshQueries = useQueries({
    queries: syncedState.sources.map((source) => ({
      queryKey: queryKeys.sourceItems(source.id),
      queryFn: async () => {
        try {
          return await refreshFeedSource({
            data: {
              source,
              seenItemIds: syncedState.seenItemIdsBySource[source.id] ?? [],
            },
          });
        } catch (error) {
          recoverFromStaleDeployment(error);
          throw error;
        }
      },
      enabled: true,
      initialData:
        source.lastCheckedAt && (syncedState.itemsBySource[source.id] ?? []).length
          ? {
              sourceId: source.id,
              items: syncedState.itemsBySource[source.id] ?? [],
              newCount: 0,
              checkedAt: source.lastCheckedAt,
              nextPageUrl: syncedState.paginationBySource[source.id]?.nextPageUrl,
            }
          : undefined,
      initialDataUpdatedAt: source.lastCheckedAt ? Date.parse(source.lastCheckedAt) : undefined,
      refetchInterval: source.pollingEnabled ? source.pollIntervalMs : false,
      refetchIntervalInBackground: false,
    })),
  });
  const refreshedState = sourceRefreshQueries.reduce((currentState, query) => {
    if (!query.data) {
      return currentState;
    }

    return applySourceRefresh(currentState, query.data as RefreshResult);
  }, syncedState);
  const state = sourceRefreshQueries.reduce((currentState, query, index) => {
    if (!query.error) {
      return currentState;
    }

    const message =
      query.error instanceof Error
        ? query.error.message
        : "This source could not be refreshed right now.";

    return setSourceError(currentState, syncedState.sources[index]!.id, message);
  }, refreshedState);
  const sourceSummaries = state.sources.map((source) => {
    const items = getSourceItems(state, source.id);

    return {
      source,
      items,
      unreadCount: items.filter((item) => !item.isRead).length,
      newCount: items.filter((item) => item.isNew).length,
      itemCount: items.length,
    };
  });
  const totalNew = sourceSummaries.reduce((total, summary) => total + summary.newCount, 0);
  const detailPanelSourceSummary =
    detailPanel.mode === "closed"
      ? undefined
      : sourceSummaries.find((summary) => summary.source.id === detailPanel.sourceId);
  const detailPanelItems = detailPanelSourceSummary?.items ?? [];
  const selectedItem =
    detailPanel.mode === "reader"
      ? detailPanelItems.find((item) => item.id === detailPanel.itemId)
      : undefined;
  const detailPanelPagination =
    detailPanel.mode === "closed" ? undefined : state.paginationBySource[detailPanel.sourceId];
  const selectedSource =
    detailPanel.mode === "closed" ? undefined : detailPanelSourceSummary?.source;
  const bookmarkedUrls = new Set(bookmarks?.map((bookmark) => bookmark.url) ?? []);
  const articleViewMode =
    detailPanel.mode === "reader" && currentBlogViewMode
      ? currentBlogViewMode
      : effectivePreferences.defaultView;

  const updateFeedReaderState = (updater: (state: FeedReaderState) => FeedReaderState) => {
    setFeedReaderState((currentState) =>
      updater(
        canReadUserData && feedSubscriptions
          ? syncSourcesFromConvex(currentState, feedSubscriptions)
          : currentState,
      ),
    );
  };

  const addSourceMutation = useMutation({
    mutationFn: async (input: string) =>
      assertDiscoveryResult(
        await withStaleDeploymentRecovery(() =>
          fetchFeedSource({
            data: {
              url: normalizeInputUrl(input),
              pollIntervalMs: effectivePollingIntervalMs,
            },
          }),
        ),
      ),
    onMutate: () => {
      toast.loading("Checking feed...", { id: "add-feed" });
    },
    onSuccess: async (discovery) => {
      startTransition(() => {
        addSourceSuccess(discovery);
      });
      if (canReadUserData) {
        await addFeedSubscription({
          sourceId: discovery.source.id,
          label: discovery.source.label,
          inputUrl: discovery.source.inputUrl,
          siteUrl: discovery.source.siteUrl,
          feedUrl: discovery.source.feedUrl,
          pollingEnabled: discovery.source.pollingEnabled,
          pollIntervalMs: discovery.source.pollIntervalMs,
        });
      }
      toast.success(`Added ${discovery.source.label}.`, { id: "add-feed" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not add feed.", {
        id: "add-feed",
      });
    },
  });

  const loadMoreSourceItemsMutation = useMutation({
    mutationFn: ({ source, pageUrl }: { source: SavedSource; pageUrl: string }) =>
      withStaleDeploymentRecovery(() =>
        loadMoreFeedItems({
          data: { source, pageUrl },
        }),
      ),
    onSuccess: (result) => {
      startTransition(() => {
        applyLoadMore(result);
      });
    },
  });

  const refreshingSourceIds = syncedState.sources
    .filter((_, index) => sourceRefreshQueries[index]?.fetchStatus === "fetching")
    .map((source) => source.id);

  const handleAddSource = () => {
    if (!sourceInput.trim()) {
      return;
    }

    addSourceMutation.mutate(sourceInput);
  };

  const handleSetCurrentArticleViewMode = (mode: ArticleViewMode) => {
    setCurrentBlogViewMode({ route: "home", mode });
  };

  const handleSetDefaultArticleViewMode = async (mode: ArticleViewMode) => {
    if (!canReadUserData) {
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
    if (detailPanel.mode === "closed") {
      return;
    }

    updateFeedReaderState((currentState) =>
      markItemRead(currentState, detailPanel.sourceId, itemId),
    );
    openItem({
      sourceId: detailPanel.sourceId,
      itemId,
      defaultView: effectivePreferences.defaultView,
    });
  };

  const handleBackToList = () => {
    backToFeedList();
  };

  const handleCloseDetailPanel = () => {
    closeHomePanel();
  };

  const handleToggleFullScreen = () => {
    toggleReaderFullScreen();
  };

  const handleRefreshSource = async (sourceId: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sourceItems(sourceId) });
  };

  const handleRefreshAll = async () => {
    if (isRefreshingAll) {
      return;
    }

    setIsRefreshingAll(true);
    const sourceCount = syncedState.sources.length;
    const loadingMessage =
      sourceCount > 0
        ? `Refreshing ${sourceCount} feed${sourceCount === 1 ? "" : "s"}...`
        : "Refreshing feeds...";

    toast.loading(loadingMessage, { id: "refresh-all-feeds" });

    try {
      await queryClient.invalidateQueries({ queryKey: ["source-items"] });
      toast.success("Feeds refreshed.", { id: "refresh-all-feeds" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh feeds.", {
        id: "refresh-all-feeds",
      });
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    removeFeedSource(sourceId);
    void queryClient.removeQueries({ queryKey: queryKeys.sourceItems(sourceId) });
    if (canReadUserData) {
      await removeFeedSubscription({ sourceId });
    }
  };

  const handleLoadMoreDetailPanelItems = async (sourceId: string) => {
    const source = state.sources.find((entry) => entry.id === sourceId);
    const pagination = state.paginationBySource[sourceId];
    const pageUrl = pagination?.nextPageUrl;

    if (
      !source ||
      !pageUrl ||
      loadMoreSourceItemsMutation.isPending ||
      pagination.loadedPageUrls.includes(pageUrl)
    ) {
      return;
    }

    await loadMoreSourceItemsMutation.mutateAsync({ source, pageUrl });
  };

  const handleToggleBookmark = async () => {
    if (!canReadUserData || !selectedItem || !selectedSource || bookmarkMutation.isPending) {
      return;
    }

    await bookmarkMutation.mutateAsync({
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
    handleToggleBookmark,
    handleBookmarkItem,
    handleMarkUnread: (itemId: string) =>
      updateFeedReaderState((currentState) => markItemUnread(currentState, itemId)),
  };
}
