import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

const DEFAULT_POLL_INTERVAL_MS = 15 * 60_000;

export const listForCurrentUser = query({
  args: {
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile || profile.userId !== identity.subject) {
      throw new Error("Profile not found.");
    }

    const subscriptions = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_userId_profileId", (q) =>
        q.eq("userId", identity.subject).eq("profileId", args.profileId),
      )
      .collect();

    return subscriptions.map((sub) => ({
      id: sub.sourceId,
      label: sub.label,
      inputUrl: sub.inputUrl,
      siteUrl: sub.siteUrl,
      feedUrl: sub.feedUrl,
      pollingEnabled: sub.pollingEnabled ?? true,
      pollIntervalMs: sub.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    }));
  },
});
