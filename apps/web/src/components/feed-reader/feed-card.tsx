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
    <div className="group relative min-h-[13rem] md:h-[13rem]">
      <Card
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        className={cn(
          "h-full cursor-pointer gap-0 py-0 pr-14 transition-colors duration-150 md:pr-0",
          isSelected ? "ring-primary/40 bg-primary/[0.02]" : "hover:bg-muted/30",
        )}
      >
        {/* Items */}
        <CardContent className="flex-1 px-4 pt-4 pb-3 flex flex-col gap-0">
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
        <CardFooter className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
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

      {/* Hover actions */}
      <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 rounded-lg bg-card hover:bg-muted border border-border/60 text-destructive hover:text-destructive"
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
