# Phase 1 foundation evidence

Date: 2026-10-24. Machine: Windows x64, Node 24.21.0, pnpm 11.25.0, local PostgreSQL 18.4.0 (embedded-postgres package 18.4.0-beta.17). This is development verification, not a production pilot.

## Built

- Next.js catalog workspace with account creation/sign-in, shop selection/creation, search, product creation, and active/inactive toggles.
- Fastify API with Better Auth sessions, owner/cashier membership, shop-scoped product operations, input validation, error IDs, restricted CORS/origin, and redacted request logs.
- Drizzle migrations for shops, memberships, products, and a membership foreign key to Better Auth users. Product prices use integer paise; PostgreSQL uses UTF-8 for Hindi names.
- Free local PostgreSQL startup script and separate `bolibill_test` database.

## Checks actually run

- `pnpm --filter @bolibill/api check` — passed.
- `pnpm --filter @bolibill/web check` — passed after replacing a generated layout type and removing a synchronous effect state update.
- `pnpm --filter @bolibill/api build` and `pnpm --filter @bolibill/web build` — passed.
- `pnpm --filter @bolibill/api test` — one PostgreSQL integration test passed. It verifies two-shop reads/writes, owner and cashier roles, self-demotion prevention, duplicate SKU conflict, rejected origin, Hindi product round trip, and unchanged price after denied writes.
- Browser smoke via Playwright CLI on localhost: account creation -> shop creation -> add `चावल`, SKU `RICE-01`, alias `Chawal`, `kg`, ₹125.50 -> reload with session retained -> sign out -> sign in with the catalog retained. The [screenshot](phase1-catalog.png) shows the saved catalog row.
- Workspace-level `pnpm check`, `pnpm test`, and `pnpm build` — all passed after the browser smoke check.

## Remaining Phase 1 work

Catalog import, pack sizes and tax fields, a seed script, owner UI for staff management and price edits, OpenAPI, and CI are not complete. The test covers the API boundary but does not yet automate the browser flow. Phase 0 cashier-speech evaluation also remains incomplete.
