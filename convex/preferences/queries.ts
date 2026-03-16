import { query } from "../_generated/server";

const defaultPreferences = {
  pollingIntervalMinutes: 15,
  defaultView: "reader" as const,
};

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return defaultPreferences;
    }

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!preferences) {
      return defaultPreferences;
    }

    return {
      pollingIntervalMinutes: preferences.pollingIntervalMinutes,
      defaultView: preferences.defaultView,
    };
  },
});
