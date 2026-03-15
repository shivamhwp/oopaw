import type { ArticleViewMode } from "@/lib/types";

export const DEFAULT_POLLING_INTERVAL_MINUTES = 15;
export const DEFAULT_POLLING_INTERVAL_MS = DEFAULT_POLLING_INTERVAL_MINUTES * 60_000;
export const DEFAULT_ARTICLE_VIEW_MODE: ArticleViewMode = "reader";

export const defaultUserPreferences = {
  pollingIntervalMinutes: DEFAULT_POLLING_INTERVAL_MINUTES,
  defaultView: DEFAULT_ARTICLE_VIEW_MODE,
};
