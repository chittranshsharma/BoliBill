# ADR 0001: free local-first project baseline

Date: 2026-10-24. Status: accepted for the project baseline; revise if the user changes the free-only constraint.

## Context

The user wants a strong resume project that runs without paid APIs, paid tiers, required paid hosting, or a payment gateway subscription. The application must still demonstrate real billing, voice processing, and merchant UPI QR generation.

## Decision

Keep the planned TypeScript/Next.js/Fastify/PostgreSQL web architecture, running locally with free open-source dependencies. Run speech recognition and any extraction model locally. Generate each shop's UPI QR from server-controlled shop settings and the finalized bill. Record UPI success only when a cashier explicitly confirms it after checking the merchant's own UPI/bank app. Preserve that provenance in the invoice history.

Use a free local development container tool if containers are needed; a direct database install is also valid. Hosting remains optional. Keep the application usable with manual item entry when local inference is unavailable.

## Alternatives considered

- Usage-based cloud speech or LLM APIs and gateway payment webhooks: simpler managed integration, but violate the user's free-only requirement.
- Browser speech recognition: may cost no developer fee but has variable browser support and can depend on a browser vendor's remote service, so it cannot be the guaranteed free, locally controlled baseline.
- A QR that automatically flips the bill to paid after a scan: there is no trustworthy confirmation signal in a QR scan, so this would falsely mark bills paid.

## Consequences

This architecture offers an honest, reproducible local project and a meaningful AI benchmark. The user supplies local CPU/storage, and voice latency may require optimization. The QR can request payment into the merchant's UPI account but cannot prove settlement; the UI must state `CASHIER_CONFIRMED`, not `PROVIDER_VERIFIED`. If a genuinely free authenticated bank/PSP confirmation interface becomes available later, that could add a separate verified status after review and tests.
