import { ArrowClockwiseIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/feed.xml or https://example.com/atom.xml"
        className="h-10 text-sm focus:border-primary/50 md:h-9"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <Button
            type="submit"
            size="sm"
            className="h-9 flex-1 rounded-full px-3 text-sm min-[420px]:flex-none md:h-7 md:px-2.5 md:text-xs"
            disabled={isSubmitting}
          >
            <PlusIcon weight="bold" />
            {isSubmitting ? "Adding…" : "Add feed"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 flex-1 rounded-full px-3 text-sm min-[420px]:flex-none md:h-7 md:px-2.5 md:text-xs"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-full rounded-full px-3 text-sm sm:ml-auto sm:h-7 sm:w-7 sm:px-0 md:text-xs"
          disabled={isRefreshing}
          onClick={onRefreshAll}
          title="Refresh all sources"
        >
          <ArrowClockwiseIcon className={isRefreshing ? "animate-spin" : ""} weight="bold" />
          <span className="sm:hidden">Refresh all feeds</span>
        </Button>
      </div>
    </form>
  );
}
