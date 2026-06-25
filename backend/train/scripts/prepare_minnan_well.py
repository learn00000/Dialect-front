#!/usr/bin/env python3
"""将「日常对话-闽南」整理为 taizhou_well 同款目录结构。

输入：/root/日常对话-闽南/*.m4a（文件名即对应文本）
输出：/root/minnan_well/
  video/001/{文本}.wav
  word/001/{文本}.txt
  video/001/manifest.json

音频与文本同名，txt 内容为该句文本。
"""
from __future__ import annotations

import json
import logging
import os
import wave
from pathlib import Path

import av
import numpy as np

logger = logging.getLogger(__name__)

SRC_DIR = Path(os.environ.get("MINNAN_SRC_DIR", "/root/日常对话-闽南"))
OUT_DIR = Path(os.environ.get("MINNAN_WELL_DIR", "/root/minnan_well"))
SLOT = "001"
SAMPLE_RATE = 24000
MIN_DURATION = 0.5
MAX_DURATION = 20.0


def load_m4a_mono(path: Path) -> tuple[np.ndarray, int]:
    container = av.open(str(path))
    stream = container.streams.audio[0]
    chunks: list[np.ndarray] = []
    for frame in container.decode(audio=0):
        arr = frame.to_ndarray()
        if arr.ndim > 1:
            arr = arr.mean(axis=0)
        chunks.append(arr.astype(np.float32))
    if not chunks:
        raise ValueError("empty audio")
    audio = np.concatenate(chunks)
    return audio, int(stream.rate)


def resample(audio: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    if src_sr == dst_sr:
        return audio
    try:
        import torch
        import torchaudio

        t = torch.from_numpy(audio).unsqueeze(0)
        t = torchaudio.transforms.Resample(src_sr, dst_sr)(t)
        return t.squeeze(0).numpy()
    except Exception:
        duration = len(audio) / src_sr
        n = max(1, int(round(duration * dst_sr)))
        x_old = np.linspace(0.0, duration, num=len(audio), endpoint=False)
        x_new = np.linspace(0.0, duration, num=n, endpoint=False)
        return np.interp(x_new, x_old, audio).astype(np.float32)


def float_to_int16(audio: np.ndarray) -> np.ndarray:
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1.0:
        audio = audio / peak
    return (audio * 32767.0).clip(-32768, 32767).astype(np.int16)


def save_wav(path: Path, audio: np.ndarray, sr: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = float_to_int16(audio)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if not SRC_DIR.is_dir():
        raise SystemExit(f"源目录不存在: {SRC_DIR}")

    video_dir = OUT_DIR / "video" / SLOT
    word_dir = OUT_DIR / "word" / SLOT
    video_dir.mkdir(parents=True, exist_ok=True)
    word_dir.mkdir(parents=True, exist_ok=True)

    m4a_files = sorted(SRC_DIR.glob("*.m4a"))
    kept, skipped = 0, 0
    durations: list[float] = []

    for src in m4a_files:
        text = src.stem.strip()
        if not text:
            skipped += 1
            continue
        dst_wav = video_dir / f"{text}.wav"
        dst_txt = word_dir / f"{text}.txt"
        try:
            audio, sr = load_m4a_mono(src)
            audio = resample(audio, sr, SAMPLE_RATE)
            dur = len(audio) / SAMPLE_RATE
            if not (MIN_DURATION <= dur <= MAX_DURATION):
                logger.warning("skip %s: duration %.2fs", text, dur)
                skipped += 1
                continue
            save_wav(dst_wav, audio, SAMPLE_RATE)
            dst_txt.write_text(text + "\n", encoding="utf-8")
            durations.append(dur)
            kept += 1
        except Exception as exc:
            logger.warning("skip %s: %s", text, exc)
            skipped += 1

    manifest = {
        "profile": "minnan_daily",
        "video_slot": SLOT,
        "source_dir": str(SRC_DIR),
        "clip_count": kept,
        "naming": "wav_and_txt_named_by_utterance_text",
    }
    (video_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    avg = sum(durations) / len(durations) if durations else 0.0
    logger.info(
        "done -> %s | kept=%d skipped=%d avg_dur=%.2fs",
        OUT_DIR,
        kept,
        skipped,
        avg,
    )


if __name__ == "__main__":
    main()
