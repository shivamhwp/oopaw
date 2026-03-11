import { useEffect } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Provider } from "jotai";
import { PwaRegistration } from "@/components/pwa/pwa-registration";
import { FeedQueryProvider } from "@/lib/query/client";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeProvider,
  getThemeInitScript,
} from "@/components/theme-provider";

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
        content:
          "Track fresh posts from any RSS feed or site URL and read them in a clean split-pane reader.",
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
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
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
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
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
    if (import.meta.env.DEV) {
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
              <PwaRegistration />
              {children}
              <Scripts />
            </FeedQueryProvider>
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
