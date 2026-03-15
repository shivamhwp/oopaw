import { auth as clerkAuth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

export const defaultAuthState = {
  isSignedIn: false,
  userId: null as string | null,
};

export type AppAuthState = typeof defaultAuthState;

type AuthSnapshot = AppAuthState & {
  token: string | null;
};

export const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await clerkAuth();
  const token = await auth.getToken({ template: "convex" });

  return {
    isSignedIn: Boolean(auth.userId),
    userId: auth.userId ?? null,
    token: token ?? null,
  } satisfies AuthSnapshot;
});
