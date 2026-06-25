"""Stage and state constants shared by the sidecar API."""

from __future__ import annotations

from typing import Dict, List

STAGES: List[Dict[str, str]] = [
    {
        "key": "intake_agent",
        "label": "收录",
        "agent_name": "Intake Agent",
        "public_phase": "收录",
    },
    {
        "key": "subtitle_source_agent",
        "label": "字幕来源",
        "agent_name": "Subtitle Source Agent",
        "public_phase": "字幕/转写",
    },
    {
        "key": "audio_prep_agent",
        "label": "音频预处理",
        "agent_name": "Audio Prep Agent",
        "public_phase": "字幕/转写",
    },
    {
        "key": "transcription_agent",
        "label": "转写",
        "agent_name": "Transcription Agent",
        "public_phase": "字幕/转写",
    },
    {
        "key": "llm_proofread_agent",
        "label": "校对",
        "agent_name": "LLM Proofread Agent",
        "public_phase": "校对",
    },
    {
        "key": "segmentation_agent",
        "label": "切分",
        "agent_name": "Segmentation Agent",
        "public_phase": "切分",
    },
    {
        "key": "mandarin_filter_agent",
        "label": "普通话过滤",
        "agent_name": "Mandarin Filter Agent",
        "public_phase": "质检",
    },
    {
        "key": "metadata_writer_agent",
        "label": "入库",
        "agent_name": "Metadata Writer Agent",
        "public_phase": "入库",
    },
]

STAGE_BY_KEY = {stage["key"]: stage for stage in STAGES}
STAGE_ORDER = [stage["key"] for stage in STAGES]

LEGACY_STAGE_BY_KEY = {
    "quality_filter_agent": {
        "key": "quality_filter_agent",
        "label": "质量过滤",
        "agent_name": "Quality Filter Agent",
        "public_phase": "质检",
    }
}


def get_stage_meta(stage_key: str) -> Dict[str, str]:
    key = str(stage_key or "").strip()
    if key in STAGE_BY_KEY:
        return STAGE_BY_KEY[key]
    if key in LEGACY_STAGE_BY_KEY:
        return LEGACY_STAGE_BY_KEY[key]
    fallback_label = key.replace("_", " ").strip() or "未知阶段"
    return {
        "key": key,
        "label": fallback_label,
        "agent_name": fallback_label,
        "public_phase": "",
    }

JOB_STATES = {
    "queued",
    "running",
    "blocked_for_review",
    "failed",
    "ready",
}

STAGE_STATES = {
    "pending",
    "running",
    "completed",
    "failed",
    "blocked",
    "skipped",
}
