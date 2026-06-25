"""通用工具：ffmpeg/ffprobe 检测、子进程封装、时长查询、日志。"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Sequence, Tuple


def find_ffmpeg() -> str:
    return shutil.which("ffmpeg") or ""


def find_ffprobe() -> str:
    return shutil.which("ffprobe") or ""


def ensure_ffmpeg_available() -> Tuple[str, str]:
    """返回 (ffmpeg, ffprobe) 路径；缺失则抛错。"""
    ff = find_ffmpeg()
    fp = find_ffprobe()
    if not ff or not fp:
        missing = []
        if not ff:
            missing.append("ffmpeg")
        if not fp:
            missing.append("ffprobe")
        raise RuntimeError(
            "未在 PATH 中找到: "
            + ", ".join(missing)
            + "。请先安装 FFmpeg 并加入系统 PATH。"
            + " Windows: https://ffmpeg.org/download.html 或使用 winget install ffmpeg"
        )
    return ff, fp


def run_cmd(
    args: Sequence[str],
    *,
    cwd: Optional[Path] = None,
    timeout: Optional[float] = None,
) -> subprocess.CompletedProcess:
    """以列表形式调用子进程，避免 shell 注入；兼容 Windows。"""
    return subprocess.run(
        list(args),
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
    )


def get_video_duration_sec(ffprobe: str, video_path: Path) -> float:
    """用 ffprobe 获取视频时长（秒）。"""
    args = [
        ffprobe,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    cp = run_cmd(args, timeout=120)
    if cp.returncode != 0:
        raise RuntimeError(cp.stderr or cp.stdout or "ffprobe failed")
    try:
        return float((cp.stdout or "").strip())
    except ValueError as e:
        raise RuntimeError(f"无法解析时长: {cp.stdout!r}") from e


def setup_file_logger(log_path: Path, name: str = "video_job") -> logging.Logger:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(f"{name}_{log_path.stem}")
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    return logger


def safe_stem(path: Path) -> str:
    """用于日志文件名的简化 stem。"""
    s = path.stem
    s = re.sub(r"[^\w\-]+", "_", s, flags=re.UNICODE)
    return s[:120] if len(s) > 120 else s


def clamp_segment(
    start: float, end: float, duration: float, pre: float, post: float
) -> Tuple[float, float]:
    """应用 pre/post roll 并限制在 [0, duration]。"""
    s = max(0.0, start - pre)
    e = min(duration, end + post)
    if e <= s:
        # 极端情况：至少 0.05s
        e = min(duration, s + 0.05)
    return s, e


# 常见“仅噪声”字符：空白、标点、制表符等
_PUNCT_NOISE_RE = re.compile(
    r"^[\s\.,;:!?，。；：！？、·…—\-－_\"'\"''「」『』（）()\[\]【】<>《》\d\u3000]+$",
    re.UNICODE,
)


def is_punctuation_or_noise_text(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    return bool(_PUNCT_NOISE_RE.match(t))


def is_single_char_subtitle_noise(
    text: str,
    *,
    allowlist: Optional[Sequence[str]] = None,
) -> bool:
    """硬字幕 OCR 常见：单独一个字（如「商」）多为噪声，新闻口播极少整行单字。"""
    t = text.strip()
    if len(t) != 1:
        return False
    allowed = {x.strip() for x in (allowlist or ()) if x and x.strip()}
    if t in allowed:
        return False
    if is_punctuation_or_noise_text(t):
        return True
    return True


def normalize_text(
    text: str,
    *,
    collapse_whitespace: bool,
    strip_newlines: bool,
) -> str:
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    if strip_newlines:
        t = t.replace("\n", " ")
    if collapse_whitespace:
        t = re.sub(r"\s+", " ", t).strip()
    else:
        t = t.strip()
    return t
