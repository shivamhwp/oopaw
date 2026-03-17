import { TrashIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import type { FeedItem, SavedSource } from "@/lib/types";

type FeedCardProps = {
  source: SavedSource;
  items: FeedItem[];
  unreadCount: number;
  newCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

export function FeedCard({
  source,
  items,
  unreadCount,
  newCount,
  isSelected,
  onSelect,
  onRemove,
}: FeedCardProps) {
  const latestItems = items.slice(0, 4);

  return (
    <div className="group relative min-h-[12rem] sm:min-h-[13rem] md:h-[13rem]">
      <Card
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        className={cn(
          "h-full cursor-pointer gap-0 py-0 pr-12 transition-colors duration-150 sm:pr-14 md:pr-0",
          isSelected ? "ring-primary/40 bg-primary/[0.02]" : "md:hover:bg-muted/30",
        )}
      >
        {/* Items */}
        <CardContent className="flex flex-1 flex-col gap-0 pl-4 pr-12 pt-4 pb-1 md:px-4">
          {latestItems.length > 0 ? (
            latestItems.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline gap-2 py-[0.22rem] border-b border-border/20 last:border-0"
              >
                <div
                  className={cn(
                    "mt-[0.28rem] size-[4px] rounded-full shrink-0",
                    !item.isRead ? "bg-primary" : "bg-transparent",
                  )}
                />
                <p
                  className={cn(
                    "text-[0.77rem] leading-snug line-clamp-1",
                    !item.isRead ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.title}
                </p>
              </div>
            ))
          ) : (
            <p className="text-[0.75rem] text-muted-foreground/40 italic">No posts yet</p>
          )}
        </CardContent>

        {/* Footer — source info */}
        <CardFooter className="flex items-start justify-between gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-[0.85rem]">{source.label}</CardTitle>
            <CardDescription className="truncate text-[0.65rem] mt-0.5">
              {source.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </CardDescription>
          </div>
          <div className="shrink-0">
            {newCount > 0 ? (
              <span className="text-[0.62rem] font-semibold text-primary tabular-nums">
                {newCount} new
              </span>
            ) : unreadCount > 0 ? (
              <span className="text-[0.62rem] text-muted-foreground tabular-nums">
                {unreadCount}
              </span>
            ) : null}
          </div>
        </CardFooter>
      </Card>

      {/* Actions: always visible on mobile, hover-only on desktop */}
      <div className="absolute right-2.5 top-2.5 z-10 flex gap-1 opacity-100 transition-opacity duration-150 md:right-3 md:top-3 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 rounded-lg border border-border/60 bg-card text-destructive hover:bg-transparent hover:text-destructive md:hover:bg-muted md:hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove feed ${source.label}`}
        >
          <TrashIcon className="size-3" weight="bold" />
        </Button>
      </div>
    </div>
  );
}
