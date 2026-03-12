import { ArrowClockwise, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type SourceFormProps = {
  value: string;
  error?: string;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
};

export function SourceForm({
  value,
  error,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
  onRefreshAll,
  isRefreshing,
}: SourceFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/feed.xml or https://example.com/atom.xml"
        className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/55 transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10 md:py-2 md:text-xs"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          className="h-8 rounded-full px-3 text-sm md:h-7 md:px-2.5 md:text-xs"
          disabled={isSubmitting}
        >
          <Plus weight="bold" />
          {isSubmitting ? "Adding…" : "Add feed"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-3 text-sm md:h-7 md:px-2.5 md:text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="ml-auto h-8 w-8 rounded-full md:h-7 md:w-7"
          disabled={isRefreshing}
          onClick={onRefreshAll}
          title="Refresh all sources"
        >
          <ArrowClockwise className={isRefreshing ? "animate-spin" : ""} weight="bold" />
        </Button>
      </div>
    </form>
  );
}
