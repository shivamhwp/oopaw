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

The web app uses the latest `onedollarstats` package API and initializes it from the root layout, which is the SPA setup recommended in the docs.

- `VITE_ONEDOLLARSTATS_ENABLED`: optional boolean string (`true`/`false`). Production is enabled by default unless this is `false`.
- `VITE_ONEDOLLARSTATS_HOSTNAME`: required for local development tracking. Set this to your production hostname.
- `VITE_ONEDOLLARSTATS_COLLECTOR_URL`: optional collector override.

Behavior:

- In production, analytics initializes automatically with OneDollarStats autocollection enabled.
- In development, analytics initializes only when `VITE_ONEDOLLARSTATS_ENABLED=true` and `VITE_ONEDOLLARSTATS_HOSTNAME` is set.
- TanStack Router navigation is tracked via the package's history listeners; no script tag is injected anymore.
