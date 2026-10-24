# Implementation plan

Status: Phase 1 foundation underway; Phase 0 voice evaluation remains open. Created: 2026-10-24. Free-to-run constraint: no required paid API, paid tier, payment-gateway subscription, or paid hosting.

## 1. Baseline technical direction

Use a TypeScript workspace with a Next.js/React cashier client and a Fastify modular backend. Keep billing, catalog, authorization, AI validation, and payment rules in the backend. This makes the backend inspectable and independently testable while supporting a complete web experience.

This is one product backend with internal modules, not a collection of microservices. A worker shares its database and domain code when durable jobs become necessary. A second language belongs in measured AI experiments, not duplicate CRUD services.

| Concern | Planned choice | Implementation constraint |
| --- | --- | --- |
| Runtime/workspace | Supported Node.js LTS, TypeScript strict mode, pnpm workspaces | Verify compatible versions and pin the package manager/lockfile when scaffolding |
| Web | Next.js, React, Tailwind CSS, accessible components | Desktop counter first; touch/tablet support; Hindi text and keyboard flow |
| Client data | TanStack Query for API state; ordinary React state for ephemeral UI | Do not introduce another global store until a concrete state requirement exists |
| API | Fastify, runtime request/response schemas, generated OpenAPI | Use compatible Zod/JSON Schema tooling; domain logic independent of framework |
| Data | PostgreSQL, Drizzle, SQL migrations | Tenant-scoped constraints, exact numeric types, explicit transactions and indexes |
| Authentication | Maintained session library/provider selected in Phase 0 | Verify Fastify integration, secure cookies, revocation, CSRF, shop membership, and roles |
| Money | Integer-paise final values; exact decimal library for intermediate math | Version the rounding and tax policy; serialize decimals safely across JSON |
| Speech | Compare free locally runnable multilingual ASR models, beginning with Whisper model sizes on CPU | Report language and billing-term accuracy, model size, cold/warm latency, CPU/RAM, and license |
| Self-hosted AI | Evaluate licensed pretrained multilingual models on this machine before considering custom adaptation | Report CPU/GPU, memory, cold start, concurrency, and accuracy; no model-hosting bill |
| Extraction | Rules for exact forms plus an evaluated local model only where needed; catalog grounding and runtime semantic checks | Bounded commands; local inference; measure error reduction before adding a model |
| Durable jobs | PostgreSQL outbox plus a worker only when a real durable job appears | Do not add payment-gateway retry machinery to local QR generation |
| Payment | Locally generated UPI QR from a trusted shop UPI ID | Exact amount and reference; explicit cashier confirmation with audit trail; no automatic bank verification claim |
| Printing | HTML print CSS first; saved PDF artifact during pilot readiness | Test 58/80 mm thermal layout and real driver behavior; bridge only if justified |
| Local resilience | IndexedDB for local drafts; service worker for app/catalog caching | No offline official finalization in baseline; explicit conflict resolution |
| Quality | Vitest, PostgreSQL integration tests, Playwright, targeted load tests | Test money, tenant boundaries, concurrency, AI errors, and local inference failures |
| Operations | Docker Compose or Podman locally; local runnable release | Hosting is optional and must not be required or paid; migrations, secrets, and backup restore remain necessary |
| Observability | Structured redacted logs, request IDs, latency/resource metrics | Correlate voice segment -> draft -> invoice -> cashier confirmation without logging customer content |

Final model, auth implementation, and exact dependency versions are Phase 0/1 decisions. A future optional host is not part of the free local path.

## 2. Intended repository layout

Create directories as their implementation starts; this is a proposed layout, not existing software.

```text
apps/
  web/                  # Cashier UI, microphone capture, draft resilience, receipts
  api/                  # Auth, shops, catalog, drafts, invoices, voice proposals, payments
  worker/               # Added with durable payment/document jobs
packages/
  billing/              # Pure money, quantity, discount, tax, rounding rules
  contracts/            # Runtime schemas, bounded AI command types, API contracts
  db/                   # Schema, migrations, scoped queries
evals/
  fixtures/             # Sanitized text cases and expected commands
  scripts/              # Reproducible ASR/extraction comparison
  reports/              # Versioned metrics, hardware/environment, model/prompt versions
docs/
  ROADMAP.md
  IMPLEMENTATION_PLAN.md
  adr/                  # Architecture decisions as they are made
  evidence/             # Sanitized test, performance, and pilot reports
```

Keep private recordings and production exports outside Git. Add storage/retention instructions and ignore rules before collecting them.

## 3. Domain design and contracts

### Main records

- Shops, users, memberships, roles, and owner-controlled UPI IDs.
- Products, aliases, pack sizes, sale units, effective price/tax configuration.
- Drafts and draft items with optimistic version numbers and edit provenance.
- Finalized invoices, snapshot items, invoice-number series, and calculation version.
- UPI QR intent and cashier confirmation records, with the confirming user and observed reference.
- Audit events and privacy-safe evaluation metadata.

Use tenant-consistent foreign keys and uniqueness constraints. Preserve the seller, product, tax, and customer fields needed to reproduce an invoice. Reference current catalog records separately from immutable snapshots.

### Bill and payment state

Draft: `OPEN -> FINALIZED` or `OPEN -> ABANDONED`. Finalization creates an immutable invoice in one transaction. Voids/corrections are separate recorded operations subject to supported rules.

UPI payment recording: `AWAITING_CASHIER_CONFIRMATION -> CASHIER_CONFIRMED` or `CANCELLED`. The QR encodes payment instructions only. A cashier checks the merchant's own UPI/bank app before confirming; the app records that confirmation and can later correct it with an audited action. There is no `PROVIDER_VERIFIED` transition without a separately integrated, authenticated source of bank/PSP evidence.

Invoice settlement display distinguishes `UNPAID`, `CASHIER_CONFIRMED_UPI`, and `CASH_RECORDED`. Do not collapse these into a generic verified `PAID` status. Document external refund handling and preserve correction history.

### Planned API surface

Define exact paths and schemas in Phase 1; these operations describe the intended responsibilities:

1. Authenticate, list authorized shops, and manage catalog/configuration by role.
2. Create a draft; add/update/delete items with expected draft version.
3. Request a bounded voice session and submit finalized transcript segments.
4. Produce a grounded command proposal tied to segment ID and draft version.
5. Apply validated draft commands idempotently; clarify missing/ambiguous fields.
6. Preview server totals; finalize with expected version and an idempotency key.
7. Create/retrieve a local UPI QR payload from the finalized invoice and trusted shop UPI ID.
8. Record a role-controlled cashier confirmation with an observed transaction reference and audit metadata.
9. Read the stored confirmation provenance; update the UI after server acknowledgment.
10. Read invoice history, receipt/PDF, and permitted audit/export data.

Use an error contract with code, safe message, request ID, retryability, and field errors. Never leak internal exceptions, prompts, credentials, or other shops' existence.

### Speech-to-bill execution

```text
Explicit microphone start
  -> audio chunks -> dedicated transcription session
  -> interim transcript for display only
  -> finalized segment with stable ID
  -> number/unit normalization and scoped catalog candidates
  -> bounded command extraction where ordinary rules are insufficient
  -> schema + semantic + permission + draft-version checks
  -> editable draft change or visual clarification
  -> deterministic server calculation
  -> cashier confirmation and transactional finalization
```

A spoken price is evidence for an explicit proposed override, not automatic authority to change a catalog price. Preserve both original speech and normalized values only for the session unless consented retention is enabled. Never let a model select merchant accounts or declare payment success.

## 4. Ordered implementation work

Complete the current slice, demonstrate it, and update evidence before taking the next requested slice. Internal phase gates are verification requirements, not repeated user approval prompts.

### Phase 0 tasks: feasibility and decision records

- [x] P0.1 Write a supported shop workflow, sample basket, customer-field rules, and cashier interview checklist. Assumptions and missing field observations are documented in `PHASE0_WORKFLOW.md`.
- [x] P0.2 Define consent, private dataset location, labels, speaker/session split, utterance taxonomy, and sample collection procedure. Seed a small text fixture set before collecting audio. See `evals/DATASET.md` and `evals/fixtures/billing_utterances.jsonl`.
- [ ] P0.3 Run a bounded ASR comparison on identical open or consented recordings using at least two free local models. Initial five-clip, one-speaker run and license review are complete in `docs/evidence/VOICE_COMPARISON_2026-10-24.md`; cashier-domain, multi-speaker evidence and warm latency remain.
- [ ] P0.4 Compare rules-only normalization with one local structured extraction model only when text cases show rules are insufficient. Measure product, quantity, unit, amount, corrections, no-match, and whole-line exactness.
- [ ] P0.5 Check target printer/OS/browser when available and verify UPI URI/QR behavior with non-money scans. Separate documented behavior from real hardware/account tests.
- [ ] P0.6 Record ADRs for stack/auth, ASR/extraction, money/tax rules, and local QR confirmation. No paid experiments or purchases are part of the path.

Outputs: initial ADRs, fixture schema, baseline report with missing measurements identified, and confirmed foundation choices. Stop the spike after a decision can be made.

### Phase 1 tasks: foundation

- [ ] P1.1 (in progress) Web/API workspace, strict TypeScript, lint, environment validation, lockfile, and documented scripts exist. Shared runtime contracts and formatter remain.
- [x] P1.2 Local PostgreSQL, migrations, database readiness, and isolated test database are implemented.
- [x] P1.3 Better Auth sessions, owner/cashier membership, and scoped shop access are implemented and integration-tested.
- [ ] P1.4 Implement shop and catalog schema, aliases, units, pack sizes, price/tax fields, validation, and deterministic seed data for two shops.
- [ ] P1.5 (in progress) Product create/update/list/search and minimal owner catalog UI exist. Import, fuller editing UI, and staff UI remain.
- [ ] P1.6 Add request/error contracts, OpenAPI, health/readiness, request IDs, redacted logs, CI, and setup documentation.

Gate: clean setup, passing scoped API integration tests, disallowed cross-shop references, type check, lint, tests, and build using actual manifest scripts.

### Phase 2 tasks: manual checkout

- [ ] P2.1 Implement the pure billing module: exact quantities, compatible unit conversions, rupee/paise normalization, validated overrides, discounts, tax modes, and versioned rounding.
- [ ] P2.2 Add fixtures and property tests for fractions, inclusive/exclusive prices, multiple rates, invalid quantities, precision bounds, rounding boundaries, and zero/negative cases.
- [ ] P2.3 Implement versioned draft persistence, transactional finalization, unique numbering, immutable snapshots, idempotency, and audit provenance.
- [ ] P2.4 Build the cashier workspace with catalog search, item edits, shortcuts, accessible totals, conditional customer details, and recoverable error states.
- [ ] P2.5 Add role-controlled cash settlement, invoice history, initial receipt view, and print CSS.
- [ ] P2.6 Verify simultaneous finalization, repeated clicks, stale revisions, catalog changes, refresh, and failed writes. Demonstrate a complete manual cash bill.

Gate: exact deterministic calculations and database invariants; full manual checkout passes without any model or gateway credentials.

### Phase 3 tasks: voice and AI evaluation

- [ ] P3.1 Implement explicit microphone permission/recording controls, supported audio capture, transcription session auth, and incremental visual transcript.
- [ ] P3.2 Add final-segment deduplication, bounded session/request budgets, cancellation, reconnection behavior, and obsolete-result rejection.
- [ ] P3.3 Implement Hindi/Hinglish number/unit normalization and catalog candidate grounding. Test pack-count versus pack-weight ambiguity explicitly.
- [ ] P3.4 Implement schema-validated add/update/remove/undo/clarification proposals with permitted price overrides. Apply commands to drafts idempotently.
- [ ] P3.5 Add visual resolution controls for uncertain products, missing prices, and ambiguous quantities. Preserve manual entry and corrections throughout.
- [ ] P3.6 Build the reproducible evaluation runner and report per-field/whole-line accuracy, coverage, correction rate, p50/p95 latency, failure categories, and cost.
- [ ] P3.7 Test unseen speakers, background noise, partial/final repeats, same-item corrections, bill switching mid-request, negation, timeouts, and prompt-like spoken text.

Gate: no audio output; actual held-out report against roadmap targets; UI works on local inference failure. If targets fail, publish the failure and improve the measured bottleneck before claiming a speed benefit.

### Phase 4 tasks: local UPI QR and honest payment recording

- [ ] P4.1 Implement owner-controlled merchant UPI ID setup, with validation, audit trail, and role restrictions.
- [ ] P4.2 Construct UPI payment URI/QR from server-stored shop UPI ID, finalized invoice amount, and invoice reference. Persist an immutable QR intent and return the same result on retries.
- [ ] P4.3 Display merchant name, UPI ID, amount, and a clear `Awaiting cashier confirmation` state. Test QR readability on target screens and UPI apps without moving money during development.
- [ ] P4.4 Record cashier confirmation only after an explicit check in the merchant's UPI/bank app, including observed reference when available. Label this status as manually confirmed.
- [ ] P4.5 Protect against wrong-tenant, changed-merchant, changed-amount, duplicate-confirmation, and unauthorized-confirmation requests. Audit all corrections.
- [ ] P4.6 Keep an optional verified-provider integration as a future design only if a free authenticated bank/PSP interface becomes available; do not present it as required or implemented.

Gate: deterministic QR and authorization tests pass; a documented non-money scan opens the expected UPI app details; the app never treats a QR scan or user redirect as verified payment.

### Phase 5 tasks: pilot and operations

- [ ] P5.1 Add the supported correction/cancellation and external refund recording process with immutable history and permissions. Review tax/accounting treatment for the chosen seller profile.
- [ ] P5.2 Add validated catalog import/export, printable PDF, reprint provenance, and shop branding. Keep transactional customer data out of public demo fixtures.
- [ ] P5.3 Test receipt layout and print dialog with the target thermal printer. If silent printing is required, evaluate one authenticated local bridge/kiosk setup and record the installation burden.
- [ ] P5.4 Add PWA installation and cached catalog/manual drafts. Make local save versus server acknowledgment clear; detect stale prices and version conflicts on reconnect.
- [ ] P5.5 Instrument stage timings, local model CPU/RAM use, QR creation, manual confirmation lag, and errors without retaining raw audio/customer details by default.
- [ ] P5.6 Document retention/deletion, secret rotation, database migrations, backup/restore, rollback, and shop owner setup.
- [ ] P5.7 Run owner/cashier isolation, browser accessibility, import validation, browser refresh, local-model outage, and database recovery scenarios.

Gate: target-hardware demonstration, documented recovery, and a usable daily cashier workflow. Record any missing access or untested production assumptions.

### Phase 6 tasks: measured release and resume evidence

- [ ] P6.1 Package a locally runnable demo with synthetic shop data and labeled non-money payment simulation. Optional free hosting is separate and must not be required to run the project.
- [ ] P6.2 Run a reproducible load test with declared hardware/region, shop count, catalog size, users, connection pool, duration, error rate, and p50/p95 results. Tune only observed bottlenecks.
- [ ] P6.3 Run a matched checkout trial if cashiers are available. Compare manual entry/voice and relevant barcode baseline; include corrections and failed attempts in results.
- [ ] P6.4 Publish README, architecture/data-flow diagram, setup, OpenAPI, ADRs, AI evaluation/model card, failure scenarios, operational limitations, and a short demo video.
- [ ] P6.5 Write resume bullets from measured results. Templates: "Built [verified scope] using [architecture], achieving [measured result] on [workload]." Keep unmeasured placeholders out of the final resume.

Gate: every headline claim links to runnable code or dated evidence. No simulated transaction is represented as real payment processing.

### Phase 7 tasks: custom AI, only after evidence

- [ ] P7.1 Pick the largest measured error/cost category and define a fixed success criterion against the production baseline.
- [ ] P7.2 Confirm consent, license, dataset rights, speaker/shop holdouts, and compute budget. Start with vocabulary/rules, then a small intent/slot model or licensed ASR adaptation if warranted.
- [ ] P7.3 Record dataset/model/training configuration versions, seeds where supported, hardware, inference concurrency, and end-to-end integration costs.
- [ ] P7.4 Compare unchanged test sets and publish error tradeoffs, abstention coverage, cost, and latency. Adopt only when the product benefits; retain the previous model as rollback.

## 5. Focused verification matrix

| Area | Required evidence |
| --- | --- |
| Money/tax | Exact fixtures and property invariants; no float currency arithmetic |
| Persistence | Real PostgreSQL transaction, uniqueness, version, and concurrency tests |
| Isolation | Two-shop/role adversarial read/write/export/event tests |
| Voice | Segmentation/deduplication/staleness tests and held-out recordings/text evaluation |
| Payments | Trusted merchant UPI ID, exact amount/reference, QR decoding, authorized cashier confirmation, and audit provenance |
| Durable jobs | Required only if durable jobs are introduced; then test retry without duplicate business action |
| Browser | Manual checkout, voice correction, clearly labeled cashier confirmation, history, and printable receipt |
| Hardware | Actual microphone/browser/OS and printer trial with recorded conditions |
| Product | Matched checkout timing and correction rate with limitations stated |

Use deterministic fakes for external edges. Use actual PostgreSQL for transactional claims. Use real hardware and non-money QR scans before making corresponding usability claims.

## 6. Current references and implementation-time checks

References inspected on 2026-10-24; re-check versioned docs and actual account support when integrating:

- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/): schema-driven request validation and response serialization.
- [Whisper model and code](https://github.com/openai/whisper), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), and [faster-whisper](https://github.com/SYSTRAN/faster-whisper): free local speech candidate ecosystem. Benchmark actual model and runtime combinations before choosing.
- [AI4Bharat Hindi IndicConformer](https://huggingface.co/ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large): free MIT-licensed Hindi candidate, but gated download and NeMo setup must be checked; it is not yet benchmarked on this machine.
- [FLEURS](https://huggingface.co/datasets/google/fleurs) and [CS-FLEURS](https://huggingface.co/datasets/byan/cs-fleurs): open public language/code-switching evaluation sources, not cashier-domain speech. Observe attribution and the latter's noncommercial license.
- [GST portal taxpayer welcome kit](https://tutorial.gst.gov.in/downloads/news/welcome_kit_for_new_taxpyers.pdf): invoice-field starting reference. Review current official rules for the supported seller profile before implementation and commercial use.
- [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [browser printing](https://developer.mozilla.org/en-US/docs/Web/API/Window/print): installation and print-dialog behavior; printer compatibility still needs testing.

Phase 0 progress and measurements are recorded in `docs/evidence/`. An initial ASR comparison and scorer tests have run. No application tests, real payment transactions, or printer trials have yet been run.
