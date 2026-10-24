# Voice Billing Platform: product roadmap

Created: 2026-10-24. Status: Phase 0 evidence remains incomplete; Phase 1 foundation is underway. Working project name: **BoliBill**. The project must run with free software and local compute, without paid tiers or required paid services.

## Product goal

Help Indian retail cashiers turn English, Hindi, and Hinglish speech into accurate, reviewable bills, collect payment into the shop's merchant account, and produce receipts with less checkout effort.

Initial hypothesis: loose goods and mixed baskets at small retail counters are a useful starting point because quantity, unit, and price entry can be cumbersome. Validate this with real cashiers. Barcode entry should remain available where it is faster.

### Problem statement

During busy periods, cashiers repeatedly translate spoken purchases into product searches, quantities, prices, tax entries, and payment checks. Errors or repeated corrections increase checkout time. Build a web platform that captures spoken items, resolves them against a shop catalog, calculates bills deterministically, and closes the checkout with a shop-specific UPI QR, clearly labeled cashier payment confirmation, and a receipt.

### Non-negotiable experience

Cashier speaks -> editable bill updates -> visual correction if needed -> cashier confirms -> exact-amount QR for this shop -> customer authorizes payment -> cashier checks the merchant's UPI/bank app and records confirmation -> receipt and saved history.

The system never speaks. Customer details are requested on screen only when the supported invoice configuration or requested receipt requires them. Speech is optional throughout checkout.

## What makes this project stand out

| Engineering area | Demonstrable work | Evidence to publish |
| --- | --- | --- |
| Backend | Transactional finalization, concurrent invoice numbering, optimistic draft updates, tenant isolation | Integration tests, API contract, concurrency report, architecture decisions |
| Applied AI | Hinglish number/unit interpretation, catalog grounding, corrections, abstention, provider comparison | Versioned held-out evaluation, error taxonomy, latency/accuracy/cost results |
| Payments | Trusted merchant UPI routing, exact-amount QR generation, idempotency, tamper resistance, honest confirmation provenance | UPI URI tests and cashier confirmation audit trail; never claim automatic payment verification |
| Full stack | Responsive cashier workspace, live transcription, manual fallback, receipts, useful failure states | Deployed demo, browser tests, recorded real hardware trial |
| Product | Measured checkout improvement and acceptable operating cost | Matched cashier trial, correction rate, cost per bill, user feedback |

Depth comes from making these parts work together. A custom model is valuable when it solves an observed failure; using a pretrained model without evaluating it is insufficient evidence of AI engineering.

## Delivery sequence

### Phase 0: prove the risky assumptions

Deliver product scope, a small cashier workflow study, representative catalog and utterances, baseline measurement definitions, and bounded technical spikes.

- Compare at least two locally runnable, free speech model candidates on identical open or consented recordings. Separate public language tests from real cashier speech tests.
- Measure transcript accuracy and CPU latency with text-only output. Do not add speech generation.
- Check real printer behavior when hardware is available and validate local UPI QR construction against the merchant's own UPI app before real use.
- Record stack/model decisions in ADRs, including licenses, memory, setup difficulty, and measured limitations.

Exit: risks are evidenced, a free implementation path exists, and unknowns have named follow-ups. Voice comparison results on generic speech do not count as cashier-domain accuracy.

### Phase 1: runnable foundation and shop isolation

Deliver workspace setup, local PostgreSQL, schema migrations, maintained authentication, owner/cashier membership, shop configuration, catalog CRUD/import, API schemas, logging, and CI.

Exit: two seeded shops cannot access each other's data; a developer can start the project using documented commands; validation and integration checks run in CI.

### Phase 2: a complete manual billing counter

Deliver keyboard/touch entry, versioned server-saved drafts, exact calculations, configured tax rules, finalization, unique invoice numbering, immutable snapshots, history, and an initial printable receipt.

Exit: a cashier can complete a cash checkout without AI; calculation and concurrency gates pass; customer details are conditional; finalized bills survive catalog edits unchanged.

### Phase 3: measured voice-to-bill

Deliver explicit microphone controls, live transcript, grounded item proposals, Hindi/Hinglish quantities, visual ambiguities, correction commands, bounded usage, stale-result protection, and a reproducible evaluation runner.

Exit: held-out results are published, repeated partial transcripts cannot duplicate items, the system never speaks, and microphone/model failures preserve manual billing.

### Phase 4: merchant UPI QR and auditable payment closure

Deliver owner-controlled shop UPI ID settings, local exact-amount QR construction, frozen invoice reference, customer QR display, cashier confirmation with audit details, and clear payment status on saved receipts. Keep cash, UPI cashier confirmation, and simulation distinct.

Exit: changing merchant, amount, or invoice reference is prevented; repeated QR requests are stable; cashier confirmation is permissioned and auditable. The app never displays bank-verified success without a real supported verification integration.

### Phase 5: pilot readiness

Deliver supported cancellation/correction flows, catalog import validation, receipt/PDF export, real printer verification, PWA installation, local manual drafts, safe reconnect conflict handling, audit views, backups/restore procedure, and operational monitoring. Refund recording must match whatever external process the merchant actually used.

Exit: complete cashier scenarios pass on target hardware; customer/audio retention is documented; merchant setup and daily operation are usable; supported GST behavior is reviewed before commercial claims.

### Phase 6: evidence, deployment, and resume presentation

Deliver a locally runnable and recordable demo, reproducible setup, architecture diagram, API documentation, threat/failure notes, load report, AI model card/evaluation report, demo video, and a measured cashier trial if access is available. Optional hosting must remain free and nonessential.

Exit: a reviewer can reproduce core claims and inspect meaningful tradeoffs. Resume bullets use actual results with honest scope and limitations.

### Phase 7: optional custom AI research

Triggered by a measured failure or cost bottleneck after the end-to-end product works.

Candidate work: shop vocabulary adaptation, Indian-number normalization, a small intent/slot model, or fine-tuning a licensed pretrained speech model using consented data. Compare against the unchanged baseline on unseen speakers and shops. Include training/inference costs, hardware, dataset provenance, and license constraints.

Exit: adopt only if it improves the chosen accuracy/latency/cost tradeoff without increasing harmful accepted errors. Publish negative results if it does not. Training speech recognition from scratch is not a baseline requirement.

## Measurement contract

The numbers below are initial design targets, not achieved results. Refine them after the baseline and retain the revision history.

| Metric | Initial target or gate | Measurement |
| --- | --- | --- |
| Billing correctness | Exact match on approved fixtures; zero invariant violations in the executed property suite | Compare integer-paise outputs, tax breakdowns, discounts, units, and versioned rounding |
| Voice precision | At least 98% exact field accuracy among accepted critical fields, with at least 85% coverage | Report product/quantity/unit/price separately, coverage, correction rate, and whole-line exact match |
| Voice latency | End of speech to editable grounded proposal: p50 <= 1.5 s, p95 <= 3 s | Include segmentation, transcription, extraction, retrieval, and network; separate cold/warm sessions |
| Payment safety | No false `PROVIDER_VERIFIED` state; cashier-confirmed records show provenance | Include wrong shop, changed UPI ID, changed amount/reference, repeated scans, and unauthorized confirmation |
| Checkout improvement | Hypothesis: at least 30% lower median time for the target basket type | At least 30 matched baskets; record cashier count, order effects, accuracy, and actual baseline |
| Cost per bill | Zero required API or hosting spend | Report local CPU/RAM use, model size, electricity/hardware assumptions, and optional deployment cost separately |
| Recovery | No loss of server-acknowledged drafts in executed recovery scenarios | Browser refresh, local model outage, process restart, and retry scenarios |

Build an initial development set of at least 200 utterances and a separate held-out set of at least 100 utterances, aiming for at least five consented speakers across the collection. Split by speaker/session where possible; identify synthetic and real noise separately. These are initial sample-size goals, not proof of population-wide accuracy. Publish sample counts and uncertainty; expand before broader commercial claims.

Include: English, Devanagari Hindi, Romanized Hindi, mixed speech, accents, rupee/paise values, aadha/paav/dedh/dhai, per-kg versus per-pack pricing, similarly named products, corrections, negation, interrupted speech, multiple items, and background voices.

## Scope boundaries

Initial launch scope: one supported retail workflow, INR, authorized owner/cashier roles, multiple isolated shops, ordinary configured invoices, cash and locally generated UPI QR with cashier confirmation.

Later only when justified: broad inventory/procurement, multi-currency, consumer self-checkout, always-listening audio, autonomous agent orchestration, native apps, government e-invoice submission, multi-provider payment routing, custom ASR training, and large-scale distributed infrastructure.

Offline initially means cached catalog and manual local drafts. It does not imply offline AI, official invoice numbering, or verified online payment.

## Current status

- [x] Product requirements and project operating instructions documented and updated for a free stack.
- [x] Roadmap and implementation plan written and updated for a free stack.
- [x] P0.1: supported cashier workflow and assumptions documented in `PHASE0_WORKFLOW.md`.
- [x] P0.2: consent/data protocol and first synthetic text fixtures documented in `evals/DATASET.md`.
- [x] Initial free local ASR probe: five Hindi–English clips, three candidate models, reproducible runner, and evidence report.
- [ ] P0.3: complete domain-specific, multi-speaker voice benchmark and select a model.
- [ ] P0.4–P0.6: extraction comparison, hardware/QR checks, and remaining decisions.
- [ ] Phase 1 foundation (in progress): runnable local web/API/PostgreSQL catalog slice, owner/cashier scope, and integration test exist. Import, tax/pack fields, seed data, OpenAPI, and CI remain.
- [ ] Phase 2 manual billing.
- [ ] Phase 3 voice and evaluations.
- [ ] Phase 4 payments.
- [ ] Phase 5 pilot readiness.
- [ ] Phase 6 public evidence and release.
- [ ] Phase 7 custom AI research, only if justified.

Next implementation step: continue Phase 1 with catalog import, pack/price/tax configuration, a two-shop seed, staff setup UI, and CI. The [foundation evidence](evidence/PHASE1_FOUNDATION_2026-10-24.md) records what was verified. Phase 0 cashier-domain model evaluation remains necessary before choosing the voice model.
