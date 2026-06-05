import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  profiles: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_name", ["userId", "name"]),
  feedSubscriptions: defineTable({
    userId: v.string(),
    profileId: v.optional(v.id("profiles")),
    sourceId: v.string(),
    label: v.string(),
    inputUrl: v.string(),
    siteUrl: v.string(),
    feedUrl: v.string(),
    pollingEnabled: v.optional(v.boolean()),
    pollIntervalMs: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_profileId", ["userId", "profileId"])
    .index("by_userId_profileId_sourceId", ["userId", "profileId", "sourceId"])
    .index("by_userId_sourceId", ["userId", "sourceId"]),
  userPreferences: defineTable({
    userId: v.string(),
    pollingIntervalMinutes: v.number(),
    defaultView: v.union(v.literal("reader"), v.literal("site")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  bookmarks: defineTable({
    userId: v.string(),
    profileId: v.optional(v.id("profiles")),
    profile: v.optional(v.string()),
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
    .index("by_userId_profileId", ["userId", "profileId"])
    .index("by_userId_profileId_url", ["userId", "profileId", "url"])
    .index("by_userId_url", ["userId", "url"]),
});
