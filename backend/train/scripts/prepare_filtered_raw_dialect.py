#!/usr/bin/env python3
"""Prepare a filtered noisy dialect subset for second-stage SFT.

This keeps the same CosyVoice raw_prepared layout as prepare_raw_dialect.py,
but accepts multiple raw roots and filters by duration/text length. It is meant
for small noisy augmentation; keep dev data clean and use this for train only.
"""
from __future__ import annotations

import argparse
import audioop
import logging
import shutil
import wave
from pathlib import Path

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24000


def read_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    return " ".join(text.split())


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / float(wav.getframerate())


def resample_wav(src: Path, dst: Path, target_sr: int) -> None:
    with wave.open(str(src), "rb") as wav:
        sr = wav.getframerate()
        nch = wav.getnchannels()
        sw = wav.getsampwidth()
        data = wav.readframes(wav.getnframes())
    if nch == 2:
        data = audioop.tomono(data, sw, 0.5, 0.5)
        nch = 1
    if sr != target_sr:
        data, _ = audioop.ratecv(data, sw, nch, sr, target_sr, None)
    dst.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dst), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(sw)
        out.setframerate(target_sr)
        out.writeframes(data)


def copy_or_resample(src: Path, dst: Path, resample: bool, target_sr: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if resample:
        resample_wav(src, dst, target_sr)
    else:
        shutil.copy2(src, dst)


def iter_wavs(raw_dirs: list[Path]):
    for raw_dir in raw_dirs:
        for wav_path in sorted((raw_dir / "video").glob("*/*.wav")):
            slot = wav_path.parent.name
            txt_path = raw_dir / "word" / slot / f"{wav_path.stem}.txt"
            yield raw_dir, slot, wav_path, txt_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw_dirs", nargs="+", required=True)
    parser.add_argument("--out_dir", required=True)
    parser.add_argument("--spk_id", required=True)
    parser.add_argument("--split", default="train", choices=["train", "dev"])
    parser.add_argument("--max_utts", type=int, default=300)
    parser.add_argument("--min_duration", type=float, default=1.0)
    parser.add_argument("--max_duration", type=float, default=15.0)
    parser.add_argument("--min_chars", type=int, default=4)
    parser.add_argument("--max_chars", type=int, default=80)
    parser.add_argument("--sample_rate", type=int, default=SAMPLE_RATE)
    parser.add_argument("--resample", action="store_true", default=True)
    parser.add_argument("--no_resample", action="store_false", dest="resample")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    raw_dirs = [Path(i).resolve() for i in args.raw_dirs]
    out_dir = Path(args.out_dir).resolve()

    kept, skipped = 0, 0
    for raw_dir, slot, wav_path, txt_path in iter_wavs(raw_dirs):
        if kept >= args.max_utts:
            break
        if not txt_path.is_file():
            skipped += 1
            continue
        try:
            text = read_text(txt_path)
            duration = wav_duration(wav_path)
        except Exception as exc:
            logger.warning("skip %s: %s", wav_path, exc)
            skipped += 1
            continue
        if not (args.min_duration <= duration <= args.max_duration):
            skipped += 1
            continue
        if not (args.min_chars <= len(text) <= args.max_chars):
            skipped += 1
            continue

        root_tag = raw_dir.name
        utt_slot = f"{root_tag}_{slot}"
        utt_name = f"{root_tag}_{slot}_{wav_path.stem}"
        utt_dir = out_dir / args.split / args.spk_id / utt_slot
        dst_wav = utt_dir / f"{utt_name}.wav"
        dst_txt = utt_dir / f"{utt_name}.normalized.txt"
        copy_or_resample(wav_path, dst_wav, args.resample, args.sample_rate)
        dst_txt.write_text(text + "\n", encoding="utf-8")
        kept += 1

    logger.info(
        "done noisy roots=%s -> out=%s spk=%s kept=%d skipped=%d",
        ",".join(str(i) for i in raw_dirs),
        out_dir,
        args.spk_id,
        kept,
        skipped,
    )


if __name__ == "__main__":
    main()
