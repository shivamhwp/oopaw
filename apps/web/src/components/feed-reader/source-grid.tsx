import { useCallback, useEffect, useRef, useState } from "react";
import { FeedCard } from "@/components/feed-reader/feed-card";
import { useProgressiveWindow } from "@/components/feed-reader/use-progressive-window";
import type { FeedItem, SavedSource } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";

const GRID_PAGE_SIZE = 20;
const GRID_THRESHOLD_ROWS = 2;
const GRID_GAP = 16;
const GRID_PADDING_X = 48;
const GRID_SCROLLBAR_ALLOWANCE = 20;
const GRID_CARD_MIN_WIDTH = 240;

type SourceSummary = {
  source: SavedSource;
  items: FeedItem[];
  unreadCount: number;
  newCount: number;
  itemCount: number;
};

type SourceGridProps = {
  sourceSummaries: SourceSummary[];
  detailPanelOpen: boolean;
  selectedSourceId?: string;
  onOpenFeed: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
};

const clampColumns = (width: number, detailPanelOpen: boolean) => {
  if (width <= 0) {
    return 1;
  }

  const maxColumns = detailPanelOpen ? 2 : 5;
  const computedColumns = Math.floor((width + GRID_GAP) / (GRID_CARD_MIN_WIDTH + GRID_GAP));

  return Math.max(1, Math.min(maxColumns, computedColumns));
};

export function SourceGrid({
  sourceSummaries,
  detailPanelOpen,
  selectedSourceId,
  onOpenFeed,
  onRemoveSource,
}: SourceGridProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const columnCount = clampColumns(
    Math.max(containerWidth - GRID_PADDING_X - GRID_SCROLLBAR_ALLOWANCE, 0),
    detailPanelOpen,
  );
  const { visibleCount, reportLastVisibleIndex } = useProgressiveWindow({
    loadedCount: sourceSummaries.length,
    pageSize: GRID_PAGE_SIZE,
    threshold: columnCount * GRID_THRESHOLD_ROWS,
    identityKey: sourceSummaries.length === 0 ? "empty" : `detail-panel:${detailPanelOpen}`,
    hasRemoteMore: false,
    isFetchingRemoteMore: false,
  });
  const visibleSourceSummaries = sourceSummaries.slice(0, visibleCount);
  const renderSourceCard = ({ source, items, unreadCount, newCount }: SourceSummary) => (
    <FeedCard
      key={source.id}
      source={source}
      items={items}
      unreadCount={unreadCount}
      newCount={newCount}
      isSelected={selectedSourceId === source.id}
      onSelect={() => onOpenFeed(source.id)}
      onRemove={() => onRemoveSource(source.id)}
    />
  );

  useEffect(() => {
    if (isMobile) {
      return;
    }

    if (!containerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry?.contentRect.width ?? 0);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isMobile]);

  // Use IntersectionObserver on the sentinel to trigger progressive loading
  const handleSentinelVisible = useCallback(() => {
    const lastIndex = visibleSourceSummaries.length - 1;
    if (lastIndex >= 0) {
      reportLastVisibleIndex(lastIndex);
    }
  }, [visibleSourceSummaries.length, reportLastVisibleIndex]);

  useEffect(() => {
    if (isMobile || !sentinelRef.current || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          handleSentinelVisible();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isMobile, handleSentinelVisible]);

  if (isMobile) {
    return (
      <div
        className="app-scroll-y h-full min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
        data-testid="source-grid-mobile"
        data-scroll-restoration-id="feed-source-grid-mobile"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sourceSummaries.map(renderSourceCard)}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="app-scroll-y h-full min-w-0 overflow-x-hidden overflow-y-auto px-6 py-6"
      data-testid="source-grid-desktop"
      data-scroll-restoration-id="feed-source-grid-desktop"
    >
      <div
        className="grid w-full gap-4"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${GRID_CARD_MIN_WIDTH}px), 1fr))`,
        }}
      >
        {visibleSourceSummaries.map(renderSourceCard)}
      </div>
      {/* Sentinel for progressive loading */}
      {visibleCount < sourceSummaries.length && (
        <div ref={sentinelRef} className="h-1" aria-hidden />
      )}
    </div>
  );
}
