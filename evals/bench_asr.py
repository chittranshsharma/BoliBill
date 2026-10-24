"""Compare local whisper.cpp and Vosk models on exactly the same WAV clips.

Example (PowerShell):
  python evals/bench_asr.py --download --engine .cache/asr/bin/Release/whisper-cli.exe `
    --model tiny=.cache/asr/models/ggml-tiny.bin `
    --model base=.cache/asr/models/ggml-base.bin `
    --output evals/reports/local-cs-fleurs.json

All inference is local. The five public CS-FLEURS examples are CC BY-NC 4.0,
noncommercial and insufficient for product-level claims.
"""

from __future__ import annotations

import argparse
import json
import platform
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.request
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "evals/fixtures/cs_fleurs_hin_eng.jsonl"
DEFAULT_CACHE = ROOT / ".cache/asr/audio"


def normalized_words(text: str) -> list[str]:
    """Normalize casing/punctuation, while retaining Hindi combining marks."""
    chars = []
    for char in unicodedata.normalize("NFKC", text).casefold():
        if unicodedata.category(char)[0] in {"L", "M", "N"}:
            chars.append(char)
        else:
            chars.append(" ")
    return " ".join("".join(chars).split()).split()


def edit_distance(reference: list[str] | str, hypothesis: list[str] | str) -> int:
    previous = list(range(len(hypothesis) + 1))
    for ref_index, ref_item in enumerate(reference, 1):
        current = [ref_index]
        for hyp_index, hyp_item in enumerate(hypothesis, 1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[hyp_index] + 1,
                    previous[hyp_index - 1] + (ref_item != hyp_item),
                )
            )
        previous = current
    return previous[-1]


def load_manifest(path: Path) -> list[dict]:
    samples = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    ids = [sample["id"] for sample in samples]
    if not samples or len(ids) != len(set(ids)):
        raise ValueError("Manifest must have samples with unique IDs")
    for sample in samples:
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", sample["id"]):
            raise ValueError(f"Unsafe sample ID: {sample['id']}")
        if not sample["audio_url"].startswith("https://huggingface.co/"):
            raise ValueError(f"Unsupported audio host: {sample['id']}")
        if not sample["reference"].strip():
            raise ValueError(f"Missing reference: {sample['id']}")
    return samples


def prepare_audio(samples: list[dict], cache: Path, download: bool) -> list[dict]:
    cache.mkdir(parents=True, exist_ok=True)
    prepared = []
    for sample in samples:
        audio_path = cache / f"{sample['id']}.wav"
        if not audio_path.exists():
            if not download:
                raise FileNotFoundError(f"Missing {audio_path}; rerun with --download")
            print(f"Downloading {sample['id']}...", flush=True)
            urllib.request.urlretrieve(sample["audio_url"], audio_path)
        with wave.open(str(audio_path), "rb") as audio:
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
                raise ValueError(f"Expected mono 16-bit WAV: {audio_path}")
            duration = audio.getnframes() / audio.getframerate()
        prepared.append({**sample, "audio_path": audio_path, "audio_seconds": duration})
    return prepared


def parse_model(value: str) -> tuple[str, Path]:
    name, separator, path = value.partition("=")
    if not separator or not re.fullmatch(r"[a-zA-Z0-9_-]+", name) or not path:
        raise argparse.ArgumentTypeError("Use --model NAME=PATH")
    return name, Path(path).resolve()


def transcribe(engine: Path, model: Path, audio: Path, threads: int, language: str, timeout: int, vosk_python: Path) -> tuple[str, float]:
    with tempfile.TemporaryDirectory(prefix="asr-bench-") as temporary:
        output_prefix = Path(temporary) / "transcript"
        if model.is_dir():
            command = [str(vosk_python), str(ROOT / "evals/vosk_cli.py"), "--model", str(model), "--file", str(audio), "--output-file", str(output_prefix.with_suffix('.txt'))]
        else:
            command = [
                str(engine), "--model", str(model), "--file", str(audio),
                "--threads", str(threads), "--language", language,
                "--no-gpu", "--no-timestamps", "--output-txt", "--output-file", str(output_prefix),
                "--no-prints",
            ]
        start = time.perf_counter()
        result = subprocess.run(command, capture_output=True, text=True, errors="replace", timeout=timeout)
        elapsed = time.perf_counter() - start
        transcript_path = output_prefix.with_suffix(".txt")
        if result.returncode or not transcript_path.exists():
            raise RuntimeError(f"ASR failed on {audio.name}: {result.stderr[-1500:]}")
        return transcript_path.read_text(encoding="utf-8-sig").strip(), elapsed


def benchmark(engine: Path, models: list[tuple[str, Path]], samples: list[dict], threads: int, language: str, timeout: int, vosk_python: Path) -> dict:
    engine_version = subprocess.run([str(engine), "--version"], capture_output=True, text=True, errors="replace")
    report = {
        "method": "cold command process per clip; model load and transcription included; CPU only",
        "engine": engine.name,
        "engine_version": (engine_version.stdout + engine_version.stderr).strip(),
        "machine": {"system": platform.system(), "release": platform.release(), "processor": platform.processor()},
        "threads": threads,
        "language_setting": language,
        "dataset": "CS-FLEURS read/test hin-eng, CC BY-NC 4.0; all clips are one speaker and not billing speech",
        "normalization": "NFKC, casefold, punctuation removed; mixed-script orthographic differences remain errors",
        "models": [],
    }
    for name, path in models:
        if not path.exists():
            raise FileNotFoundError(path)
        outcomes = []
        word_errors = word_count = char_errors = char_count = 0
        for sample in samples:
            transcript, seconds = transcribe(engine, path, sample["audio_path"], threads, language, timeout, vosk_python)
            ref_words = normalized_words(sample["reference"])
            hyp_words = normalized_words(transcript)
            ref_chars = "".join(ref_words)
            hyp_chars = "".join(hyp_words)
            words_wrong = edit_distance(ref_words, hyp_words)
            chars_wrong = edit_distance(ref_chars, hyp_chars)
            word_errors += words_wrong
            word_count += len(ref_words)
            char_errors += chars_wrong
            char_count += len(ref_chars)
            outcomes.append({
                "id": sample["id"], "reference": sample["reference"], "transcript": transcript,
                "audio_seconds": round(sample["audio_seconds"], 3), "wall_seconds": round(seconds, 3),
                "real_time_factor": round(seconds / sample["audio_seconds"], 3),
                "word_edits": words_wrong, "reference_words": len(ref_words),
                "character_edits": chars_wrong, "reference_characters": len(ref_chars),
            })
            print(f"{name} {sample['id']}: {seconds:.2f}s, {words_wrong}/{len(ref_words)} word edits", flush=True)
        model_result = {
            "name": name, "path": path.name, "model_bytes": sum(file.stat().st_size for file in path.rglob('*') if file.is_file()) if path.is_dir() else path.stat().st_size,
            "word_error_rate": round(word_errors / word_count, 4),
            "character_error_rate": round(char_errors / char_count, 4),
            "total_wall_seconds": round(sum(row["wall_seconds"] for row in outcomes), 3),
            "total_audio_seconds": round(sum(row["audio_seconds"] for row in outcomes), 3),
            "samples": outcomes,
        }
        report["models"].append(model_result)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--engine", type=Path, required=True)
    parser.add_argument("--vosk-python", type=Path, default=Path(sys.executable))
    parser.add_argument("--model", type=parse_model, action="append", required=True)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--language", default="auto")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.threads < 1 or args.timeout < 1:
        parser.error("threads and timeout must be positive")
    if not args.engine.is_file():
        parser.error(f"Engine not found: {args.engine}")
    samples = prepare_audio(load_manifest(args.manifest), args.cache, args.download)
    report = benchmark(args.engine.resolve(), args.model, samples, args.threads, args.language, args.timeout, args.vosk_python.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
