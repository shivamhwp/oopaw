import type { UserIdentity } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthenticatedCtx = MutationCtx | QueryCtx;

export const requireCurrentUser = async (ctx: AuthenticatedCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  return identity satisfies UserIdentity;
};
