import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const addForCurrentUser = mutation({
  args: {
    sourceId: v.string(),
    label: v.string(),
    inputUrl: v.string(),
    siteUrl: v.string(),
    feedUrl: v.string(),
    pollingEnabled: v.boolean(),
    pollIntervalMs: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_userId_sourceId", (q) =>
        q.eq("userId", identity.subject).eq("sourceId", args.sourceId),
      )
      .unique();

    if (existing) {
      const now = Date.now();
      await ctx.db.patch(existing._id, {
        label: args.label,
        inputUrl: args.inputUrl,
        siteUrl: args.siteUrl,
        feedUrl: args.feedUrl,
        pollingEnabled: args.pollingEnabled,
        pollIntervalMs: args.pollIntervalMs,
        updatedAt: now,
      });
      return;
    }

    const now = Date.now();
    await ctx.db.insert("feedSubscriptions", {
      userId: identity.subject,
      sourceId: args.sourceId,
      label: args.label,
      inputUrl: args.inputUrl,
      siteUrl: args.siteUrl,
      feedUrl: args.feedUrl,
      pollingEnabled: args.pollingEnabled,
      pollIntervalMs: args.pollIntervalMs,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeForCurrentUser = mutation({
  args: { sourceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_userId_sourceId", (q) =>
        q.eq("userId", identity.subject).eq("sourceId", args.sourceId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
