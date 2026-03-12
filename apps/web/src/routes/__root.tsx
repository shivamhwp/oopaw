import { useEffect } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Provider } from "jotai";
import { FeedQueryProvider } from "@/lib/query/client";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeProvider,
  getThemeInitScript,
} from "@/components/theme-provider";
import { installLocalhostCacheCleanup } from "@/lib/deployment-recovery";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
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
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installLocalhostCacheCleanup();

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
            <FeedQueryProvider>
              {children}
              <Scripts />
            </FeedQueryProvider>
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
