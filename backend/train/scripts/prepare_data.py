#!/usr/bin/env python3
"""Build wav.scp / text / utt2spk / spk2utt [/instruct] for dialect fine-tuning."""
import argparse
import glob
import logging
import os

from tqdm import tqdm

logger = logging.getLogger(__name__)


def main() -> None:
    wavs = sorted(glob.glob(os.path.join(args.src_dir, "*", "*", "*.wav")))
    utt2wav, utt2text, utt2spk, spk2utt = {}, {}, {}, {}

    for wav in tqdm(wavs):
        txt = wav.replace(".wav", ".normalized.txt")
        if not os.path.isfile(txt):
            logger.warning("%s missing transcript", wav)
            continue
        with open(txt, encoding="utf-8") as f:
            content = "".join(l.replace("\n", "") for l in f.readline())
        session = os.path.basename(os.path.dirname(wav))
        stem = os.path.basename(wav).replace(".wav", "")
        spk = os.path.basename(os.path.dirname(os.path.dirname(wav)))
        utt = f"{spk}_{stem}"

        utt2wav[utt] = wav
        utt2text[utt] = content
        utt2spk[utt] = spk
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
    if args.instruct:
        with open(os.path.join(args.des_dir, "instruct"), "w", encoding="utf-8") as f:
            for k in utt2text:
                f.write(f"{k} {args.instruct}\n")

    logger.info("wrote %d utterances to %s", len(utt2wav), args.des_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--src_dir", type=str, required=True)
    parser.add_argument("--des_dir", type=str, required=True)
    parser.add_argument(
        "--instruct",
        type=str,
        default="",
        help='e.g. "You are a helpful assistant. 请用闽南话表达。<|endofprompt|>"',
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    main()
