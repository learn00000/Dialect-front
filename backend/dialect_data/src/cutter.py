"""按时间从视频切出小视频片段。"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from .utils import run_cmd


def cut_video_segment(
    ffmpeg: str,
    input_video: Path,
    output_mp4: Path,
    start_sec: float,
    end_sec: float,
    *,
    video_codec: str,
    audio_codec: str,
    crf: int,
    preset: str,
    timeout_sec: float = 600,
) -> bool:
    """
    使用 -ss / -to 放在 -i 之后以获得较准确切边（相对输入时间轴）。
    """
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    if output_mp4.exists():
        output_mp4.unlink()

    # -to 为输入时间轴上的结束时刻
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
        "-c:v",
        video_codec,
        "-c:a",
        audio_codec,
        "-crf",
        str(crf),
        "-preset",
        preset,
        "-movflags",
        "+faststart",
        str(output_mp4),
    ]
    cp = run_cmd(args, timeout=timeout_sec)
    if cp.returncode != 0:
        return False
    return output_mp4.exists() and output_mp4.stat().st_size > 0
