import { useEffect, useRef, useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useAction, useConvexAuth, useQuery as useConvexQuery } from "convex/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startTransition } from "react";
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
import { useProfiles } from "@/components/feed-reader/use-profiles";
import {
  getCachedFeedReaderData,
  markItemRead,
  markItemUnread,
  markItemsSeen,
  pruneRemovedSources,
  shouldRefreshSource,
  SOURCE_STALE_TTL_MS,
  upsertSourceItems,
  upsertSourceMeta,
} from "@/lib/feed-reader-db";
import {
  applySourceRefresh,
  createEmptyFeedReaderState,
  getSourceItems,
  setSourceError,
  syncSourcesFromConvex,
  type FeedItemStateMap,
} from "@/lib/feed-reader-state";
import { api, type Id } from "@/lib/convex";
import { normalizeInputUrl } from "@/lib/feed/utils";
import { defaultUserPreferences } from "@/lib/preferences";
import {
  discoveryResultSchema,
  type ArticleViewMode,
  type FeedItem,
  type FeedReaderState,
  type RefreshResult,
  type SavedSource,
} from "@/lib/types";

const assertDiscoveryResult = (value: unknown) => discoveryResultSchema.parse(value);

const mergeCachedState = (
  state: FeedReaderState,
  metaBySource: Record<
    string,
    {
      lastCheckedAt?: string;
      lastError?: string;
      loadedPageUrls: string[];
      nextPageUrl?: string;
    }
  >,
  itemsBySource: FeedReaderState["itemsBySource"],
) => ({
  ...state,
  sources: state.sources.map((source) => ({
    ...source,
    lastCheckedAt: metaBySource[source.id]?.lastCheckedAt ?? source.lastCheckedAt,
    lastError: metaBySource[source.id]?.lastError,
  })),
  itemsBySource,
  paginationBySource: Object.fromEntries(
    state.sources.map((source) => [
      source.id,
      {
        loadedPageUrls: metaBySource[source.id]?.loadedPageUrls ?? [source.feedUrl],
        nextPageUrl: metaBySource[source.id]?.nextPageUrl,
      },
    ]),
  ),
});

const setItemStateEntry = (
  itemStateBySource: Record<string, FeedItemStateMap>,
  sourceId: string,
  itemId: string,
  nextState: { isRead: boolean; isSeen: boolean },
) => ({
  ...itemStateBySource,
  [sourceId]: {
    ...(itemStateBySource[sourceId] ?? {}),
    [itemId]: nextState,
  },
});

export function useFeedReader() {
  const convexAuth = useConvexAuth();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingSourceIds, setRefreshingSourceIds] = useState<string[]>([]);
  const [itemStateBySource, setItemStateBySource] = useState<Record<string, FeedItemStateMap>>({});
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
  const {
    profiles,
    selectedProfile,
    selectedProfileId,
    isProfilesLoading,
    isCreatingProfile,
    isRenamingProfile,
    selectProfile,
    createNewProfile,
    renameCurrentProfile,
  } = useProfiles(canReadUserData);
  const canReadSelectedProfile = canReadUserData && selectedProfileId !== null;
  const preferences = useConvexQuery(
    api.preferences.queries.getForCurrentUser,
    canReadUserData ? {} : "skip",
  );
  const bookmarks = useConvexQuery(
    api.bookmarks.queries.listForCurrentUser,
    canReadUserData && selectedProfileId ? { profileId: selectedProfileId } : "skip",
  );
  const feedSubscriptions = useConvexQuery(
    api.feedSubscriptions.queries.listForCurrentUser,
    canReadUserData && selectedProfileId ? { profileId: selectedProfileId } : "skip",
  );
  const setPollingIntervalPreference = useConvexMutation(
    api.preferences.mutations.setPollingIntervalForCurrentUser,
  );
  const setDefaultViewPreference = useConvexMutation(
    api.preferences.mutations.setDefaultViewForCurrentUser,
  );
  const addFeedSubscription = useConvexMutation(api.feedSubscriptions.mutations.addForCurrentUser);
  const removeFeedSubscription = useConvexMutation(
    api.feedSubscriptions.mutations.removeForCurrentUser,
  );
  const toggleBookmark = useConvexMutation(api.bookmarks.mutations.toggleForCurrentUser);
  const discoverFeedSource = useAction(api.feed.actions.fetchSource);
  const refreshFeedSource = useAction(api.feed.actions.refreshSource);
  const loadMoreFeedItems = useAction(api.feed.actions.loadMoreItems);
  const pollingIntervalMutation = useMutation({ mutationFn: setPollingIntervalPreference });
  const defaultViewMutation = useMutation({ mutationFn: setDefaultViewPreference });
  const bookmarkMutation = useMutation({ mutationFn: toggleBookmark });
  const effectivePreferences = preferences ?? defaultUserPreferences;
  const effectivePollingIntervalMs = effectivePreferences.pollingIntervalMinutes * 60_000;
  const state =
    canReadSelectedProfile && feedSubscriptions
      ? syncSourcesFromConvex(baseState, feedSubscriptions)
      : canReadUserData
        ? createEmptyFeedReaderState()
        : baseState;
  const isHydrationPending =
    convexAuth.isLoading ||
    (canReadUserData &&
      (isProfilesLoading || selectedProfileId === null || feedSubscriptions === undefined));
  const stateRef = useRef(state);
  const selectedProfileIdRef = useRef<Id<"profiles"> | null>(selectedProfileId);
  const previousProfileIdRef = useRef<Id<"profiles"> | null>(null);
  const itemStateBySourceRef = useRef(itemStateBySource);
  const hydrateSourcesRef = useRef<SavedSource[]>([]);
  const hydrateSourceIdsRef = useRef<string[]>([]);
  const refreshSourceNowRef = useRef<(source: SavedSource, force?: boolean) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    selectedProfileIdRef.current = selectedProfileId;
  }, [selectedProfileId]);

  useEffect(() => {
    if (
      previousProfileIdRef.current &&
      selectedProfileId &&
      previousProfileIdRef.current !== selectedProfileId
    ) {
      closeHomePanel();
      setItemStateBySource({});
      setFeedReaderState(createEmptyFeedReaderState());
    }

    previousProfileIdRef.current = selectedProfileId;
  }, [closeHomePanel, selectedProfileId, setFeedReaderState]);

  useEffect(() => {
    itemStateBySourceRef.current = itemStateBySource;
  }, [itemStateBySource]);

  const hydrateSources =
    canReadSelectedProfile && feedSubscriptions ? feedSubscriptions : state.sources;
  const hydrateSourceIds = hydrateSources.map((source) => source.id);
  hydrateSourcesRef.current = hydrateSources;
  hydrateSourceIdsRef.current = hydrateSourceIds;
  const hydrateSourceKey = hydrateSourceIds.join("|");

  const persistRefreshResult = async (source: SavedSource, result: RefreshResult) => {
    const loadedPageUrls = stateRef.current.paginationBySource[source.id]?.loadedPageUrls ?? [
      source.feedUrl,
    ];

    await Promise.all([
      upsertSourceItems(source.id, result.items),
      upsertSourceMeta({
        sourceId: source.id,
        lastFetchedAt: Date.now(),
        lastCheckedAt: result.checkedAt,
        nextPageUrl: result.nextPageUrl,
        loadedPageUrls,
      }),
    ]);

    setFeedReaderState((currentState) => applySourceRefresh(currentState, result));
  };

  const refreshSourceNow = async (source: SavedSource, force = false) => {
    setRefreshingSourceIds((current) =>
      current.includes(source.id) ? current : [...current, source.id],
    );

    try {
      if (!force && !(await shouldRefreshSource(source.id, SOURCE_STALE_TTL_MS))) {
        return;
      }

      const seenItemIds = Object.entries(itemStateBySourceRef.current[source.id] ?? {})
        .filter(([, entry]) => entry.isSeen)
        .map(([itemId]) => itemId);
      const result = await refreshFeedSource({
        sourceId: source.id,
        feedUrl: source.feedUrl,
        seenItemIds,
      });

      await persistRefreshResult(source, result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "This source could not be refreshed right now.";
      const pagination = stateRef.current.paginationBySource[source.id];

      await upsertSourceMeta({
        sourceId: source.id,
        lastFetchedAt:
          (await getCachedFeedReaderData([source.id])).metaBySource[source.id]?.lastFetchedAt ?? 0,
        lastCheckedAt:
          stateRef.current.sources.find((entry) => entry.id === source.id)?.lastCheckedAt ??
          undefined,
        nextPageUrl: pagination?.nextPageUrl,
        loadedPageUrls: pagination?.loadedPageUrls ?? [source.feedUrl],
        lastError: message,
      });
      setFeedReaderState((currentState) => setSourceError(currentState, source.id, message));
    } finally {
      setRefreshingSourceIds((current) => current.filter((sourceId) => sourceId !== source.id));
    }
  };
  refreshSourceNowRef.current = refreshSourceNow;

  useEffect(() => {
    if (isHydrationPending) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      const sourcesToHydrate = hydrateSourcesRef.current;
      const sourceIdsToHydrate = hydrateSourceIdsRef.current;

      await pruneRemovedSources(sourceIdsToHydrate);
      const cached = await getCachedFeedReaderData(sourceIdsToHydrate);

      if (isCancelled) {
        return;
      }

      setItemStateBySource(cached.itemStateBySource);
      setFeedReaderState((currentState) =>
        mergeCachedState(
          canReadSelectedProfile
            ? syncSourcesFromConvex(currentState, sourcesToHydrate)
            : currentState,
          cached.metaBySource,
          cached.itemsBySource,
        ),
      );

      await Promise.all(
        sourcesToHydrate.map(async (source) => {
          if (await shouldRefreshSource(source.id, SOURCE_STALE_TTL_MS)) {
            await refreshSourceNowRef.current(source);
          }
        }),
      );
    })();

    return () => {
      isCancelled = true;
    };
  }, [canReadSelectedProfile, hydrateSourceKey, isHydrationPending, setFeedReaderState]);

  const sourceSummaries = state.sources.map((source) => {
    const items = getSourceItems(state, source.id, itemStateBySource[source.id]);
    let unreadCount = 0;
    let newCount = 0;

    for (const item of items) {
      if (!item.isRead) {
        unreadCount += 1;
      }

      if (item.isNew) {
        newCount += 1;
      }
    }

    return {
      source,
      items,
      unreadCount,
      newCount,
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
  const isSourcesLoading =
    convexAuth.isLoading ||
    (canReadUserData &&
      (isProfilesLoading || selectedProfileId === null || feedSubscriptions === undefined));

  const addSourceMutation = useMutation({
    mutationFn: async ({ input }: { input: string; profileId: Id<"profiles"> | null }) =>
      assertDiscoveryResult(
        await discoverFeedSource({
          url: normalizeInputUrl(input),
          pollIntervalMs: effectivePollingIntervalMs,
        }),
      ),
    onMutate: () => {
      toast.loading("Checking feed...", { id: "add-feed" });
    },
    onSuccess: async (discovery, variables) => {
      await Promise.all([
        upsertSourceItems(discovery.source.id, discovery.items),
        upsertSourceMeta({
          sourceId: discovery.source.id,
          lastFetchedAt: Date.now(),
          lastCheckedAt: discovery.checkedAt,
          nextPageUrl: discovery.nextPageUrl,
          loadedPageUrls: [discovery.source.feedUrl],
        }),
        markItemsSeen(
          discovery.source.id,
          discovery.items.map((item) => item.id),
        ),
      ]);

      setItemStateBySource((current) => ({
        ...current,
        [discovery.source.id]: Object.fromEntries(
          discovery.items.map((item) => [item.id, { isRead: false, isSeen: true }]),
        ),
      }));

      if (variables.profileId === selectedProfileIdRef.current || variables.profileId === null) {
        startTransition(() => {
          addSourceSuccess(discovery);
        });
      }

      if (variables.profileId) {
        await addFeedSubscription({
          profileId: variables.profileId,
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
      loadMoreFeedItems({
        sourceId: source.id,
        pageUrl,
      }),
    onSuccess: async (result, variables) => {
      await Promise.all([
        upsertSourceItems(result.sourceId, result.items),
        upsertSourceMeta({
          sourceId: result.sourceId,
          lastFetchedAt:
            (await getCachedFeedReaderData([result.sourceId])).metaBySource[result.sourceId]
              ?.lastFetchedAt ?? Date.now(),
          lastCheckedAt: stateRef.current.sources.find((source) => source.id === result.sourceId)
            ?.lastCheckedAt,
          nextPageUrl: result.nextPageUrl,
          loadedPageUrls: [
            ...(stateRef.current.paginationBySource[result.sourceId]?.loadedPageUrls ?? [
              variables.source.feedUrl,
            ]),
            result.pageUrl,
          ].filter((value, index, values) => values.indexOf(value) === index),
        }),
      ]);

      startTransition(() => {
        applyLoadMore(result);
      });
    },
  });

  const handleAddSource = () => {
    if (!sourceInput.trim()) {
      return;
    }

    const profileId = selectedProfileIdRef.current;

    if (canReadUserData && !profileId) {
      return;
    }

    addSourceMutation.mutate({
      input: sourceInput,
      profileId,
    });
  };

  const handleSetCurrentArticleViewMode = (mode: ArticleViewMode) => {
    setCurrentBlogViewMode({ route: "home", mode });
  };

  const handleSetDefaultArticleViewMode = async (mode: ArticleViewMode) => {
    if (!canReadUserData) {
      return;
    }

    await defaultViewMutation.mutateAsync({
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

    await pollingIntervalMutation.mutateAsync({
      pollingIntervalMinutes,
    });
  };

  const handleOpenFeed = (sourceId: string) => {
    openFeed(sourceId);
  };

  const handleSelectItem = (itemId: string) => {
    if (detailPanel.mode === "closed") {
      return;
    }

    setItemStateBySource((current) =>
      setItemStateEntry(current, detailPanel.sourceId, itemId, {
        isRead: true,
        isSeen: true,
      }),
    );
    void markItemRead(detailPanel.sourceId, itemId);
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
    const source = state.sources.find((entry) => entry.id === sourceId);

    if (!source) {
      return;
    }

    await refreshSourceNow(source, true);
  };

  const handleRefreshAll = async () => {
    if (isRefreshingAll) {
      return;
    }

    setIsRefreshingAll(true);
    const sourceCount = state.sources.length;
    const loadingMessage =
      sourceCount > 0
        ? `Refreshing ${sourceCount} feed${sourceCount === 1 ? "" : "s"}...`
        : "Refreshing feeds...";

    toast.loading(loadingMessage, { id: "refresh-all-feeds" });

    try {
      await Promise.all(state.sources.map((source) => refreshSourceNow(source, true)));
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
    setItemStateBySource((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([currentSourceId]) => currentSourceId !== sourceId),
      ),
    );
    await pruneRemovedSources(
      state.sources.filter((source) => source.id !== sourceId).map((source) => source.id),
    );

    if (selectedProfileIdRef.current) {
      await removeFeedSubscription({
        profileId: selectedProfileIdRef.current,
        sourceId,
      });
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
    if (
      !selectedProfileId ||
      !canReadUserData ||
      !selectedItem ||
      !selectedSource ||
      bookmarkMutation.isPending
    ) {
      return;
    }

    await bookmarkMutation.mutateAsync({
      profileId: selectedProfileId,
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
    if (!selectedProfileId || !canReadUserData || bookmarkMutation.isPending) {
      return;
    }

    await bookmarkMutation.mutateAsync({
      profileId: selectedProfileId,
      url: item.url,
      title: item.title,
      excerpt: item.excerpt,
      imageUrl: item.imageUrl,
      sourceLabel: source.label,
      sourceSiteUrl: source.siteUrl,
      publishedAt: item.publishedAt,
    });
  };

  const handleMarkUnread = (itemId: string) => {
    if (detailPanel.mode === "closed") {
      return;
    }

    setItemStateBySource((current) =>
      setItemStateEntry(current, detailPanel.sourceId, itemId, {
        isRead: false,
        isSeen: true,
      }),
    );
    void markItemUnread(detailPanel.sourceId, itemId);
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
    profiles,
    selectedProfile,
    selectedProfileId,
    isProfilesLoading,
    isCreatingProfile,
    isRenamingProfile,
    isDefaultViewPending: defaultViewMutation.isPending,
    isPollingIntervalPending: pollingIntervalMutation.isPending,
    effectivePollingIntervalMs,
    isSignedIn: canReadUserData,
    isBookmarked: selectedItem ? bookmarkedUrls.has(selectedItem.url) : false,
    isItemBookmarked: (item: FeedItem) => bookmarkedUrls.has(item.url),
    isBookmarkPending: bookmarkMutation.isPending,
    isSourcesLoading,
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
    selectProfile,
    createNewProfile,
    renameCurrentProfile,
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
    handleMarkUnread,
  };
}
