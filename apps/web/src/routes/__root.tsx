import { useEffect } from "react";
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Provider } from "jotai";
import { configure as configureOneDollarStats } from "onedollarstats";
import { shadcn } from "@clerk/themes";
import { getOneDollarStatsConfig } from "@/lib/analytics/onedollarstats";
import { defaultAuthState, fetchClerkAuth } from "@/lib/auth";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeProvider,
  getThemeInitScript,
} from "@/components/theme-provider";
import { installLocalhostCacheCleanup } from "@/lib/deployment-recovery";
import type { AppRouterContext } from "@/router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

const oneDollarStatsConfig = getOneDollarStatsConfig(import.meta.env);
let hasConfiguredOneDollarStats = false;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        title: "oop — Feed Reader",
      },
      {
        name: "description",
        content: "Track fresh posts from direct RSS and Atom feeds in a clean split-pane reader.",
      },
      {
        name: "theme-color",
        content: "#faf8f8",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#2a2629",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Micro+5&display=swap",
      },
      {
        rel: "icon",
        href: "/oop-logo.svg",
        type: "image/svg+xml",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex h-svh items-center justify-center px-6 text-center text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  beforeLoad: async (ctx) => {
    const auth = await fetchClerkAuth();

    if (auth.token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(auth.token);
    } else {
      ctx.context.convexQueryClient.serverHttpClient?.clearAuth();
    }

    return {
      auth: auth.isSignedIn ? { isSignedIn: true, userId: auth.userId } : defaultAuthState,
    };
  },
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { convexClient } = Route.useRouteContext();

  useEffect(() => {
    installLocalhostCacheCleanup();

    if (oneDollarStatsConfig && !hasConfiguredOneDollarStats) {
      configureOneDollarStats(oneDollarStatsConfig);
      hasConfiguredOneDollarStats = true;
    }

    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_REACT_GRAB === "true") {
      void import("react-grab");
      void import("@react-grab/mcp/client");
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <HeadContent />
      </head>
      <body>
        <Provider>
          <ThemeProvider defaultTheme={DEFAULT_THEME} storageKey={THEME_STORAGE_KEY}>
            <ClerkProvider
              appearance={{
                theme: shadcn,
              }}
              publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
            >
              <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
                {children}
                <Toaster position="bottom-right" />
                <Scripts />
              </ConvexProviderWithClerk>
            </ClerkProvider>
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
