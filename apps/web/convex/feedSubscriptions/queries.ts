import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCurrentUser(ctx);
    const subscriptions = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    return subscriptions.map((sub) => ({
      id: sub.sourceId,
      label: sub.label,
      inputUrl: sub.inputUrl,
      siteUrl: sub.siteUrl,
      feedUrl: sub.feedUrl,
      pollingEnabled: sub.pollingEnabled,
      pollIntervalMs: sub.pollIntervalMs,
    }));
  },
});
