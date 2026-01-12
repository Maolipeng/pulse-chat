# Web Client (Next.js)

Next.js client for PulseChat. This app renders the web UI and connects to the Node server via HTTP and Socket.IO.

## Requirements

- Node.js 18+ (recommended)
- pnpm 9+
- Running API server (see `apps/server`)

## Environment

Create `apps/client/.env.local` (or edit if already present):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

If you use a hosted server, replace with your public URL.

## Install

From repo root:

```
pnpm install
```

## Development

From repo root:

```
pnpm dev:client
```

Or from this folder:

```
pnpm dev
```

App runs on `http://localhost:3000` by default.

## Build

From repo root:

```
pnpm build:client
```

## Production

Build first, then start:

```
pnpm --filter client build
pnpm --filter client start
```

## Common issues

- Wrong API URL: make sure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` are set and point to a reachable server.
- CORS: the server currently allows `*`, but reverse proxies can still block WebSocket upgrades.

## Project structure

- `src/app/` Next.js app router pages and UI
- `public/` static assets
