import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";

const defaultPreferences = {
  pollingIntervalMinutes: 15,
  defaultView: "reader" as const,
};

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCurrentUser(ctx);
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
