#!/usr/bin/env python3
"""Build readable SRT captions from the approved narration transcript."""

from __future__ import annotations

import argparse
import re
import textwrap
from pathlib import Path


def stamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    whole_seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02},{milliseconds:03}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("transcript", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--duration", type=float, required=True)
    args = parser.parse_args()

    text = args.transcript.read_text().split("\n\n", 1)[1]
    text = re.sub(r"\s+", " ", text).strip()
    tokens = text.split()
    chunks = [" ".join(tokens[start : start + 13]) for start in range(0, len(tokens), 13)]
    words = [len(chunk.split()) for chunk in chunks]
    total_words = len(tokens)
    cursor = 0.0
    cues: list[str] = []
    for index, (chunk, word_count) in enumerate(zip(chunks, words), start=1):
        end = args.duration if index == len(chunks) else cursor + args.duration * word_count / total_words
        wrapped = "\n".join(textwrap.wrap(chunk, width=48, break_long_words=False, break_on_hyphens=False))
        cues.append(f"{index}\n{stamp(cursor)} --> {stamp(end)}\n{wrapped}\n")
        cursor = end
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(cues))
    print(f"captions={len(cues)} duration={args.duration:.3f} output={args.output}")


if __name__ == "__main__":
    main()
