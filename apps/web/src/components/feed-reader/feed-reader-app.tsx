import { useEffect, useRef, useState } from "react";
import { Desktop, Moon, Plus, SpinnerIcon, Sun } from "@phosphor-icons/react";
import { useAtom } from "jotai";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { sidebarSizeAtom, type SidebarState } from "@/components/feed-reader/feed-reader-atoms";
import { ItemList } from "@/components/feed-reader/item-list";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import { SourceForm } from "@/components/feed-reader/source-form";
import { SourceGrid } from "@/components/feed-reader/source-grid";
import { SourceSyncController } from "@/components/feed-reader/source-sync-controller";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useTheme } from "@/components/theme-provider";
import {
  MAX_FEED_READER_SIDEBAR_SIZE,
  MIN_FEED_READER_SIDEBAR_SIZE,
  MIN_FEED_READER_SOURCE_SIDEBAR_SIZE,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFeedReader } from "@/components/feed-reader/use-feed-reader";

const getSidebarMinSize = (sidebar: SidebarState) =>
  sidebar.mode === "list" ? MIN_FEED_READER_SOURCE_SIDEBAR_SIZE : MIN_FEED_READER_SIDEBAR_SIZE;

const getSidebarOpenSize = (sidebar: SidebarState, sidebarSize: number) =>
  Math.max(sidebarSize, getSidebarMinSize(sidebar));

const THEME_CYCLE = [
  { value: "system" as const, label: "System", Icon: Desktop },
  { value: "light" as const, label: "Light", Icon: Sun },
  { value: "dark" as const, label: "Dark", Icon: Moon },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const idx = Math.max(
    0,
    THEME_CYCLE.findIndex((t) => t.value === theme),
  );
  const current = THEME_CYCLE[idx]!;
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!;
  const { Icon } = current;

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      className="h-7 w-7 cursor-pointer"
      onClick={() => setTheme(next.value)}
      aria-label={`Switch to ${next.label} theme`}
    >
      <Icon weight="bold" />
    </Button>
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
    isRefreshingAll,
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
  const sidebarMinSize = getSidebarMinSize(sidebar);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Collapse/expand the panel when sidebar state changes (desktop only)
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      wasSidebarOpenRef.current = sidebarOpen;
      return;
    }

    if (sidebarOpen) {
      const nextSidebarSize = getSidebarOpenSize(sidebar, sidebarSize);

      if (nextSidebarSize !== sidebarSize) {
        setSidebarSize(nextSidebarSize);
      }

      if (!wasSidebarOpenRef.current || nextSidebarSize !== sidebarSize) {
        sidebarPanelRef.current?.resize(`${nextSidebarSize}%`);
      }
    }

    if (!sidebarOpen && wasSidebarOpenRef.current) {
      sidebarPanelRef.current?.collapse();
    }

    wasSidebarOpenRef.current = sidebarOpen;
  }, [sidebar, sidebarOpen, sidebarSize, setSidebarSize]);

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
          <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-1.5">
            {/* Logo */}
            <div className="flex items-baseline gap-2.5">
              <span className="font-logo text-[2.1rem] leading-none tracking-wide text-foreground select-none">
                oop
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={showAddForm ? "secondary" : "default"}
                className="h-7 rounded-full text-xs cursor-pointer"
                onClick={() => setShowAddForm((v) => !v)}
              >
                <Plus weight="bold" />
                Add feed
              </Button>
              <ThemeToggle />
            </div>
          </div>

          {/* Inline add-feed form */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              showAddForm ? "max-h-28" : "max-h-0",
            )}
          >
            <div className="px-4 md:px-6 pb-4 pt-2 border-t border-border/30">
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
                selectedSourceId={sidebar.mode === "closed" ? undefined : sidebar.sourceId}
                onOpenFeed={handleOpenFeed}
                onRemoveSource={handleRemoveSource}
              />
            ) : (
              <div className="h-full min-w-0 overflow-y-auto px-6 py-6">
                <div className="relative h-full flex items-center justify-center">
                  {/* Ghost feed tiles — peeking in from the sides */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                    {(
                      [
                        { x: -268, y: -72, rotate: -5 },
                        { x: 264, y: -56, rotate: 4 },
                        { x: -240, y: 96, rotate: 3 },
                        { x: 252, y: 88, rotate: -4 },
                      ] as { x: number; y: number; rotate: number }[]
                    ).map((tile, i) => (
                      <div
                        key={i}
                        className="absolute paper-panel rounded-xl border border-white/20 p-4 w-48 opacity-[0.28] dark:opacity-[0.14]"
                        style={{
                          transform: `translate(${tile.x}px, ${tile.y}px) rotate(${tile.rotate}deg)`,
                        }}
                      >
                        <div className="h-2 rounded-full bg-foreground/20 w-20 mb-3" />
                        <div className="h-1.5 rounded-full bg-foreground/12 w-32 mb-2" />
                        <div className="h-1.5 rounded-full bg-foreground/12 w-24 mb-2" />
                        <div className="h-1.5 rounded-full bg-foreground/8 w-16 mb-5" />
                        <div className="flex gap-2">
                          <div className="h-1 rounded-full bg-primary/25 w-10" />
                          <div className="h-1 rounded-full bg-foreground/8 w-7" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Main card */}
                  <div className="relative z-10 paper-panel ink-ring rounded-2xl border border-white/65 px-10 py-10 text-center max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* RSS signal icon */}
                    <div
                      className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full"
                      style={{
                        background: "color-mix(in oklab, var(--primary) 13%, transparent)",
                        boxShadow: "0 0 0 8px color-mix(in oklab, var(--primary) 6%, transparent)",
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="4.5"
                          cy="15.5"
                          r="2.5"
                          fill="currentColor"
                          className="text-primary"
                        />
                        <path
                          d="M2.5 9.5C6.09 9.5 9 12.41 9 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className="text-primary"
                        />
                        <path
                          d="M2.5 4.5C8.85 4.5 14 9.65 14 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeOpacity="0.45"
                          className="text-primary"
                        />
                      </svg>
                    </div>

                    <p className="font-display text-[1.45rem] leading-tight text-foreground mb-2.5 tracking-tight text-balance">
                      Your reading list
                      <br />
                      starts here
                    </p>
                    <p className="text-sm text-muted-foreground leading-6 mb-6 text-balance">
                      Paste any RSS or site URL — oop finds the feed and keeps it fresh
                      automatically.
                    </p>
                    <Button type="button" size="sm" onClick={() => setShowAddForm(true)}>
                      <Plus weight="bold" />
                      Add your first feed
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ResizablePanel>

          {/* Drag handle — invisible when sidebar is closed, hidden on mobile */}
          <ResizableHandle
            withHandle
            className={cn(
              "cursor-col-resize max-md:hidden",
              !sidebarOpen && "invisible pointer-events-none",
            )}
          />

          {/* Sidebar panel */}
          <ResizablePanel
            className="min-w-0"
            panelRef={sidebarPanelRef}
            collapsible
            collapsedSize="0%"
            defaultSize="0%"
            minSize={`${sidebarMinSize}%`}
            maxSize={`${MAX_FEED_READER_SIDEBAR_SIZE}%`}
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

      {/* ── Mobile sidebar overlay (full-screen on small screens) ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-background flex flex-col overflow-hidden">
          <div className="h-full min-w-0 overflow-hidden">
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
        </div>
      )}

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
