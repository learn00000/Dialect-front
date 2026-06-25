#!/usr/bin/env python3
"""
方言新闻视频 -> TTS 训练数据一站式批处理。

流程：OCR/软字幕 → LLM 校对 → 按字幕切片 → 听感质检 → 普通话 ASR 过滤

输出布局（按地区、按视频编号）：
  output/taizhou/video/001/*.wav
  output/taizhou/word/001/*.txt
"""

from __future__ import annotations

import argparse
import logging
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from src.audio_export import extract_wav_segment
from src.cutter import cut_video_segment
from src.layout import ClipPaths, VideoOutputDirs, video_slot
from src.metadata_writer import (
    MetadataRow,
    write_metadata_csv,
    write_metadata_jsonl,
    write_metadata_txt,
)
from src.ocr_subtitle import try_generate_srt_via_ocr
from src.pipeline_filters import run_mandarin_filter, run_quality_filter
from src.srt_parser import (
    ClipPlan,
    SubtitleSegment,
    merge_adjacent_by_gap,
    merge_consecutive_fuzzy_similar,
    parse_srt_file,
    plan_clips_from_segments,
)
from src.subtitle_extract import extract_subtitle_srt
from src.subtitle_probe import pick_text_subtitle_stream_index
from src.utils import (
    clamp_segment,
    ensure_ffmpeg_available,
    is_single_char_subtitle_noise,
    get_video_duration_sec,
    is_punctuation_or_noise_text,
    normalize_text,
    safe_stem,
    setup_file_logger,
)

VIDEO_EXTS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".flv"}


@dataclass
class RegionJob:
    profile: str
    input_dirs: List[Path]
    output_root: Path


def _deep_merge_dict(base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    for key, val in overlay.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(val, dict)
        ):
            _deep_merge_dict(base[key], val)
        else:
            base[key] = val
    return base


def load_config(path: Path, profile: Optional[str] = None) -> Dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    assert isinstance(data, dict)
    prof_name = profile if profile and profile not in ("all", "") else None
    if not prof_name:
        prof_name = data.get("active_profile")
    profiles = data.get("profiles") or {}
    if prof_name and isinstance(profiles, dict) and prof_name in profiles:
        overlay = profiles[prof_name]
        if isinstance(overlay, dict):
            _deep_merge_dict(data, overlay)
            data["active_profile"] = prof_name
    return data


def collect_videos(input_dirs: List[Path], recursive: bool) -> List[Path]:
    out: List[Path] = []
    for d in input_dirs:
        if not d.exists():
            continue
        if d.is_file() and d.suffix.lower() in VIDEO_EXTS:
            out.append(d.resolve())
            continue
        if not d.is_dir():
            continue
        pattern = "**/*" if recursive else "*"
        for p in sorted(d.glob(pattern)):
            if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
                out.append(p.resolve())
    seen: set[Path] = set()
    uniq: List[Path] = []
    for p in out:
        if p in seen:
            continue
        seen.add(p)
        uniq.append(p)
    return uniq


def resolve_regions(
    cfg: Dict[str, Any],
    *,
    profile_arg: Optional[str],
    output_override: Optional[Path],
) -> List[RegionJob]:
    pipeline = dict(cfg.get("pipeline") or {})
    base = Path(output_override or pipeline.get("output_base") or "output")
    recursive = bool(pipeline.get("recursive", True))
    regions_cfg = dict(pipeline.get("regions") or {})

    if not regions_cfg:
        regions_cfg = {
            "taizhou": {"inputs": ["taizhou-news"]},
            "wenzhou": {"inputs": ["wenzhou-news"]},
        }

    want = profile_arg or "all"
    jobs: List[RegionJob] = []
    for name, rcfg in regions_cfg.items():
        if want != "all" and name != want:
            continue
        if isinstance(rcfg, str):
            rcfg = {"inputs": [rcfg]}
        rcfg = dict(rcfg or {})
        prof = str(rcfg.get("profile") or name)
        inputs = [Path(str(x)) for x in (rcfg.get("inputs") or [])]
        if not inputs:
            continue
        out_name = str(rcfg.get("output_dir") or prof)
        jobs.append(
            RegionJob(
                profile=prof,
                input_dirs=inputs,
                output_root=(base / out_name).resolve(),
            )
        )
    return jobs


def filter_segment(
    seg: SubtitleSegment,
    duration: float,
    pre_roll: float,
    post_roll: float,
    min_d: float,
    max_d: float,
    clip_end_trim: float,
    drop_punct_only: bool,
    collapse_ws: bool,
    strip_nl: bool,
    *,
    subtitle_mode: bool,
) -> Optional[Tuple[float, float, str]]:
    text = normalize_text(
        seg.text, collapse_whitespace=collapse_ws, strip_newlines=strip_nl
    )
    if not text:
        return None
    if drop_punct_only and is_punctuation_or_noise_text(text):
        return None

    subtitle_dur = seg.end - seg.start
    if subtitle_dur < min_d:
        return None
    if max_d > 0 and subtitle_dur > max_d:
        return None

    start, end = clamp_segment(seg.start, seg.end, duration, pre_roll, post_roll)
    if clip_end_trim > 0:
        end = max(start + 0.05, end - clip_end_trim)

    clip_len = end - start
    if clip_len < min_d:
        return None
    if not subtitle_mode and max_d > 0 and clip_len > max_d:
        return None
    return start, end, text


def normalize_subtitle_segments(
    segments: List[SubtitleSegment],
    *,
    collapse_ws: bool,
    strip_nl: bool,
    drop_punct_only: bool,
    drop_single_char: bool = False,
    single_char_allowlist: Optional[List[str]] = None,
) -> List[SubtitleSegment]:
    out: List[SubtitleSegment] = []
    for seg in segments:
        text = normalize_text(
            seg.text, collapse_whitespace=collapse_ws, strip_newlines=strip_nl
        )
        if not text:
            continue
        if drop_punct_only and is_punctuation_or_noise_text(text):
            continue
        if drop_single_char and is_single_char_subtitle_noise(
            text, allowlist=single_char_allowlist
        ):
            continue
        out.append(SubtitleSegment(start=seg.start, end=seg.end, text=text))
    return out


def build_clip_plans(
    segments: List[SubtitleSegment],
    duration: float,
    cfg: Dict[str, Any],
    *,
    pre_roll: float,
    post_roll: float,
    clip_end_trim: float,
    min_d: float,
    max_d: float,
    collapse_ws: bool,
    strip_nl: bool,
    drop_punct_only: bool,
    subtitle_mode: bool,
    logger: logging.Logger,
) -> List[ClipPlan]:
    drop_single_char = bool(cfg.get("drop_single_char_subtitles", True))
    single_char_allowlist = list(cfg.get("single_char_allowlist") or [])
    norm = normalize_subtitle_segments(
        segments,
        collapse_ws=collapse_ws,
        strip_nl=strip_nl,
        drop_punct_only=drop_punct_only,
        drop_single_char=drop_single_char,
        single_char_allowlist=single_char_allowlist,
    )
    short_cfg = dict(cfg.get("short_clip_merge") or {})
    if bool(short_cfg.get("enabled", False)):
        min_clip = float(short_cfg.get("min_duration_sec", min_d))
        max_span = float(short_cfg.get("max_merge_span_sec", 10.0))
        neighbors = int(short_cfg.get("max_neighbors_each_side", 2))
        llm_cfg = dict(cfg.get("llm_proofread") or {})
        boundary_cfg = dict(cfg.get("clip_boundary") or {})
        plans = plan_clips_from_segments(
            norm,
            duration,
            pre_roll=pre_roll,
            post_roll=post_roll,
            clip_end_trim=clip_end_trim,
            min_clip_sec=min_clip,
            max_merge_span_sec=max_span,
            max_neighbors_each_side=neighbors,
            max_clip_sec=max_d if max_d > 0 else 0.0,
            boundary_cfg=boundary_cfg,
            llm_cfg=llm_cfg if llm_cfg.get("enabled") else None,
            logger=logger,
        )
        logger.info(
            "短片段合并切片: %d 条字幕 -> %d 个 clip（<%gs 合并，跨度≤%.1fs）",
            len(norm),
            len(plans),
            min_clip,
            max_span,
        )
        return plans

    plans: List[ClipPlan] = []
    for seg in norm:
        filtered = filter_segment(
            seg,
            duration,
            pre_roll,
            post_roll,
            min_d,
            max_d,
            clip_end_trim,
            drop_punct_only,
            collapse_ws,
            strip_nl,
            subtitle_mode=subtitle_mode,
        )
        if filtered:
            start, end, text = filtered
            plans.append(ClipPlan(start=start, end=end, text=text))
    return plans


def process_one_video(
    *,
    video_path: Path,
    output_root: Path,
    profile: str,
    slot: str,
    cfg: Dict[str, Any],
    ffmpeg: str,
    ffprobe: str,
    force_ocr: bool,
    no_ocr: bool,
    reuse_srt: bool,
    video_only: bool,
    audio_only: bool,
    logger: logging.Logger,
) -> Tuple[List[MetadataRow], bool]:
    pre_roll = float(cfg.get("pre_roll", 0.08))
    post_roll = float(cfg.get("post_roll", 0.08))
    clip_end_trim = float(cfg.get("clip_end_trim_sec", 0.0))
    min_d = float(cfg.get("min_duration_sec", 0.35))
    max_d = float(cfg.get("max_duration_sec", 0.0))
    collapse_ws = bool(cfg.get("collapse_whitespace", True))
    strip_nl = bool(cfg.get("strip_newlines", True))
    drop_punct_only = bool(cfg.get("drop_punctuation_only", True))

    split_mode = str(cfg.get("segment_split_mode", "subtitle")).lower()
    subtitle_mode = split_mode == "subtitle"

    vcfg = dict(cfg.get("video") or {})
    acfg = dict(cfg.get("audio") or {})
    ocr_cfg = dict(cfg.get("ocr") or {})

    video_codec = str(vcfg.get("video_codec", "libx264"))
    audio_codec = str(vcfg.get("audio_codec", "aac"))
    crf = int(vcfg.get("crf", 23))
    preset = str(vcfg.get("preset", "veryfast"))

    sample_rate = int(acfg.get("sample_rate", 22050))
    channels = int(acfg.get("channels", 1))
    wav_codec = str(acfg.get("codec", "pcm_s16le"))

    vdirs = VideoOutputDirs.create(output_root, slot, safe_stem(video_path))
    work_srt = vdirs.work_srt

    duration = get_video_duration_sec(ffprobe, video_path)
    logger.info(
        "[视频 %s] 时长 %.3fs %s", slot, duration, video_path.name
    )

    srt_ok = False
    if (
        reuse_srt
        and not force_ocr
        and work_srt.is_file()
        and work_srt.stat().st_size > 50
        and "-->" in work_srt.read_text(encoding="utf-8", errors="replace")[:2000]
    ):
        srt_ok = True
        logger.info("复用已有字幕: %s", work_srt)

    if not srt_ok and not force_ocr:
        try:
            idx = pick_text_subtitle_stream_index(ffprobe, video_path)
            if idx is not None:
                srt_ok = extract_subtitle_srt(ffmpeg, video_path, work_srt, idx)
                if srt_ok:
                    logger.info("已提取软字幕 -> %s", work_srt)
        except Exception as e:
            logger.exception("软字幕异常: %s", e)

    if not srt_ok and not no_ocr and bool(ocr_cfg.get("enabled", True)):
        logger.info("OCR 硬字幕…")
        try:
            srt_ok = try_generate_srt_via_ocr(
                ffprobe, video_path, work_srt, ocr_cfg, logger=logger
            )
        except Exception as e:
            logger.exception("OCR 失败: %s", e)

    if not srt_ok or not work_srt.exists():
        logger.error("无可用字幕，跳过")
        return [], False

    llm_cfg = dict(cfg.get("llm_proofread") or {})
    if llm_cfg.get("enabled"):
        try:
            from src.llm_proofread import proofread_srt_file

            proofread_srt_file(
                work_srt,
                llm_cfg,
                logger=logger,
                force=bool(llm_cfg.get("force", False)),
            )
        except Exception as e:
            if bool(llm_cfg.get("fail_open", True)):
                logger.warning("LLM 校对失败（继续）: %s", e)
            else:
                return [], False

    segments = parse_srt_file(work_srt)
    logger.info("解析 %d 条字幕", len(segments))

    fuzzy_cfg = dict(cfg.get("subtitle_fuzzy_merge") or {})
    llm_for_merge = dict(cfg.get("llm_proofread") or {})
    if fuzzy_cfg.get("enabled"):
        segments = merge_consecutive_fuzzy_similar(
            segments,
            float(fuzzy_cfg.get("max_gap_sec", 0.42)),
            float(fuzzy_cfg.get("similarity_threshold", 0.82)),
            llm_cfg=llm_for_merge if llm_for_merge.get("enabled") else None,
            logger=logger,
        )

    merge_gap = float(cfg.get("merge_adjacent_gap_sec", 0.0))
    merge_span = float(cfg.get("merge_max_span_sec", 14.0))
    if merge_gap > 0:
        segments = merge_adjacent_by_gap(segments, merge_gap, merge_span)

    clip_plans = build_clip_plans(
        segments,
        duration,
        cfg,
        pre_roll=pre_roll,
        post_roll=post_roll,
        clip_end_trim=clip_end_trim,
        min_d=min_d,
        max_d=max_d,
        collapse_ws=collapse_ws,
        strip_nl=strip_nl,
        drop_punct_only=drop_punct_only,
        subtitle_mode=subtitle_mode,
        logger=logger,
    )

    rows: List[MetadataRow] = []
    ok_any = False
    total = len(clip_plans)

    for clip_i, plan in enumerate(clip_plans, 1):
        start, end, text = plan.start, plan.end, plan.text
        paths = ClipPaths.for_clip(vdirs, profile, clip_i)

        print(
            f"  [{profile} 视频{slot} {clip_i}/{total}] "
            f"{paths.wav.name}  {start:.2f}-{end:.2f}s",
            flush=True,
        )

        if not audio_only:
            mp4_path = vdirs.profile_root / "video_clips" / slot / f"{paths.wav.stem}.mp4"
            mp4_path.parent.mkdir(parents=True, exist_ok=True)
            if not cut_video_segment(
                ffmpeg,
                video_path,
                mp4_path,
                start,
                end,
                video_codec=video_codec,
                audio_codec=audio_codec,
                crf=crf,
                preset=preset,
            ):
                continue

        if not video_only:
            if not extract_wav_segment(
                ffmpeg,
                video_path,
                paths.wav,
                start,
                end,
                sample_rate=sample_rate,
                channels=channels,
                codec=wav_codec,
            ):
                continue

        paths.txt.write_text(text + "\n", encoding="utf-8")
        rel_wav = str(paths.wav.relative_to(output_root))
        rel_txt = str(paths.txt.relative_to(output_root))
        rows.append(
            MetadataRow(
                id=paths.clip_id,
                wav_basename=paths.wav.name,
                text=text,
                start_sec=start,
                end_sec=end,
                source_video=str(video_path),
                profile=profile,
                video_slot=slot,
                wav_path=rel_wav,
                txt_path=rel_txt,
            )
        )
        ok_any = True

    manifest = output_root / "video" / slot / "manifest.json"
    manifest.write_text(
        __import__("json").dumps(
            {
                "profile": profile,
                "video_slot": slot,
                "source_video": str(video_path),
                "clip_count": len(rows),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return rows, ok_any


def run_slice_phase(
    job: RegionJob,
    cfg_path: Path,
    *,
    ffmpeg: str,
    ffprobe: str,
    recursive: bool,
    force_ocr: bool,
    no_ocr: bool,
    reuse_srt: bool,
    video_only: bool,
    audio_only: bool,
) -> Tuple[List[MetadataRow], List[str]]:
    prof_cfg = load_config(cfg_path, profile=job.profile)
    videos = collect_videos(job.input_dirs, recursive)
    if not videos:
        return [], []

    all_rows: List[MetadataRow] = []
    failed: List[str] = []
    index_map: Dict[str, str] = {}

    for vi, vp in enumerate(videos, 1):
        slot = video_slot(vi)
        index_map[slot] = str(vp)
        logger = setup_file_logger(
            VideoOutputDirs.create(job.output_root, slot, safe_stem(vp)).log_path
        )
        logger.info("==== %s 视频 %s ====", job.profile, slot)
        try:
            rows, ok = process_one_video(
                video_path=vp,
                output_root=job.output_root,
                profile=job.profile,
                slot=slot,
                cfg=prof_cfg,
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                force_ocr=force_ocr,
                no_ocr=no_ocr,
                reuse_srt=reuse_srt,
                video_only=video_only,
                audio_only=audio_only,
                logger=logger,
            )
            all_rows.extend(rows)
            if not ok:
                failed.append(str(vp))
        except Exception as e:
            logger.exception("跳过: %s", e)
            failed.append(str(vp))

    index_path = job.output_root / "video_index.json"
    index_path.write_text(
        __import__("json").dumps(index_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    meta_dir = job.output_root / "metadata"
    meta_dir.mkdir(parents=True, exist_ok=True)
    write_metadata_txt(meta_dir / "metadata.txt", all_rows)
    write_metadata_csv(meta_dir / "metadata.csv", all_rows)
    write_metadata_jsonl(meta_dir / "metadata.jsonl", all_rows)
    (meta_dir / "failed_videos.txt").write_text(
        "\n".join(failed) + ("\n" if failed else ""),
        encoding="utf-8",
    )
    return all_rows, failed


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="方言新闻一站式：OCR → LLM → 切片 → 听感质检 → 剔普通话",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
子命令:
  all              完整流水线（默认）
  slice            仅 OCR/LLM/切片
  filter           仅听感 + 普通话过滤
  filter-quality   仅听感质检
  filter-mandarin  仅普通话 ASR 过滤

示例:
  python main.py all --profile all
  python main.py slice --profile wenzhou --reuse-srt --audio-only
  python main.py filter --profile taizhou --dry-run
""",
    )
    p.add_argument(
        "command",
        nargs="?",
        default="all",
        choices=["all", "slice", "filter", "filter-quality", "filter-mandarin"],
    )
    p.add_argument("--config", type=Path, default=Path("config.yaml"))
    p.add_argument(
        "--profile",
        type=str,
        default="all",
        help="taizhou / wenzhou / all（默认 all=两个地区都跑）",
    )
    p.add_argument("--output", type=Path, default=None, help="覆盖 pipeline.output_base")
    p.add_argument("--input", type=Path, action="append", dest="inputs")
    p.add_argument("--recursive", action="store_true")
    p.add_argument("--no-recursive", action="store_true")
    p.add_argument("--ocr", action="store_true")
    p.add_argument("--no-ocr", action="store_true")
    p.add_argument("--video-only", action="store_true")
    p.add_argument("--audio-only", action="store_true", help="推荐：只出 wav")
    p.add_argument("--reuse-srt", action="store_true")
    p.add_argument("--llm-proofread", action="store_true")
    p.add_argument("--no-llm-proofread", action="store_true")
    p.add_argument("--llm-force", action="store_true")
    p.add_argument("--dry-run", action="store_true", help="过滤阶段只出报告不移动文件")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def main() -> int:
    warnings.filterwarnings("ignore", message=".*pin_memory.*", category=UserWarning)
    args = build_arg_parser().parse_args()

    from src.api_keys import resolve_dashscope_api_key

    resolve_dashscope_api_key()

    if args.video_only and args.audio_only:
        print("错误：--video-only 与 --audio-only 不能同时使用", file=sys.stderr)
        return 2

    base_cfg = yaml.safe_load(args.config.read_text(encoding="utf-8")) or {}
    pipeline = dict(base_cfg.get("pipeline") or {})
    recursive = bool(pipeline.get("recursive", True))
    if args.recursive:
        recursive = True
    if args.no_recursive:
        recursive = False

    jobs = resolve_regions(
        base_cfg,
        profile_arg=args.profile,
        output_override=args.output,
    )
    if args.inputs:
        if len(jobs) != 1 and args.profile == "all":
            print("指定 --input 时请同时指定 --profile taizhou 或 wenzhou", file=sys.stderr)
            return 2
        if not jobs:
            jobs = [
                RegionJob(
                    profile=args.profile if args.profile != "all" else "taizhou",
                    input_dirs=[Path(x) for x in args.inputs],
                    output_root=(Path(args.output or "output") / (args.profile or "taizhou")).resolve(),
                )
            ]
        else:
            jobs[0] = RegionJob(
                profile=jobs[0].profile,
                input_dirs=[Path(x) for x in args.inputs],
                output_root=jobs[0].output_root,
            )

    if not jobs:
        print("错误：未配置 pipeline.regions", file=sys.stderr)
        return 2

    cmd = args.command
    do_slice = cmd in ("all", "slice")
    do_quality = cmd in ("all", "filter", "filter-quality")
    do_mandarin = cmd in ("all", "filter", "filter-mandarin")

    if do_slice:
        try:
            ffmpeg, ffprobe = ensure_ffmpeg_available()
        except RuntimeError as e:
            print(str(e), file=sys.stderr)
            return 2
    else:
        ffmpeg, ffprobe = "", ""

    log = logging.getLogger("main")
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )

    total_clips = 0
    any_fail = False

    for job in jobs:
        print(f"\n========== {job.profile} → {job.output_root} ==========")
        prof_cfg = load_config(args.config, profile=job.profile)

        llm_base = dict(prof_cfg.get("llm_proofread") or {})
        if args.no_llm_proofread:
            llm_base["enabled"] = False
        elif args.llm_proofread or cmd == "all":
            llm_base["enabled"] = True
        if args.llm_force:
            llm_base["force"] = True
        prof_cfg["llm_proofread"] = llm_base

        if do_slice:
            llm_on = bool(prof_cfg.get("llm_proofread", {}).get("enabled"))
            if llm_on and not __import__("os").environ.get("DASHSCOPE_API_KEY", "").strip():
                print(
                    "错误: LLM 校对需要环境变量 DASHSCOPE_API_KEY",
                    file=sys.stderr,
                )
                return 2
            rows, failed = run_slice_phase(
                job,
                args.config,
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                recursive=recursive,
                force_ocr=bool(args.ocr),
                no_ocr=bool(args.no_ocr),
                reuse_srt=bool(args.reuse_srt),
                video_only=bool(args.video_only),
                audio_only=bool(args.audio_only or cmd == "all"),
            )
            total_clips += len(rows)
            if failed:
                any_fail = True
            print(
                f"[{job.profile}] 切片完成：{len(rows)} 条，"
                f"失败视频 {len(failed)}"
            )

        if do_quality:
            pipe_cfg = dict(base_cfg.get("pipeline") or {})
            skip_q = bool(pipe_cfg.get("skip_quality_filter", False))
            if not skip_q:
                run_quality_filter(
                    job.output_root,
                    prof_cfg,
                    job.profile,
                    dry_run=bool(args.dry_run),
                    log=log,
                )

        if do_mandarin:
            mcfg = dict(prof_cfg.get("mandarin_filter") or {})
            if mcfg.get("enabled", True):
                import os

                if str(mcfg.get("asr_backend", "local")).lower() == "local":
                    model = Path(
                        str(
                            mcfg.get(
                                "local_asr_model_dir",
                                "models/sherpa-onnx-paraformer-zh-2023-09-14",
                            )
                        )
                    )
                    if not (model / "model.int8.onnx").is_file():
                        print(
                            f"错误: 本地 ASR 未安装，请 bash scripts/setup_local_asr.sh",
                            file=sys.stderr,
                        )
                        return 2
                if llm_base.get("enabled") and not os.environ.get(
                    str(mcfg.get("api_key_env") or "DASHSCOPE_API_KEY"), ""
                ):
                    if cmd == "all" or args.llm_proofread:
                        pass  # slice needs key; filter mandarin local doesn't
                run_mandarin_filter(
                    job.output_root,
                    prof_cfg,
                    job.profile,
                    dry_run=bool(args.dry_run),
                    verbose=bool(args.verbose),
                    log=log,
                )

    print(
        f"\n全部完成：共 {total_clips} 条切片，"
        f"输出见 output/<地区>/video|word/<编号>/"
    )
    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
