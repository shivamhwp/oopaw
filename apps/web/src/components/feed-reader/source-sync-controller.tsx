import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { recoverFromStaleDeployment } from "@/lib/deployment-recovery";
import { queryKeys } from "@/lib/query/keys";
import { refreshFeedSource } from "@/lib/server/feed";
import type { RefreshResult, SavedSource, StoredFeedItem } from "@/lib/types";

type SourceSyncControllerProps = {
  source: SavedSource;
  initialItems: StoredFeedItem[];
  seenItemIds: string[];
  enabled: boolean;
  onRefresh: (result: RefreshResult) => void;
  onError: (message: string) => void;
};

export function SourceSyncController({
  source,
  initialItems,
  seenItemIds,
  enabled,
  onRefresh,
  onError,
}: SourceSyncControllerProps) {
  const lastAppliedCheck = useRef(source.lastCheckedAt);
  const lastError = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.sourceItems(source.id),
    queryFn: async () => {
      try {
        return await refreshFeedSource({
          data: { source, seenItemIds },
        });
      } catch (error) {
        recoverFromStaleDeployment(error);
        throw error;
      }
    },
    enabled,
    initialData:
      source.lastCheckedAt && initialItems.length
        ? {
            sourceId: source.id,
            items: initialItems,
            newCount: 0,
            checkedAt: source.lastCheckedAt,
          }
        : undefined,
    initialDataUpdatedAt: source.lastCheckedAt ? Date.parse(source.lastCheckedAt) : undefined,
    refetchInterval: enabled && source.pollingEnabled ? source.pollIntervalMs : false,
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
