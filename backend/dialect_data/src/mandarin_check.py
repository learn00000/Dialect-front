"""检测切片是否为普通话口播，以及音频与字幕是否对得上。"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .srt_parser import SubtitleSegment, parse_srt_file
from .text_dedupe import normalize_for_compare, text_similarity

_ASR_MODEL = "paraformer-realtime-8k-v2"


from .api_keys import resolve_dashscope_api_key


def _resolve_api_key(cfg: Dict[str, Any]) -> str:
    return resolve_dashscope_api_key(cfg)


def _asr_sample_rate(cfg: Dict[str, Any]) -> int:
    model = str(cfg.get("asr_model") or _ASR_MODEL).lower()
    if cfg.get("asr_sample_rate") is not None:
        return int(cfg["asr_sample_rate"])
    if "8k" in model:
        return 8000
    return 16000


def _ensure_mono_wav(src: Path, sample_rate: int) -> Path:
    """转为指定采样率单声道 wav（与百炼 Paraformer 模型一致）。"""
    tmp = Path(tempfile.mkstemp(suffix=f".{sample_rate}.wav")[1])
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        str(tmp),
    ]
    subprocess.run(cmd, check=True, timeout=120)
    return tmp


def transcribe_wav(wav_path: Path, cfg: Dict[str, Any]) -> str:
    """按配置选择本地免费 ASR 或百炼云端 ASR。"""
    backend = str(cfg.get("asr_backend", "local")).lower()
    if backend == "off":
        return ""
    if backend == "local":
        from .local_asr import local_asr_available, transcribe_local

        if not local_asr_available(cfg):
            raise RuntimeError(
                "本地 ASR 模型未安装。请运行: bash scripts/setup_local_asr.sh"
            )
        return transcribe_local(wav_path, cfg)
    if backend == "dashscope":
        return transcribe_wav_dashscope(wav_path, cfg)
    raise ValueError(f"未知 asr_backend: {backend}")


def transcribe_wav_dashscope(wav_path: Path, cfg: Dict[str, Any]) -> str:
    """用百炼 Paraformer 识别本地 wav，返回文本。"""
    api_key = _resolve_api_key(cfg)
    os.environ["DASHSCOPE_API_KEY"] = api_key

    from dashscope.audio.asr import Recognition

    tmp: Optional[Path] = None
    try:
        sample_rate = _asr_sample_rate(cfg)
        tmp = _ensure_mono_wav(wav_path, sample_rate)
        recognition = Recognition(
            model=str(cfg.get("asr_model") or _ASR_MODEL),
            format="wav",
            sample_rate=sample_rate,
            callback=None,
        )
        result = recognition.call(str(tmp))
        parts: List[str] = []
        sentence = result.get_sentence()
        if isinstance(sentence, dict):
            sentence = [sentence]
        if isinstance(sentence, list):
            for s in sentence:
                if isinstance(s, dict) and s.get("text"):
                    parts.append(str(s["text"]))
        text = "".join(parts).strip()
        if not text and result.output:
            out = result.output
            if isinstance(out, dict) and out.get("text"):
                text = str(out["text"]).strip()
        return text
    finally:
        if tmp and tmp.is_file():
            try:
                tmp.unlink()
            except OSError:
                pass


def _chat_json(api_key: str, cfg: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    base_url = str(
        cfg.get("base_url") or "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    model = str(cfg.get("model") or "deepseek-v4-flash")
    url = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "你只输出合法 JSON。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": float(cfg.get("temperature", 0.1)),
        "max_tokens": int(cfg.get("max_tokens", 512)),
        "response_format": {"type": "json_object"},
        "enable_thinking": bool(cfg.get("enable_thinking", False)),
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=float(cfg.get("timeout_sec", 90))) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    content = (payload.get("choices") or [{}])[0].get("message", {}).get("content", "")
    return json.loads(content.strip())


def llm_classify_mandarin(
    text: str,
    cfg: Dict[str, Any],
    *,
    label: str = "字幕",
) -> Dict[str, Any]:
    """判断文本是否为标准普通话专题/政策播报（非方言主持）。"""
    api_key = _resolve_api_key(cfg)
    dialect = str(cfg.get("dialect_hint") or "台州方言新闻《阿福讲白搭》")
    prompt = f"""你是方言新闻数据质检员。节目：{dialect}

判断以下「{label}」文本是否属于应剔除的 **标准普通话** 内容（政策宣读、民生实事清单、普通新闻播报腔），而非方言主持/方言口语。

应剔除（is_mandarin=true）示例：
- 「接下来我们将加大…投入」「增加仙居普通高中优质学位…」等政策稿
- 标准新闻联播腔、无方言口语特征的书面稿

应保留（is_mandarin=false）示例：
- 「昨天阿福白搭讲过」「谢女士…」「大家好我是小应…看新闻讲天讲地」等方言主持、口语叙事

仅返回 JSON：
{{"is_mandarin": true/false, "confidence": 0.0-1.0, "reason": "一句话"}}

文本：
{text.strip()[:800]}"""
    try:
        return _chat_json(api_key, cfg, prompt)
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        return {
            "is_mandarin": False,
            "confidence": 0.0,
            "reason": f"llm_error:{e}",
        }


def segments_overlapping_clip(
    segments: List[SubtitleSegment],
    clip_start: float,
    clip_end: float,
    *,
    min_overlap_ratio: float = 0.25,
) -> List[SubtitleSegment]:
    """取与切片时间窗重叠的 SRT 条（用于一句一句检测）。"""
    out: List[SubtitleSegment] = []
    clip_len = max(0.05, clip_end - clip_start)
    for seg in segments:
        o0 = max(seg.start, clip_start)
        o1 = min(seg.end, clip_end)
        if o1 <= o0:
            continue
        overlap = o1 - o0
        seg_len = max(0.05, seg.end - seg.start)
        if overlap / seg_len >= min_overlap_ratio or overlap / clip_len >= 0.12:
            out.append(seg)
    return sorted(out, key=lambda s: s.start)


def _extract_wav_slice(
    wav_path: Path,
    offset_sec: float,
    duration_sec: float,
) -> Path:
    """从已切片的 wav 里再切一小段（相对时间）。"""
    tmp = Path(tempfile.mkstemp(suffix=".seg.wav")[1])
    duration_sec = max(0.05, duration_sec)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{max(0.0, offset_sec):.3f}",
            "-t",
            f"{duration_sec:.3f}",
            "-i",
            str(wav_path),
            "-ac",
            "1",
            str(tmp),
        ],
        check=True,
        timeout=60,
    )
    return tmp


def _evaluate_segment_matches(
    wav_path: Path,
    clip_start: float,
    clip_end: float,
    sub_segments: List[SubtitleSegment],
    cfg: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], float]:
    """逐条 SRT 在切片内做 ASR↔字幕比对。返回 (明细, 高匹配占比)。"""
    high_thr = float(cfg.get("segment_high_match", 0.68))
    min_seg_dur = float(cfg.get("segment_min_duration_sec", 0.35))
    details: List[Dict[str, Any]] = []
    high_weight = 0.0
    total_weight = 0.0

    for seg in sub_segments:
        rel0 = max(0.0, seg.start - clip_start)
        rel1 = min(clip_end - clip_start, seg.end - clip_start)
        dur = rel1 - rel0
        if dur < min_seg_dur:
            continue
        tmp: Optional[Path] = None
        try:
            tmp = _extract_wav_slice(wav_path, rel0, dur)
            asr_t = transcribe_wav(tmp, cfg)
            score = match_score(seg.text, asr_t)
        except Exception as e:
            score = 0.0
            asr_t = ""
            details.append(
                {
                    "ocr": seg.text,
                    "asr": asr_t,
                    "match": 0.0,
                    "error": str(e),
                    "start": seg.start,
                    "end": seg.end,
                }
            )
            continue
        finally:
            if tmp and tmp.is_file():
                try:
                    tmp.unlink()
                except OSError:
                    pass

        details.append(
            {
                "ocr": seg.text,
                "asr": asr_t,
                "match": round(score, 4),
                "start": seg.start,
                "end": seg.end,
            }
        )
        total_weight += dur
        if score >= high_thr:
            high_weight += dur

    ratio = (high_weight / total_weight) if total_weight > 0 else 0.0
    return details, ratio


def match_score(ocr_text: str, asr_text: str) -> float:
    """音频转写与字幕相似度（越高越说明对得上）。"""
    if not ocr_text.strip() or not asr_text.strip():
        return 0.0
    return text_similarity(ocr_text, asr_text)


def evaluate_clip(
    wav_path: Path,
    subtitle_text: str,
    cfg: Dict[str, Any],
    *,
    run_asr: bool = True,
    clip_start: Optional[float] = None,
    clip_end: Optional[float] = None,
    all_srt_segments: Optional[List[SubtitleSegment]] = None,
) -> Dict[str, Any]:
    """
  返回质检结果 dict：
  - reject: 是否建议剔除
  - reasons: 原因列表
  - ocr_text, asr_text, match_score
  - llm_subtitle, llm_asr
    """
    reasons: List[str] = []
    min_match = float(cfg.get("min_match_score", 0.68))
    min_conf = float(cfg.get("min_mandarin_confidence", 0.72))
    text_only_reject = bool(cfg.get("reject_text_mandarin_only", False))

    use_llm = bool(cfg.get("llm_enabled", False))
    match_only = bool(cfg.get("match_only_mode", True))

    if use_llm or text_only_reject:
        llm_sub = llm_classify_mandarin(subtitle_text, cfg, label="字幕")
    else:
        llm_sub = {"is_mandarin": False, "confidence": 0.0, "reason": "llm_skipped"}
    sub_mandarin = bool(llm_sub.get("is_mandarin"))
    sub_conf = float(llm_sub.get("confidence") or 0.0)

    asr_text = ""
    m_score = 0.0
    llm_asr: Dict[str, Any] = {}
    asr_mandarin = False
    asr_conf = 0.0

    if run_asr and bool(cfg.get("asr_enabled", True)):
        try:
            asr_text = transcribe_wav(wav_path, cfg)
            m_score = match_score(subtitle_text, asr_text)
            if asr_text.strip() and use_llm and not match_only:
                llm_asr = llm_classify_mandarin(asr_text, cfg, label="音频转写")
                asr_mandarin = bool(llm_asr.get("is_mandarin"))
                asr_conf = float(llm_asr.get("confidence") or 0.0)
        except Exception as e:
            reasons.append(f"asr_failed:{e}")

    reject = False
    high_match = float(cfg.get("high_match_reject", 0.72))
    low_match_keep = float(cfg.get("low_match_keep", 0.42))
    segment_check = bool(cfg.get("segment_check_enabled", True))
    min_seg_count = int(cfg.get("segment_check_min_lines", 2))
    seg_high_thr = float(cfg.get("segment_high_match", 0.68))
    use_ratio_reject = bool(cfg.get("use_segment_ratio_reject", False))
    reject_ratio = float(cfg.get("reject_high_match_ratio", 0.5))

    seg_details: List[Dict[str, Any]] = []
    high_match_ratio = 0.0

    # 按 SRT 逐句切开：任一句 ASR 与 OCR 相似度 >= 阈值 → 整段 clip 剔除
    if (
        segment_check
        and run_asr
        and bool(cfg.get("asr_enabled", True))
        and clip_start is not None
        and clip_end is not None
        and all_srt_segments
    ):
        sub_segs = segments_overlapping_clip(
            all_srt_segments, clip_start, clip_end
        )
        if len(sub_segs) >= min_seg_count:
            seg_details, high_match_ratio = _evaluate_segment_matches(
                wav_path, clip_start, clip_end, sub_segs, cfg
            )
            for d in seg_details:
                if float(d.get("match", 0)) >= seg_high_thr:
                    reject = True
                    reasons.append(
                        f"segment_high_match:{d.get('match')}:{d.get('ocr', '')[:20]}"
                    )
                    break
            if (
                not reject
                and use_ratio_reject
                and high_match_ratio >= reject_ratio
            ):
                reject = True
                reasons.append(
                    f"segment_high_match_ratio_{high_match_ratio:.2f}"
                )

    # 整段检测：单句 clip 或逐句未触发时，仍看整体 match
    if not reject and asr_text:
        if m_score >= high_match:
            reject = True
            reasons.append("asr_ocr_high_match_likely_mandarin")
        elif m_score <= low_match_keep and not seg_details:
            reasons.append("asr_ocr_low_match_keep_dialect")
        elif (
            use_llm
            and not match_only
            and m_score >= min_match
            and sub_conf >= min_conf
            and sub_mandarin
        ):
            reject = True
            reasons.append("mandarin_subtitle_llm")

    if text_only_reject and sub_mandarin and sub_conf >= 0.88:
        reject = True
        reasons.append("mandarin_subtitle_high_conf")

    return {
        "reject": reject,
        "reasons": reasons,
        "ocr_text": subtitle_text.strip(),
        "asr_text": asr_text.strip(),
        "match_score": round(m_score, 4),
        "llm_subtitle": llm_sub,
        "llm_asr": llm_asr,
        "segment_count": len(seg_details),
        "segment_high_match_ratio": round(high_match_ratio, 4),
        "segments": seg_details,
    }
