# oopaw

a clean, no-nonsense rss feed reader that just works.

## Tech

TanStack Start, Convex, Clerk, Tailwind CSS, shadcn/ui, Bun, Turbo, Jotai, Vite

## Features

- **Subscribe to any RSS/Atom feed** — paste a url, get your posts. polling intervals keep things fresh automatically.
- **Split-pane reader** — read articles inline or pop out to the original site. resize panels however you like.
- **Bookmarks** — save stuff for later with one click. come back to it whenever.

## Getting Started

```sh
bun install
bun run dev
```

This spins up the web app and convex backend together.

## Project Structure

```
apps/web        — tanstack start app (the main thing)
packages/ui     — shared react components
packages/ts-config — shared typescript config
```

## Scripts

```sh
bun run dev          # run everything
bun run format       # check formatting (oxfmt)
bun run lint         # lint (oxlint)
bun run typecheck    # typecheck (tsgo)
bun run check        # all of the above
```
