"""从视频提取字幕为 SRT（软字幕）。"""

from __future__ import annotations

from pathlib import Path

from .utils import run_cmd


def extract_subtitle_srt(
    ffmpeg: str,
    video_path: Path,
    out_srt: Path,
    stream_index: int,
) -> bool:
    """
    将指定字幕流导出为 SRT。
    stream_index 为 ffprobe 报告的 stream index（例如 2）。
    """
    out_srt.parent.mkdir(parents=True, exist_ok=True)
    if out_srt.exists():
        out_srt.unlink()

    args = [
        ffmpeg,
        "-y",
        "-i",
        str(video_path),
        "-map",
        f"0:{stream_index}",
        "-c:s",
        "srt",
        str(out_srt),
    ]
    cp = run_cmd(args, timeout=600)
    if cp.returncode != 0:
        return False
    if not out_srt.exists() or out_srt.stat().st_size < 10:
        return False
    # 简单校验是否像 srt
    head = out_srt.read_text(encoding="utf-8", errors="replace")[:200]
    if "-->" not in head and not head.strip().startswith("1"):
        return False
    return True
