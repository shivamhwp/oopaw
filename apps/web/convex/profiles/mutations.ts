import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

const DEFAULT_PROFILE_NAME = "Default";
const FALLBACK_PROFILE_NAME = "Profile";
const MAX_PROFILE_NAME_LENGTH = 40;

const normalizeProfileName = (name: string) => name.trim().replace(/\s+/g, " ");

const assertProfileName = (name: string) => {
  const normalized = normalizeProfileName(name);

  if (!normalized) {
    throw new Error("Profile name is required.");
  }

  return normalized.slice(0, MAX_PROFILE_NAME_LENGTH);
};

const listProfiles = async (ctx: MutationCtx, userId: string) =>
  ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

const getProfileOrThrow = async (ctx: MutationCtx, profileId: Id<"profiles">, userId: string) => {
  const profile = await ctx.db.get(profileId);

  if (!profile || profile.userId !== userId) {
    throw new Error("Profile not found.");
  }

  return profile;
};

const toProfileSummary = (profile: { _id: Id<"profiles">; name: string; createdAt: number }) => ({
  _id: profile._id,
  name: profile.name,
  createdAt: profile.createdAt,
});

const createNextProfileName = (profiles: { name: string }[]) => {
  const names = new Set(profiles.map((profile) => profile.name));

  if (!names.has(FALLBACK_PROFILE_NAME)) {
    return FALLBACK_PROFILE_NAME;
  }

  for (let index = 2; index < 1000; index += 1) {
    const name = `${FALLBACK_PROFILE_NAME} ${index}`;

    if (!names.has(name)) {
      return name;
    }
  }

  return `${FALLBACK_PROFILE_NAME} ${Date.now()}`;
};

export const ensureDefaultForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCurrentUser(ctx);
    const userId = identity.subject;
    const profiles = await listProfiles(ctx, userId);
    const now = Date.now();
    const defaultProfile =
      profiles.find((profile) => profile.name === DEFAULT_PROFILE_NAME) ??
      profiles.sort((left, right) => left.createdAt - right.createdAt)[0];
    const profile =
      defaultProfile ??
      (await ctx.db.get(
        await ctx.db.insert("profiles", {
          userId,
          name: DEFAULT_PROFILE_NAME,
          createdAt: now,
          updatedAt: now,
        }),
      ));

    if (!profile) {
      throw new Error("Could not create default profile.");
    }

    const [subscriptions, bookmarks] = await Promise.all([
      ctx.db
        .query("feedSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("bookmarks")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    await Promise.all([
      ...subscriptions
        .filter((subscription) => !subscription.profileId)
        .map((subscription) =>
          ctx.db.patch(subscription._id, {
            profileId: profile._id,
            updatedAt: now,
          }),
        ),
      ...bookmarks
        .filter((bookmark) => !bookmark.profileId || !bookmark.profile)
        .map((bookmark) =>
          ctx.db.patch(bookmark._id, {
            profileId: bookmark.profileId ?? profile._id,
            profile: bookmark.profile ?? profile.name,
            updatedAt: now,
          }),
        ),
    ]);

    return toProfileSummary(profile);
  },
});

export const createForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCurrentUser(ctx);
    const profiles = await listProfiles(ctx, identity.subject);
    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      userId: identity.subject,
      name: createNextProfileName(profiles),
      createdAt: now,
      updatedAt: now,
    });
    const profile = await ctx.db.get(profileId);

    if (!profile) {
      throw new Error("Could not create profile.");
    }

    return toProfileSummary(profile);
  },
});

export const renameForCurrentUser = mutation({
  args: {
    profileId: v.id("profiles"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireCurrentUser(ctx);
    const name = assertProfileName(args.name);
    const profile = await getProfileOrThrow(ctx, args.profileId, identity.subject);
    const now = Date.now();

    if (profile.name === name) {
      return toProfileSummary(profile);
    }

    await ctx.db.patch(profile._id, {
      name,
      updatedAt: now,
    });

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_profileId", (q) =>
        q.eq("userId", identity.subject).eq("profileId", profile._id),
      )
      .collect();

    await Promise.all(
      bookmarks.map((bookmark) =>
        ctx.db.patch(bookmark._id, {
          profile: name,
          updatedAt: now,
        }),
      ),
    );

    return {
      _id: profile._id,
      name,
      createdAt: profile.createdAt,
    };
  },
});
