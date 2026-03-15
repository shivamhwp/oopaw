import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCurrentUser(ctx);
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    return bookmarks.sort((left, right) => right.bookmarkedAt - left.bookmarkedAt);
  },
});
