# API Server (Node + Express + Prisma)

Backend API and Socket.IO server for PulseChat. Provides auth, conversations, messaging, and WebRTC signaling.

## Requirements

- Node.js 18+ (recommended)
- pnpm 9+
- Docker (for local Postgres)

## Environment

Create `apps/server/.env`:

```
DATABASE_URL=postgresql://pulsechat:0fd3b5cb976829cffa1f7336cbb48a70@localhost:5432/pulsechat
JWT_SECRET=replace-me
```

## Database (local)

From repo root:

```
pnpm db:up
```

## Install

From repo root:

```
pnpm install
```

## Prisma

Generate client:

```
pnpm --filter server prisma:generate
```

Run migrations:

```
pnpm --filter server prisma:migrate
```

## Development

From repo root:

```
pnpm dev:server
```

Server listens on `http://0.0.0.0:3001` by default.

## Health check

```
GET /health
```

## Project structure

- `index.js` server entry
- `prisma/` schema and migrations
