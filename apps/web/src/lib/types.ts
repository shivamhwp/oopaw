import { feedSubscriptionSchema, type FeedSubscription } from "@repo/shared/feed/types";

export {
  FEED_READER_PANEL_OPEN_STORAGE_KEY,
  LEGACY_FEED_READER_STATE_STORAGE_KEY as FEED_READER_STATE_STORAGE_KEY,
  LOCAL_FEED_CACHE_VERSION as FEED_READER_STATE_VERSION,
  POLL_INTERVAL_MS,
  articleViewModeSchema,
  discoveredFeedSubscriptionSchema,
  discoveryResultSchema,
  feedItemSchema,
  feedSubscriptionSchema,
  fetchFeedSourceInputSchema,
  fetchedFeedSourceSchema,
  legacyFeedReaderStateV1Schema as feedReaderStateV1Schema,
  legacyFeedReaderStateV2Schema as feedReaderStateV2Schema,
  loadMoreSourceItemsInputSchema,
  loadMoreSourceItemsResultSchema,
  localFeedCacheSchema as feedReaderStateSchema,
  refreshFeedSourceInputSchema,
  refreshResultSchema,
  sourcePaginationSchema,
  storedFeedItemSchema,
  type ArticleViewMode,
  type DiscoveryResult,
  type FeedItem,
  type FetchedFeedSource,
  type LegacyFeedReaderStateV1 as FeedReaderStateV1,
  type LegacyFeedReaderStateV2 as FeedReaderStateV2,
  type LoadMoreSourceItemsInput,
  type LoadMoreSourceItemsResult,
  type LocalFeedCache as FeedReaderState,
  type LocalFeedCacheSourceState,
  type RefreshResult,
  type SourcePagination,
  type StoredFeedItem,
} from "@repo/shared/feed/types";

export const savedSourceSchema = feedSubscriptionSchema;

export type SavedSource = FeedSubscription;
