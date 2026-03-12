# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
bunx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## OneDollarStats analytics

The web app can load the OneDollarStats tracker script from the root document.

- `VITE_ONEDOLLARSTATS_SITE_ID`: required to enable tracking.
- `VITE_ONEDOLLARSTATS_SCRIPT_SRC`: optional script URL override (defaults to `https://onedollarstats.com/tracker.js`).
- `VITE_ONEDOLLARSTATS_ENABLED`: optional boolean string (`true`/`false`) to force-enable or disable.

Behavior:

- In production, tracking loads automatically when `VITE_ONEDOLLARSTATS_SITE_ID` is set.
- In development, tracking stays disabled by default and only loads when `VITE_ONEDOLLARSTATS_ENABLED=true`.
