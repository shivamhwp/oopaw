import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { refreshDiscoveredFeed } from "@repo/shared/feed/service";
import type { RefreshResult, SavedSource, StoredFeedItem } from "@/lib/types";

type SourceSyncControllerProps = {
  source: SavedSource;
  initialItems: StoredFeedItem[];
  seenItemIds: string[];
  enabled: boolean;
  pollingIntervalMs: number;
  lastCheckedAt?: string;
  onRefresh: (result: RefreshResult) => void;
  onError: (message: string) => void;
};

export function SourceSyncController({
  source,
  initialItems,
  seenItemIds,
  enabled,
  pollingIntervalMs,
  lastCheckedAt,
  onRefresh,
  onError,
}: SourceSyncControllerProps) {
  const lastAppliedCheck = useRef(lastCheckedAt);
  const lastError = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.sourceItems(source.sourceId),
    queryFn: () =>
      refreshDiscoveredFeed({
        source: { sourceId: source.sourceId, feedUrl: source.feedUrl },
        seenItemIds,
      }),
    enabled,
    initialData:
      lastCheckedAt && initialItems.length
        ? {
            sourceId: source.sourceId,
            items: initialItems,
            newCount: 0,
            checkedAt: lastCheckedAt,
          }
        : undefined,
    initialDataUpdatedAt: lastCheckedAt ? Date.parse(lastCheckedAt) : undefined,
    refetchInterval: enabled ? pollingIntervalMs : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!query.data || query.data.checkedAt === lastAppliedCheck.current) {
      return;
    }

    lastAppliedCheck.current = query.data.checkedAt;
    onRefresh(query.data);
  }, [onRefresh, query.data]);

  useEffect(() => {
    if (!query.error) {
      lastError.current = null;
      return;
    }

    const message =
      query.error instanceof Error
        ? query.error.message
        : "This source could not be refreshed right now.";

    if (message !== lastError.current) {
      lastError.current = message;
      onError(message);
    }
  }, [onError, query.error]);

  return null;
}
