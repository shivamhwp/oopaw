import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userPreferences: defineTable({
    userId: v.string(),
    pollingIntervalMinutes: v.number(),
    defaultView: v.union(v.literal("reader"), v.literal("site")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  feedSubscriptions: defineTable({
    userId: v.string(),
    sourceId: v.string(),
    inputUrl: v.string(),
    label: v.string(),
    siteUrl: v.string(),
    feedUrl: v.string(),
    pollingEnabled: v.optional(v.boolean()),
    pollIntervalMs: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_sourceId", ["userId", "sourceId"]),
  bookmarks: defineTable({
    userId: v.string(),
    sourceId: v.optional(v.string()),
    itemId: v.optional(v.string()),
    url: v.string(),
    title: v.string(),
    excerpt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    sourceSiteUrl: v.optional(v.string()),
    publishedAt: v.optional(v.string()),
    bookmarkedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_url", ["userId", "url"]),
});
