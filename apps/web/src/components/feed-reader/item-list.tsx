import { useLayoutEffect, useRef } from "react";
import { CopyIcon, InfoIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react";
import { Virtuoso } from "react-virtuoso";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FeedItem, SavedSource } from "@/lib/types";

type ItemListProps = {
  source?: SavedSource;
  items: FeedItem[];
  selectedItemId: string | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onSelect: (itemId: string) => void;
  onLoadMore?: () => void;
  onClose?: () => void;
  onMarkUnread?: (itemId: string) => void;
  onBookmarkItem?: (item: FeedItem) => void;
  onRequireSignIn?: () => void;
  isItemBookmarked?: (item: FeedItem) => boolean;
  isSignedIn?: boolean;
  isBookmarkPending?: boolean;
  scrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
};

const formatDate = (value: string | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

const formatDateTime = (value: string | undefined) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";

const copyToClipboard = async (value: string, label: string) => {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied.`);
};

export function ItemList({
  source,
  items,
  selectedItemId,
  hasMore = false,
  isLoadingMore = false,
  onSelect,
  onLoadMore,
  onClose,
  onMarkUnread,
  onBookmarkItem,
  onRequireSignIn,
  isItemBookmarked,
  isSignedIn = false,
  isBookmarkPending = false,
  scrollTop = 0,
  onScrollTopChange,
}: ItemListProps) {
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const restoredSourceIdRef = useRef<string | undefined>(undefined);
  const unreadCount = items.filter((item) => !item.isRead).length;
  const readCount = items.length - unreadCount;
  const hasContextMenuActions = (onMarkUnread || onBookmarkItem) && source;

  useLayoutEffect(() => {
    if (!scrollElementRef.current || restoredSourceIdRef.current === source?.id) {
      return;
    }

    scrollElementRef.current.scrollTop = scrollTop;
    restoredSourceIdRef.current = source?.id;
  }, [scrollTop, source?.id]);

  const renderItem = (item: FeedItem) => {
    const date = formatDate(item.publishedAt);
    const isSelected = selectedItemId === item.id;
    const itemHasContextMenu =
      hasContextMenuActions && ((item.isRead && onMarkUnread) || onBookmarkItem);

    const button = (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-label={`Open ${item.title}`}
        className={cn(
          "group w-full select-none px-5 py-3.5 text-left transition-colors",
          isSelected ? "bg-primary/[0.04]" : "hover:bg-primary/10",
        )}
      >
        <div className="min-w-0">
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-display text-[0.95rem] leading-snug text-pretty",
                item.isRead ? "text-foreground/40" : "text-foreground",
              )}
            >
              {item.title}
            </h3>

            {(date || item.author) && (
              <p className="mt-1 text-[0.65rem] text-muted-foreground/55">
                {[date, item.author].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </button>
    );

    return itemHasContextMenu ? (
      <ContextMenu>
        <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
        <ContextMenuContent>
          {item.isRead && onMarkUnread && (
            <ContextMenuItem onSelect={() => onMarkUnread(item.id)}>Mark as unread</ContextMenuItem>
          )}
          {onBookmarkItem && (
            <ContextMenuItem
              onSelect={
                isSignedIn
                  ? () => onBookmarkItem(item)
                  : onRequireSignIn
                    ? () => onRequireSignIn()
                    : undefined
              }
              disabled={isSignedIn && isBookmarkPending}
            >
              {isSignedIn
                ? isItemBookmarked?.(item)
                  ? "Remove bookmark"
                  : "Add bookmark"
                : "Sign in to bookmark"}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    ) : (
      button
    );
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-background/94 px-4 py-2.5 backdrop-blur-sm md:px-5 md:py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{unreadCount} unread</span>
          <span>{readCount} read</span>
        </div>
        <div className="flex items-center gap-1">
          {source && (
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Feed info">
                  <InfoIcon weight="bold" className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end">
                <PopoverHeader>
                  <PopoverTitle className="font-display text-sm">{source.label}</PopoverTitle>
                  <PopoverDescription className="text-[0.72rem] leading-relaxed">
                    Feed and list metadata for the current source.
                  </PopoverDescription>
                </PopoverHeader>

                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-[0.72rem] leading-relaxed">
                  <dt className="text-muted-foreground">Posts</dt>
                  <dd className="min-w-0 break-words text-right text-foreground">{items.length}</dd>
                  <dt className="text-muted-foreground">Unread</dt>
                  <dd className="min-w-0 break-words text-right text-foreground">{unreadCount}</dd>
                  <dt className="text-muted-foreground">Read</dt>
                  <dd className="min-w-0 break-words text-right text-foreground">{readCount}</dd>
                  <dt className="text-muted-foreground">Site URL</dt>
                  <dd className="group min-w-0 text-foreground">
                    <div className="relative min-w-0">
                      <span
                        className="block min-w-0 truncate pr-0 text-right"
                        title={source.siteUrl}
                      >
                        {source.siteUrl}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-0 size-5 -translate-y-1/2 bg-popover opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Copy site URL"
                        onClick={() => void copyToClipboard(source.siteUrl, "Site URL")}
                      >
                        <CopyIcon className="size-3" weight="bold" />
                      </Button>
                    </div>
                  </dd>
                  <dt className="text-muted-foreground">Feed URL</dt>
                  <dd className="group min-w-0 text-foreground">
                    <div className="relative min-w-0">
                      <span
                        className="block min-w-0 truncate pr-0 text-right"
                        title={source.feedUrl}
                      >
                        {source.feedUrl}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-0 size-5 -translate-y-1/2 bg-popover opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Copy feed URL"
                        onClick={() => void copyToClipboard(source.feedUrl, "Feed URL")}
                      >
                        <CopyIcon className="size-3" weight="bold" />
                      </Button>
                    </div>
                  </dd>
                  <dt className="text-muted-foreground">Polling</dt>
                  <dd className="min-w-0 break-words text-right text-foreground">
                    {source.pollingEnabled ? "Enabled" : "Disabled"}
                  </dd>
                  <dt className="text-muted-foreground">Interval</dt>
                  <dd className="min-w-0 break-words text-right text-foreground">
                    {Math.round(source.pollIntervalMs / 60_000)} min
                  </dd>
                  <dt className="text-muted-foreground">Last checked</dt>
                  <dd className="min-w-0 break-words text-right text-foreground">
                    {formatDateTime(source.lastCheckedAt)}
                  </dd>
                  {source.lastError && (
                    <>
                      <dt className="text-muted-foreground">Last error</dt>
                      <dd className="min-w-0 break-words text-right text-destructive">
                        {source.lastError}
                      </dd>
                    </>
                  )}
                </dl>
              </PopoverContent>
            </Popover>
          )}

          {onClose && (
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <XIcon weight="bold" className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1">
        {items.length > 0 ? (
          <Virtuoso
            data={items}
            className="app-scroll-y h-full pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] overflow-y-auto [touch-action:pan-y]"
            data-scroll-restoration-id={source ? `feed-item-list:${source.id}` : "feed-item-list"}
            computeItemKey={(_, item) => item.id}
            defaultItemHeight={78}
            increaseViewportBy={{ top: 160, bottom: 320 }}
            overscan={200}
            scrollerRef={(ref) => {
              scrollElementRef.current = ref instanceof HTMLElement ? ref : null;
            }}
            onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
            endReached={hasMore ? () => onLoadMore?.() : undefined}
            itemContent={(_, item) => (
              <div className="border-b border-border/25">{renderItem(item)}</div>
            )}
            components={{
              Footer: () =>
                isLoadingMore ? (
                  <div className="flex items-center justify-center gap-2 px-5 py-4 text-[0.72rem] text-muted-foreground">
                    <SpinnerIcon className="size-3.5 animate-spin" weight="bold" />
                    <span>Loading more posts…</span>
                  </div>
                ) : hasMore ? (
                  <div className="px-5 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-full text-[0.72rem] text-muted-foreground hover:text-foreground"
                      onClick={onLoadMore}
                    >
                      Load more
                    </Button>
                  </div>
                ) : null,
            }}
          />
        ) : (
          <div className="flex items-center justify-center px-6 py-16">
            <p className="text-[0.78rem] text-muted-foreground/50">No posts yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
