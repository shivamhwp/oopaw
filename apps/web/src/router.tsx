import { ConvexQueryClient } from "@convex-dev/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexReactClient } from "convex/react";
import { defaultAuthState, type AppAuthState } from "@/lib/auth";
import { createAppQueryClient } from "@/lib/query/client";
import { routeTree } from "./routeTree.gen";

export type AppRouterContext = {
  queryClient: ReturnType<typeof createAppQueryClient>;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
  auth: AppAuthState;
};

export function getRouter() {
  const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
  const convexQueryClient = new ConvexQueryClient(convexClient);
  const queryClient = createAppQueryClient(convexQueryClient);

  convexQueryClient.connect(queryClient);

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      convexClient,
      convexQueryClient,
      auth: defaultAuthState,
    },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return routerWithQueryClient(router, queryClient);
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
