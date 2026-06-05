import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCurrentUser(ctx);
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    return profiles
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((profile) => ({
        _id: profile._id,
        name: profile.name,
        createdAt: profile.createdAt,
      }));
  },
});
