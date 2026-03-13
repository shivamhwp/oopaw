import { X } from "@phosphor-icons/react";
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
  const sourceTitle = source?.label ?? "Posts";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="safe-top safe-left safe-right shrink-0 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display truncate text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {sourceTitle}
            </h2>
            <p className="mt-1 text-[0.72rem] text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread · ${items.length} total`
                : `${items.length} ${items.length === 1 ? "post" : "posts"}`}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label="Close"
            >
              <X weight="bold" className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mx-5 h-px bg-border/40" />

      {/* List */}
      <div className="safe-bottom safe-left safe-right min-h-0 flex-1 overflow-y-auto">
        {items.length > 0 ? (
          <>
            <ul>
              {items.map((item) => {
                const date = formatDate(item.publishedAt);
                const isSelected = selectedItemId === item.id;

                return (
                  <li key={item.id} className="border-b border-border/25 last:border-0">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "group w-full px-5 py-3.5 text-left transition-colors",
                        isSelected ? "bg-primary/[0.04]" : "hover:bg-muted/25",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
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

                        {/* Unread dot — far right, vertically centered with first line */}
                        <div className="mt-[0.35rem] size-1.5 shrink-0">
                          {!item.isRead && (
                            <span className="block size-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {(hasMore || isLoadingMore) && (
              <div className="px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full text-[0.72rem] text-muted-foreground hover:text-foreground"
                  disabled={!hasMore || isLoadingMore}
                  onClick={onLoadMore}
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center px-6 py-16">
            <p className="text-[0.78rem] text-muted-foreground/50">No posts yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
