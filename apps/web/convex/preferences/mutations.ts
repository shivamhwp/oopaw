import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const upsertForCurrentUser = mutation({
  args: {
    pollingIntervalMinutes: v.number(),
    defaultView: v.union(v.literal("reader"), v.literal("site")),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);

    if (!Number.isInteger(args.pollingIntervalMinutes) || args.pollingIntervalMinutes < 1) {
      throw new Error("Polling interval must be a positive integer.");
    }

    if (!["reader", "site"].includes(args.defaultView)) {
      throw new Error("Invalid default view.");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pollingIntervalMinutes: args.pollingIntervalMinutes,
        defaultView: args.defaultView,
        updatedAt: now,
      });

      return {
        pollingIntervalMinutes: args.pollingIntervalMinutes,
        defaultView: args.defaultView,
      };
    }

    await ctx.db.insert("userPreferences", {
      userId: identity.subject,
      pollingIntervalMinutes: args.pollingIntervalMinutes,
      defaultView: args.defaultView,
      createdAt: now,
      updatedAt: now,
    });

    return {
      pollingIntervalMinutes: args.pollingIntervalMinutes,
      defaultView: args.defaultView,
    };
  },
});
