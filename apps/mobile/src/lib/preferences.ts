import type { ArticleViewMode } from "@repo/shared/feed/types";

export const defaultUserPreferences = {
  pollingIntervalMinutes: 15,
  defaultView: "reader" as ArticleViewMode,
};
