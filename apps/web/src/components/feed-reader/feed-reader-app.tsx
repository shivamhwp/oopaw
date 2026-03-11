import { useEffect, useRef, useState } from "react";
import { Moon, Plus, SpinnerIcon, Sun } from "@phosphor-icons/react";
import { useAtom } from "jotai";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { sidebarSizeAtom } from "@/components/feed-reader/feed-reader-atoms";
import { ItemList } from "@/components/feed-reader/item-list";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import { SourceForm } from "@/components/feed-reader/source-form";
import { SourceGrid } from "@/components/feed-reader/source-grid";
import { SourceSyncController } from "@/components/feed-reader/source-sync-controller";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useFeedReader } from "@/components/feed-reader/use-feed-reader";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (theme === "dark") {
      setIsDark(true);
    } else if (theme === "light") {
      setIsDark(false);
    } else {
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun weight="bold" className="size-3.5" />
      ) : (
        <Moon weight="bold" className="size-3.5" />
      )}
    </button>
  );
}

export const shouldShowFeedReaderBootScreen = (isClientReady: boolean) => !isClientReady;

export function FeedReaderBootScreen() {
  return (
    <div className="flex h-svh items-center justify-center overflow-hidden bg-background">
      <div role="status" aria-label="Loading feeds" className="text-muted-foreground">
        <SpinnerIcon className="size-5 animate-spin" />
      </div>
    </div>
  );
}

export function FeedReaderApp() {
  const {
    state,
    sourceInput,
    showAddForm,
    sidebar,
    isReaderFullScreen,
    sourceSummaries,
    sidebarSourceSummary,
    sidebarItems,
    sidebarPagination,
    selectedItem,
    articleQuery,
    articleEmbedQuery,
    articleViewMode,
    refreshingSourceIds,
    isRefreshingAll,
    totalNew,
    addSourceError,
    isAddingSource,
    isLoadingMoreSidebarItems,
    setSourceInput,
    setShowAddForm,
    setArticleViewMode,
    handleAddSource,
    handleOpenFeed,
    handleSelectItem,
    handleBackToList,
    handleCloseSidebar,
    handleToggleFullScreen,
    handleRefreshSource,
    handleRefreshAll,
    handleRemoveSource,
    handleLoadMoreSidebarItems,
    handleSourceRefresh,
    handleSourceError,
  } = useFeedReader();

  const sidebarOpen = sidebar.mode !== "closed";
  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const wasSidebarOpenRef = useRef(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [sidebarSize, setSidebarSize] = useAtom(sidebarSizeAtom);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Collapse/expand the panel when sidebar state changes
  useEffect(() => {
    if (sidebarOpen && !wasSidebarOpenRef.current) {
      sidebarPanelRef.current?.resize(`${sidebarSize}%`);
    }

    if (!sidebarOpen && wasSidebarOpenRef.current) {
      sidebarPanelRef.current?.collapse();
    }

    wasSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, sidebarSize]);

  if (shouldShowFeedReaderBootScreen(isClientReady)) {
    return <FeedReaderBootScreen />;
  }

  return (
    <>
      {/* Invisible sync controllers — one per source */}
      {state.sources.map((source) => (
        <SourceSyncController
          key={source.id}
          source={source}
          initialItems={state.itemsBySource[source.id] ?? []}
          seenItemIds={state.seenItemIdsBySource[source.id] ?? []}
          enabled={true}
          onRefresh={(result) => handleSourceRefresh(result, source.id)}
          onError={(message) => handleSourceError(source.id, message)}
        />
      ))}

      {/* ── Root shell ── */}
      <div className="flex flex-col h-svh overflow-hidden bg-background">
        {/* Header — spans full width above the resizable split */}
        <header className="shrink-0 border-b border-border/40 bg-background/80 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between gap-4 px-6 py-1.5">
            {/* Logo */}
            <div className="flex items-baseline gap-2.5">
              <span className="font-logo text-[1.6rem] leading-none tracking-wide text-foreground select-none">
                oop
              </span>
              {totalNew > 0 && (
                <span className="text-[0.62rem] text-muted-foreground/70">
                  <span className="text-primary font-semibold">{totalNew}</span> new
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <Button
                type="button"
                size="sm"
                variant={showAddForm ? "secondary" : "outline"}
                className="h-7 rounded-full text-xs"
                onClick={() => setShowAddForm((v) => !v)}
              >
                <Plus weight="bold" />
                Add feed
              </Button>
            </div>
          </div>

          {/* Inline add-feed form */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              showAddForm ? "max-h-28" : "max-h-0",
            )}
          >
            <div className="px-6 pb-4 pt-2 border-t border-border/30">
              <SourceForm
                value={sourceInput}
                error={addSourceError}
                isSubmitting={isAddingSource}
                onChange={setSourceInput}
                onSubmit={handleAddSource}
                onCancel={() => setShowAddForm(false)}
                onRefreshAll={handleRefreshAll}
                isRefreshing={isRefreshingAll}
              />
            </div>
          </div>
        </header>

        {/* ── Resizable split: feed grid | sidebar ── */}
        <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 min-w-0">
          {/* Main feed grid */}
          <ResizablePanel defaultSize="100%" minSize="30%" className="min-w-0">
            {sourceSummaries.length > 0 ? (
              <SourceGrid
                sourceSummaries={sourceSummaries}
                sidebarOpen={sidebarOpen}
                refreshingSourceIds={refreshingSourceIds}
                selectedSourceId={sidebar.mode === "closed" ? undefined : sidebar.sourceId}
                onOpenFeed={handleOpenFeed}
                onRefreshSource={handleRefreshSource}
                onRemoveSource={handleRemoveSource}
              />
            ) : (
              <div className="h-full min-w-0 overflow-y-auto px-6 py-6">
                <div className="h-full flex items-center justify-center">
                  <div className="paper-panel ink-ring rounded-2xl border border-white/65 px-10 py-10 text-center max-w-sm">
                    <p className="font-display text-2xl text-foreground mb-2">No feeds yet</p>
                    <p className="text-sm text-muted-foreground leading-7 mb-5">
                      Paste any RSS feed URL or regular site URL — oop discovers the feed
                      automatically and keeps it fresh.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus weight="bold" />
                      Add your first feed
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ResizablePanel>

          {/* Drag handle — invisible when sidebar is closed */}
          <ResizableHandle
            withHandle
            className={cn("cursor-col-resize", !sidebarOpen && "invisible pointer-events-none")}
          />

          {/* Sidebar panel */}
          <ResizablePanel
            className="min-w-0"
            panelRef={sidebarPanelRef}
            collapsible
            collapsedSize="0%"
            defaultSize="0%"
            minSize="25%"
            maxSize="70%"
            onResize={(size) => {
              if (size.asPercentage === 0 && sidebarOpen) {
                handleCloseSidebar();
                return;
              }

              if (size.asPercentage > 0 && size.asPercentage !== sidebarSize) {
                setSidebarSize(size.asPercentage);
              }
            }}
          >
            <div className="h-full min-w-0 overflow-hidden border-l border-border/40">
              {sidebar.mode === "list" && (
                <ItemList
                  source={sidebarSourceSummary?.source}
                  items={sidebarItems}
                  selectedItemId={null}
                  hasMore={Boolean(sidebarPagination?.nextPageUrl)}
                  isLoadingMore={isLoadingMoreSidebarItems}
                  onSelect={handleSelectItem}
                  onLoadMore={() => handleLoadMoreSidebarItems(sidebar.sourceId)}
                  onClose={handleCloseSidebar}
                />
              )}

              {sidebar.mode === "reader" && (
                <ReaderPane
                  item={selectedItem}
                  article={articleQuery.data}
                  articleEmbed={articleEmbedQuery.data}
                  articleViewMode={articleViewMode}
                  isLoadingArticle={articleQuery.isLoading}
                  isLoadingEmbed={articleEmbedQuery.isLoading}
                  isFullScreen={false}
                  onBack={handleBackToList}
                  onClose={handleCloseSidebar}
                  onToggleFullScreen={handleToggleFullScreen}
                  onArticleViewModeChange={setArticleViewMode}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ── Full-screen reader overlay ── */}
      {isReaderFullScreen && sidebar.mode === "reader" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
          <ReaderPane
            item={selectedItem}
            article={articleQuery.data}
            articleEmbed={articleEmbedQuery.data}
            articleViewMode={articleViewMode}
            isLoadingArticle={articleQuery.isLoading}
            isLoadingEmbed={articleEmbedQuery.isLoading}
            isFullScreen={true}
            onBack={handleBackToList}
            onClose={handleCloseSidebar}
            onToggleFullScreen={handleToggleFullScreen}
            onArticleViewModeChange={setArticleViewMode}
          />
        </div>
      )}
    </>
  );
}
