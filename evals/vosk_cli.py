"""Small Vosk adapter for cold-process comparisons in bench_asr.py."""

import argparse
import json
import wave
from pathlib import Path

from vosk import KaldiRecognizer, Model, SetLogLevel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--output-file", type=Path, required=True)
    args = parser.parse_args()
    SetLogLevel(-1)
    model = Model(str(args.model))
    pieces = []
    with wave.open(str(args.file), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError("Vosk expects mono 16-bit PCM WAV")
        recognizer = KaldiRecognizer(model, audio.getframerate())
        while chunk := audio.readframes(4000):
            if recognizer.AcceptWaveform(chunk):
                pieces.append(json.loads(recognizer.Result()).get("text", ""))
        pieces.append(json.loads(recognizer.FinalResult()).get("text", ""))
    args.output_file.write_text(" ".join(piece for piece in pieces if piece).strip(), encoding="utf-8")


if __name__ == "__main__":
    main()
