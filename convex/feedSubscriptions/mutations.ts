import { v } from "convex/values";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

const subscriptionArgs = {
  sourceId: v.string(),
  inputUrl: v.string(),
  label: v.string(),
  siteUrl: v.string(),
  feedUrl: v.string(),
};

const upsertSubscription = async (
  ctx: MutationCtx,
  userId: string,
  args: {
    sourceId: string;
    inputUrl: string;
    label: string;
    siteUrl: string;
    feedUrl: string;
  },
) => {
  const existing = await ctx.db
    .query("feedSubscriptions")
    .withIndex("by_userId_sourceId", (q) => q.eq("userId", userId).eq("sourceId", args.sourceId))
    .unique();
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...args,
      updatedAt: now,
    });

    return { ...args, createdAt: existing.createdAt, updatedAt: now };
  }

  await ctx.db.insert("feedSubscriptions", {
    userId,
    ...args,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ...args,
    createdAt: now,
    updatedAt: now,
  };
};

export const createForCurrentUser = mutation({
  args: subscriptionArgs,
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);

    return upsertSubscription(ctx, identity.subject, args);
  },
});

export const removeForCurrentUser = mutation({
  args: {
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_userId_sourceId", (q) =>
        q.eq("userId", identity.subject).eq("sourceId", args.sourceId),
      )
      .unique();

    if (!existing) {
      return { removed: false };
    }

    await ctx.db.delete(existing._id);

    return { removed: true };
  },
});

export const importForCurrentUser = mutation({
  args: {
    subscriptions: v.array(
      v.object({
        sourceId: v.string(),
        inputUrl: v.string(),
        label: v.string(),
        siteUrl: v.string(),
        feedUrl: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);

    for (const subscription of args.subscriptions) {
      await upsertSubscription(ctx, identity.subject, subscription);
    }

    return {
      importedCount: args.subscriptions.length,
    };
  },
});
