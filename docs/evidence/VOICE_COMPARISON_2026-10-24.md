# Phase 0 voice comparison: first local probe

Date: 2026-10-24. This is a measured feasibility probe, not a production model decision. No paid API, cloud inference, or trial credit was used. The project has no cashier voice recordings yet.

## Candidate screening

| Candidate | Why consider it | Free/local status | Result of this phase |
| --- | --- | --- | --- |
| [Whisper multilingual tiny and base through whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Multilingual, compact C++ runtime; the [published model list](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md) includes tiny/base/small and says `.en` variants are English-only | MIT project/model lineage; downloaded open model weights and Windows CPU binary | Both benchmarked below on identical Hindi–English clips |
| [Vosk small Hindi 0.22](https://alphacephei.com/vosk/models) | Very small, local, streaming-friendly Hindi recognizer with vocabulary options | Apache 2.0 model; Python API ran locally | Benchmarked below; best of these three on mixed-script WER/CER, with serious number/code-switching errors still visible |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | CPU int8 and persistent inference may improve latency for larger Whisper weights | MIT local runtime; no paid service required | Not separately benchmarked; it uses Whisper weights, so this would primarily be a runtime comparison |
| [AI4Bharat Hindi IndicConformer](https://huggingface.co/ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large) | Hindi-focused model may improve Hindi recognition | MIT model card, but gated download requires accepting model terms; NeMo/runtime setup also needs checking | Not benchmarked without access; Hindi-only design may struggle with English product names |
| Whisper small or larger | Better capacity may improve recognition | Free weights but more CPU/RAM and model storage | Deferred until a cashier-domain set shows whether tiny/base errors are fixable and whether latency remains workable |

Vosk's published Hindi WER numbers are on other datasets and are **not** compared to the local scores below. A model being open does not prove that it meets a cashier's speed or accuracy needs.

## Reproducible experiment

- Source: five `hin-eng` read-speech clips from [CS-FLEURS read/test](https://huggingface.co/datasets/byan/cs-fleurs), licensed CC BY-NC 4.0. Clip references and download URLs are in `evals/fixtures/cs_fleurs_hin_eng.jsonl`; the corpus is described by [Yan et al., 2025](https://arxiv.org/abs/2509.14161). All five clips are from speaker `AD`, total 31.02 seconds, and none contains a retail bill.
- Hardware: Intel Core Ultra 7 155U, 12 physical/14 logical cores, 16.57 GB installed RAM, integrated Intel graphics. Windows; CPU inference with four threads for whisper.cpp. Vosk uses its own CPU settings.
- Runtime: whisper.cpp CLI version 1.9.5 from GitHub binary release `b5454`; Vosk Python package 0.3.45 and model `vosk-model-small-hi-0.22`; Python 3.14.8. Local model files remain in ignored `.cache/`.
- Each clip started a new model process. Timings include process start, model load, and transcription. This experiment did not measure resident-server warm latency, partial streaming, network transit, catalog matching, or the complete utterance-to-edit time.
- Command: run `python evals/bench_asr.py --engine .cache/asr/bin/Release/whisper-cli.exe --model tiny=.cache/asr/models/ggml-tiny.bin --model base=.cache/asr/models/ggml-base.bin --model vosk-hi=.cache/asr/models/vosk-model-small-hi-0.22 --vosk-python .venv-asr/Scripts/python.exe --language hi --output evals/reports/local-cs-fleurs-hi.json` after placing the models as described in `evals/DATASET.md`. The sanitized [raw result JSON](../../evals/reports/cs-fleurs-cpu-2026-10-24.json) preserves every hypothesis and per-clip score without local absolute paths.
- Scoring: casefold/NFKC and punctuation removal, retaining Devanagari marks; WER and character error rate are raw edit distance divided by reference length. English words rendered in Devanagari and Hindi rendered in Roman/Urdu script count as errors even when the sounds are similar. No transliteration equivalence is assumed.

| Local model | Model size on disk | WER ↓ | Character error ↓ | Median cold time / clip ↓ | Maximum cold time / clip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Whisper tiny multilingual | 74.1 MiB | 0.92 | 0.74 | 1.27 s | 1.48 s |
| Whisper base multilingual | 141.1 MiB | 0.95 | 0.91 | 2.32 s | 2.89 s |
| Vosk small Hindi | 78.3 MiB extracted | 0.35 | 0.46 | 2.42 s | 3.00 s |

The first run let Whisper detect language automatically. Repeating the same clips with `--language hi` did **not** change its transcripts in this sample. The base model wrote several Hindi phrases in Urdu script; tiny mostly Romanized them. Example: the reference begins “राज्यपाल के कार्यालय… उन्नीस police officers”; base output begins in Urdu script, while Vosk outputs “राज्यपाल के कार्यालय… उन्नीस पुलिस ऑफिसर”. Vosk's output is closer to the reference words, but English product names may still need alias matching. The clip with `11:35 pm` shows a critical Vosk failure: it transcribed the number as unrelated words. That is exactly the kind of error a billing flow must detect and clarify.

## Decision and next evidence

**Provisional choice for the first local voice prototype: Vosk small Hindi, with manual correction and no automatic acceptance of numbers or prices.** It worked on this CPU and produced more legible mixed Hindi–English text on these five clips. Keep Whisper tiny/base as baselines. This choice can change after billing-domain evaluation.

The sample is far too small and narrow for a product claim. It has one speaker, read sentences, and no prices or catalog products. Mixed-script WER over-penalizes transliteration. Phase 0 still needs a consented multi-speaker cashier dataset, per-field product/quantity/unit/price scoring, a persistent-service latency run, microphone noise tests, and a real checkout timing baseline. Do not quote these five-clip numbers as resume performance or claim the app is faster from them.

To reproduce the exact local run, execute the benchmark command and compare its JSON metrics and transcripts. The evaluator itself passed two unit checks for Unicode normalization and edit distance on this machine.
