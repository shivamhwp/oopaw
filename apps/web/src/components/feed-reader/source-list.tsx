import { ArrowClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SavedSource } from "@/lib/types";

type SourceSummary = {
  source: SavedSource;
  unreadCount: number;
  newCount: number;
  itemCount: number;
};

type SourceListProps = {
  items: SourceSummary[];
  selectedSourceId: string | null;
  refreshingSourceIds: string[];
  onSelect: (sourceId: string) => void;
  onTogglePolling: (sourceId: string, enabled: boolean) => void;
  onRefresh: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
};

export function SourceList({
  items,
  selectedSourceId,
  refreshingSourceIds,
  onSelect,
  onTogglePolling,
  onRefresh,
  onRemove,
}: SourceListProps) {
  if (!items.length) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-xs leading-6 text-muted-foreground">
          Add a direct RSS or Atom feed URL above to start reading.
        </p>
      </div>
    );
  }

  return (
    <nav className="py-1">
      {items.map(({ source, unreadCount, newCount }) => {
        const isSelected = source.id === selectedSourceId;
        const isRefreshing = refreshingSourceIds.includes(source.id);

        return (
          <div key={source.id} className={cn("group relative", isSelected && "bg-primary/[0.05]")}>
            <button
              type="button"
              onClick={() => onSelect(source.id)}
              className={cn(
                "w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors",
                isSelected
                  ? "text-foreground"
                  : "text-foreground/75 hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {/* Unread indicator dot */}
              <div
                className={cn(
                  "size-1.5 rounded-full shrink-0 transition-colors",
                  unreadCount > 0 ? "bg-primary" : "bg-border",
                )}
              />

              <div className="flex-1 min-w-0 pr-8">
                <div className="text-sm font-medium truncate leading-snug">{source.label}</div>
                <div className="text-[0.68rem] text-muted-foreground/70 truncate">
                  {source.siteUrl.replace(/^https?:\/\//, "")}
                </div>
              </div>

              {unreadCount > 0 && (
                <span className="shrink-0 text-[0.62rem] font-semibold text-primary bg-primary/10 rounded-full px-1.5 min-w-[1.25rem] text-center leading-5">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Hover actions */}
            <div
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5",
                "opacity-0 group-hover:opacity-100 transition-opacity",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={`Refresh ${source.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh(source.id);
                }}
              >
                <ArrowClockwiseIcon className={isRefreshing ? "animate-spin" : ""} weight="bold" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-full text-destructive hover:text-destructive"
                aria-label={`Remove ${source.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(source.id);
                }}
              >
                <TrashIcon weight="bold" />
              </Button>
            </div>

            {/* Polling toggle (show only on selected) */}
            {isSelected && (
              <div className="px-4 pb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`poll-${source.id}`}
                  className="size-3 rounded border-border accent-primary"
                  checked={source.pollingEnabled}
                  onChange={(e) => onTogglePolling(source.id, e.target.checked)}
                />
                <label
                  htmlFor={`poll-${source.id}`}
                  className="text-[0.65rem] text-muted-foreground cursor-pointer"
                >
                  Poll every {Math.round(source.pollIntervalMs / 60_000)} min
                </label>
              </div>
            )}

            {source.lastError && isSelected && (
              <p className="px-4 pb-2 text-[0.65rem] text-destructive truncate">
                {source.lastError}
              </p>
            )}

            {newCount > 0 && (
              <div className="mx-4 mb-2 text-[0.65rem] text-accent-foreground font-medium">
                {newCount} new
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
