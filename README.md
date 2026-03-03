# Inkspace

A collaborative drawing application. The project includes a frontend, HTTP backend, WebSocket backend, and shared packages. The repository uses Turborepo and pnpm workspaces to manage multiple apps and packages.

## Features

- Real-time collaborative drawing with WebSocket-based rooms and presence.
- Room lifecycle: create, join, join requests, and member management.
- Persistent drawings and chat backed by a database (Prisma migrations included).
- Drawing primitives with `shapeId` and per-room background color support.
- Role-aware UI with admin controls and member panels.

## Tech stack

- Frontend: Next.js + TypeScript (`apps/frontend`).
- Backends: Node.js + TypeScript (HTTP and WebSocket servers in `apps/http-backend` and `apps/ws-backend`).
- Database: Prisma ORM (`packages/database/prisma`).
- Monorepo tools: Turborepo + pnpm workspaces.

## Architecture overview

- Clients use the WebSocket backend for real-time canvas events and presence.
- The HTTP backend serves REST endpoints for authentication, room management, and non-realtime operations.
- Shared types and utilities live in `packages/` to keep behavior consistent across services.

## Repository structure

```text
Inkspace/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── turbo.json
├── apps/
│   ├── frontend/
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   ├── postcss.config.mjs
+│  │  ├── README.md
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── globals.css
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx
│   │       ├── (auth)/
│   │       │   ├── signin/page.tsx
│   │       │   └── signup/page.tsx
│   │       └── components/
│   │           ├── auth/auth-page.tsx
│   │           └── canvas/
│   │               ├── admin-menu.tsx
│   │               ├── room-canvas.tsx
│   │               └── (other canvas components)
│   ├── http-backend/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── middleware.ts
│   └── ws-backend/
│       ├── package.json
│       └── src/
│           └── index.ts
├── packages/
│   ├── backend-common/
│   │   └── src/index.ts
│   ├── common/
│   │   └── src/types.ts
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │     
│   │   └── src/index.ts
│   ├── eslint-config/
│   │   ├── base.js
│   │   └── next.js
│   ├── typescript-config/
│   └── ui/
│       └── src/
│           ├── button.tsx
│           └── card.tsx
└── (other config files)
```

## Quick start

1. Install dependencies at the repository root:

```bash
pnpm install
```

2. Start all services in development :

```bash
pnpm run dev
```

3. Start individual services:

```bash
# Frontend 
cd apps\frontend && pnpm run dev

# WebSocket backend
cd apps\ws-backend && pnpm run dev

# HTTP backend
cd apps\http-backend && pnpm run dev
```

