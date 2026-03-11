import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startTransition, useState } from "react";
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
  openFeedAtom,
  removeSourceAtom,
  selectItemAtom,
  selectedItemAtom,
  setSourceErrorAtom,
  showAddFormAtom,
  sourceInputAtom,
  sourceSummariesAtom,
  toggleReaderFullScreenAtom,
  totalNewAtom,
} from "@/components/feed-reader/store";
import { queryKeys } from "@/lib/query/keys";
import {
  discoverSource,
  fetchArticle,
  inspectArticleEmbed,
  loadMoreSourceItems,
} from "@/lib/server/feed";
import { recoverFromStaleDeployment } from "@/lib/deployment-recovery";
import type { ArticleViewMode, FeedItem, SavedSource } from "@/lib/types";

const ARTICLE_EMBED_STALE_TIME_MS = 30 * 60_000;
const ARTICLE_EMBED_GC_TIME_MS = 24 * 60 * 60_000;

export const shouldFetchReaderArticle = (
  selectedItem: FeedItem | undefined,
  articleViewMode: ArticleViewMode,
) => Boolean(selectedItem) && articleViewMode === "reader";

export const shouldInspectArticleEmbed = (selectedItem: FeedItem | undefined) =>
  Boolean(selectedItem);

const withStaleDeploymentRecovery = async <Value>(load: () => Promise<Value>) => {
  try {
    return await load();
  } catch (error) {
    recoverFromStaleDeployment(error);
    throw error;
  }
};

export function useFeedReader() {
  const queryClient = useQueryClient();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const state = useAtomValue(feedReaderStateAtom);
  const [sourceInput, setSourceInput] = useAtom(sourceInputAtom);
  const [showAddForm, setShowAddForm] = useAtom(showAddFormAtom);
  const [articleViewMode, setArticleViewMode] = useAtom(articleViewModeAtom);
  const detailPanel = useAtomValue(detailPanelAtom);
  const isReaderFullScreen = useAtomValue(isReaderFullScreenAtom);
  const sourceSummaries = useAtomValue(sourceSummariesAtom);
  const detailPanelSourceSummary = useAtomValue(detailPanelSourceSummaryAtom);
  const detailPanelItems = useAtomValue(detailPanelItemsAtom);
  const selectedItem = useAtomValue(selectedItemAtom);
  const totalNew = useAtomValue(totalNewAtom);
  const openFeed = useSetAtom(openFeedAtom);
  const selectItem = useSetAtom(selectItemAtom);
  const backToFeedList = useSetAtom(backToFeedListAtom);
  const closeDetailPanel = useSetAtom(closeDetailPanelAtom);
  const toggleReaderFullScreen = useSetAtom(toggleReaderFullScreenAtom);
  const addSourceSuccess = useSetAtom(addSourceSuccessAtom);
  const removeFeedSource = useSetAtom(removeSourceAtom);
  const applyLoadMore = useSetAtom(applyLoadMoreSourceItemsAtom);
  const applyRefresh = useSetAtom(applySourceRefreshAtom);
  const setFeedSourceError = useSetAtom(setSourceErrorAtom);
  const detailPanelPagination =
    detailPanel.mode === "closed" ? undefined : state.paginationBySource[detailPanel.sourceId];

  // ── Article query ────────────────────────────────────────────────
  const articleQuery = useQuery({
    queryKey: selectedItem ? queryKeys.article(selectedItem.id) : ["article", "empty"],
    queryFn: () =>
      withStaleDeploymentRecovery(() =>
        fetchArticle({
          data: { itemId: selectedItem!.id, url: selectedItem!.url },
        }),
      ),
    enabled: shouldFetchReaderArticle(selectedItem, articleViewMode),
    staleTime: Infinity,
  });
  const articleEmbedQuery = useQuery({
    queryKey: selectedItem ? queryKeys.articleEmbed(selectedItem.url) : ["article-embed", "empty"],
    queryFn: () =>
      withStaleDeploymentRecovery(() =>
        inspectArticleEmbed({
          data: { itemId: selectedItem!.id, url: selectedItem!.url },
        }),
      ),
    enabled: shouldInspectArticleEmbed(selectedItem),
    staleTime: ARTICLE_EMBED_STALE_TIME_MS,
    gcTime: ARTICLE_EMBED_GC_TIME_MS,
  });

  // ── Add source mutation ──────────────────────────────────────────
  const addSourceMutation = useMutation({
    mutationFn: (input: string) =>
      withStaleDeploymentRecovery(() => discoverSource({ data: { input } })),
    onSuccess: (discovery) => {
      startTransition(() => {
        addSourceSuccess(discovery);
      });
    },
  });

  const loadMoreSourceItemsMutation = useMutation({
    mutationFn: ({ source, pageUrl }: { source: SavedSource; pageUrl: string }) =>
      withStaleDeploymentRecovery(() => loadMoreSourceItems({ data: { source, pageUrl } })),
    onSuccess: (result) => {
      startTransition(() => {
        applyLoadMore(result);
      });
    },
  });

  // ── Refreshing source ids ────────────────────────────────────────
  const refreshingSourceIds = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["source-items"] })
    .filter((query) => query.state.fetchStatus === "fetching")
    .map((query) => String(query.queryKey[1]));

  // ── Handlers ─────────────────────────────────────────────────────
  const handleAddSource = () => {
    if (!sourceInput.trim()) return;
    addSourceMutation.mutate(sourceInput);
  };

  const handleOpenFeed = (sourceId: string) => {
    openFeed(sourceId);
  };

  const handleSelectItem = (itemId: string) => {
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

  const handleRemoveSource = (sourceId: string) => {
    removeFeedSource(sourceId);
    void queryClient.removeQueries({ queryKey: queryKeys.sourceItems(sourceId) });
  };

  const handleLoadMoreDetailPanelItems = async (sourceId: string) => {
    const source = state.sources.find((entry) => entry.id === sourceId);
    const pagination = state.paginationBySource[sourceId];
    const pageUrl = pagination?.nextPageUrl;

    if (
      !source ||
      source.kind !== "feed" ||
      !pageUrl ||
      loadMoreSourceItemsMutation.isPending ||
      pagination.loadedPageUrls.includes(pageUrl)
    ) {
      return;
    }

    await loadMoreSourceItemsMutation.mutateAsync({ source, pageUrl });
  };

  // ── Sync state ───────────────────────────────────────────────────
  const handleSourceRefresh = (result: Parameters<typeof applyRefresh>[0], _sourceId: string) => {
    applyRefresh(result);
  };

  const handleSourceError = (sourceId: string, message: string) => {
    setFeedSourceError({ sourceId, message });
  };

  return {
    // State
    state,
    sourceInput,
    showAddForm,
    detailPanel,
    // Derived
    sourceSummaries,
    detailPanelSourceSummary,
    detailPanelItems,
    detailPanelPagination,
    selectedItem,
    articleQuery,
    articleEmbedQuery,
    articleViewMode,
    refreshingSourceIds,
    isRefreshingAll,
    isLoadingMoreDetailPanelItems: loadMoreSourceItemsMutation.isPending,
    totalNew,
    addSourceError:
      addSourceMutation.error instanceof Error ? addSourceMutation.error.message : undefined,
    isAddingSource: addSourceMutation.isPending,
    isReaderFullScreen,
    // Setters
    setSourceInput,
    setShowAddForm,
    setArticleViewMode,
    // Handlers
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
  };
}
