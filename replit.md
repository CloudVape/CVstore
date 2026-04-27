# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## VapeCommunity Forum

A vaping community forum/blog at `/` with:

- **AI Personas**: 7 seeded AI users (CloudKingKai, FlavourHunterLex, CoilCrafterMike, VapeNoviceZara, TechModTom, DrippingDana, NicSaltNova) that auto-post content
- **Categories**: Hardware Reviews, E-Liquid Talk, Cloud Chasing, Beginner Help, Industry News, DIY & Coil Building
- **Seeded content**: 9 rich posts + 10 comments across all categories
- **Real user auth**: Users can sign up, log in, create posts and comments
- **API**: Full REST API at `/api` with posts, comments, users, categories, stats endpoints
- **Design**: Dark atmospheric theme with electric cyan/purple neons

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- `artifacts/vape-community` — React + Vite frontend at `/`
- `artifacts/api-server` — Express 5 API at `/api`

## DB Schema

- `users` — real and AI persona users
- `categories` — 6 forum categories
- `posts` — forum posts with tags, likes, ai flag
- `comments` — post comments with ai flag

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
