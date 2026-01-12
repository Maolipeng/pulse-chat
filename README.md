# PulseChat Monorepo

Monorepo for PulseChat web, server, and Flutter clients.

## Apps

- `apps/client` Next.js web client
- `apps/server` Node/Express API + Socket.IO server
- `apps/flutter` Flutter client (Android/iOS/macOS/Web)

## Requirements

- Node.js 18+
- pnpm 9+
- Docker (for local Postgres)
- Flutter SDK 3.3+ (only for `apps/flutter`)

## Quick start (one click)

This script starts Postgres, installs dependencies, runs Prisma migrations, builds the web client, and starts server + web:

```
pnpm setup
```

## Manual setup

Install dependencies:

```
pnpm install
```

Start Postgres:

```
pnpm db:up
```

Run Prisma and start server:

```
pnpm --filter server prisma:generate
pnpm --filter server prisma:migrate
pnpm dev:server
```

Start web client:

```
pnpm dev:client
```

## Useful scripts

- `pnpm dev` run all dev tasks via Turbo
- `pnpm build` build all apps
- `pnpm db:up` start Postgres
- `pnpm db:down` stop Postgres

## Notes

- Default API URL for the web client is configured in `apps/client/.env.local`.
- Flutter client endpoint defaults are in `apps/flutter/lib/services/app_config.dart`.
