"""检测视频是否包含可映射的字幕流（软字幕）。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .utils import run_cmd


def probe_streams(ffprobe: str, video_path: Path) -> Dict[str, Any]:
    args = [
        ffprobe,
        "-v",
        "error",
        "-show_streams",
        "-of",
        "json",
        str(video_path),
    ]
    cp = run_cmd(args, timeout=120)
    if cp.returncode != 0:
        raise RuntimeError(cp.stderr or "ffprobe failed")
    return json.loads(cp.stdout or "{}")


def list_subtitle_streams(ffprobe: str, video_path: Path) -> List[Dict[str, Any]]:
    data = probe_streams(ffprobe, video_path)
    streams = data.get("streams") or []
    subs = [s for s in streams if s.get("codec_type") == "subtitle"]
    return subs


def pick_text_subtitle_stream_index(ffprobe: str, video_path: Path) -> Optional[int]:
    """
    选择较可能导出为文本的字幕轨索引（容器内 stream index，非仅 subtitle 序）。
    返回全局 stream index，供 ffmpeg -map 0:i 使用。
    """
    subs = list_subtitle_streams(ffprobe, video_path)
    if not subs:
        return None

    # 优先常见文本字幕
    prefer = (
        "subrip",
        "ass",
        "ssa",
        "mov_text",
        "webvtt",
        "srt",
        "hdmv_pgs_subtitle",  # 位图，提取 srt 常失败，放后面
    )
    ranked: List[tuple[int, Dict[str, Any]]] = []
    for s in subs:
        idx = int(s.get("index", -1))
        name = (s.get("codec_name") or "").lower()
        try:
            pri = prefer.index(name)
        except ValueError:
            pri = len(prefer) + 1
        ranked.append((pri, s))

    ranked.sort(key=lambda x: (x[0], int(x[1].get("index", 999999))))
    best = ranked[0][1]
    codec = (best.get("codec_name") or "").lower()
    # 位图字幕无法用 ffmpeg 稳定转 SRT，直接交给 OCR
    if codec in ("hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle"):
        return None
    return int(best["index"])


def has_soft_subtitle(ffprobe: str, video_path: Path) -> bool:
    return pick_text_subtitle_stream_index(ffprobe, video_path) is not None
