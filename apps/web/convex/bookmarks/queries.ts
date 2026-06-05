import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const listForCurrentUser = query({
  args: {
    profileId: v.optional(v.id("profiles")),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const profileId = args.profileId;

    if (profileId) {
      const profile = await ctx.db.get(profileId);

      if (!profile || profile.userId !== identity.subject) {
        throw new Error("Profile not found.");
      }

      const bookmarks = await ctx.db
        .query("bookmarks")
        .withIndex("by_userId_profileId", (q) =>
          q.eq("userId", identity.subject).eq("profileId", profileId),
        )
        .collect();

      return bookmarks.sort((left, right) => right.bookmarkedAt - left.bookmarkedAt);
    }

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    return bookmarks.sort((left, right) => right.bookmarkedAt - left.bookmarkedAt);
  },
});
