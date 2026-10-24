# Phase 0: first cashier workflow

Created: 2026-10-24. Status: written from the project brief; no cashier interview or field trial has occurred.

## Supported first scenario

A single cashier at a small Indian grocery/general store creates an INR retail bill with loose goods and packaged items. The shop already has a product catalog with prices and optional configured GST treatment. The cashier uses a desktop or tablet browser with a microphone and internet is optional for local voice inference; the billing API/database run locally or on a machine the shop can reach. The shop owner configures their own UPI ID.

Example spoken basket: "Do kilo chawal saath rupaye kilo, teen साबुन पैंतीस each, aur ek packet chai 120." This intentionally mixes Romanized Hindi, Devanagari, English, number words, explicit prices, and product units. The illustrative line prices are 2 kg rice × ₹60/kg = ₹120; 3 soap × ₹35 = ₹105; 1 tea pack × ₹120 = ₹120; pre-tax subtotal ₹345. The actual payable amount depends on configured tax and discount rules. These numbers are a design fixture, not a real merchant bill.

## End-to-end counter flow

1. Cashier chooses the shop and opens a new draft. The UI shows a product search, item grid, and an explicit microphone button.
2. Cashier presses to speak one short phrase. The UI displays interim words for feedback, then a finalized transcript. No AI voice output occurs.
3. Local speech recognition converts audio to text. The system normalizes number words and units, searches that shop's catalog, and proposes structured item edits bound to this draft version.
4. Clear matches appear as editable rows. The UI asks a short visual question if a product, quantity, unit, price, or correction is ambiguous. The cashier can always type or use touch.
5. Deterministic billing code calculates line totals, discounts, tax, and total. The cashier reviews every row and confirms. The server finalizes an immutable invoice and gives it a unique number.
6. The app makes a UPI QR from the shop's saved UPI ID, invoice reference, and exact total. The customer scans it in their UPI app and authorizes the payment there.
7. The cashier checks their own UPI/bank app or soundbox for the payment and records a confirmation with the observed transaction reference when available. The app labels this `CASHIER_CONFIRMED`; it cannot claim automatic bank verification from QR generation alone.
8. The cashier prints a receipt using the browser print dialog. The saved invoice retains the shop, line, tax, and payment-confirmation provenance.

## What to ask the customer

For an ordinary sale, the cashier should not be forced to ask a name or address for every bill. When a configured tax-invoice scenario requires buyer details, when the customer requests a named invoice, or when a delivery address is needed, the UI asks only the relevant fields. The shop's tax settings and current official rules determine required data; this workflow does not claim GST compliance yet.

## Fast and failure paths

- Manual catalog search and keyboard entry must be complete enough to finish a bill when the model is slow, unavailable, or wrong.
- The cashier should see an editable item proposal soon after ending a short utterance. The roadmap's 1.5 s median / 3 s p95 values are goals to measure on target hardware, not achieved performance.
- Price and UPI destination never come from a model guess. A spoken price override stays visible and permission-controlled.
- If the microphone captures another person's speech, an interrupted phrase, or an item correction, the app pauses or asks for clarification rather than silently changing a finalized bill.
- If there is no payment confirmation, print an unpaid/awaiting-payment receipt only if the shop permits it; the app must not show "paid" because a QR was scanned.
- A network interruption may leave a saved local draft, but official invoice numbering waits for the billing server/database.

## First product boundaries

Start with one shop type and two or three sample catalogs, 5–20 item baskets, cash/manual UPI recording, and basic configured GST behavior. Barcode workflows remain an alternative. Inventory forecasting, autonomous ordering, government e-invoicing, and native mobile apps are separate projects unless evidence makes them necessary.

## Cashier interview and observation checklist

No interview has been run. When a cashier or shop owner is available, ask and observe:

1. Which products are entered manually today, and which are scanned? How many seconds does each path take?
2. How often are quantity, unit, price, discount, or GST corrected? Which errors cause reprinting?
3. What phrases and languages do cashiers actually use under queue pressure? Is push-to-talk practical with their hands occupied?
4. Are catalog prices reliable? Who can override them? How are loose goods weighed and named?
5. What details are collected on ordinary receipts versus requested tax invoices?
6. Which browser, microphone, OS, printer paper width, and internet connection are actually at the counter?
7. Is UPI confirmation seen in a bank app, PSP app, soundbox, SMS, or paper record? What happens when an alert is delayed?
8. What is the current median time for comparable baskets, including payment and printing? How often must customers wait?

Record observed timings and corrections separately from opinions. Do not claim that the new flow is faster until comparable real checkout trials have been measured.

## Phase 0 assumptions and open evidence

| Assumption | Status | How to check |
| --- | --- | --- |
| Cashiers will use voice for loose/mixed baskets | Untested | Observe 30 comparable baskets and run a short push-to-talk trial |
| A local free ASR model can understand Hinglish billing speech quickly enough on CPU | Untested | Compare models on the same audio with latency and product/number accuracy |
| A local QR can open the merchant UPI ID with an amount | Documented integration concept; untested on a merchant account | Construct the URI, inspect the QR, scan with at least two UPI apps on a non-money test if possible |
| Browser print output fits the shop's receipt printer | Untested | Print on the target OS/browser/58 or 80 mm device |
| GST/customer-field rules fit the chosen shop profile | Untested | Choose the profile and check current official guidance before implementing tax invoices |

This document completes roadmap task P0.1 as a written workflow. Field research and quantitative validation remain open.
