import { query } from "../_generated/server";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    return subscriptions
      .sort((left, right) => left.label.localeCompare(right.label))
      .map(({ _id, _creationTime, userId, ...subscription }) => subscription);
  },
});
