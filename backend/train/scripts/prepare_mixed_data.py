#!/usr/bin/env python3
"""Build mixed dialect data with per-speaker instructs.

Input layout:
  raw_prepared/{train,dev}/{spk_id}/{slot}/{slot}_{id}.wav
  raw_prepared/{train,dev}/{spk_id}/{slot}/{slot}_{id}.normalized.txt

Unlike prepare_data.py, this script prefixes utterance ids with spk_id so
multiple dialect corpora can share the same slot/id names without collisions.
"""
from __future__ import annotations

import argparse
import glob
import logging
import os

logger = logging.getLogger(__name__)


def parse_instructs(values: list[str]) -> dict[str, str]:
    instructs: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise ValueError(f"--instruct_map must be spk_id=instruct, got: {value}")
        spk, instruct = value.split("=", 1)
        spk = spk.strip()
        instruct = instruct.strip()
        if not spk or not instruct:
            raise ValueError(f"invalid --instruct_map: {value}")
        instructs[spk] = instruct
    return instructs


def main() -> None:
    instructs = parse_instructs(args.instruct_map)

    wavs = []
    for src_dir in args.src_dir:
        wavs.extend(sorted(glob.glob(os.path.join(src_dir, "*", "*", "*.wav"))))
    utt2wav, utt2text, utt2spk, utt2instruct, spk2utt = {}, {}, {}, {}, {}

    for wav in wavs:
        txt = wav.replace(".wav", ".normalized.txt")
        if not os.path.isfile(txt):
            logger.warning("%s missing transcript", wav)
            continue

        stem = os.path.basename(wav).replace(".wav", "")
        spk = os.path.basename(os.path.dirname(os.path.dirname(wav)))
        if spk not in instructs:
            raise KeyError(f"missing instruct for speaker/dialect {spk}")

        utt = f"{spk}_{stem}"
        if utt in utt2wav:
            raise ValueError(f"duplicate utterance id {utt}, check source dirs")
        with open(txt, encoding="utf-8") as f:
            content = " ".join(f.readline().split())

        utt2wav[utt] = wav
        utt2text[utt] = content
        utt2spk[utt] = spk
        utt2instruct[utt] = instructs[spk]
        spk2utt.setdefault(spk, []).append(utt)

    os.makedirs(args.des_dir, exist_ok=True)
    with open(os.path.join(args.des_dir, "wav.scp"), "w", encoding="utf-8") as f:
        for k, v in utt2wav.items():
            f.write(f"{k} {v}\n")
    with open(os.path.join(args.des_dir, "text"), "w", encoding="utf-8") as f:
        for k, v in utt2text.items():
            f.write(f"{k} {v}\n")
    with open(os.path.join(args.des_dir, "utt2spk"), "w", encoding="utf-8") as f:
        for k, v in utt2spk.items():
            f.write(f"{k} {v}\n")
    with open(os.path.join(args.des_dir, "spk2utt"), "w", encoding="utf-8") as f:
        for k, v in spk2utt.items():
            f.write(f"{k} {' '.join(v)}\n")
    with open(os.path.join(args.des_dir, "instruct"), "w", encoding="utf-8") as f:
        for k, v in utt2instruct.items():
            f.write(f"{k} {v}\n")

    logger.info(
        "wrote %d utterances, %d dialect speakers to %s",
        len(utt2wav), len(spk2utt), args.des_dir,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--src_dir", nargs="+", required=True)
    parser.add_argument("--des_dir", type=str, required=True)
    parser.add_argument(
        "--instruct_map",
        nargs="+",
        required=True,
        help='Items like spk_id="You are a helpful assistant. 请用温州话表达。<|endofprompt|>"',
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    main()
