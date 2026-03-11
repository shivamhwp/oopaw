import { z } from "zod";

export const sourceKindSchema = z.enum(["feed", "scrape"]);
export const articleViewModeSchema = z.enum(["site", "reader"]);

export const savedSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  inputUrl: z.string().min(1),
  siteUrl: z.string().url(),
  feedUrl: z.string().url().optional(),
  kind: sourceKindSchema,
  pollingEnabled: z.boolean(),
  pollIntervalMs: z.number().int().positive(),
  lastCheckedAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
});

export const storedFeedItemSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  author: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const feedItemSchema = storedFeedItemSchema.extend({
  isNew: z.boolean(),
  isRead: z.boolean(),
});

export const readerArticleSchema = z.object({
  itemId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  byline: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  contentHtml: z.string().optional(),
  excerpt: z.string().optional(),
  readTimeMinutes: z.number().int().positive().optional(),
  fallbackReason: z.string().optional(),
});

export const articleEmbedStatusSchema = z.object({
  itemId: z.string().min(1),
  url: z.string().url(),
  finalUrl: z.string().url().optional(),
  canEmbed: z.boolean(),
  blockedReason: z.string().optional(),
});

export const sourcePaginationSchema = z.object({
  loadedPageUrls: z.array(z.string().url()),
  nextPageUrl: z.string().url().optional(),
});

export const discoveryResultSchema = z.object({
  source: savedSourceSchema,
  items: z.array(storedFeedItemSchema),
  checkedAt: z.string().datetime(),
  nextPageUrl: z.string().url().optional(),
});

export const refreshResultSchema = z.object({
  sourceId: z.string().min(1),
  items: z.array(storedFeedItemSchema),
  newCount: z.number().int().nonnegative(),
  checkedAt: z.string().datetime(),
  nextPageUrl: z.string().url().optional(),
});

export const feedReaderStateV1Schema = z.object({
  version: z.literal(1),
  sources: z.array(savedSourceSchema),
  itemsBySource: z.record(z.string(), z.array(storedFeedItemSchema)),
  readItemIds: z.array(z.string()),
  seenItemIdsBySource: z.record(z.string(), z.array(z.string())),
  selectedSourceId: z.string().nullable(),
});

export const feedReaderStateSchema = z.object({
  version: z.literal(2),
  sources: z.array(savedSourceSchema),
  itemsBySource: z.record(z.string(), z.array(storedFeedItemSchema)),
  readItemIds: z.array(z.string()),
  seenItemIdsBySource: z.record(z.string(), z.array(z.string())),
  selectedSourceId: z.string().nullable(),
  paginationBySource: z.record(z.string(), sourcePaginationSchema),
});

export const discoverSourceInputSchema = z.object({
  input: z.string().min(1),
});

export const refreshSourceInputSchema = z.object({
  source: savedSourceSchema,
  seenItemIds: z.array(z.string()).default([]),
});

export const loadMoreSourceItemsInputSchema = z.object({
  source: savedSourceSchema,
  pageUrl: z.string().url(),
});

export const fetchArticleInputSchema = z.object({
  itemId: z.string().min(1),
  url: z.string().url(),
});

export const loadMoreSourceItemsResultSchema = z.object({
  sourceId: z.string().min(1),
  pageUrl: z.string().url(),
  items: z.array(storedFeedItemSchema),
  nextPageUrl: z.string().url().optional(),
});

export const POLL_INTERVAL_MS = 5 * 60_000;
export const FEED_READER_STATE_VERSION = 2;
export const FEED_READER_STATE_STORAGE_KEY = "papertrail.feed-reader.state";
export const FEED_READER_ARTICLE_VIEW_MODE_STORAGE_KEY = "papertrail.feed-reader.article-view";
export const FEED_READER_PANEL_OPEN_STORAGE_KEY = "papertrail.feed-reader.panel-open";

export type SourceKind = z.infer<typeof sourceKindSchema>;
export type ArticleViewMode = z.infer<typeof articleViewModeSchema>;
export type SavedSource = z.infer<typeof savedSourceSchema>;
export type StoredFeedItem = z.infer<typeof storedFeedItemSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type ReaderArticle = z.infer<typeof readerArticleSchema>;
export type ArticleEmbedStatus = z.infer<typeof articleEmbedStatusSchema>;
export type SourcePagination = z.infer<typeof sourcePaginationSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
export type RefreshResult = z.infer<typeof refreshResultSchema>;
export type FeedReaderStateV1 = z.infer<typeof feedReaderStateV1Schema>;
export type FeedReaderState = z.infer<typeof feedReaderStateSchema>;
export type LoadMoreSourceItemsInput = z.infer<typeof loadMoreSourceItemsInputSchema>;
export type LoadMoreSourceItemsResult = z.infer<typeof loadMoreSourceItemsResultSchema>;
