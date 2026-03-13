import { useEffect, useRef, useState } from "react";
import { CowIcon, DesktopIcon, MoonIcon, PlusIcon, SpinnerIcon, SunIcon } from "@phosphor-icons/react";
import { useAtom, useAtomValue } from "jotai";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { ItemList } from "@/components/feed-reader/item-list";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import { SourceForm } from "@/components/feed-reader/source-form";
import {
  detailPanelOpenAtom,
  detailPanelSizeAtom,
  MAX_FEED_READER_PANEL_SIZE,
  MIN_FEED_READER_LIST_PANEL_SIZE,
  MIN_FEED_READER_READER_PANEL_SIZE,
  type DetailPanelState,
} from "@/components/feed-reader/store";
import { SourceGrid } from "@/components/feed-reader/source-grid";
import { SourceSyncController } from "@/components/feed-reader/source-sync-controller";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useTheme } from "@/components/theme-provider";
import { useFeedReader } from "@/components/feed-reader/use-feed-reader";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const getDetailPanelMinSize = (detailPanel: DetailPanelState) =>
  detailPanel.mode === "list" ? MIN_FEED_READER_LIST_PANEL_SIZE : MIN_FEED_READER_READER_PANEL_SIZE;

const getDetailPanelOpenSize = (detailPanel: DetailPanelState, detailPanelSize: number) =>
  Math.max(detailPanelSize, getDetailPanelMinSize(detailPanel));

const THEME_CYCLE = [
  { value: "system" as const, label: "System", Icon: DesktopIcon },
  { value: "light" as const, label: "Light", Icon: SunIcon },
  { value: "dark" as const, label: "Dark", Icon: MoonIcon },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const idx = Math.max(
    0,
    THEME_CYCLE.findIndex((entry) => entry.value === theme),
  );
  const current = THEME_CYCLE[idx]!;
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!;
  const { Icon } = current;

  return (
    <Button
      type="button"
      variant="secondary"
      className="cursor-pointer"
      onClick={() => setTheme(next.value)}
      aria-label={`Switch to ${next.label} theme`}
    >
      <Icon weight="bold" />
    </Button>
  );
}

export const shouldShowFeedReaderBootScreen = (isClientReady: boolean) => !isClientReady;
export const getFeedReaderLayoutMode = (isMobile: boolean) => (isMobile ? "mobile" : "desktop");

export function FeedReaderBootScreen() {
  return (
    <div className="flex h-svh items-center justify-center overflow-hidden bg-background">
      <div role="status" aria-label="Loading feeds" className="text-muted-foreground">
        <SpinnerIcon className="size-5 animate-spin" />
      </div>
    </div>
  );
}

function EmptyFeedState({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="h-full min-w-0 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <div className="relative flex h-full items-center justify-center">
        <div className="pointer-events-none absolute inset-0 hidden select-none items-center justify-center overflow-hidden md:flex">
          {(
            [
              { x: -268, y: -72, rotate: -5 },
              { x: 264, y: -56, rotate: 4 },
              { x: -240, y: 96, rotate: 3 },
              { x: 252, y: 88, rotate: -4 },
            ] as { x: number; y: number; rotate: number }[]
          ).map((tile, index) => (
            <div
              key={index}
              className="paper-panel absolute w-48 rounded-xl border border-primary/40 p-4 opacity-[0.28] dark:opacity-[0.14]"
              style={{
                transform: `translate(${tile.x}px, ${tile.y}px) rotate(${tile.rotate}deg)`,
              }}
            >
              <div className="mb-3 h-2 w-20 rounded-full bg-foreground/20" />
              <div className="mb-2 h-1.5 w-32 rounded-full bg-foreground/12" />
              <div className="mb-2 h-1.5 w-24 rounded-full bg-foreground/12" />
              <div className="mb-5 h-1.5 w-16 rounded-full bg-foreground/8" />
              <div className="flex gap-2">
                <div className="h-1 w-10 rounded-full bg-primary/25" />
                <div className="h-1 w-7 rounded-full bg-foreground/8" />
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex max-w-sm flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div
            className={cn(
              "mb-5 flex items-center justify-center rounded-full text-primary",
              isMobile ? "size-14" : "size-16",
            )}
            style={{
              background: "color-mix(in oklab, var(--primary) 13%, transparent)",
              boxShadow: "0 0 0 10px color-mix(in oklab, var(--primary) 6%, transparent)",
            }}
          >
            <CowIcon weight="duotone" className={cn(isMobile ? "size-7" : "size-8")} />
          </div>
          <p className="font-display text-[0.92rem] uppercase tracking-[0.32em] text-foreground/78 md:text-[1.05rem] md:tracking-[0.42em]">
            No feeds yet
          </p>
        </div>
      </div>
    </div>
  );
}

export function FeedReaderApp() {
  const {
    state,
    sourceInput,
    showAddForm,
    detailPanel,
    isReaderFullScreen,
    sourceSummaries,
    detailPanelSourceSummary,
    detailPanelItems,
    detailPanelPagination,
    selectedItem,
    articleViewMode,
    isRefreshingAll,
    addSourceError,
    isAddingSource,
    isLoadingMoreDetailPanelItems,
    setSourceInput,
    setShowAddForm,
    setArticleViewMode,
    handleAddSource,
    handleOpenFeed,
    handleSelectItem,
    handleBackToList,
    handleCloseDetailPanel,
    handleToggleFullScreen,
    handleRefreshAll,
    handleRemoveSource,
    handleLoadMoreDetailPanelItems,
    handleSourceRefresh,
    handleSourceError,
  } = useFeedReader();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const detailPanelOpen = useAtomValue(detailPanelOpenAtom);
  const detailPanelRef = useRef<PanelImperativeHandle>(null);
  const wasDetailPanelOpenRef = useRef(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [detailPanelSize, setDetailPanelSize] = useAtom(detailPanelSizeAtom);
  const detailPanelMinSize = getDetailPanelMinSize(detailPanel);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (isMobile) {
      wasDetailPanelOpenRef.current = detailPanelOpen;
      return;
    }

    if (detailPanelOpen) {
      const nextDetailPanelSize = getDetailPanelOpenSize(detailPanel, detailPanelSize);

      if (nextDetailPanelSize !== detailPanelSize) {
        setDetailPanelSize(nextDetailPanelSize);
      }

      if (!wasDetailPanelOpenRef.current || nextDetailPanelSize !== detailPanelSize) {
        detailPanelRef.current?.resize(`${nextDetailPanelSize}%`);
      }
    }

    if (!detailPanelOpen && wasDetailPanelOpenRef.current) {
      detailPanelRef.current?.collapse();
    }

    wasDetailPanelOpenRef.current = detailPanelOpen;
  }, [isMobile, detailPanel, detailPanelOpen, detailPanelSize, setDetailPanelSize]);

  if (shouldShowFeedReaderBootScreen(isClientReady)) {
    return <FeedReaderBootScreen />;
  }

  const detailPanelContent = (
    <div className="h-full min-w-0 overflow-hidden md:pl-2">
      {detailPanel.mode === "list" && (
        <ItemList
          source={detailPanelSourceSummary?.source}
          items={detailPanelItems}
          selectedItemId={null}
          hasMore={Boolean(detailPanelPagination?.nextPageUrl)}
          isLoadingMore={isLoadingMoreDetailPanelItems}
          onSelect={handleSelectItem}
          onLoadMore={() => handleLoadMoreDetailPanelItems(detailPanel.sourceId)}
          onClose={handleCloseDetailPanel}
        />
      )}

      {detailPanel.mode === "reader" && (
        <ReaderPane
          item={selectedItem}
          articleViewMode={articleViewMode}
          isFullScreen={false}
          onBack={handleBackToList}
          onClose={handleCloseDetailPanel}
          onToggleFullScreen={handleToggleFullScreen}
          onArticleViewModeChange={setArticleViewMode}
        />
      )}
    </div>
  );

  const mainContent =
    sourceSummaries.length > 0 ? (
      <SourceGrid
        sourceSummaries={sourceSummaries}
        detailPanelOpen={detailPanelOpen}
        selectedSourceId={detailPanel.mode === "closed" ? undefined : detailPanel.sourceId}
        onOpenFeed={handleOpenFeed}
        onRemoveSource={handleRemoveSource}
      />
    ) : (
      <EmptyFeedState isMobile={isMobile} />
    );

  return (
    <>
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

      <div className="min-h-svh flex h-svh flex-col overflow-hidden bg-background">
        <header className="pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] z-20 shrink-0 border-b border-border/40 bg-background/80 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6 md:py-1.5">
            <div className="flex items-baseline gap-2.5">
              <span className="select-none font-logo text-[2.1rem] leading-none tracking-wide text-foreground">
                oop
              </span>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-1.5">
              <Button
                type="button"
                className="cursor-pointer rounded-full"
                onClick={() => setShowAddForm((value) => !value)}
              >
                <PlusIcon weight="bold" />
                <span className="min-[420px]:hidden">Add</span>
                <span className="hidden min-[420px]:inline">Add feed</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              showAddForm ? "max-h-40" : "max-h-0",
            )}
          >
            <div className="border-t border-border/30 px-4 pb-4 pt-2 md:px-6">
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

        {getFeedReaderLayoutMode(isMobile) === "mobile" ? (
          <div className="flex-1 min-h-0" data-testid="mobile-feed-shell">
            {mainContent}
          </div>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            className="flex-1 min-h-0 min-w-0"
            data-testid="desktop-feed-shell"
          >
            <ResizablePanel defaultSize="100%" minSize="30%" className="min-w-0">
              {mainContent}
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className={cn(
                "cursor-col-resize",
                !detailPanelOpen && "invisible pointer-events-none",
              )}
            />

            <ResizablePanel
              className="min-w-0"
              panelRef={detailPanelRef}
              collapsible
              collapsedSize="0%"
              defaultSize="0%"
              minSize={`${detailPanelMinSize}%`}
              maxSize={`${MAX_FEED_READER_PANEL_SIZE}%`}
              onResize={(size) => {
                if (size.asPercentage === 0 && detailPanelOpen) {
                  handleCloseDetailPanel();
                  return;
                }

                if (size.asPercentage > 0 && size.asPercentage !== detailPanelSize) {
                  setDetailPanelSize(size.asPercentage);
                }
              }}
            >
              {detailPanelContent}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {isMobile && detailPanelOpen && (
        <div className="pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] fixed inset-0 z-30 flex flex-col overflow-hidden bg-background">
          {detailPanelContent}
        </div>
      )}

      {!isMobile && isReaderFullScreen && detailPanel.mode === "reader" && selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
          <ReaderPane
            item={selectedItem}
            articleViewMode={articleViewMode}
            isFullScreen={true}
            onBack={handleBackToList}
            onClose={handleCloseDetailPanel}
            onToggleFullScreen={handleToggleFullScreen}
            onArticleViewModeChange={setArticleViewMode}
          />
        </div>
      )}
    </>
  );
}
