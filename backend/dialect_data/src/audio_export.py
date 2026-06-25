"""从视频导出 WAV（整段或时间范围）。"""

from __future__ import annotations

from pathlib import Path

from .utils import run_cmd


def extract_wav_segment(
    ffmpeg: str,
    input_video: Path,
    output_wav: Path,
    start_sec: float,
    end_sec: float,
    *,
    sample_rate: int,
    channels: int,
    codec: str,
    timeout_sec: float = 600,
) -> bool:
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    if output_wav.exists():
        output_wav.unlink()

    args = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(input_video),
        "-ss",
        f"{start_sec:.3f}",
        "-to",
        f"{end_sec:.3f}",
        "-vn",
        "-ac",
        str(channels),
        "-ar",
        str(sample_rate),
        "-c:a",
        codec,
        str(output_wav),
    ]
    cp = run_cmd(args, timeout=timeout_sec)
    if cp.returncode != 0:
        return False
    return output_wav.exists() and output_wav.stat().st_size > 0


def extract_wav_from_clip(
    ffmpeg: str,
    clip_mp4: Path,
    output_wav: Path,
    *,
    sample_rate: int,
    channels: int,
    codec: str,
    timeout_sec: float = 600,
) -> bool:
    """从小视频文件导出整段 WAV（用于已切好 mp4 时）。"""
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    if output_wav.exists():
        output_wav.unlink()

    args = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(clip_mp4),
        "-vn",
        "-ac",
        str(channels),
        "-ar",
        str(sample_rate),
        "-c:a",
        codec,
        str(output_wav),
    ]
    cp = run_cmd(args, timeout=timeout_sec)
    if cp.returncode != 0:
        return False
    return output_wav.exists() and output_wav.stat().st_size > 0
