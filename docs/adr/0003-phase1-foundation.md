# ADR 0003: Phase 1 local foundation

Date: 2026-10-24. Status: accepted for the Phase 1 foundation slice.

## Context

The project must run locally for free, keep shop data isolated, support Hindi text, and leave deterministic billing independent of any model. Docker Desktop was unavailable on the development machine.

## Decision

- Use one pnpm TypeScript workspace with a Next.js web client and a Fastify API.
- Use Better Auth's maintained PostgreSQL session implementation with a node-postgres pool. Keep authentication tables managed by Better Auth's programmatic migration, and application tables managed by versioned Drizzle SQL migrations.
- Use real local PostgreSQL through `embedded-postgres` for Windows development and a separate test database. Initialize the cluster with UTF-8 explicitly because the Windows locale otherwise chose WIN1252.
- Keep catalog authorization in the API: session -> membership -> scoped SQL. Owners can change products and memberships; cashiers can read the catalog.
- Store catalog prices as integer paise. Voice extraction is outside Phase 1. Future parsing starts with deterministic rules and only adds a small free local model after a measured need.

## Tradeoffs and revisit condition

The bundled PostgreSQL wrapper is a beta package and downloads a native binary; a standard local PostgreSQL installation with the same connection string is an alternative. Auth and application schema have two migration mechanisms, so their order is explicit in `db:migrate` and the test setup. Revisit the wrapper if it proves unreliable on another development platform, and revisit the model choice after representative cashier-speech evaluation.
