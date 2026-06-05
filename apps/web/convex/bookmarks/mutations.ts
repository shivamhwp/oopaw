import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

export const toggleForCurrentUser = mutation({
  args: {
    profileId: v.id("profiles"),
    url: v.string(),
    title: v.string(),
    excerpt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    sourceSiteUrl: v.optional(v.string()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile || profile.userId !== identity.subject) {
      throw new Error("Profile not found.");
    }

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_profileId_url", (q) =>
        q.eq("userId", identity.subject).eq("profileId", args.profileId).eq("url", args.url),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { bookmarked: false };
    }

    const now = Date.now();

    await ctx.db.insert("bookmarks", {
      userId: identity.subject,
      profileId: args.profileId,
      profile: profile.name,
      url: args.url,
      title: args.title,
      excerpt: args.excerpt,
      imageUrl: args.imageUrl,
      sourceLabel: args.sourceLabel,
      sourceSiteUrl: args.sourceSiteUrl,
      publishedAt: args.publishedAt,
      bookmarkedAt: now,
      updatedAt: now,
    });

    return { bookmarked: true };
  },
});
