# t3s-agent

Bun monorepo with:

- `apps/web`: TanStack Start app
- `packages/ui`: shared React components
- `packages/typescript-config`: shared TypeScript config

## Tooling

- `tsgo` for typechecking
- `oxlint` for linting
- `oxfmt` for formatting
- `turbo` for task orchestration

## Commands

```sh
bun run dev
bun run web
bun run format
bun run check
bun run lint
bun run typecheck
```

Use filtered commands when you only want the web app:

```sh
bun run dev:web
bun run web:dev
bun run install:web
bun run web:install
bun run format:web
bun run web:format
bun run check:web
bun run web:check
bun run lint:web
bun run web:lint
bun run test:web
bun run web:test
bun run typecheck:web
bun run web:typecheck
```
