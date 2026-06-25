"""按地区 / 视频编号组织输出目录（video/001、word/001）。"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple


def video_slot(index: int) -> str:
    return f"{index:03d}"


def clip_basename(clip_index: int) -> str:
    return f"{clip_index:03d}"


@dataclass(frozen=True)
class VideoOutputDirs:
    """单个源视频对应的输出路径。"""

    profile_root: Path
    slot: str
    wav_dir: Path
    txt_dir: Path
    log_path: Path
    work_srt: Path

    @classmethod
    def create(
        cls,
        profile_root: Path,
        slot: str,
        video_stem: str,
    ) -> VideoOutputDirs:
        root = Path(profile_root)
        wav_dir = root / "video" / slot
        txt_dir = root / "word" / slot
        wav_dir.mkdir(parents=True, exist_ok=True)
        txt_dir.mkdir(parents=True, exist_ok=True)
        log_dir = root / "logs"
        work_dir = log_dir / "work"
        log_dir.mkdir(parents=True, exist_ok=True)
        work_dir.mkdir(parents=True, exist_ok=True)
        return cls(
            profile_root=root,
            slot=slot,
            wav_dir=wav_dir,
            txt_dir=txt_dir,
            log_path=log_dir / f"{video_stem}.log",
            work_srt=work_dir / f"{video_stem}.srt",
        )


@dataclass(frozen=True)
class ClipPaths:
    wav: Path
    txt: Path
    clip_id: str

    @classmethod
    def for_clip(
        cls,
        dirs: VideoOutputDirs,
        profile: str,
        clip_index: int,
    ) -> ClipPaths:
        base = clip_basename(clip_index)
        clip_id = f"{profile}_v{dirs.slot}_c{base}"
        return cls(
            wav=dirs.wav_dir / f"{base}.wav",
            txt=dirs.txt_dir / f"{base}.txt",
            clip_id=clip_id,
        )


def iter_profile_clips(profile_root: Path) -> Iterable[Tuple[Path, Path, str]]:
    """遍历 profile 下所有 (wav, txt, slot)。"""
    video_root = profile_root / "video"
    word_root = profile_root / "word"
    if not video_root.is_dir():
        return
    for slot_dir in sorted(video_root.iterdir()):
        if not slot_dir.is_dir():
            continue
        slot = slot_dir.name
        txt_dir = word_root / slot
        for wav in sorted(slot_dir.glob("*.wav")):
            txt = txt_dir / f"{wav.stem}.txt"
            yield wav, txt, slot


def rejected_quality_dir(profile_root: Path, slot: str) -> Path:
    return profile_root / "rejected" / "quality" / "video" / slot


def rejected_mandarin_dir(profile_root: Path, slot: str) -> Path:
    return profile_root / "rejected" / "mandarin" / "video" / slot


def rejected_quality_txt_dir(profile_root: Path, slot: str) -> Path:
    return profile_root / "rejected" / "quality" / "word" / slot


def rejected_mandarin_txt_dir(profile_root: Path, slot: str) -> Path:
    return profile_root / "rejected" / "mandarin" / "word" / slot
