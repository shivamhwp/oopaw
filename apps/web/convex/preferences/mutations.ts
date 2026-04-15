import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const setPollingIntervalForCurrentUser = mutation({
  args: {
    pollingIntervalMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);

    if (!Number.isInteger(args.pollingIntervalMinutes) || args.pollingIntervalMinutes < 1) {
      throw new Error("Polling interval must be a positive integer.");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    const now = Date.now();
    const defaultView = existing?.defaultView ?? "reader";

    if (existing) {
      await ctx.db.patch(existing._id, {
        pollingIntervalMinutes: args.pollingIntervalMinutes,
        updatedAt: now,
      });

      return {
        pollingIntervalMinutes: args.pollingIntervalMinutes,
        defaultView,
      };
    }

    await ctx.db.insert("userPreferences", {
      userId: identity.subject,
      pollingIntervalMinutes: args.pollingIntervalMinutes,
      defaultView,
      createdAt: now,
      updatedAt: now,
    });

    return {
      pollingIntervalMinutes: args.pollingIntervalMinutes,
      defaultView,
    };
  },
});

export const setDefaultViewForCurrentUser = mutation({
  args: {
    defaultView: v.union(v.literal("reader"), v.literal("site")),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    const now = Date.now();
    const pollingIntervalMinutes = existing?.pollingIntervalMinutes ?? 15;

    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultView: args.defaultView,
        updatedAt: now,
      });

      return {
        pollingIntervalMinutes,
        defaultView: args.defaultView,
      };
    }

    await ctx.db.insert("userPreferences", {
      userId: identity.subject,
      pollingIntervalMinutes,
      defaultView: args.defaultView,
      createdAt: now,
      updatedAt: now,
    });

    return {
      pollingIntervalMinutes,
      defaultView: args.defaultView,
    };
  },
});
