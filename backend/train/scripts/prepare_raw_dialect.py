#!/usr/bin/env python3
"""Convert dialect raw corpus to CosyVoice LibriTTS-style layout.

Raw layout (per dialect root):
  video/{slot}/{id}.wav
  word/{slot}/{id}.txt

Output layout (CosyVoice expects src_dir/*/*/*.wav):
  {out_dir}/train/{spk_id}/{slot}/{slot}_{id}.wav
  {out_dir}/train/{spk_id}/{slot}/{slot}_{id}.normalized.txt
  {out_dir}/dev/...
"""
from __future__ import annotations

import argparse
import logging
import shutil
from pathlib import Path

import torch
import torchaudio

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24000


def _read_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    return " ".join(text.split())


def _resample_wav(src: Path, dst: Path, target_sr: int) -> None:
    audio, sr = torchaudio.load(str(src))
    if audio.shape[0] > 1:
        audio = audio.mean(dim=0, keepdim=True)
    if sr != target_sr:
        audio = torchaudio.transforms.Resample(orig_freq=sr, new_freq=target_sr)(audio)
    dst.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(dst), audio, target_sr)


def _copy_or_link(
    src: Path,
    dst: Path,
    use_symlink: bool,
    resample: bool,
    target_sr: int,
) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if resample:
        _resample_wav(src, dst, target_sr)
        return
    if use_symlink:
        if dst.exists() or dst.is_symlink():
            dst.unlink()
        dst.symlink_to(src.resolve())
        return
    shutil.copy2(src, dst)


def _collect_slots(raw_dir: Path) -> list[str]:
    video_dir = raw_dir / "video"
    if not video_dir.is_dir():
        raise FileNotFoundError(f"missing video dir: {video_dir}")
    return sorted(p.name for p in video_dir.iterdir() if p.is_dir())


def _dev_stems_for_slot(
    wav_paths: list[Path],
    slot: str,
    dev_slots: set[str],
    dev_ratio: float,
) -> set[str]:
    if slot in dev_slots:
        return {p.stem for p in wav_paths}
    if dev_ratio <= 0 or not wav_paths:
        return set()
    dev_n = max(1, int(round(len(wav_paths) * dev_ratio)))
    # 按文本名排序后，末尾若干条划入 dev（可复现）
    return {p.stem for p in wav_paths[-dev_n:]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw_dir", type=str, required=True, help="e.g. /root/minnan_well")
    parser.add_argument("--out_dir", type=str, required=True, help="e.g. data/raw_prepared")
    parser.add_argument("--spk_id", type=str, default="", help="speaker id, default: dialect name")
    parser.add_argument(
        "--dev_slots",
        type=str,
        default="010,011",
        help="comma-separated video slots for dev set",
    )
    parser.add_argument(
        "--dev_ratio",
        type=float,
        default=0.0,
        help="when slot not in dev_slots, hold out this ratio per slot (e.g. 0.1)",
    )
    parser.add_argument("--symlink", action="store_true", help="symlink wav instead of copy")
    parser.add_argument(
        "--resample",
        action="store_true",
        default=True,
        help="resample wav to 24kHz (recommended for CosyVoice3)",
    )
    parser.add_argument("--no_resample", action="store_false", dest="resample")
    parser.add_argument("--sample_rate", type=int, default=SAMPLE_RATE)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    raw_dir = Path(args.raw_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    spk_id = args.spk_id or raw_dir.name
    dev_slots = {s.strip() for s in args.dev_slots.split(",") if s.strip()}

    stats = {"train": 0, "dev": 0, "skip": 0}
    for slot in _collect_slots(raw_dir):
        wav_dir = raw_dir / "video" / slot
        txt_dir = raw_dir / "word" / slot
        wav_paths = sorted(wav_dir.glob("*.wav"))
        slot_dev_stems = _dev_stems_for_slot(wav_paths, slot, dev_slots, args.dev_ratio)

        for wav_path in wav_paths:
            txt_path = txt_dir / f"{wav_path.stem}.txt"
            if not txt_path.is_file():
                logger.warning("skip %s: missing %s", wav_path, txt_path)
                stats["skip"] += 1
                continue

            split = "dev" if wav_path.stem in slot_dev_stems else "train"
            utt_name = f"{slot}_{wav_path.stem}"
            utt_dir = out_dir / split / spk_id / slot
            dst_wav = utt_dir / f"{utt_name}.wav"
            dst_txt = utt_dir / f"{utt_name}.normalized.txt"

            _copy_or_link(
                wav_path,
                dst_wav,
                use_symlink=args.symlink and not args.resample,
                resample=args.resample,
                target_sr=args.sample_rate,
            )
            dst_txt.write_text(_read_text(txt_path) + "\n", encoding="utf-8")
            stats[split] += 1

    logger.info(
        "done raw=%s -> out=%s spk=%s train=%d dev=%d skip=%d",
        raw_dir,
        out_dir,
        spk_id,
        stats["train"],
        stats["dev"],
        stats["skip"],
    )


if __name__ == "__main__":
    main()
