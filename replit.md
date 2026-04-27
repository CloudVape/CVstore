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

- `users` — real and AI persona users; includes `isAdmin` flag for admin gating
- `categories` — 6 forum categories
- `posts` — forum posts with tags, likes, ai flag
- `comments` — post comments with ai flag
- `products` — store products (now also `supplierId`, `externalSku`, `lastSyncedAt`; unique `(supplierId, externalSku)`)
- `suppliers` — dropshipper sources with column mapping + (placeholder) schedule
- `import_runs` — history of feed imports with per-row error log
- `orders` — e-commerce orders; now includes `shippedAt`, `deliveredAt`, `refundedAt`, `trackingNumber`, `reviewEmailSent`
- `email_log` — every outbound email logged with template, status, provider message ID, and error
- `newsletter_subscribers` — email opt-in with double-opt-in confirmation and signed unsubscribe tokens

## Admin / Dropshipper Imports

- Admin-only console at `/admin/suppliers`, `/admin/import`, `/admin/runs` (frontend)
- Routes mounted under `/api/admin/*`. Gating: `requireAdmin` middleware
  expects `Authorization: Bearer <users.session_token>` and verifies
  `users.isAdmin === true`. The session token is rotated on every login
  and only returned to the user it belongs to (login/signup responses).
  Public user endpoints intentionally omit `isAdmin` and `sessionToken`.
- Format-agnostic CSV pipeline: `lib/csv.ts` (RFC4180-ish parser) feeds
  `lib/import-engine.ts`. Engine upserts on `(supplierId, externalSku)`.
- CSV input arrives either as a `text/csv` request body (file upload) or
  fetched server-side from a saved supplier `sourceUrl`.
- "Automatic sync" is a UI placeholder — schedule intent is persisted on
  `suppliers.schedule` but no scheduler runs.
- To grant admin: update `users.is_admin = true` in SQL, or run
  `tsx artifacts/api-server/src/promote-admin.ts <username>`.
- Sample feed: `artifacts/api-server/src/sample-feeds/example-supplier.csv`.

## Email System (Resend)

- **Provider**: Resend (`resend` npm package). Set `RESEND_API_KEY` secret to activate. Without it, emails are logged as "skipped".
- **Required secrets**: `RESEND_API_KEY`, optionally `FROM_EMAIL_TRANSACTIONAL`, `FROM_EMAIL_MARKETING`, `SITE_URL`, `RESEND_WEBHOOK_SECRET`
- **Default from-addresses**: `support@vapevault.com` (transactional), `hello@vapevault.com` (marketing)
- **Core service**: `artifacts/api-server/src/lib/email.ts` — wraps Resend, logs every send to `email_log` table, graceful skip when no key
- **Templates**: `artifacts/api-server/src/lib/email-templates.ts` — neon-on-dark branded HTML + plain-text for all 9 template types
- **Templates in use**: welcome, order-confirmation, shipping-update, delivery-confirmation, refund-confirmation, review-request, newsletter-confirm, marketing-broadcast
- **Automatic triggers**:
  - Signup → welcome email (fire-and-forget)
  - Order created → order-confirmation email (fire-and-forget)
  - Admin sets order status to shipped/delivered/refunded → corresponding email
- **Review scheduler**: `artifacts/api-server/src/jobs/review-emails.ts` — runs daily, sends review-request 4 days after delivery, marks `orders.reviewEmailSent = true`
- **Newsletter**: Double opt-in — subscribe form in footer → confirmation email → confirm link → confirmed. One-click signed unsubscribe in every marketing email.
- **Admin pages**: `/admin/email-log` (log viewer with filters), `/admin/orders` (status updates), `/admin/subscribers` (subscriber list), `/admin/broadcast` (compose & send marketing emails)
- **Resend webhooks**: `POST /api/webhooks/resend` — updates log status on bounce/complaint/delivered events. Set `RESEND_WEBHOOK_SECRET` for signature verification.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
