"""解析 SRT 为时间段 + 文本列表。"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .text_dedupe import join_distinct_clip_texts, text_similarity
from .utils import clamp_segment, is_single_char_subtitle_noise


_TIMESTAMP_LINE = re.compile(
    r"^\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})"
)


def _parse_ts(ts: str) -> float:
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) != 3:
        raise ValueError(f"bad timestamp: {ts}")
    h, m, s = parts
    return int(h) * 3600 + int(m) * 60 + float(s)


@dataclass
class SubtitleSegment:
    start: float
    end: float
    text: str


@dataclass
class ClipPlan:
    """切片计划：时间轴 + 合并后的字幕文本。"""

    start: float
    end: float
    text: str


def parse_srt_content(content: str) -> List[SubtitleSegment]:
    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    segments: List[SubtitleSegment] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.isdigit():
            i += 1
            if i >= n:
                break
            line = lines[i].strip()

        m = _TIMESTAMP_LINE.match(line)
        if not m:
            i += 1
            continue

        start = _parse_ts(m.group(1))
        end = _parse_ts(m.group(2))
        i += 1
        text_lines: List[str] = []
        while i < n and lines[i].strip():
            text_lines.append(lines[i].rstrip())
            i += 1
        text = "\n".join(text_lines).strip()
        if end > start:
            segments.append(SubtitleSegment(start=start, end=end, text=text))
        i += 1

    return segments


def drop_single_char_segments(
    segments: List[SubtitleSegment],
    *,
    allowlist: Optional[List[str]] = None,
) -> List[SubtitleSegment]:
    """去掉仅一个字的字幕条（OCR 句首/段首噪声）。"""
    out: List[SubtitleSegment] = []
    for seg in segments:
        if is_single_char_subtitle_noise(seg.text, allowlist=allowlist):
            continue
        out.append(seg)
    return out


def parse_srt_file(path: Path) -> List[SubtitleSegment]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    return parse_srt_content(raw)


def format_srt_timestamp(ts: float) -> str:
    if ts < 0:
        ts = 0.0
    ms = int(round((ts - int(ts)) * 1000))
    total = int(math.floor(ts))
    h = total // 3600
    m = (total % 3600) // 60
    sec = total % 60
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def write_srt_file(path: Path, segments: List[SubtitleSegment]) -> None:
    lines: List[str] = []
    for i, s in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(
            f"{format_srt_timestamp(s.start)} --> {format_srt_timestamp(s.end)}"
        )
        lines.append(s.text)
        lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _join_subtitle_text(a: str, b: str) -> str:
    a, b = a.strip(), b.strip()
    if not a:
        return b
    if not b:
        return a
    return f"{a} {b}"


def merge_adjacent_by_gap(
    segments: List[SubtitleSegment],
    max_gap_sec: float,
    max_span_sec: float,
) -> List[SubtitleSegment]:
    if max_gap_sec <= 0 or len(segments) <= 1:
        return list(segments)
    segs = sorted(segments, key=lambda s: s.start)
    out: List[SubtitleSegment] = []
    cur = segs[0]
    for nxt in segs[1:]:
        gap = nxt.start - cur.end
        span = max(nxt.end, cur.end) - cur.start
        if gap <= max_gap_sec and span <= max_span_sec:
            cur = SubtitleSegment(
                start=cur.start,
                end=max(cur.end, nxt.end),
                text=_join_subtitle_text(cur.text, nxt.text),
            )
        else:
            out.append(cur)
            cur = nxt
    out.append(cur)
    return out


def collapse_similar_ocr_segments(
    segments: List[SubtitleSegment],
    max_gap_sec: float,
    similarity_threshold: float,
    *,
    llm_cfg: Optional[Dict[str, Any]] = None,
    logger: Optional[Any] = None,
) -> List[SubtitleSegment]:
    """相邻且高度相似的 OCR 条合并为一条（只保留一条最佳文本）。"""
    if len(segments) <= 1:
        return list(segments)
    segs = sorted(segments, key=lambda s: s.start)
    out: List[SubtitleSegment] = []
    cur = segs[0]
    for nxt in segs[1:]:
        gap = nxt.start - cur.end
        sim = text_similarity(cur.text, nxt.text)
        if gap <= max_gap_sec and sim >= similarity_threshold:
            merged = join_distinct_clip_texts(
                [cur.text, nxt.text],
                similarity_threshold=similarity_threshold,
                llm_cfg=llm_cfg,
                logger=logger,
            )
            cur = SubtitleSegment(
                start=cur.start,
                end=max(cur.end, nxt.end),
                text=merged,
            )
        else:
            out.append(cur)
            cur = nxt
    out.append(cur)
    return out


def merge_consecutive_fuzzy_similar(
    segments: List[SubtitleSegment],
    max_gap_sec: float,
    similarity_threshold: float,
    *,
    llm_cfg: Optional[Dict[str, Any]] = None,
    logger: Optional[Any] = None,
) -> List[SubtitleSegment]:
    """相邻条间隙小且文本相似度高时合并（缓解 OCR 抖动）。"""
    return collapse_similar_ocr_segments(
        segments,
        max_gap_sec,
        similarity_threshold,
        llm_cfg=llm_cfg,
        logger=logger,
    )


def _compute_clip_end(
    segments: List[SubtitleSegment],
    hi: int,
    duration: float,
    post_roll: float,
    clip_end_trim: float,
    boundary_cfg: Optional[Dict[str, Any]],
) -> float:
    seg_end = segments[hi].end
    gap_to_next = (
        segments[hi + 1].start - seg_end if hi + 1 < len(segments) else 999.0
    )
    bcfg = boundary_cfg or {}
    tight_gap = float(bcfg.get("tight_gap_sec", 0.28))
    tail_ratio = float(bcfg.get("tight_tail_ratio", 0.35))

    max_tail = float(bcfg.get("max_tail_sec", 0.04))
    if gap_to_next < tight_gap:
        tail = min(post_roll, max(0.01, gap_to_next * tail_ratio), max_tail)
        end = seg_end + tail
    else:
        end = min(duration, seg_end + post_roll)

    if clip_end_trim > 0:
        end = max(seg_end, end - clip_end_trim)

    if hi + 1 < len(segments) and bool(bcfg.get("split_at_midgap", True)):
        next_start = segments[hi + 1].start
        if gap_to_next < tight_gap:
            split = (seg_end + next_start) * 0.5
            pad = float(bcfg.get("split_pad_sec", 0.02))
            end = min(end, split - pad)

    return min(duration, end)


def _expand_hi_on_tight_gap(
    segs: List[SubtitleSegment],
    lo: int,
    hi: int,
    n: int,
    *,
    boundary_cfg: Optional[Dict[str, Any]],
    max_seg_in_group: int,
    max_merge_span_sec: float,
    duration: float,
    pre_roll: float,
    post_roll: float,
    clip_end_trim: float,
    start_floor: float,
    llm_cfg: Optional[Dict[str, Any]],
    logger: Optional[Any],
) -> int:
    """相邻字幕间隙过小时，合并为一条 clip，避免硬切吃字。"""
    merge_on_gap = float((boundary_cfg or {}).get("merge_on_gap_sec", 0.0))
    if merge_on_gap <= 0:
        return hi
    while hi + 1 < n:
        gap = segs[hi + 1].start - segs[hi].end
        if gap > merge_on_gap:
            break
        if (hi + 1 - lo + 1) > max_seg_in_group:
            break
        _, _, span_len, _ = _clip_bounds_for_span(
            segs,
            lo,
            hi + 1,
            duration,
            pre_roll,
            post_roll,
            clip_end_trim,
            start_floor=start_floor,
            boundary_cfg=boundary_cfg,
            llm_cfg=llm_cfg,
            logger=logger,
        )
        if span_len > max_merge_span_sec:
            break
        hi += 1
        if logger:
            logger.debug(
                "紧间隙合并字幕: gap=%.3fs lo=%s hi=%s",
                gap,
                lo,
                hi,
            )
    return hi


def _clip_bounds_for_span(
    segments: List[SubtitleSegment],
    lo: int,
    hi: int,
    duration: float,
    pre_roll: float,
    post_roll: float,
    clip_end_trim: float,
    *,
    start_floor: float = 0.0,
    boundary_cfg: Optional[Dict[str, Any]] = None,
    llm_cfg: Optional[Dict[str, Any]] = None,
    logger: Optional[Any] = None,
) -> Tuple[float, float, float, str]:
    natural_start = max(0.0, segments[lo].start - pre_roll)
    start = natural_start
    if start_floor > 0:
        start = max(start, start_floor)

    end = _compute_clip_end(
        segments, hi, duration, post_roll, clip_end_trim, boundary_cfg
    )
    if end <= start:
        end = min(duration, start + 0.05)

    # 合并组内字幕条数可能多于实际音频窗（start_floor 避免与上一 clip 重叠）；
    # 只保留与 [start, end] 有时间交集的字幕，避免 txt 带上一条 wav 里没有的句。
    texts = [
        segments[j].text
        for j in range(lo, hi + 1)
        if segments[j].end > start + 1e-3 and segments[j].start < end - 1e-3
    ]
    sim_thr = float((llm_cfg or {}).get("clip_similarity_threshold", 0.82))
    text = join_distinct_clip_texts(
        texts,
        similarity_threshold=sim_thr,
        llm_cfg=llm_cfg,
        logger=logger,
    )
    return start, end, end - start, text


def plan_clips_from_segments(
    segments: List[SubtitleSegment],
    duration: float,
    *,
    pre_roll: float,
    post_roll: float,
    clip_end_trim: float,
    min_clip_sec: float,
    max_merge_span_sec: float,
    max_neighbors_each_side: int = 2,
    max_clip_sec: float = 0.0,
    boundary_cfg: Optional[Dict[str, Any]] = None,
    llm_cfg: Optional[Dict[str, Any]] = None,
    logger: Optional[Any] = None,
) -> List[ClipPlan]:
    """
    生成切片计划。
    - 单条切片时长 >= min_clip_sec：不合并。
    - 否则与前后最多各 max_neighbors_each_side 条合并，总跨度 <= max_merge_span_sec。
    """
    segs = sorted(segments, key=lambda s: s.start)
    n = len(segs)
    if n == 0:
        return []

    max_neighbors_each_side = max(0, int(max_neighbors_each_side))
    max_seg_in_group = 1 + 2 * max_neighbors_each_side

    plans: List[ClipPlan] = []
    prev_end = 0.0
    i = 0
    while i < n:
        lo = hi = i
        start_floor = prev_end
        while True:
            _, _, clip_len, _ = _clip_bounds_for_span(
                segs,
                lo,
                hi,
                duration,
                pre_roll,
                post_roll,
                clip_end_trim,
                start_floor=start_floor,
                boundary_cfg=boundary_cfg,
                llm_cfg=llm_cfg,
                logger=logger,
            )
            if clip_len >= min_clip_sec:
                break
            if clip_len >= max_merge_span_sec:
                break

            candidates: List[Tuple[int, int, float]] = []
            if hi + 1 < n and (hi + 1 - lo + 1) <= max_seg_in_group:
                _, _, ln, _ = _clip_bounds_for_span(
                    segs,
                    lo,
                    hi + 1,
                    duration,
                    pre_roll,
                    post_roll,
                    clip_end_trim,
                    start_floor=start_floor,
                    boundary_cfg=boundary_cfg,
                    llm_cfg=llm_cfg,
                    logger=logger,
                )
                if ln <= max_merge_span_sec:
                    candidates.append((lo, hi + 1, ln))
            if lo > 0 and (hi - (lo - 1) + 1) <= max_seg_in_group:
                _, _, ln, _ = _clip_bounds_for_span(
                    segs,
                    lo - 1,
                    hi,
                    duration,
                    pre_roll,
                    post_roll,
                    clip_end_trim,
                    start_floor=start_floor,
                    boundary_cfg=boundary_cfg,
                    llm_cfg=llm_cfg,
                    logger=logger,
                )
                if ln <= max_merge_span_sec:
                    candidates.append((lo - 1, hi, ln))

            if not candidates:
                break
            best = max(candidates, key=lambda c: c[2])
            if best[2] <= clip_len + 1e-6:
                break
            lo, hi = best[0], best[1]

        hi = _expand_hi_on_tight_gap(
            segs,
            lo,
            hi,
            n,
            boundary_cfg=boundary_cfg,
            max_seg_in_group=max_seg_in_group,
            max_merge_span_sec=max_merge_span_sec,
            duration=duration,
            pre_roll=pre_roll,
            post_roll=post_roll,
            clip_end_trim=clip_end_trim,
            start_floor=start_floor,
            llm_cfg=llm_cfg,
            logger=logger,
        )

        start, end, clip_len, text = _clip_bounds_for_span(
            segs,
            lo,
            hi,
            duration,
            pre_roll,
            post_roll,
            clip_end_trim,
            start_floor=start_floor,
            boundary_cfg=boundary_cfg,
            llm_cfg=llm_cfg,
            logger=logger,
        )
        if clip_len < min_clip_sec and end < duration - 0.05:
            desired = start + min_clip_sec
            cap = _compute_clip_end(
                segs, hi, duration, post_roll, clip_end_trim, boundary_cfg
            )
            if hi + 1 < n and bool((boundary_cfg or {}).get("split_at_midgap", True)):
                pad = float((boundary_cfg or {}).get("split_pad_sec", 0.02))
                mid_cap = (segs[hi].end + segs[hi + 1].start) * 0.5 - pad
                cap = min(cap, mid_cap)
            desired = min(desired, cap)
            end = min(duration, max(end, desired))
            clip_len = end - start
        if max_clip_sec > 0 and clip_len > max_clip_sec:
            i = hi + 1
            continue
        if clip_len < min_clip_sec:
            i = hi + 1
            continue
        plans.append(ClipPlan(start=start, end=end, text=text))
        prev_end = end
        i = hi + 1

    return plans
