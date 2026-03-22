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
};

export function SourceForm({
  value,
  error,
  isSubmitting,
  isOpen,
  onChange,
  onSubmit,
  onCancel,
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/feed.xml or https://example.com/atom.xml"
          className="min-w-[16rem] flex-1 border border-border focus:border-primary/50"
        />
        <div className="flex items-center gap-2 md:shrink-0">
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
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
