import { CalendarDots, Sparkle, User, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
};

const formatDate = (value: string | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

export function ItemList({
  source,
  items,
  selectedItemId,
  hasMore = false,
  isLoadingMore = false,
  onSelect,
  onLoadMore,
  onClose,
}: ItemListProps) {
  const unreadCount = items.filter((item) => !item.isRead).length;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="safe-top safe-left safe-right shrink-0 border-b border-border/40 px-4 py-4 md:px-5">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display truncate text-[1.5rem] leading-tight text-foreground">
              {source?.label ?? "Posts"}
            </h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label="Close"
              >
                <X weight="bold" className="size-4.5" />
              </button>
            )}
          </div>
          {items.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {unreadCount > 0 ? (
                <>
                  <span className="font-medium text-primary">{unreadCount}</span> unread ·{" "}
                </>
              ) : null}
              {items.length} posts
            </p>
          )}
        </div>
      </div>

      <div className="safe-bottom safe-left safe-right min-h-0 flex-1 overflow-y-auto">
        {items.length > 0 ? (
          <>
            <ol>
              {items.map((item) => (
                <li key={item.id} className="border-b border-border/30 last:border-0">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "w-full px-5 py-4 text-left transition-colors",
                      selectedItemId === item.id ? "bg-primary/[0.05]" : "hover:bg-muted/35",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 pt-[0.55rem]">
                        <div
                          className={cn(
                            "size-[5px] rounded-full",
                            !item.isRead ? "bg-primary" : "bg-transparent",
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[0.66rem] text-muted-foreground">
                          {formatDate(item.publishedAt) && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDots weight="fill" className="size-2.5" />
                              {formatDate(item.publishedAt)}
                            </span>
                          )}
                          {item.author && (
                            <span className="inline-flex items-center gap-1">
                              <User weight="fill" className="size-2.5" />
                              {item.author}
                            </span>
                          )}
                          {item.isNew && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/55 px-1.5 py-px text-[0.58rem] font-semibold tracking-wider text-accent-foreground uppercase">
                              <Sparkle weight="fill" className="size-2" />
                              New
                            </span>
                          )}
                        </div>

                        <h3
                          className={cn(
                            "font-display text-[1.15rem] leading-tight text-pretty",
                            item.isRead ? "text-foreground/60" : "text-foreground",
                          )}
                        >
                          {item.title}
                        </h3>

                        {item.excerpt && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.excerpt}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ol>

            {(hasMore || isLoadingMore) && (
              <div className="px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full text-xs"
                  disabled={!hasMore || isLoadingMore}
                  onClick={onLoadMore}
                >
                  {isLoadingMore ? "Loading more..." : "Load more posts"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">No posts yet. Try refreshing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
