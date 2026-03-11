import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FeedCard } from "@/components/feed-reader/feed-card";
import { useProgressiveWindow } from "@/components/feed-reader/use-progressive-window";
import type { FeedItem, SavedSource } from "@/lib/types";

const GRID_PAGE_SIZE = 20;
const GRID_THRESHOLD_ROWS = 2;
const GRID_GAP = 16;
const CARD_WIDTH = 288;

type SourceSummary = {
  source: SavedSource;
  items: FeedItem[];
  unreadCount: number;
  newCount: number;
  itemCount: number;
};

type SourceGridProps = {
  sourceSummaries: SourceSummary[];
  sidebarOpen: boolean;
  selectedSourceId?: string;
  onOpenFeed: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
};

const clampColumns = (width: number, sidebarOpen: boolean) => {
  if (width <= 0) {
    return 1;
  }

  const maxColumns = sidebarOpen ? 2 : 4;
  const computedColumns = Math.floor((width + GRID_GAP) / (CARD_WIDTH + GRID_GAP));

  return Math.max(1, Math.min(maxColumns, computedColumns));
};

export function SourceGrid({
  sourceSummaries,
  sidebarOpen,
  selectedSourceId,
  onOpenFeed,
  onRemoveSource,
}: SourceGridProps) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const columnCount = clampColumns(containerWidth, sidebarOpen);
  const { visibleCount, reportLastVisibleIndex } = useProgressiveWindow({
    loadedCount: sourceSummaries.length,
    pageSize: GRID_PAGE_SIZE,
    threshold: columnCount * GRID_THRESHOLD_ROWS,
    identityKey: sourceSummaries.length === 0 ? "empty" : `sidebar:${sidebarOpen}`,
    hasRemoteMore: false,
    isFetchingRemoteMore: false,
  });
  const visibleSourceSummaries = sourceSummaries.slice(0, visibleCount);
  const rows = Array.from(
    { length: Math.ceil(visibleSourceSummaries.length / columnCount) },
    (_, index) => visibleSourceSummaries.slice(index * columnCount, (index + 1) * columnCount),
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 236,
    overscan: GRID_THRESHOLD_ROWS,
    measureElement: (element) => element.getBoundingClientRect().height,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastVisibleRowIndex = virtualRows.at(-1)?.index ?? null;
  const lastVisibleItemIndex =
    lastVisibleRowIndex === null
      ? null
      : Math.min(visibleSourceSummaries.length - 1, (lastVisibleRowIndex + 1) * columnCount - 1);

  useEffect(() => {
    if (!scrollElementRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry?.contentRect.width ?? 0);
    });

    observer.observe(scrollElementRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    reportLastVisibleIndex(lastVisibleItemIndex);
  }, [lastVisibleItemIndex, reportLastVisibleIndex]);

  return (
    <div ref={scrollElementRef} className="h-full min-w-0 overflow-y-auto px-6 py-6">
      <div
        className="relative"
        style={{
          height: rowVirtualizer.getTotalSize(),
        }}
      >
        {virtualRows.map((virtualRow) => (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div
              className="grid"
              style={{
                gap: GRID_GAP,
                gridTemplateColumns: `repeat(${columnCount}, ${CARD_WIDTH}px)`,
              }}
            >
              {rows[virtualRow.index]?.map(({ source, items, unreadCount, newCount }) => (
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
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
