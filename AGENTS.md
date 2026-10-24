# Project instructions

## Purpose and source of truth

Build a resume-grade voice-assisted billing platform for Indian retail counters. Demonstrate backend engineering, applied AI engineering, and full stack product development with reproducible evidence. The user requires a free-to-run project: no paid API, paid tier, paid gateway subscription, or required paid hosting.

Read these documents before substantial work:

1. `docs/ROADMAP.md`: product scope, milestones, success criteria, and current status.
2. `docs/IMPLEMENTATION_PLAN.md`: architecture, execution order, contracts, and verification.
3. Relevant source, tests, package manifests, and architecture decisions once they exist.

The roadmap tracks which planned components exist. Proposed packages, commands, services, and performance targets are not verified functionality until implemented and tested.

## User requirements

- The cashier speaks English, Hindi, or Hinglish. The system transcribes and processes speech and responds visually. Never implement spoken AI replies or text-to-speech.
- Extract products, quantities, units, prices, discounts, and correction commands into an editable bill.
- Let the cashier confirm the bill before finalization. Ambiguities require a visual correction, not a silent guess.
- Calculate money and taxes in deterministic code. AI output is an untrusted proposal.
- Generate a bill-specific UPI QR locally from the selected shop's trusted UPI ID and exact payable amount. The customer authorizes payment in their UPI app.
- QR generation does not verify payment. Without a free bank/PSP confirmation interface, require explicit cashier confirmation against the merchant's bank/UPI app and label the status `CASHIER_CONFIRMED`, never provider-verified.
- Support configurable GST, conditional customer details, receipt printing, and saved records.
- Build a web app usable at a real counter, with keyboard and touch entry available throughout.
- Optimize for useful engineering depth and measured outcomes. Do not add infrastructure solely to lengthen the technology list.
- No AI provider is mandated. Compare free, locally runnable models on the same audio. Custom models are allowed when an experiment establishes a useful advantage. No component may rely on a trial credit, usage-based service, or paid tier.

## Working protocol

1. Respect the user's requested step. A roadmap is not authorization to implement all phases in one turn.
2. Inspect the repository before changing it. Preserve existing work and follow applicable nested instructions.
3. State the intended outcome briefly, implement a complete vertical slice, and verify its material risks.
4. Use the smallest design that satisfies the current milestone. Keep proposed future work in the plan.
5. Keep progress visible during long tasks. Produce concrete files early; avoid research without a bounded decision.
6. Record significant decisions in `docs/adr/` when made: context, alternatives, evidence, choice, tradeoffs, and revisit condition.
7. Update milestone status and actual evidence after implementation. Mark blocked external integrations explicitly; keep independent work moving.
8. Report what changed, checks actually run, and remaining limitations. Never claim unrun tests, simulated payments, synthetic benchmarks, or design targets as real results.
9. Use subagents only when the user or applicable higher-level instructions authorize delegation. This file does not independently request delegation.

## Architecture rules

- Default: TypeScript, Next.js/React web client, Fastify modular API, PostgreSQL, Drizzle migrations, and shared runtime schemas. See the implementation plan for reasoning.
- The API owns authorization, catalog access, billing rules, finalization, payments, and persistence. Do not duplicate business rules in Next.js handlers.
- Keep pure billing calculations separate from HTTP, database, and model calls. Keep modules within one backend rather than distributing business logic into microservices.
- Use a small model boundary for the selected transcription and extraction implementations plus deterministic test fakes. Do not build a generic AI platform.
- Browser microphone capture streams to the project's authenticated local transcription service. Keep model inference off the browser main thread.
- Introduce a PostgreSQL transactional outbox and a worker only when a durable job is actually needed.
- Choose stable supported dependency versions at implementation time, pin them in the lockfile, and consult matching official documentation. Do not copy model IDs from memory.
- Do not add Redis, Kafka, Kubernetes, vector databases, RAG, autonomous agent loops, or a second application backend language without a current need and an ADR. Python is appropriate for actual AI evaluation, fine-tuning, or model serving experiments.

## Billing invariants

- Store settled monetary amounts in integer paise. Use exact decimal arithmetic for fractional quantities, rates, and intermediate tax calculations; never binary floating-point currency math.
- Define and version rounding, discount order, tax-inclusive/exclusive pricing, and supported unit conversions. Reject unsupported precision and incompatible units.
- Record catalog product ID, pack size, sale unit, quantity, price source, discount, tax configuration, and calculation version.
- Catalog prices and tax configuration are authoritative defaults. Explicit spoken overrides require validation, cashier visibility, and role permission. Never invent missing prices or tax rates.
- Finalize from a server-calculated, version-checked draft. Never trust client totals or previously generated AI totals.
- Allocate unique invoice numbers transactionally within the configured shop/financial-year series. Reject duplicate finalization and stale draft updates.
- Snapshot finalized item descriptions, prices, tax fields, and relevant party details so catalog changes cannot rewrite invoice history.
- Finalized invoice content is immutable. Use documented correction, cancellation, credit-note, and refund workflows as applicable; do not overwrite history.
- Keep invoice state separate from cashier confirmation records. Preserve the audit trail when a confirmation is corrected or reversed.
- GST rules and required fields must be sourced, dated, tested, and reviewed for the supported seller profile. Do not claim universal GST compliance or treat payment QR generation as government e-invoicing.

## AI and voice invariants

- The model proposes bounded commands: add item, update quantity, propose price override, remove item, undo draft edit, or request clarification. It cannot execute arbitrary tools, change merchant destinations, finalize an invoice, or mark a payment successful.
- Validate output shape and meaning: authorized shop, active draft, permitted operation, existing product, quantity, unit, price bounds, and evidence in the transcript.
- Resolve catalog candidates using exact aliases and database search before adding semantic search. Preserve a no-match result and show alternatives.
- Distinguish interim transcript display from finalized speech segments. Deduplicate segment IDs and command IDs; never add an item once per partial transcript.
- Bind extraction to draft ID, draft version, and segment ID. Discard stale results after edits, cancellation, navigation, or starting the next bill.
- Handle Hindi numbers, Romanized Hindi, Devanagari, rupee/paise values, fractions, pack sizes, self-corrections, negation, and background speech explicitly.
- Treat spoken instructions and catalog text as untrusted data. Schema validity is not proof that the extracted order is correct.
- Use ambiguity checks and empirically evaluated thresholds. Do not treat a model's self-reported confidence as calibrated probability.
- Bound audio duration, inference requests, memory, retries, and concurrency. Make timeout and disconnected states actionable on screen.
- Do not store raw microphone audio by default. Evaluation recordings require consent and a documented retention/deletion policy. Keep private datasets out of Git.

## Payments, isolation, and security

- Every business record and operation must be scoped to an authorized shop. Derive access from the authenticated session and membership, never solely from a submitted shop ID.
- Test cross-shop reads, writes, exports, streaming events, and object references. Enforce database constraints that prevent cross-shop relationships.
- Use an established maintained authentication library or provider, server-verified sessions, explicit owner/cashier permissions, secure cookies, CSRF protection as applicable, and exact origin allowlists.
- Validate request boundaries, upload limits, rate limits, output serialization, and secrets configuration. Never put long-lived provider credentials in browser bundles, logs, URLs, or committed files.
- Merchant routing belongs to trusted server-side configuration. Authenticate and audit merchant changes; never accept a payee from model output or an ordinary cashier request.
- Freeze the payable invoice revision before constructing the QR. The trusted shop UPI ID, invoice reference, and exact amount come from server state.
- Implement idempotent finalization and QR generation. Regenerating the same bill's QR must preserve its merchant and amount.
- Store who confirmed a UPI payment, when, and by what evidence/reference they observed. `CASHIER_CONFIRMED` is not the same as bank-verified.
- If a free bank/PSP confirmation API is later documented and integrated, verify signed messages and exact merchant, currency, reference, and amount before adding `PROVIDER_VERIFIED` status.
- A QR scan, screenshot, frontend redirect, or client-supplied success callback is never payment proof.
- Label simulated and manually confirmed payments visibly. Never claim automatic verification from a QR alone.
- Collect customer information only when needed for the configured invoice or explicitly requested by the customer. Redact personal information and transcripts from routine telemetry.

## UX and offline behavior

- Show a readable item table, price/quantity corrections, subtotal, taxes, payable total, microphone state, and payment state.
- Make recording explicit with push-to-talk or a deliberate start/stop control. Do not continuously listen to the queue by default.
- Keep keyboard shortcuts and manual catalog search fast. Show visual questions only for unresolved fields.
- Preserve drafts across recoverable failures. Distinguish locally saved drafts, server-saved drafts, finalized invoices, and payment status.
- Initial offline scope is cached catalog/manual draft capture. Voice may run on a local service without internet. Server finalization still needs the local API/database connection; payment cannot be auto-verified without a supported integration.
- Browser printing opens a print dialog. Claim silent or direct thermal printing only after a supported kiosk/bridge integration passes a real hardware trial.
- Support focus management, accessible controls, readable contrast, Hindi text rendering, and screen-reader status updates.

## Verification and completion

- Once package manifests exist, read their scripts rather than inventing runnable commands. Document reproducible setup and validation commands with implementation.
- Money/tax changes require deterministic edge cases and invariant/property tests. Persistence changes require PostgreSQL integration tests for constraints and concurrency.
- Authorization changes require role and tenant isolation tests. UPI QR changes require merchant, amount, invoice-reference, and tampering tests. If verified provider events are ever implemented, add signature, duplicate, late-event, and reconciliation tests.
- Voice/parser changes require the fixed evaluation set, correction/stale-result tests, and a browser microphone smoke check where available.
- Important checkout changes require an end-to-end test covering review, finalization, clearly labeled cashier payment confirmation, saved history, and printable receipt.
- Run relevant type checks, lint, tests, and builds. Broaden testing only when required gates or a concrete unresolved risk justify it.
- When an external dependency is unavailable, run available deterministic tests and label the missing verification. Never silently replace production behavior with a fake.
- Every public metric must identify dataset/workload, environment, sample size, model and prompt version, timing definition, and date. Record targets separately from measurements.
- Use Conventional Commits when committing is requested. Do not commit, publish, provision paid services, or run real-money trials merely because a roadmap mentions them.
