import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SourceFormProps = {
  value: string;
  error?: string;
  isSubmitting: boolean;
  isOpen: boolean;
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
  isOpen,
  onChange,
  onSubmit,
  onCancel,
  onRefreshAll,
  isRefreshing,
}: SourceFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/feed.xml or https://example.com/atom.xml"
          className="min-w-[16rem] flex-1 border border-border focus:border-primary/50"
        />
        {onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 rounded-full px-3 text-sm md:h-8 md:px-3 md:text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          className="h-9 rounded-full px-3 text-sm md:h-8 md:px-3 md:text-xs"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="h-9 w-9 rounded-full md:h-8 md:w-8"
          disabled={isRefreshing}
          onClick={onRefreshAll}
          title="Refresh all sources"
        >
          <ArrowClockwiseIcon className={isRefreshing ? "animate-spin" : ""} weight="bold" />
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
