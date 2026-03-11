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
        placeholder="shivam.ing/blogs or https://example.com/feed.xml"
        className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/55 transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-1.5">
        <Button
          type="submit"
          size="sm"
          className="h-7 rounded-full text-xs"
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
            className="h-7 rounded-full text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="h-7 w-7 rounded-full ml-auto"
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
