# Speech and command evaluation data

Status: evaluation protocol and five public audio examples exist; no cashier recording has been collected. See `docs/evidence/VOICE_COMPARISON_2026-10-24.md` for the provisional result.

## Data sources and rights

- `fixtures/cs_fleurs_hin_eng.jsonl` identifies five public [CS-FLEURS](https://huggingface.co/datasets/byan/cs-fleurs) Hindi–English read-speech clips. Dataset license: CC BY-NC 4.0. Credit the dataset and [paper](https://arxiv.org/abs/2509.14161) when publishing results. Downloaded WAVs stay in ignored `.cache/asr/audio/`. These clips are noncommercial evaluation material and must never be treated as licensed training data for a commercial derivative.
- `fixtures/billing_utterances.jsonl` contains invented text-only billing cases; it is not an audio benchmark and does not measure speech recognition.
- Future cashier recordings require informed consent naming the purpose, access, retention period, and withdrawal/deletion route. Store the original audio and labels under ignored `evals/private/`, not in Git or routine logs. No recording is started by this plan.

## Collection protocol for a real pilot

1. Ask a consenting cashier to read and freely phrase baskets from a fixed catalog. Capture the microphone, shop noise condition, device, speaker/session ID, language pattern, and manual reference transcript.
2. Include at least five speakers with different accents and at least 200 development utterances plus 100 held-out utterances as initial sample goals. Keep whole speakers or sessions out of the development split where possible.
3. Cover product names and similar aliases; Hindi number words and digits; Romanized and Devanagari Hindi; kilogram/gram/litre/pack units; price per unit versus total; discounts; negation; self-correction; deletion; low-confidence and out-of-catalog speech; overlapping background talk.
4. Label the exact transcript and intended structured command separately. For each item annotate product ID, quantity as an exact decimal string, unit, optional spoken price and its unit, correction target, and whether clarification is required. Do not insert a missing price into the reference.
5. Have a second reviewer resolve disagreements in critical fields. Keep an adjudication log and immutable dataset version. Do not edit the held-out set after viewing model outputs without publishing the change.
6. Measure word/character error for transcription, but assess product/quantity/unit/price and whole-bill correctness after catalog grounding. Mixed-script transliteration can inflate WER without changing the cashier's intended item; inspect examples manually.

## Benchmark command on this Windows machine

The runner uses only Python's standard library. `--download` fetches the public clips; omit it after caching. Whisper models and Vosk are free local downloads. Install Vosk in an isolated environment if that candidate is included.

For the recorded Windows run, download [whisper.cpp release `b5454` x64 binary](https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip) and extract it so the CLI is `.cache/asr/bin/Release/whisper-cli.exe`. Download multilingual [Whisper tiny](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin) and [base](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin) to `.cache/asr/models/`. Download the [Vosk Hindi small model](https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip) and extract its model directory under `.cache/asr/models/`. Create `.venv-asr` with `python -m venv .venv-asr`, then run `.venv-asr/Scripts/python.exe -m pip install vosk==0.3.45`. The model files and virtual environment are ignored by Git. Check the source licenses before redistributing any artifact.

```powershell
python evals/bench_asr.py --download `
  --engine .cache/asr/bin/Release/whisper-cli.exe `
  --model tiny=.cache/asr/models/ggml-tiny.bin `
  --model base=.cache/asr/models/ggml-base.bin `
  --model vosk-hi=.cache/asr/models/vosk-model-small-hi-0.22 `
  --vosk-python .venv-asr/Scripts/python.exe `
  --language hi `
  --output evals/reports/local-cs-fleurs-hi.json
```

This runs a fresh process per clip and times model startup plus transcription. It does not measure a persistent server's warm response, streaming partials, network time, or speech-to-edit latency. All models get the same audio; Vosk is a Hindi-only model and Whisper receives the `hi` language hint. The tool reports mixed-script WER/CER and the actual transcript for manual review. The initial five clips are from one speaker and are not billing phrases, so results are a feasibility probe rather than a model selection for the product.
