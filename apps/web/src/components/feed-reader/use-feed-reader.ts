import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConvexAuth } from "convex/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addSourceSuccessAtom,
  applyLoadMoreSourceItemsAtom,
  applySourceRefreshAtom,
  articleViewModeAtom,
  backToFeedListAtom,
  closeDetailPanelAtom,
  detailPanelAtom,
  detailPanelItemsAtom,
  detailPanelSourceSummaryAtom,
  feedReaderStateAtom,
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
import { recoverFromStaleDeployment } from "@/lib/deployment-recovery";
import { normalizeInputUrl } from "@/lib/feed/utils";
import { fetchFeedSource, loadMoreFeedItems } from "@/lib/server/feed";
import { discoveryResultSchema, type FeedItem, type SavedSource } from "@/lib/types";

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
  const previousSignedInRef = useRef(false);
  const detailPanelPagination =
    detailPanel.mode === "closed" ? undefined : state.paginationBySource[detailPanel.sourceId];
  const canReadUserData = convexAuth.isAuthenticated;
  const preferencesQuery = useQuery(
    convexQuery(api.preferences.queries.getForCurrentUser, canReadUserData ? {} : "skip"),
  );
  const bookmarksQuery = useQuery(
    convexQuery(api.bookmarks.queries.listForCurrentUser, canReadUserData ? {} : "skip"),
  );
  const feedSubscriptionsQuery = useQuery({
    ...convexQuery(api.feedSubscriptions.queries.listForCurrentUser, canReadUserData ? {} : "skip"),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const upsertPreferences = useConvexMutation(api.preferences.mutations.upsertForCurrentUser);
  const addFeedSubscription = useConvexMutation(api.feedSubscriptions.mutations.addForCurrentUser);
  const removeFeedSubscription = useConvexMutation(
    api.feedSubscriptions.mutations.removeForCurrentUser,
  );
  const toggleBookmark = useConvexMutation(api.bookmarks.mutations.toggleForCurrentUser);
  const preferenceMutation = useMutation({ mutationFn: upsertPreferences });
  const bookmarkMutation = useMutation({ mutationFn: toggleBookmark });
  const effectivePreferences = preferencesQuery.data ?? defaultUserPreferences;
  const effectivePollingIntervalMs = effectivePreferences.pollingIntervalMinutes * 60_000;
  const selectedSource =
    detailPanel.mode === "closed" ? undefined : detailPanelSourceSummary?.source;
  const bookmarkedUrls = new Set(bookmarksQuery.data?.map((bookmark) => bookmark.url) ?? []);

  useEffect(() => {
    if (previousSignedInRef.current && !canReadUserData) {
      setLocalArticleViewMode(defaultUserPreferences.defaultView);
    }

    previousSignedInRef.current = canReadUserData;
  }, [canReadUserData, setLocalArticleViewMode]);

  useEffect(() => {
    if (!canReadUserData || !feedSubscriptionsQuery.data) return;
    syncSourcesFromConvex(feedSubscriptionsQuery.data);
  }, [canReadUserData, feedSubscriptionsQuery.data, syncSourcesFromConvex]);

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

  const refreshingSourceIds = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["source-items"] })
    .filter((query) => query.state.fetchStatus === "fetching")
    .map((query) => String(query.queryKey[1]));

  const handleAddSource = () => {
    if (!sourceInput.trim()) return;
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
    handleSourceRefresh,
    handleSourceError,
    handleToggleBookmark,
    handleBookmarkItem,
    handleMarkUnread: (itemId: string) => markItemUnread(itemId),
  };
}
