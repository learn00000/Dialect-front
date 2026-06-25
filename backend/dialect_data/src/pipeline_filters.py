"""听感质检与普通话 ASR 过滤（供 main.py 一站式调用）。"""

from __future__ import annotations

import json
import logging
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .audio_quality import analyze_wav, evaluate_clip_quality
from .layout import (
    iter_profile_clips,
    rejected_mandarin_dir,
    rejected_mandarin_txt_dir,
    rejected_quality_dir,
    rejected_quality_txt_dir,
)
from .mandarin_check import evaluate_clip
from .srt_parser import parse_srt_file
from .utils import safe_stem


def _resolve_quality_rules(cfg: Dict[str, Any], profile: str) -> Dict[str, Any]:
    qcfg = dict(cfg.get("quality_filter") or {})
    profiles = dict(qcfg.get("profiles") or {})
    base = dict(qcfg.get("default") or {})
    if profile in profiles:
        merged = dict(base)
        merged.update(profiles[profile])
        return merged
    return base or qcfg


def _load_mandarin_cfg(cfg: Dict[str, Any], profile: str) -> Dict[str, Any]:
    base = dict(cfg.get("mandarin_filter") or {})
    profiles = dict(base.get("profiles") or {})
    if profile in profiles:
        merged = dict(base)
        merged.update(profiles[profile])
        merged["profiles"] = profiles
        return merged
    return base


def _build_srt_cache(
    work_dir: Path,
    meta_rows: List[Dict[str, Any]],
    mcfg: Dict[str, Any],
    log: logging.Logger,
) -> Dict[str, List[Any]]:
    cache: Dict[str, List[Any]] = {}
    cfg_srt = mcfg.get("srt_path")
    if cfg_srt:
        p = Path(str(cfg_srt))
        if not p.is_absolute():
            p = Path.cwd() / p
        if p.is_file():
            cache["__default__"] = parse_srt_file(p)
            return cache

    stems: set[str] = set()
    for row in meta_rows:
        src = row.get("source_video")
        if src:
            stems.add(safe_stem(Path(str(src))))

    for stem in sorted(stems):
        cand = work_dir / f"{stem}.srt"
        if cand.is_file():
            cache[stem] = parse_srt_file(cand)
            log.info("逐句检测 SRT[%s]: %d 条", stem, len(cache[stem]))

    if not cache and work_dir.is_dir():
        srt_files = sorted(work_dir.glob("*.srt"), key=lambda p: p.stat().st_mtime)
        if srt_files:
            cache["__fallback__"] = parse_srt_file(srt_files[-1])
    return cache


def _srt_for_clip(
    meta: Dict[str, Any], cache: Dict[str, List[Any]]
) -> Optional[List[Any]]:
    if not cache:
        return None
    src = meta.get("source_video")
    if src:
        stem = safe_stem(Path(str(src)))
        if stem in cache:
            return cache[stem]
    return cache.get("__default__") or cache.get("__fallback__")


def _load_metadata_jsonl(path: Path) -> Dict[str, Dict[str, Any]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    if not path.is_file():
        return by_id
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        by_id[str(row.get("id", ""))] = row
    return by_id


def run_quality_filter(
    profile_root: Path,
    cfg: Dict[str, Any],
    profile: str,
    *,
    dry_run: bool = False,
    log: Optional[logging.Logger] = None,
) -> Dict[str, Any]:
    log = log or logging.getLogger("quality_filter")
    rules = _resolve_quality_rules(cfg, profile)
    if not rules.get("enabled", True):
        log.info("[%s] 听感质检已禁用", profile)
        return {"kept_count": 0, "rejected_count": 0, "skipped": True}

    kept: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    for wav, txt, slot in iter_profile_clips(profile_root):
        try:
            m = analyze_wav(wav)
            ok, reasons = evaluate_clip_quality(m, rules)
        except Exception as e:
            ok, reasons, m = False, [f"error:{e}"], None
        row = {
            "id": wav.stem,
            "slot": slot,
            "wav": str(wav),
            "keep": ok,
            "reasons": reasons,
            "metrics": m.to_dict() if m else {},
        }
        if ok:
            kept.append(row)
        else:
            rejected.append(row)
            if not dry_run:
                rej_w = rejected_quality_dir(profile_root, slot)
                rej_t = rejected_quality_txt_dir(profile_root, slot)
                rej_w.mkdir(parents=True, exist_ok=True)
                rej_t.mkdir(parents=True, exist_ok=True)
                shutil.move(str(wav), str(rej_w / wav.name))
                if txt.is_file():
                    shutil.move(str(txt), str(rej_t / txt.name))

    report = {
        "profile": profile,
        "rules": rules,
        "kept_count": len(kept),
        "rejected_count": len(rejected),
        "kept": kept,
        "rejected": rejected,
    }
    report_path = profile_root / "metadata" / "quality_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    log.info(
        "[%s] 听感质检：保留 %d，剔除 %d → %s",
        profile,
        len(kept),
        len(rejected),
        report_path,
    )
    return report


def run_mandarin_filter(
    profile_root: Path,
    cfg: Dict[str, Any],
    profile: str,
    *,
    dry_run: bool = False,
    limit: int = 0,
    verbose: bool = False,
    log: Optional[logging.Logger] = None,
) -> Dict[str, Any]:
    log = log or logging.getLogger("mandarin_filter")
    mcfg = _load_mandarin_cfg(cfg, profile)
    if not mcfg.get("enabled", True):
        log.info("[%s] 普通话过滤已禁用", profile)
        return {"kept_count": 0, "rejected_count": 0, "skipped": True}

    meta_path = profile_root / "metadata" / "metadata.jsonl"
    meta_by_id = _load_metadata_jsonl(meta_path)

    srt_cache: Dict[str, List[Any]] = {}
    if bool(mcfg.get("segment_check_enabled", True)):
        srt_cache = _build_srt_cache(
            profile_root / "logs" / "work", list(meta_by_id.values()), mcfg, log
        )

    clips = list(iter_profile_clips(profile_root))
    if limit > 0:
        clips = clips[:limit]

    kept: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    for i, (wav, txt, slot) in enumerate(clips, 1):
        subtitle = txt.read_text(encoding="utf-8").strip() if txt.is_file() else ""
        rel_wav = str(wav.relative_to(profile_root))
        meta = {}
        for row in meta_by_id.values():
            if row.get("wav_path") == rel_wav:
                meta = row
                break
        if not meta:
            for row in meta_by_id.values():
                if row.get("video_slot") == slot and row.get("wav") == wav.name:
                    meta = row
                    break

        clip_start = float(meta["start"]) if "start" in meta else None
        clip_end = float(meta["end"]) if "end" in meta else None
        srt_segments = _srt_for_clip(meta, srt_cache)

        log.info("[%s] [%d/%d] %s/%s", profile, i, len(clips), slot, wav.name)
        try:
            result = evaluate_clip(
                wav,
                subtitle,
                mcfg,
                run_asr=bool(mcfg.get("asr_enabled", True)),
                clip_start=clip_start,
                clip_end=clip_end,
                all_srt_segments=srt_segments,
            )
        except Exception as e:
            log.error("  失败: %s", e)
            result = {
                "reject": False,
                "reasons": [f"error:{e}"],
                "match_score": 0.0,
            }

        row = {"id": wav.stem, "slot": slot, "wav": str(wav), **result}
        if result.get("reject"):
            rejected.append(row)
            if not dry_run:
                rej_w = rejected_mandarin_dir(profile_root, slot)
                rej_t = rejected_mandarin_txt_dir(profile_root, slot)
                rej_w.mkdir(parents=True, exist_ok=True)
                rej_t.mkdir(parents=True, exist_ok=True)
                shutil.move(str(wav), str(rej_w / wav.name))
                if txt.is_file():
                    shutil.move(str(txt), str(rej_t / txt.name))
        else:
            kept.append(row)
            if verbose:
                log.debug("  保留 match=%.2f", result.get("match_score", 0))
        time.sleep(float(mcfg.get("request_interval_sec", 0.0)))

    report = {
        "profile": profile,
        "kept_count": len(kept),
        "rejected_count": len(rejected),
        "kept": kept,
        "rejected": rejected,
    }
    report_path = profile_root / "metadata" / "mandarin_filter_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    log.info(
        "[%s] 普通话过滤：保留 %d，剔除 %d → %s",
        profile,
        len(kept),
        len(rejected),
        report_path,
    )
    return report
