import type { ArticleViewMode } from "@/lib/types";

const DEFAULT_POLLING_INTERVAL_MINUTES = 15;
const DEFAULT_ARTICLE_VIEW_MODE: ArticleViewMode = "reader";

export const defaultUserPreferences = {
  pollingIntervalMinutes: DEFAULT_POLLING_INTERVAL_MINUTES,
  defaultView: DEFAULT_ARTICLE_VIEW_MODE,
};
