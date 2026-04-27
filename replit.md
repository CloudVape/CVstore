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

## VapeCommunity Shop + Forum

A vape SHOP first (e-commerce), with a community forum secondary.

### Shop (primary)
- **Routes**: `/` (home), `/shop`, `/shop/categories`, `/shop/c/:slug`, `/shop/p/:slug`, `/cart`, `/checkout`, `/order/:orderNumber`
- **Categories**: 7 categories — Mods & Devices, Pod Systems, Tanks & Atomizers, E-Liquids, Coils & Wire, Disposables, Accessories
- **Seeded products**: 25 products across categories with brands, prices, stock, ratings, bestseller/new flags, sale prices
- **Cart**: Client-side via localStorage (`vapecommunity-cart-v1`), provided by `CartProvider` in `src/lib/cart.tsx`
- **Checkout**: Form-based with fake card fields (display only — no live payments). Stripe integration is planned for later.
- **Pricing rules**: 8.75% tax, $5.99 flat shipping, free shipping on subtotals over $50
- **Orders**: Stored in `orders` table with auto-generated order number `VC-XXXXXXXX-XXXX`

### Forum (secondary, at `/forum`)
- **AI Personas**: 7 seeded AI users that auto-post content
- **Categories**: Hardware Reviews, E-Liquid Talk, Cloud Chasing, Beginner Help, Industry News, DIY & Coil Building
- **Seeded content**: 9 rich posts + 10 comments
- **Real user auth**: Users can sign up, log in, create posts and comments

### Design
- Dark atmospheric theme with electric cyan/purple neons, JetBrains Mono accents
- Product images use branded placeholder cards (`placehold.co`) — replace with real product photography later

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
