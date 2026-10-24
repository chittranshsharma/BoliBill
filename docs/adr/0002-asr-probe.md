# ADR 0002: initial local ASR candidate after five-clip probe

Date: 2026-10-24. Status: provisional; revisit after billing-domain recordings and persistent-service timing.

## Context

The project needs free English/Hindi/Hinglish transcription on a CPU-only Windows machine. Small models may be fast but can misread numbers and product names. The first open Hindi–English corpus clips provide a repeatable probe, not a cashier benchmark.

## Evidence and decision

On five identical CS-FLEURS `hin-eng` clips, [the local comparison](../evidence/VOICE_COMPARISON_2026-10-24.md) measured Vosk small Hindi at WER 0.35 and 2.42 s median cold command time, versus Whisper tiny at WER 0.92 / 1.27 s and Whisper base at WER 0.95 / 2.32 s. The metric punishes script changes and the dataset has only one speaker. Vosk visibly fails a numeric time phrase, so no model may silently commit prices or quantities.

Use Vosk small Hindi as the first local voice prototype candidate because it produced the clearest script for this limited dataset and fits the hardware. Retain Whisper tiny/base as baselines. Compare again on consented retail speech with per-field correctness and warm latency before selecting the production model. If Vosk fails English brands or quantity words, test a larger multilingual model or a bounded catalog-aware correction stage.

## Revisit condition

Reopen this decision after at least five consented speakers and the initial 100-utterance held-out billing set exist, or when a free model can be run locally with stronger measured accuracy at acceptable latency. Publish unsuccessful comparisons as well as improvements.
