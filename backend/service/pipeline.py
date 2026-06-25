"""Dual-track pipeline wrapper around the copied dialect_data workflow."""

from __future__ import annotations

import base64
import json
import mimetypes
import shutil
import sqlite3
import subprocess
import sys
import threading
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests

from .config import (
    DATA_ROOT,
    DASHSCOPE_API_KEY,
    DASHSCOPE_ASR_ENABLED,
    DASHSCOPE_ASR_MODEL,
    DASHSCOPE_ASR_TIMEOUT_SEC,
    DASHSCOPE_ASR_URL,
    DEFAULT_PROFILE,
    DEFAULT_REVIEW_POLICY,
    DEFAULT_STORAGE_URL_PREFIX,
    DIALECT_DATA_ROOT,
    JOBS_ROOT,
    MAX_WORKERS,
    UPLOADS_ROOT,
)
from .constants import STAGE_BY_KEY, STAGES, get_stage_meta
from .db import get_connection, init_db, utcnow_iso


class PipelineService:
    """Creates jobs, executes them asynchronously, and serves query APIs."""

    def __init__(self) -> None:
        for path in (DATA_ROOT, JOBS_ROOT, UPLOADS_ROOT):
            path.mkdir(parents=True, exist_ok=True)
        init_db()
        self._executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
        self._lock = threading.Lock()

    def create_audio_contribution(
        self,
        *,
        filename: str,
        media_content_type: str,
        contribution_type: str,
        payload: bytes,
        area: str,
        dialect_self_report: str,
        content: str,
        nickname: str,
        consent_granted: bool,
    ) -> Dict[str, Any]:
        contribution_id = self._new_id("contrib")
        job_id = self._new_id("job")
        job_root = JOBS_ROOT / job_id
        input_dir = job_root / "inputs"
        output_root = job_root / "output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_root.mkdir(parents=True, exist_ok=True)

        suffix = Path(filename or "upload.wav").suffix or ".wav"
        input_path = input_dir / f"source{suffix}"
        input_path.write_bytes(payload)

        created_at = utcnow_iso()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO contributions (
                  id, job_id, source_type, area, dialect_self_report, content_type,
                  content, user_transcript, asr_transcript, transcript_source, nickname, consent_granted, status, pipeline_state,
                  dialect_label, transcript_snippet, quality_score, ready_segment_count,
                  audio_url, artifact_root, risk_flags, created_at, updated_at
                ) VALUES (?, ?, 'audio_upload', ?, ?, ?, ?, ?, '', '', ?, ?, 'queued', 'queued',
                  ?, ?, NULL, 0, '', ?, '[]', ?, ?)
                """,
                (
                    contribution_id,
                    job_id,
                    area,
                    dialect_self_report,
                    contribution_type,
                    content,
                    content,
                    nickname,
                    1 if consent_granted else 0,
                    dialect_self_report or area or "待识别方言",
                    (content or "").strip()[:140],
                    str(output_root),
                    created_at,
                    created_at,
                ),
            )
            conn.execute(
                """
                INSERT INTO pipeline_jobs (
                  id, contribution_id, source_type, status, profile, input_path,
                  artifact_root, review_mode, stage_cursor, error_message,
                  created_at, updated_at, completed_at
                ) VALUES (?, ?, 'audio_upload', 'queued', ?, ?, ?, ?, '', NULL, ?, ?, NULL)
                """,
                (
                    job_id,
                    contribution_id,
                    DEFAULT_PROFILE,
                    str(input_path),
                    str(output_root),
                    DEFAULT_REVIEW_POLICY,
                    created_at,
                    created_at,
                ),
            )
            self._seed_stage_runs(conn, job_id)
            self._insert_media_asset(
                conn,
                contribution_id=contribution_id,
                job_id=job_id,
                role="raw_upload",
                path=input_path,
                mime_type=media_content_type,
                metadata={"original_name": filename},
            )
        self._submit_job(job_id)
        return {
            "contributionId": contribution_id,
            "jobId": job_id,
            "sourceType": "audio_upload",
        }

    def create_video_import(
        self,
        *,
        profile: str,
        input_path: str,
        region: str,
        dialect_hint: str,
        uploaded_file: Optional[Tuple[str, str, bytes]] = None,
    ) -> Dict[str, Any]:
        contribution_id = self._new_id("corpus")
        job_id = self._new_id("job")
        job_root = JOBS_ROOT / job_id
        input_dir = job_root / "inputs"
        output_root = job_root / "output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_root.mkdir(parents=True, exist_ok=True)

        resolved_input = Path(input_path).expanduser() if input_path else None
        mime_type = ""
        original_name = ""
        if uploaded_file is not None:
            original_name, mime_type, payload = uploaded_file
            suffix = Path(original_name or "source.mp4").suffix or ".mp4"
            resolved_input = input_dir / f"source{suffix}"
            resolved_input.write_bytes(payload)

        if resolved_input is None:
            raise ValueError("需要提供 inputPath 或上传视频文件")
        if resolved_input.exists() and resolved_input.is_dir():
            raise ValueError("当前版本 /api/corpora/import-video 先接单个视频文件；目录批量导入待下一轮补齐")

        created_at = utcnow_iso()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO contributions (
                  id, job_id, source_type, area, dialect_self_report, content_type,
                  content, user_transcript, asr_transcript, transcript_source, nickname, consent_granted, status, pipeline_state,
                  dialect_label, transcript_snippet, quality_score, ready_segment_count,
                  audio_url, artifact_root, risk_flags, created_at, updated_at
                ) VALUES (?, ?, 'video_source', ?, ?, 'video', '', '', '', '', 'system', 1,
                  'queued', 'queued', ?, '', NULL, 0, '', ?, '[]', ?, ?)
                """,
                (
                    contribution_id,
                    job_id,
                    region,
                    dialect_hint,
                    dialect_hint or region or profile or "待识别方言",
                    str(output_root),
                    created_at,
                    created_at,
                ),
            )
            conn.execute(
                """
                INSERT INTO pipeline_jobs (
                  id, contribution_id, source_type, status, profile, input_path,
                  artifact_root, review_mode, stage_cursor, error_message,
                  created_at, updated_at, completed_at
                ) VALUES (?, ?, 'video_source', 'queued', ?, ?, ?, ?, '', NULL, ?, ?, NULL)
                """,
                (
                    job_id,
                    contribution_id,
                    profile or DEFAULT_PROFILE,
                    str(resolved_input),
                    str(output_root),
                    DEFAULT_REVIEW_POLICY,
                    created_at,
                    created_at,
                ),
            )
            self._seed_stage_runs(conn, job_id)
            self._insert_media_asset(
                conn,
                contribution_id=contribution_id,
                job_id=job_id,
                role="video_source",
                path=resolved_input,
                mime_type=mime_type or "video/mp4",
                metadata={"original_name": original_name or resolved_input.name},
            )
        self._submit_job(job_id)
        return {
            "corpusImportId": contribution_id,
            "contributionId": contribution_id,
            "jobId": job_id,
            "sourceType": "video_source",
        }

    def get_job(self, job_id: str) -> Dict[str, Any]:
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT j.*, c.area, c.dialect_self_report, c.ready_segment_count
                FROM pipeline_jobs j
                JOIN contributions c ON c.id = j.contribution_id
                WHERE j.id = ?
                """,
                (job_id,),
            ).fetchone()
            if row is None:
                raise KeyError(job_id)
            reviews = conn.execute(
                """
                SELECT id, stage_key, severity, reason, status, decision, block_job,
                       created_at, updated_at
                FROM review_tasks
                WHERE job_id = ?
                ORDER BY created_at ASC
                """,
                (job_id,),
            ).fetchall()
        return {
            "jobId": row["id"],
            "contributionId": row["contribution_id"],
            "sourceType": row["source_type"],
            "status": row["status"],
            "profile": row["profile"],
            "inputPath": row["input_path"],
            "artifactRoot": row["artifact_root"],
            "stageCursor": row["stage_cursor"],
            "errorMessage": row["error_message"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "completedAt": row["completed_at"],
            "readySegmentCount": row["ready_segment_count"],
            "area": row["area"],
            "dialectSelfReport": row["dialect_self_report"],
            "reviewTasks": [dict(item) for item in reviews],
        }

    def get_map_overview(self) -> Dict[str, Any]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT id, area, status, created_at, ready_segment_count, audio_url
                FROM contributions
                ORDER BY created_at DESC
                """
            ).fetchall()
            volunteer_review_rows = conn.execute(
                """
                SELECT contribution_id, reviewer_name, dialect_accuracy, risk_flag, transcript_choice,
                       transcript_user, transcript_asr, transcript_final, created_at
                FROM volunteer_reviews
                ORDER BY created_at ASC, id ASC
                """
            ).fetchall()
        volunteer_review_map: Dict[str, List[Dict[str, Any]]] = {}
        for review in volunteer_review_rows:
            volunteer_review_map.setdefault(str(review["contribution_id"]), []).append(dict(review))
        total = len(rows)
        processing = 0
        ready = 0
        new_count = 0
        review = 0
        regions = set()
        recent = 0
        cutoff = self._timestamp_minus_hours(24)
        for row in rows:
            volunteer_summary = self._build_volunteer_review_summary(
                volunteer_review_map.get(str(row["id"]), []),
                "",
                "",
            )
            status = self._display_status(
                row["status"],
                ready_segment_count=row["ready_segment_count"],
                audio_url=row["audio_url"],
                volunteer_summary=volunteer_summary,
            )
            if row["area"]:
                regions.add(str(row["area"]))
            if status == "processing":
                processing += 1
            elif status == "ready":
                ready += 1
            elif status == "review":
                review += 1
            else:
                new_count += 1
            if row["created_at"] >= cutoff:
                recent += 1
        ready_rate = round(ready / total, 4) if total else 0
        return {
            "totalContributions": total,
            "processingCount": processing,
            "readyCount": ready,
            "newCount": new_count,
            "reviewCount": review,
            "regionCoverage": len(regions),
            "newLast24h": recent,
            "readyRate": ready_rate,
            "highlightSentence": "每一段乡音，都有坐标、状态与去向。", 
        }

    def list_map_points(
        self,
        *,
        layer: str = "",
        province: str = "",
        city: str = "",
        district: str = "",
        point_type: Optional[List[str]] = None,
        status: str = "",
    ) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT c.*, j.error_message
                FROM contributions c
                LEFT JOIN pipeline_jobs j ON j.id = c.job_id
                ORDER BY c.created_at DESC
                """
            ).fetchall()
            volunteer_review_rows = conn.execute(
                """
                SELECT contribution_id, reviewer_name, dialect_accuracy, risk_flag, transcript_choice,
                       transcript_user, transcript_asr, transcript_final, created_at
                FROM volunteer_reviews
                ORDER BY created_at ASC, id ASC
                """
            ).fetchall()
        volunteer_review_map: Dict[str, List[Dict[str, Any]]] = {}
        for review in volunteer_review_rows:
            volunteer_review_map.setdefault(str(review["contribution_id"]), []).append(dict(review))
        items: List[Dict[str, Any]] = []
        allowed_types = {item for item in (point_type or []) if item}
        for row in rows:
            item = dict(row)
            volunteer_summary = self._build_volunteer_review_summary(
                volunteer_review_map.get(str(item["id"]), []),
                str(item.get("user_transcript") or item.get("content") or ""),
                str(item.get("asr_transcript") or ""),
            )
            ui_status = self._display_status(
                item["status"],
                ready_segment_count=item.get("ready_segment_count"),
                audio_url=item.get("audio_url"),
                volunteer_summary=volunteer_summary,
            )
            item["status"] = ui_status
            item["type"] = item.get("content_type") or "方言"
            if layer and not self._matches_layer(ui_status, layer):
                continue
            if status and ui_status != status:
                continue
            area = str(item.get("area") or "")
            parts = area.split("/")
            if province and (len(parts) < 1 or parts[0] != province):
                continue
            if city and (len(parts) < 2 or parts[1] != city):
                continue
            if district and (len(parts) < 3 or parts[2] != district):
                continue
            if allowed_types and item["type"] not in allowed_types:
                continue
            items.append(
                {
                    "id": item["id"],
                    "jobId": item["job_id"],
                    "area": area,
                    "dialectLabel": item.get("dialect_label") or item.get("dialect_self_report") or "待识别方言",
                    "type": item["type"],
                    "status": ui_status,
                    "audioUrl": item.get("audio_url") or "",
                    "transcriptSnippet": item.get("transcript_snippet") or "",
                    "qualityScore": item.get("quality_score"),
                    "readySegmentCount": item.get("ready_segment_count") or 0,
                    "createdAt": item.get("created_at"),
                    "nickname": item.get("nickname") or "匿名贡献者",
                    "content": item.get("content") or "",
                    "userTranscript": item.get("user_transcript") or "",
                    "asrTranscript": item.get("asr_transcript") or "",
                    "transcriptSource": item.get("transcript_source") or "",
                    "reviewReason": self._display_review_reason(item, volunteer_summary, ui_status),
                    "volunteerReviewSummary": volunteer_summary,
                }
            )
        return items

    def get_pipeline_metrics(self) -> Dict[str, Any]:
        with self._conn() as conn:
            reviews = conn.execute(
                "SELECT COUNT(*) FROM review_tasks WHERE status = 'pending'"
            ).fetchone()[0]
            jobs = conn.execute(
                "SELECT status, created_at FROM pipeline_jobs"
            ).fetchall()
            stage_rows = conn.execute(
                "SELECT stage_key, state FROM pipeline_stage_runs"
            ).fetchall()
        stage_map = {
            "intake_agent": "ingest",
            "subtitle_source_agent": "clean",
            "audio_prep_agent": "clean",
            "transcription_agent": "transcribe",
            "llm_proofread_agent": "annotate",
            "segmentation_agent": "annotate",
            "mandarin_filter_agent": "qa",
            "metadata_writer_agent": "archive",
        }
        counts: Dict[str, Dict[str, int]] = {}
        for key in ("ingest", "clean", "transcribe", "annotate", "qa", "archive"):
            counts[key] = {"completedCount": 0, "runningCount": 0, "failedCount": 0}
        for row in stage_rows:
            bucket = counts.get(stage_map.get(row["stage_key"], ""))
            if not bucket:
                continue
            state = row["state"]
            if state == "completed":
                bucket["completedCount"] += 1
            elif state == "running":
                bucket["runningCount"] += 1
            elif state in {"failed", "blocked"}:
                bucket["failedCount"] += 1
        failed_count = sum(1 for job in jobs if job["status"] == "failed")
        throughput = sum(1 for job in jobs if job["created_at"] >= self._timestamp_minus_hours(24))
        return {
            "throughput24h": throughput,
            "reviewQueueCount": reviews,
            "failedCount": failed_count,
            "stages": [
                {"key": "ingest", "label": "收录", **counts["ingest"]},
                {"key": "clean", "label": "清洗", **counts["clean"]},
                {"key": "transcribe", "label": "转写", **counts["transcribe"]},
                {"key": "annotate", "label": "标注", **counts["annotate"]},
                {"key": "qa", "label": "质检", **counts["qa"]},
                {"key": "archive", "label": "入库", **counts["archive"]},
            ],
        }

    def delete_contribution(self, contribution_id: str) -> Dict[str, Any]:
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT c.id, c.job_id, c.artifact_root, j.input_path
                FROM contributions c
                LEFT JOIN pipeline_jobs j ON j.id = c.job_id
                WHERE c.id = ?
                """,
                (contribution_id,),
            ).fetchone()
            if row is None:
                raise KeyError(contribution_id)
            conn.execute("DELETE FROM contributions WHERE id = ?", (contribution_id,))
            conn.commit()

        paths_to_remove = set()
        artifact_root = str(row["artifact_root"] or "").strip()
        input_path = str(row["input_path"] or "").strip()
        if artifact_root:
            artifact_path = Path(artifact_root)
            paths_to_remove.add(artifact_path)
            if artifact_path.parent.name == "jobs":
                paths_to_remove.add(artifact_path.parent)
        if input_path:
            input_file = Path(input_path)
            if input_file.parent.exists():
                paths_to_remove.add(input_file.parent)
            if input_file.parent.parent.name == "jobs":
                paths_to_remove.add(input_file.parent.parent)

        removed = []
        for path in sorted(paths_to_remove, key=lambda item: len(str(item)), reverse=True):
            try:
                if path.exists():
                    shutil.rmtree(path)
                    removed.append(str(path))
            except OSError:
                continue

        return {
            "id": contribution_id,
            "jobId": row["job_id"],
            "removedPaths": removed,
        }

    def list_contributions(
        self,
        *,
        search: str = "",
        province: str = "",
        city: str = "",
        district: str = "",
        content_type: str = "",
        status: str = "",
        source_type: str = "",
        has_review: Optional[bool] = None,
        sort: str = "createdAt",
        order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT c.*, j.stage_cursor, j.error_message, j.status AS job_status
                FROM contributions c
                LEFT JOIN pipeline_jobs j ON j.id = c.job_id
                ORDER BY c.created_at DESC
                """
            ).fetchall()
            review_rows = conn.execute(
                """
                SELECT contribution_id, reason, status
                FROM review_tasks
                ORDER BY created_at ASC
                """
            ).fetchall()
            volunteer_review_rows = conn.execute(
                """
                SELECT contribution_id, reviewer_name, dialect_accuracy, risk_flag, transcript_choice,
                       transcript_user, transcript_asr, transcript_final, created_at
                FROM volunteer_reviews
                ORDER BY created_at ASC, id ASC
                """
            ).fetchall()

        review_map: Dict[str, Dict[str, Any]] = {}
        for review in review_rows:
            bucket = review_map.setdefault(
                str(review["contribution_id"]),
                {"pending": 0, "total": 0, "reasons": []},
            )
            bucket["total"] += 1
            if review["status"] == "pending":
                bucket["pending"] += 1
            bucket["reasons"].append(str(review["reason"]))

        volunteer_review_map: Dict[str, List[Dict[str, Any]]] = {}
        for review in volunteer_review_rows:
            volunteer_review_map.setdefault(str(review["contribution_id"]), []).append(dict(review))

        items: List[Dict[str, Any]] = []
        search_text = search.strip().lower()
        for row in rows:
            record = dict(row)
            area = str(record.get("area") or "")
            parts = area.split("/")
            ui_status = self._ui_status(record.get("status"))
            review_summary = review_map.get(str(record["id"]), {"pending": 0, "total": 0, "reasons": []})
            volunteer_summary = self._build_volunteer_review_summary(
                volunteer_review_map.get(str(record["id"]), []),
                str(record.get("user_transcript") or record.get("content") or ""),
                str(record.get("asr_transcript") or ""),
            )
            current_stage_key = str(record.get("stage_cursor") or "")
            ui_status = self._display_status(
                record.get("status"),
                ready_segment_count=record.get("ready_segment_count"),
                audio_url=record.get("audio_url"),
                volunteer_summary=volunteer_summary,
            )
            current_stage_label = (
                "志愿者复核"
                if ui_status == "review"
                else "治理失败"
                if ui_status == "failed"
                else get_stage_meta(current_stage_key).get("label", "待处理")
            )
            item = {
                "id": record["id"],
                "jobId": record["job_id"],
                "createdAt": record["created_at"],
                "updatedAt": record["updated_at"],
                "area": area,
                "dialectLabel": record.get("dialect_label") or record.get("dialect_self_report") or "待识别方言",
                "sourceType": record.get("source_type") or "",
                "type": record.get("content_type") or "方言",
                "status": ui_status,
                "currentStageKey": current_stage_key,
                "currentStage": current_stage_label,
                "readySegmentCount": record.get("ready_segment_count") or 0,
                "qualityScore": record.get("quality_score"),
                "nickname": record.get("nickname") or "匿名贡献者",
                "hasReview": ui_status == "review",
                "reviewReason": self._display_review_reason(record, volunteer_summary, ui_status),
                "reviewCount": review_summary["total"],
                "pendingReviewCount": review_summary["pending"],
                "content": record.get("content") or "",
                "userTranscript": record.get("user_transcript") or "",
                "asrTranscript": record.get("asr_transcript") or "",
                "transcriptSource": record.get("transcript_source") or "",
                "transcriptSnippet": record.get("transcript_snippet") or "",
                "volunteerReviewStatus": volunteer_summary["status"],
                "volunteerReviewCount": volunteer_summary["totalReviews"],
                "volunteerNextReviewerNumber": volunteer_summary["nextReviewerNumber"],
            }

            if province and (len(parts) < 1 or parts[0] != province):
                continue
            if city and (len(parts) < 2 or parts[1] != city):
                continue
            if district and (len(parts) < 3 or parts[2] != district):
                continue
            if content_type and item["type"] != content_type:
                continue
            if status and item["status"] != status:
                continue
            if source_type and item["sourceType"] != source_type:
                continue
            if has_review is True and not item["hasReview"]:
                continue
            if has_review is False and item["hasReview"]:
                continue
            if search_text:
                haystack = " ".join(
                    [
                        str(item["id"]),
                        str(item["area"]),
                        str(item["dialectLabel"]),
                        str(item["nickname"]),
                    ]
                ).lower()
                if search_text not in haystack:
                    continue
            items.append(item)

        reverse = str(order).lower() != "asc"
        sort_key = str(sort or "createdAt")
        key_map = {
            "createdAt": lambda item: str(item["createdAt"]),
            "updatedAt": lambda item: str(item["updatedAt"]),
            "readySegmentCount": lambda item: int(item["readySegmentCount"]),
            "qualityScore": lambda item: float(item["qualityScore"] or 0),
        }
        items.sort(key=key_map.get(sort_key, key_map["createdAt"]), reverse=reverse)

        page = max(1, int(page or 1))
        page_size = max(1, min(100, int(page_size or 20)))
        start = (page - 1) * page_size
        end = start + page_size
        paged = items[start:end]
        return {
            "items": paged,
            "total": len(items),
            "page": page,
            "pageSize": page_size,
        }

    def get_contribution_segments(self, contribution_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT s.id, s.clip_id, s.wav_path, s.txt_path, s.text, s.start_sec, s.end_sec,
                       s.status, c.artifact_root
                FROM corpus_segments s
                JOIN contributions c ON c.id = s.contribution_id
                WHERE s.contribution_id = ?
                ORDER BY s.created_at ASC
                """,
                (contribution_id,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "clipId": row["clip_id"],
                "wavPath": row["wav_path"],
                "wavUrl": (
                    self._storage_url(Path(row["artifact_root"]) / row["wav_path"])
                    if row["wav_path"] and row["artifact_root"]
                    else ""
                ),
                "txtPath": row["txt_path"],
                "text": row["text"],
                "startSec": row["start_sec"],
                "endSec": row["end_sec"],
                "status": row["status"],
            }
            for row in rows
        ]

    def get_job_stages(self, job_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT stage_key, state, started_at, ended_at, confidence, note,
                       agent_name, artifacts, metadata
                FROM pipeline_stage_runs
                WHERE job_id = ?
                ORDER BY id ASC
                """,
                (job_id,),
            ).fetchall()
        return [self._stage_response(dict(row)) for row in rows]

    def get_contribution(self, contribution_id: str) -> Dict[str, Any]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM contributions WHERE id = ?",
                (contribution_id,),
            ).fetchone()
            if row is None:
                raise KeyError(contribution_id)
            assets = conn.execute(
                """
                SELECT id, role, path, mime_type, metadata, created_at
                FROM media_assets
                WHERE contribution_id = ?
                ORDER BY created_at ASC
                """,
                (contribution_id,),
            ).fetchall()
            reviews = conn.execute(
                """
                SELECT id, stage_key, severity, reason, status, decision, note, block_job
                FROM review_tasks
                WHERE contribution_id = ?
                ORDER BY created_at ASC
                """,
                (contribution_id,),
            ).fetchall()
            volunteer_reviews = conn.execute(
                """
                SELECT id, reviewer_name, province, city, district, area_scope, dialect_accuracy,
                       dialect_note, transcript_choice, transcript_user, transcript_asr, transcript_final,
                       transcript_changed, risk_flag, risk_note, created_at, updated_at
                FROM volunteer_reviews
                WHERE contribution_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (contribution_id,),
            ).fetchall()
        data = dict(row)
        data["riskFlags"] = [
            self._humanize_review_reason(item)
            for item in json.loads(data.pop("risk_flags") or "[]")
        ]
        data["assets"] = [
            {
                **dict(asset),
                "url": self._storage_url(Path(asset["path"])),
                "metadata": json.loads(asset["metadata"] or "{}"),
            }
            for asset in assets
        ]
        data["reviewTasks"] = [
            {
                **dict(item),
                "reason": self._humanize_review_reason(str(item["reason"] or "")),
            }
            for item in reviews
        ]
        volunteer_review_rows = []
        for index, item in enumerate(volunteer_reviews, start=1):
            review = dict(item)
            review["review_order"] = index
            volunteer_review_rows.append(review)
        data["volunteerReviews"] = volunteer_review_rows
        data["volunteerReviewSummary"] = self._build_volunteer_review_summary(
            volunteer_review_rows,
            str(data.get("user_transcript") or data.get("content") or ""),
            str(data.get("asr_transcript") or ""),
        )
        display_status = self._display_status(
            data["status"],
            ready_segment_count=data.get("ready_segment_count"),
            audio_url=data.get("audio_url"),
            volunteer_summary=data["volunteerReviewSummary"],
        )
        stage_meta = self._get_stage_meta_for_job(data["job_id"])
        return {
            "id": data["id"],
            "jobId": data["job_id"],
            "sourceType": data["source_type"],
            "area": data["area"],
            "dialectSelfReport": data["dialect_self_report"],
            "dialectLabel": data["dialect_label"],
            "contentType": data["content_type"],
            "content": data["content"],
            "userTranscript": data.get("user_transcript") or "",
            "asrTranscript": data.get("asr_transcript") or "",
            "transcriptSource": data.get("transcript_source") or "",
            "nickname": data["nickname"],
            "consentGranted": bool(data["consent_granted"]),
            "status": display_status,
            "pipelineState": data["pipeline_state"],
            "transcriptSnippet": data["transcript_snippet"],
            "qualityScore": data["quality_score"],
            "readySegmentCount": data["ready_segment_count"],
            "audioUrl": data["audio_url"],
            "artifactRoot": data["artifact_root"],
            "riskFlags": data["riskFlags"],
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
            "currentStageKey": stage_meta["key"],
            "currentStageLabel": (
                "志愿者复核"
                if display_status == "review"
                else "治理失败"
                if display_status == "failed"
                else stage_meta["label"]
            ),
            "errorMessage": self._humanize_review_reason(stage_meta["errorMessage"]),
            "assets": data["assets"],
            "reviewTasks": data["reviewTasks"],
            "volunteerReviews": data["volunteerReviews"],
            "volunteerReviewSummary": data["volunteerReviewSummary"],
        }

    def get_contribution_pipeline(self, contribution_id: str) -> Dict[str, Any]:
        contribution = self.get_contribution(contribution_id)
        stages = [
            self._enrich_mandarin_stage(stage, artifact_root=str(contribution.get("artifactRoot") or ""))
            for stage in self.get_job_stages(contribution["jobId"])
        ]
        review_tasks = contribution["reviewTasks"]
        public_stages: List[Dict[str, Any]] = []
        for phase in ("收录", "字幕/转写", "校对", "切分", "质检", "入库"):
            phase_stages = [
                stage
                for stage in stages
                if get_stage_meta(stage["key"]).get("public_phase") == phase
            ]
            public_stages.append(
                {
                    "label": phase,
                    "state": self._collapse_public_state(phase_stages),
                    "stageKeys": [stage["key"] for stage in phase_stages],
                    "agents": [stage["label"] for stage in phase_stages],
                }
            )
        return {
            "contributionId": contribution["id"],
            "jobId": contribution["jobId"],
            "sourceType": contribution["sourceType"],
            "state": contribution["pipelineState"],
            "publicStages": public_stages,
            "agentStages": stages,
            "reviewTasks": review_tasks,
        }

    def decide_review_task(self, review_task_id: str, decision: str, note: str) -> Dict[str, Any]:
        decision = decision.strip().lower()
        if decision not in {"approve", "reject", "waive"}:
            raise ValueError("decision 只允许 approve / reject / waive")
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM review_tasks WHERE id = ?",
                (review_task_id,),
            ).fetchone()
            if row is None:
                raise KeyError(review_task_id)
            now = utcnow_iso()
            status = "resolved"
            conn.execute(
                """
                UPDATE review_tasks
                SET status = ?, decision = ?, note = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, decision, note, now, review_task_id),
            )
            if decision == "reject":
                self._set_job_state(
                    conn,
                    row["job_id"],
                    "failed",
                    error_message=f"review_rejected:{row['reason']}",
                )
            else:
                self._reconcile_job_state(conn, row["job_id"])
        return self.get_job(str(row["job_id"]))

    def apply_volunteer(
        self,
        *,
        reviewer_name: str,
        province: str = "",
        city: str = "",
        district: str = "",
    ) -> Dict[str, Any]:
        reviewer_name = reviewer_name.strip()
        if not reviewer_name:
            raise ValueError("reviewerName 不能为空")
        area_scope = self._build_area_scope(province, city, district)
        if not area_scope:
            raise ValueError("至少需要选择志愿者负责的省份")
        now = utcnow_iso()
        application_id = self._new_id("volunteer")
        with self._conn() as conn:
            existing = conn.execute(
                """
                SELECT id, status
                FROM volunteer_applications
                WHERE reviewer_name = ? AND area_scope = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (reviewer_name, area_scope),
            ).fetchone()
            if existing is not None:
                return {
                    "applicationId": existing["id"],
                    "reviewerName": reviewer_name,
                    "province": province,
                    "city": city,
                    "district": district,
                    "areaScope": area_scope,
                    "status": existing["status"],
                }
            conn.execute(
                """
                INSERT INTO volunteer_applications (
                  id, reviewer_name, province, city, district, area_scope, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
                """,
                (application_id, reviewer_name, province, city, district, area_scope, now, now),
            )
            conn.commit()
        return {
            "applicationId": application_id,
            "reviewerName": reviewer_name,
            "province": province,
            "city": city,
            "district": district,
            "areaScope": area_scope,
            "status": "approved",
        }

    def submit_volunteer_review(
        self,
        *,
        contribution_id: str,
        reviewer_name: str,
        province: str = "",
        city: str = "",
        district: str = "",
        dialect_accuracy: int,
        dialect_note: str = "",
        transcript_choice: str = "user",
        transcript_final: str = "",
        risk_flag: bool = False,
        risk_note: str = "",
    ) -> Dict[str, Any]:
        reviewer_name = reviewer_name.strip()
        if not reviewer_name:
            raise ValueError("reviewerName 不能为空")
        if dialect_accuracy not in {1, 2, 3}:
            raise ValueError("dialectAccuracy 只允许 1 / 2 / 3")
        transcript_choice = str(transcript_choice or "user").strip().lower()
        if transcript_choice not in {"user", "asr", "custom"}:
            raise ValueError("transcriptChoice 只允许 user / asr / custom")
        area_scope = self._build_area_scope(province, city, district)
        now = utcnow_iso()
        with self._conn() as conn:
            contribution = conn.execute(
                "SELECT * FROM contributions WHERE id = ?",
                (contribution_id,),
            ).fetchone()
            if contribution is None:
                raise KeyError(contribution_id)
            current_area = str(contribution["area"] or "")
            normalized_scope = self._normalize_area_for_match(area_scope)
            normalized_current_area = self._normalize_area_for_match(current_area)
            if normalized_scope and normalized_current_area and not normalized_current_area.startswith(normalized_scope):
                raise ValueError("当前志愿者片区与样本地区不匹配")
            approved_application = conn.execute(
                """
                SELECT id
                FROM volunteer_applications
                WHERE reviewer_name = ? AND area_scope = ? AND status = 'approved'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (reviewer_name, area_scope),
            ).fetchone()
            if approved_application is None:
                conn.execute(
                    """
                    INSERT INTO volunteer_applications
                        (reviewer_name, province, city, district, area_scope, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'approved', ?)
                    """,
                    (reviewer_name, province, city, district, area_scope, now),
                )

            existing_reviews = [
                dict(row)
                for row in conn.execute(
                    """
                    SELECT id, reviewer_name, dialect_accuracy, risk_flag, transcript_choice,
                           transcript_user, transcript_asr, transcript_final, created_at
                    FROM volunteer_reviews
                    WHERE contribution_id = ?
                    ORDER BY created_at ASC, id ASC
                    """,
                    (contribution_id,),
                ).fetchall()
            ]
            if any(str(item["reviewer_name"]).strip() == reviewer_name for item in existing_reviews):
                raise ValueError("同一位志愿者不能重复审核同一条样本")

            existing_summary = self._build_volunteer_review_summary(
                existing_reviews,
                str(contribution["user_transcript"] or contribution["content"] or "").strip(),
                str(contribution["asr_transcript"] or "").strip(),
            )
            if not existing_summary["canAcceptMoreReviews"] and existing_summary["totalReviews"] > 0:
                raise ValueError("该样本的志愿者审核已完成")
            if existing_summary["totalReviews"] >= 4:
                raise ValueError("该样本已达到最多 4 位志愿者审核上限")

            transcript_user = str(contribution["user_transcript"] or contribution["content"] or "").strip()
            transcript_asr = str(contribution["asr_transcript"] or "").strip()
            if transcript_choice == "user":
                final_text = transcript_user
            elif transcript_choice == "asr":
                final_text = transcript_asr
            else:
                final_text = str(transcript_final or "").strip()
            if transcript_choice in {"user", "asr"} and not final_text:
                raise ValueError("所选文本来源当前为空，请改为手动填写")
            if transcript_choice == "custom" and not final_text:
                raise ValueError("选择“自己改”时必须填写志愿者最终文本")
            transcript_changed = 1 if transcript_choice == "custom" and final_text and final_text != transcript_user else 0
            review_id = self._new_id("volreview")

            conn.execute(
                """
                INSERT INTO volunteer_reviews (
                  id, contribution_id, reviewer_name, province, city, district, area_scope,
                  dialect_accuracy, dialect_note, transcript_choice, transcript_user, transcript_asr,
                  transcript_final, transcript_changed, risk_flag, risk_note, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    review_id,
                    contribution_id,
                    reviewer_name,
                    province,
                    city,
                    district,
                    area_scope or current_area,
                    dialect_accuracy,
                    dialect_note.strip(),
                    transcript_choice,
                    transcript_user,
                    transcript_asr,
                    final_text,
                    transcript_changed,
                    1 if risk_flag else 0,
                    risk_note.strip(),
                    now,
                    now,
                ),
            )
            review_rows = [
                dict(row)
                for row in conn.execute(
                    """
                    SELECT id, reviewer_name, dialect_accuracy, risk_flag, transcript_choice,
                           transcript_user, transcript_asr, transcript_final, created_at
                    FROM volunteer_reviews
                    WHERE contribution_id = ?
                    ORDER BY created_at ASC, id ASC
                    """,
                    (contribution_id,),
                ).fetchall()
            ]
            summary = self._build_volunteer_review_summary(review_rows, transcript_user, transcript_asr)
            next_risk_flags = [
                flag
                for flag in json.loads(contribution["risk_flags"] or "[]")
                if flag != "志愿者标记风险"
            ]
            if summary["hasRisk"]:
                next_risk_flags.append("志愿者标记风险")

            conn.execute(
                """
                UPDATE contributions
                SET content = ?, transcript_source = ?, transcript_snippet = ?, risk_flags = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    summary["finalTranscript"] or transcript_user or transcript_asr,
                    summary["finalTranscriptSource"] or str(contribution["transcript_source"] or ""),
                    (summary["finalTranscript"] or transcript_user or transcript_asr)[:140],
                    json.dumps(next_risk_flags, ensure_ascii=False),
                    now,
                    contribution_id,
                ),
            )
            self._clear_pending_volunteer_review_tasks(conn, str(contribution["job_id"]), contribution_id)
            self._sync_volunteer_review_tasks(
                conn,
                job_id=str(contribution["job_id"]),
                contribution_id=contribution_id,
                summary=summary,
            )
            conn.commit()
        return self.get_contribution(contribution_id)

    def _build_volunteer_review_summary(
        self,
        reviews: List[Dict[str, Any]],
        transcript_user: str,
        transcript_asr: str,
    ) -> Dict[str, Any]:
        normalized_reviews = []
        for index, review in enumerate(reviews, start=1):
            item = dict(review)
            item["review_order"] = int(item.get("review_order") or index)
            item["dialect_accuracy"] = int(item.get("dialect_accuracy") or 0)
            item["risk_flag"] = bool(item.get("risk_flag"))
            item["transcript_choice"] = str(item.get("transcript_choice") or "user")
            normalized_reviews.append(item)

        dialect_summary = self._summarize_dialect_votes([item["dialect_accuracy"] for item in normalized_reviews if item.get("dialect_accuracy")])
        risk_summary = self._summarize_risk_votes([bool(item.get("risk_flag")) for item in normalized_reviews])
        transcript_summary = self._resolve_final_transcript(normalized_reviews, transcript_user, transcript_asr)

        total_reviews = len(normalized_reviews)
        can_accept_more = total_reviews < 4
        status = "not_started"
        label = "等待第 1 位志愿者"
        required_reviewers = 2
        next_reviewer_number: Optional[int] = 1
        is_passed = False
        is_rejected = False
        has_risk = False

        if dialect_summary["resolved"] and dialect_summary["majorityValue"] == 1:
            status = "rejected"
            label = "多数志愿者判定为不准确，样本不通过"
            required_reviewers = dialect_summary["requiredReviewers"]
            next_reviewer_number = None
            can_accept_more = False
            is_rejected = True
            has_risk = bool(risk_summary["majorityValue"]) if risk_summary["resolved"] else False
        elif dialect_summary["resolved"] and risk_summary["resolved"]:
            required_reviewers = max(dialect_summary["requiredReviewers"], risk_summary["requiredReviewers"])
            next_reviewer_number = None
            can_accept_more = False
            has_risk = bool(risk_summary["majorityValue"])
            if has_risk:
                status = "risk_flagged"
                label = "方言投票通过，但内容风险多数票为有风险"
            else:
                status = "approved"
                label = "志愿者投票通过"
                is_passed = True
        else:
            if total_reviews <= 0:
                next_reviewer_number = 1
                required_reviewers = 2
            else:
                required_reviewers = max(dialect_summary["requiredReviewers"], risk_summary["requiredReviewers"])
                next_reviewer_number = min(required_reviewers, total_reviews + 1) if total_reviews < required_reviewers else None
            if next_reviewer_number:
                status = f"awaiting_reviewer_{next_reviewer_number}"
                label = f"等待第 {next_reviewer_number} 位志愿者"
            else:
                status = "pending"
                label = "等待更多志愿者"

        return {
            "status": status,
            "label": label,
            "totalReviews": total_reviews,
            "requiredReviewers": required_reviewers,
            "nextReviewerNumber": next_reviewer_number,
            "canAcceptMoreReviews": can_accept_more and next_reviewer_number is not None,
            "dialectDecision": dialect_summary,
            "riskDecision": risk_summary,
            "finalTranscript": transcript_summary["text"],
            "finalTranscriptSource": transcript_summary["source"],
            "finalTranscriptReviewer": transcript_summary["reviewerName"],
            "hasRisk": has_risk,
            "isPassed": is_passed,
            "isRejected": is_rejected,
        }

    def _summarize_dialect_votes(self, votes: List[int]) -> Dict[str, Any]:
        normalized_votes = [int(vote) for vote in votes if int(vote) in {1, 2, 3}]
        counts = Counter(normalized_votes)
        count_map = {str(key): counts.get(key, 0) for key in (1, 2, 3)}
        result = {
            "resolved": False,
            "requiredReviewers": 2,
            "nextReviewerNumber": 2 if normalized_votes else 1,
            "majorityValue": None,
            "label": "待投票",
            "counts": count_map,
        }
        size = len(normalized_votes)
        if size == 0:
            return result
        if size == 1:
            result["nextReviewerNumber"] = 2
            result["label"] = "等待第 2 位志愿者"
            return result
        if size == 2:
            if normalized_votes[0] == normalized_votes[1]:
                vote = normalized_votes[0]
                result.update(
                    {
                        "resolved": True,
                        "requiredReviewers": 2,
                        "nextReviewerNumber": None,
                        "majorityValue": vote,
                        "label": self._dialect_vote_label(vote),
                    }
                )
                return result
            result["requiredReviewers"] = 3
            result["nextReviewerNumber"] = 3
            result["label"] = "前两位意见不一致，等待第 3 位志愿者"
            return result
        first_three = normalized_votes[:3]
        first_three_counts = Counter(first_three)
        top_vote, top_count = first_three_counts.most_common(1)[0]
        if top_count >= 2:
            result.update(
                {
                    "resolved": True,
                    "requiredReviewers": 3,
                    "nextReviewerNumber": None,
                    "majorityValue": top_vote,
                    "label": self._dialect_vote_label(top_vote),
                    "counts": {str(key): first_three_counts.get(key, 0) for key in (1, 2, 3)},
                }
            )
            return result
        if size == 3:
            result.update(
                {
                    "requiredReviewers": 4,
                    "nextReviewerNumber": 4,
                    "label": "三位志愿者各投一档，等待第 4 位志愿者",
                    "counts": {str(key): first_three_counts.get(key, 0) for key in (1, 2, 3)},
                }
            )
            return result
        first_four = normalized_votes[:4]
        first_four_counts = Counter(first_four)
        top_vote, _ = first_four_counts.most_common(1)[0]
        result.update(
            {
                "resolved": True,
                "requiredReviewers": 4,
                "nextReviewerNumber": None,
                "majorityValue": top_vote,
                "label": self._dialect_vote_label(top_vote),
                "counts": {str(key): first_four_counts.get(key, 0) for key in (1, 2, 3)},
            }
        )
        return result

    def _summarize_risk_votes(self, votes: List[bool]) -> Dict[str, Any]:
        normalized_votes = [bool(vote) for vote in votes]
        yes_count = sum(1 for vote in normalized_votes if vote)
        no_count = len(normalized_votes) - yes_count
        result = {
            "resolved": False,
            "requiredReviewers": 2,
            "nextReviewerNumber": 2 if normalized_votes else 1,
            "majorityValue": None,
            "label": "待投票",
            "yesCount": yes_count,
            "noCount": no_count,
        }
        size = len(normalized_votes)
        if size == 0:
            return result
        if size == 1:
            result["nextReviewerNumber"] = 2
            result["label"] = "等待第 2 位志愿者"
            return result
        if size == 2 and normalized_votes[0] == normalized_votes[1]:
            result.update(
                {
                    "resolved": True,
                    "requiredReviewers": 2,
                    "nextReviewerNumber": None,
                    "majorityValue": normalized_votes[0],
                    "label": "有风险" if normalized_votes[0] else "无风险",
                }
            )
            return result
        if size == 2:
            result["requiredReviewers"] = 3
            result["nextReviewerNumber"] = 3
            result["label"] = "前两位意见不一致，等待第 3 位志愿者"
            return result
        first_three = normalized_votes[:3]
        yes_count = sum(1 for vote in first_three if vote)
        no_count = len(first_three) - yes_count
        majority = yes_count > no_count
        result.update(
            {
                "resolved": True,
                "requiredReviewers": 3,
                "nextReviewerNumber": None,
                "majorityValue": majority,
                "label": "有风险" if majority else "无风险",
                "yesCount": yes_count,
                "noCount": no_count,
            }
        )
        return result

    def _resolve_final_transcript(
        self,
        reviews: List[Dict[str, Any]],
        transcript_user: str,
        transcript_asr: str,
    ) -> Dict[str, str]:
        for review in reviews:
            if str(review.get("transcript_choice") or "") == "custom" and str(review.get("transcript_final") or "").strip():
                return {
                    "text": str(review.get("transcript_final") or "").strip(),
                    "source": "volunteer_custom",
                    "reviewerName": str(review.get("reviewer_name") or ""),
                }
        if reviews:
            first = reviews[0]
            choice = str(first.get("transcript_choice") or "user")
            if choice == "asr":
                return {
                    "text": str(first.get("transcript_asr") or transcript_asr or "").strip(),
                    "source": "volunteer_asr",
                    "reviewerName": str(first.get("reviewer_name") or ""),
                }
            if choice == "custom":
                return {
                    "text": str(first.get("transcript_final") or "").strip(),
                    "source": "volunteer_custom",
                    "reviewerName": str(first.get("reviewer_name") or ""),
                }
            return {
                "text": str(first.get("transcript_user") or transcript_user or "").strip(),
                "source": "volunteer_user",
                "reviewerName": str(first.get("reviewer_name") or ""),
            }
        return {
            "text": transcript_user or transcript_asr or "",
            "source": "user" if transcript_user else ("asr" if transcript_asr else ""),
            "reviewerName": "",
        }

    def _dialect_vote_label(self, vote: int) -> str:
        return {
            1: "不准确",
            2: "基本准确",
            3: "准确",
        }.get(int(vote or 0), "未判定")

    def _clear_pending_volunteer_review_tasks(
        self,
        conn: sqlite3.Connection,
        job_id: str,
        contribution_id: str,
    ) -> None:
        conn.execute(
            """
            DELETE FROM review_tasks
            WHERE job_id = ? AND contribution_id = ? AND stage_key = 'volunteer_review' AND status = 'pending'
            """,
            (job_id, contribution_id),
        )

    def _sync_volunteer_review_tasks(
        self,
        conn: sqlite3.Connection,
        *,
        job_id: str,
        contribution_id: str,
        summary: Dict[str, Any],
    ) -> None:
        if summary["status"] == "rejected":
            now = utcnow_iso()
            conn.execute(
                """
                INSERT INTO review_tasks (
                  id, job_id, contribution_id, stage_key, severity, reason, status,
                  decision, note, block_job, created_at, updated_at
                ) VALUES (?, ?, ?, 'volunteer_review', 'high', ?, 'pending', NULL, '', 0, ?, ?)
                """,
                (
                    self._new_id("review"),
                    job_id,
                    contribution_id,
                    "volunteer_dialect_rejected",
                    now,
                    now,
                ),
            )
            self._set_job_state(conn, job_id, "failed", error_message="volunteer_dialect_rejected")
        elif summary["status"] == "risk_flagged":
            now = utcnow_iso()
            conn.execute(
                """
                INSERT INTO review_tasks (
                  id, job_id, contribution_id, stage_key, severity, reason, status,
                  decision, note, block_job, created_at, updated_at
                ) VALUES (?, ?, ?, 'volunteer_review', 'high', ?, 'pending', NULL, '', 1, ?, ?)
                """,
                (
                    self._new_id("review"),
                    job_id,
                    contribution_id,
                    "volunteer_risk_flagged",
                    now,
                    now,
                ),
            )
        if summary["status"] != "rejected":
            self._reconcile_job_state(conn, job_id)
        self._sync_contribution_rollup(conn, job_id)

    def _submit_job(self, job_id: str) -> None:
        self._executor.submit(self._run_job, job_id)

    def _normalize_area_for_match(self, value: str) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        replacements = [
            "特别行政区",
            "壮族自治区",
            "回族自治区",
            "维吾尔自治区",
            "自治区",
            "自治州",
            "地区",
            "盟",
            "省",
            "市",
            "区",
            "县",
            "州",
            "/",
            "-",
            "_",
            " ",
        ]
        normalized = text
        for token in replacements:
            normalized = normalized.replace(token, "")
        return normalized

    def _run_job(self, job_id: str) -> None:
        try:
            with self._conn() as conn:
                job = conn.execute(
                    "SELECT * FROM pipeline_jobs WHERE id = ?",
                    (job_id,),
                ).fetchone()
                if job is None:
                    return
                self._set_job_state(conn, job_id, "running")
            if job["source_type"] == "audio_upload":
                self._process_audio_job(job_id)
            else:
                self._process_video_job(job_id)
        except Exception as exc:
            with self._conn() as conn:
                self._set_job_state(conn, job_id, "failed", error_message=str(exc))
                self._sync_contribution_rollup(conn, job_id)

    def _process_audio_job(self, job_id: str) -> None:
        job, contribution = self._load_job_context(job_id)
        source_path = Path(job["input_path"])

        self._mark_stage(
            job_id,
            "intake_agent",
            "running",
            note="校验授权、创建任务与样本归档",
        )
        if not contribution["consent_granted"]:
            self._mark_stage(
                job_id,
                "intake_agent",
                "failed",
                note="缺少授权同意，任务终止",
            )
            raise RuntimeError("consent_missing")
        self._mark_stage(
            job_id,
            "intake_agent",
            "completed",
            confidence=1.0,
            note="上传样本已接入任务系统",
            artifacts={"input": str(source_path)},
        )

        dialect = self._dialect_modules()
        cfg = self._load_dialect_config(job["profile"])
        output_root = Path(job["artifact_root"])
        prepared_dir = output_root / "_prepared"
        prepared_dir.mkdir(parents=True, exist_ok=True)
        prepared_wav = prepared_dir / "normalized.wav"

        self._mark_stage(
            job_id,
            "subtitle_source_agent",
            "completed",
            confidence=1.0,
            note="音频上传无字幕抽取，直接进入音频治理",
        )

        self._mark_stage(job_id, "audio_prep_agent", "running", note="音频格式归一与采样率标准化")
        try:
            ffmpeg, ffprobe = dialect["ensure_ffmpeg_available"]()
            self._normalize_audio(ffmpeg, source_path, prepared_wav)
            duration = dialect["get_video_duration_sec"](ffprobe, prepared_wav)
        except Exception as exc:
            self._mark_stage(job_id, "audio_prep_agent", "failed", note=str(exc))
            raise
        self._insert_media_asset_record(
            contribution_id=contribution["id"],
            job_id=job_id,
            role="normalized_audio",
            path=prepared_wav,
            mime_type="audio/wav",
            metadata={"durationSec": duration},
        )
        self._mark_stage(
            job_id,
            "audio_prep_agent",
            "completed",
            confidence=0.97,
            note="已完成单声道、静音裁切、响度归一与轻量降噪",
            artifacts={"preparedWav": str(prepared_wav), "durationSec": duration},
        )

        stage_conf = 0.0
        transcript_source = ""
        self._mark_stage(job_id, "transcription_agent", "running", note="用户文字优先，同时保留 ASR 结果")
        user_transcript = ((contribution["user_transcript"] or contribution["content"]) or "").strip()
        transcript = user_transcript
        asr_text = ""
        asr_source = ""
        asr_note = ""
        mandarin_cfg = dict(cfg.get("mandarin_filter") or {})
        try:
            dashscope_result = self._transcribe_with_dashscope(prepared_wav)
            asr_text = str(dashscope_result.get("text") or "").strip()
            asr_source = str(dashscope_result.get("source") or "")
            asr_note = str(dashscope_result.get("note") or "")
            stage_conf = float(dashscope_result.get("confidence") or 0.0)
        except Exception as exc:
            asr_note = str(exc)
        if not asr_text:
            try:
                if dialect["local_asr_available"](mandarin_cfg):
                    asr_text = dialect["transcribe_local"](prepared_wav, mandarin_cfg).strip()
                    asr_source = "local_asr"
                    asr_note = "local_asr_fallback"
                    stage_conf = max(stage_conf, 0.84)
            except Exception as exc:
                if not asr_note:
                    asr_note = str(exc)

        if user_transcript:
            transcript = user_transcript
            transcript_source = "user_text"
            stage_conf = max(stage_conf, 0.92 if asr_text else 0.72)
        elif asr_text:
            transcript = asr_text
            transcript_source = asr_source or "asr"
            stage_conf = max(stage_conf, 0.84)
        else:
            self._mark_stage(
                job_id,
                "transcription_agent",
                "failed",
                note="没有可用 ASR 文本，也没有用户提供的录音文字版",
            )
            raise RuntimeError("no_transcription_available")

        self._store_audio_transcripts(
            contribution["id"],
            user_transcript=user_transcript,
            asr_transcript=asr_text,
            transcript_source=transcript_source,
        )

        srt_path = self._write_single_segment_srt(
            output_root=output_root,
            stem="audio_upload",
            start_sec=0.0,
            end_sec=duration,
            text=transcript,
            write_srt_file=dialect["write_srt_file"],
            subtitle_segment=dialect["SubtitleSegment"],
        )
        self._mark_stage(
            job_id,
            "transcription_agent",
            "completed",
            confidence=stage_conf,
            note=f"主文本来源：{transcript_source or 'unknown'}；ASR：{asr_source or '未生成'}",
            artifacts={
                "srt": str(srt_path),
                "userTranscript": user_transcript[:140],
                "asrTranscript": asr_text[:140],
                "asrSource": asr_source,
                "asrNote": asr_note,
            },
        )

        self._mark_stage(job_id, "llm_proofread_agent", "running", note="方言保持式文本校对")
        proofread_note = self._proofread_srt(cfg, srt_path, dialect["proofread_srt_file"])
        self._mark_stage(
            job_id,
            "llm_proofread_agent",
            "completed",
            confidence=0.76 if proofread_note == "llm_applied" else 0.55,
            note=self._proofread_note_text(proofread_note),
            artifacts={"srt": str(srt_path)},
        )

        self._mark_stage(job_id, "segmentation_agent", "running", note="生成 clip 计划并导出训练片段")
        rows = self._segment_audio_from_srt(
            cfg=cfg,
            prepared_wav=prepared_wav,
            srt_path=srt_path,
            output_root=output_root,
            profile=job["profile"],
            source_ref=str(source_path),
            ffmpeg=ffmpeg,
            build_clip_plans=dialect["build_clip_plans"],
            plan_clips_from_segments=dialect["plan_clips_from_segments"],
            merge_adjacent_by_gap=dialect["merge_adjacent_by_gap"],
            merge_consecutive_fuzzy_similar=dialect["merge_consecutive_fuzzy_similar"],
            normalize_text=dialect["normalize_text"],
            is_punctuation_or_noise_text=dialect["is_punctuation_or_noise_text"],
            is_single_char_subtitle_noise=dialect["is_single_char_subtitle_noise"],
            parse_srt_file=dialect["parse_srt_file"],
            clip_paths_cls=dialect["ClipPaths"],
            video_output_dirs_cls=dialect["VideoOutputDirs"],
            metadata_row_cls=dialect["MetadataRow"],
            write_metadata_csv=dialect["write_metadata_csv"],
            write_metadata_jsonl=dialect["write_metadata_jsonl"],
            write_metadata_txt=dialect["write_metadata_txt"],
        )
        self._mark_stage(
            job_id,
            "segmentation_agent",
            "completed",
            confidence=0.88,
            note=f"已生成 {len(rows)} 条音频片段",
            artifacts={"metadata": str(output_root / "metadata" / "metadata.jsonl")},
        )

        self._run_post_filters(
            job_id=job_id,
            contribution_id=contribution["id"],
            profile=job["profile"],
            output_root=output_root,
            cfg=cfg,
            dialect=dialect,
        )

    def _process_video_job(self, job_id: str) -> None:
        job, contribution = self._load_job_context(job_id)
        input_path = Path(job["input_path"])

        self._mark_stage(job_id, "intake_agent", "running", note="视频任务建档与输入校验")
        if not input_path.exists():
            self._mark_stage(job_id, "intake_agent", "failed", note="视频输入路径不存在")
            raise RuntimeError(f"video_input_missing:{input_path}")
        self._mark_stage(
            job_id,
            "intake_agent",
            "completed",
            confidence=1.0,
            note="视频源任务已建档",
            artifacts={"input": str(input_path)},
        )

        dialect = self._dialect_modules()
        cfg = self._load_dialect_config(job["profile"])
        output_root = Path(job["artifact_root"])
        prepared_dir = output_root / "_prepared"
        prepared_dir.mkdir(parents=True, exist_ok=True)
        fallback_audio = prepared_dir / "fallback.wav"

        self._mark_stage(job_id, "subtitle_source_agent", "running", note="优先尝试软字幕，再回退 OCR")
        try:
            ffmpeg, ffprobe = dialect["ensure_ffmpeg_available"]()
            duration = dialect["get_video_duration_sec"](ffprobe, input_path)
            vdirs = dialect["VideoOutputDirs"].create(output_root, "001", dialect["safe_stem"](input_path))
            srt_path = vdirs.work_srt
        except Exception as exc:
            self._mark_stage(job_id, "subtitle_source_agent", "failed", note=str(exc))
            raise
        subtitle_method = ""
        srt_ok = False
        try:
            idx = dialect["pick_text_subtitle_stream_index"](ffprobe, input_path)
            if idx is not None:
                srt_ok = dialect["extract_subtitle_srt"](ffmpeg, input_path, srt_path, idx)
                if srt_ok:
                    subtitle_method = "embedded_subtitle"
        except Exception:
            srt_ok = False
        if not srt_ok and bool(cfg.get("ocr", {}).get("enabled", True)):
            try:
                srt_ok = dialect["try_generate_srt_via_ocr"](
                    ffprobe,
                    input_path,
                    srt_path,
                    dict(cfg.get("ocr") or {}),
                    logger=None,
                )
                if srt_ok:
                    subtitle_method = "ocr"
            except Exception:
                srt_ok = False
        if srt_ok:
            self._mark_stage(
                job_id,
                "subtitle_source_agent",
                "completed",
                confidence=0.82 if subtitle_method == "ocr" else 0.95,
                note=f"字幕获取成功，来源：{subtitle_method}",
                artifacts={"srt": str(srt_path)},
            )
        else:
            self._mark_stage(
                job_id,
                "subtitle_source_agent",
                "completed",
                confidence=0.25,
                note="未取到字幕，转入 ASR 兜底",
            )

        self._mark_stage(
            job_id,
            "audio_prep_agent",
            "completed",
            confidence=1.0,
            note="视频源不单独展示音频预处理节点",
        )

        self._mark_stage(job_id, "transcription_agent", "running", note="无字幕时使用本地 ASR 兜底")
        if not srt_ok:
            self._normalize_audio(ffmpeg, input_path, fallback_audio)
            mandarin_cfg = dict(cfg.get("mandarin_filter") or {})
            if not dialect["local_asr_available"](mandarin_cfg):
                self._mark_stage(
                    job_id,
                    "transcription_agent",
                    "failed",
                    note="字幕和 OCR 均失败，且未安装本地 ASR 模型",
                )
                raise RuntimeError("subtitle_and_asr_unavailable")
            asr_text = dialect["transcribe_local"](fallback_audio, mandarin_cfg).strip()
            if not asr_text:
                self._mark_stage(
                    job_id,
                    "transcription_agent",
                    "failed",
                    note="ASR 兜底未生成可用文本",
                )
                raise RuntimeError("asr_fallback_empty")
            self._write_single_segment_srt(
                output_root=output_root,
                stem="video_fallback",
                start_sec=0.0,
                end_sec=duration,
                text=asr_text,
                write_srt_file=dialect["write_srt_file"],
                subtitle_segment=dialect["SubtitleSegment"],
            )
            shutil.copy2(output_root / "logs" / "work" / "video_fallback.srt", srt_path)
            self._create_review_task(
                job_id=job_id,
                contribution_id=contribution["id"],
                stage_key="transcription_agent",
                severity="medium",
                reason="video_asr_fallback_used",
                block_job=False,
            )
            note = "字幕缺失，已使用本地 ASR 兜底"
            conf = 0.72
        else:
            note = "视频源采用字幕/OCR 文本，本节点未触发兜底"
            conf = 0.9
        self._mark_stage(
            job_id,
            "transcription_agent",
            "completed",
            confidence=conf,
            note=note,
            artifacts={"srt": str(srt_path)},
        )

        self._mark_stage(job_id, "llm_proofread_agent", "running", note="对字幕/OCR 文本做方言保持式校对")
        proofread_note = self._proofread_srt(cfg, srt_path, dialect["proofread_srt_file"])
        self._mark_stage(
            job_id,
            "llm_proofread_agent",
            "completed",
            confidence=0.76 if proofread_note == "llm_applied" else 0.55,
            note=self._proofread_note_text(proofread_note),
            artifacts={"srt": str(srt_path)},
        )

        self._mark_stage(job_id, "segmentation_agent", "running", note="按字幕切分 wav/txt")
        rows = self._segment_video_from_srt(
            cfg=cfg,
            input_path=input_path,
            output_root=output_root,
            profile=job["profile"],
            srt_path=srt_path,
            ffmpeg=ffmpeg,
            ffprobe=ffprobe,
            build_clip_plans=dialect["build_clip_plans"],
            plan_clips_from_segments=dialect["plan_clips_from_segments"],
            merge_adjacent_by_gap=dialect["merge_adjacent_by_gap"],
            merge_consecutive_fuzzy_similar=dialect["merge_consecutive_fuzzy_similar"],
            normalize_text=dialect["normalize_text"],
            is_punctuation_or_noise_text=dialect["is_punctuation_or_noise_text"],
            is_single_char_subtitle_noise=dialect["is_single_char_subtitle_noise"],
            parse_srt_file=dialect["parse_srt_file"],
            clip_paths_cls=dialect["ClipPaths"],
            video_output_dirs_cls=dialect["VideoOutputDirs"],
            metadata_row_cls=dialect["MetadataRow"],
            write_metadata_csv=dialect["write_metadata_csv"],
            write_metadata_jsonl=dialect["write_metadata_jsonl"],
            write_metadata_txt=dialect["write_metadata_txt"],
            extract_wav_segment=dialect["extract_wav_segment"],
            safe_stem=dialect["safe_stem"],
        )
        self._mark_stage(
            job_id,
            "segmentation_agent",
            "completed",
            confidence=0.9,
            note=f"已导出 {len(rows)} 条视频语料片段",
            artifacts={"metadata": str(output_root / "metadata" / "metadata.jsonl")},
        )

        self._run_post_filters(
            job_id=job_id,
            contribution_id=contribution["id"],
            profile=job["profile"],
            output_root=output_root,
            cfg=cfg,
            dialect=dialect,
        )

    def _run_post_filters(
        self,
        *,
        job_id: str,
        contribution_id: str,
        profile: str,
        output_root: Path,
        cfg: Dict[str, Any],
        dialect: Dict[str, Any],
    ) -> None:
        self._mark_stage(job_id, "mandarin_filter_agent", "running", note="普通话高匹配片段过滤")
        mandarin_cfg = dict(cfg.get("mandarin_filter") or {})
        mandarin_backend = str(mandarin_cfg.get("asr_backend") or "local").strip().lower()
        mandarin_degraded = False
        if mandarin_backend == "local" and not dialect["local_asr_available"](mandarin_cfg):
            mandarin_cfg["asr_enabled"] = False
            mandarin_cfg["segment_check_enabled"] = False
            mandarin_degraded = True
            cfg = dict(cfg)
            cfg["mandarin_filter"] = mandarin_cfg
            self._create_review_task(
                job_id=job_id,
                contribution_id=contribution_id,
                stage_key="mandarin_filter_agent",
                severity="medium",
                reason="mandarin_filter_degraded_no_local_asr",
                block_job=False,
            )
        mandarin_report = dialect["run_mandarin_filter"](
            output_root,
            cfg,
            profile,
            dry_run=False,
            verbose=False,
            log=None,
        )
        mandarin_summary = self._build_mandarin_summary(
            mandarin_report,
            mandarin_cfg,
            degraded=mandarin_degraded,
        )
        kept_after_mandarin = self._count_kept_clips(output_root)
        if kept_after_mandarin <= 0:
            self._mark_stage(job_id, "mandarin_filter_agent", "failed", note="普通话过滤后无剩余片段")
            raise RuntimeError("all_clips_rejected_by_mandarin_filter")
        self._create_edge_match_reviews(
            job_id=job_id,
            contribution_id=contribution_id,
            report=mandarin_report,
        )
        llm_flag = "LLM开" if mandarin_summary.get("llmEnabled") else "LLM关"
        self._mark_stage(
            job_id,
            "mandarin_filter_agent",
            "completed",
            confidence=self._ratio_confidence(mandarin_report),
            note=(
                f"保留 {mandarin_report.get('kept_count', 0)}，剔除 {mandarin_report.get('rejected_count', 0)}"
                f" · {mandarin_summary.get('asrBackend')} · {llm_flag}"
            ),
            artifacts={"mandarinReport": str(output_root / 'metadata' / 'mandarin_filter_report.json')},
            metadata={"mandarinSummary": mandarin_summary},
        )

        self._mark_stage(job_id, "metadata_writer_agent", "running", note="重建保留片段元数据并入库")
        final_rows = self._refresh_metadata_and_segments(
            job_id=job_id,
            contribution_id=contribution_id,
            output_root=output_root,
            profile=profile,
            iter_profile_clips=dialect["iter_profile_clips"],
            metadata_row_cls=dialect["MetadataRow"],
            write_metadata_csv=dialect["write_metadata_csv"],
            write_metadata_jsonl=dialect["write_metadata_jsonl"],
            write_metadata_txt=dialect["write_metadata_txt"],
        )
        if not final_rows:
            self._mark_stage(job_id, "metadata_writer_agent", "failed", note="最终没有可训练片段")
            raise RuntimeError("no_final_segments_ready")
        self._mark_stage(
            job_id,
            "metadata_writer_agent",
            "completed",
            confidence=0.98,
            note=f"已写入 {len(final_rows)} 条训练片段",
            artifacts={"metadata": str(output_root / 'metadata' / 'metadata.jsonl')},
        )
        with self._conn() as conn:
            self._reconcile_job_state(conn, job_id)
            self._sync_contribution_rollup(conn, job_id)

    def _segment_audio_from_srt(
        self,
        *,
        cfg: Dict[str, Any],
        prepared_wav: Path,
        srt_path: Path,
        output_root: Path,
        profile: str,
        source_ref: str,
        ffmpeg: str,
        build_clip_plans: Any,
        plan_clips_from_segments: Any,
        merge_adjacent_by_gap: Any,
        merge_consecutive_fuzzy_similar: Any,
        normalize_text: Any,
        is_punctuation_or_noise_text: Any,
        is_single_char_subtitle_noise: Any,
        parse_srt_file: Any,
        clip_paths_cls: Any,
        video_output_dirs_cls: Any,
        metadata_row_cls: Any,
        write_metadata_csv: Any,
        write_metadata_jsonl: Any,
        write_metadata_txt: Any,
    ) -> List[Any]:
        segments = parse_srt_file(srt_path)
        if not segments:
            raise RuntimeError("segmentation_source_srt_empty")
        duration = self._probe_duration_with_ffprobe(prepared_wav)
        plans = build_clip_plans(
            segments,
            duration,
            cfg,
            plan_clips_from_segments=plan_clips_from_segments,
            merge_adjacent_by_gap=merge_adjacent_by_gap,
            merge_consecutive_fuzzy_similar=merge_consecutive_fuzzy_similar,
            normalize_text=normalize_text,
            is_punctuation_or_noise_text=is_punctuation_or_noise_text,
            is_single_char_subtitle_noise=is_single_char_subtitle_noise,
            logger=self,
        )
        if not plans:
            plans = [type("ClipPlanProxy", (), {"start": 0.0, "end": duration, "text": segments[0].text})()]
        rows: List[Any] = []
        dirs = video_output_dirs_cls.create(output_root, "001", "audio_upload")
        for index, plan in enumerate(plans, start=1):
            paths = clip_paths_cls.for_clip(dirs, profile, index)
            self._extract_audio_slice(ffmpeg, prepared_wav, paths.wav, plan.start, plan.end)
            paths.txt.write_text(plan.text.strip() + "\n", encoding="utf-8")
            rows.append(
                metadata_row_cls(
                    id=paths.clip_id,
                    wav_basename=paths.wav.name,
                    text=plan.text.strip(),
                    start_sec=float(plan.start),
                    end_sec=float(plan.end),
                    source_video=source_ref,
                    profile=profile,
                    video_slot="001",
                    wav_path=str(paths.wav.relative_to(output_root)),
                    txt_path=str(paths.txt.relative_to(output_root)),
                )
            )
        self._write_index_and_metadata(
            output_root=output_root,
            rows=rows,
            source_ref=source_ref,
            write_metadata_csv=write_metadata_csv,
            write_metadata_jsonl=write_metadata_jsonl,
            write_metadata_txt=write_metadata_txt,
        )
        return rows

    def _segment_video_from_srt(
        self,
        *,
        cfg: Dict[str, Any],
        input_path: Path,
        output_root: Path,
        profile: str,
        srt_path: Path,
        ffmpeg: str,
        ffprobe: str,
        build_clip_plans: Any,
        plan_clips_from_segments: Any,
        merge_adjacent_by_gap: Any,
        merge_consecutive_fuzzy_similar: Any,
        normalize_text: Any,
        is_punctuation_or_noise_text: Any,
        is_single_char_subtitle_noise: Any,
        parse_srt_file: Any,
        clip_paths_cls: Any,
        video_output_dirs_cls: Any,
        metadata_row_cls: Any,
        write_metadata_csv: Any,
        write_metadata_jsonl: Any,
        write_metadata_txt: Any,
        extract_wav_segment: Any,
        safe_stem: Any,
    ) -> List[Any]:
        segments = parse_srt_file(srt_path)
        if not segments:
            raise RuntimeError("video_srt_empty")
        duration = self._probe_duration_with_ffprobe(input_path, ffprobe=ffprobe)
        plans = build_clip_plans(
            segments,
            duration,
            cfg,
            plan_clips_from_segments=plan_clips_from_segments,
            merge_adjacent_by_gap=merge_adjacent_by_gap,
            merge_consecutive_fuzzy_similar=merge_consecutive_fuzzy_similar,
            normalize_text=normalize_text,
            is_punctuation_or_noise_text=is_punctuation_or_noise_text,
            is_single_char_subtitle_noise=is_single_char_subtitle_noise,
            logger=self,
        )
        rows: List[Any] = []
        dirs = video_output_dirs_cls.create(output_root, "001", safe_stem(input_path))
        for index, plan in enumerate(plans, start=1):
            paths = clip_paths_cls.for_clip(dirs, profile, index)
            ok = extract_wav_segment(
                ffmpeg,
                input_path,
                paths.wav,
                float(plan.start),
                float(plan.end),
                sample_rate=int(cfg.get("audio", {}).get("sample_rate", 22050)),
                channels=int(cfg.get("audio", {}).get("channels", 1)),
                codec=str(cfg.get("audio", {}).get("codec", "pcm_s16le")),
            )
            if not ok:
                continue
            paths.txt.write_text(plan.text.strip() + "\n", encoding="utf-8")
            rows.append(
                metadata_row_cls(
                    id=paths.clip_id,
                    wav_basename=paths.wav.name,
                    text=plan.text.strip(),
                    start_sec=float(plan.start),
                    end_sec=float(plan.end),
                    source_video=str(input_path),
                    profile=profile,
                    video_slot="001",
                    wav_path=str(paths.wav.relative_to(output_root)),
                    txt_path=str(paths.txt.relative_to(output_root)),
                )
            )
        if not rows:
            raise RuntimeError("video_segmentation_empty")
        self._write_index_and_metadata(
            output_root=output_root,
            rows=rows,
            source_ref=str(input_path),
            write_metadata_csv=write_metadata_csv,
            write_metadata_jsonl=write_metadata_jsonl,
            write_metadata_txt=write_metadata_txt,
        )
        return rows

    def _refresh_metadata_and_segments(
        self,
        *,
        job_id: str,
        contribution_id: str,
        output_root: Path,
        profile: str,
        iter_profile_clips: Any,
        metadata_row_cls: Any,
        write_metadata_csv: Any,
        write_metadata_jsonl: Any,
        write_metadata_txt: Any,
    ) -> List[Any]:
        original_meta = self._load_metadata_rows(output_root / "metadata" / "metadata.jsonl")
        by_rel = {row["wav_path"]: row for row in original_meta}
        rows: List[Any] = []
        for wav_path, txt_path, slot in iter_profile_clips(output_root):
            rel_wav = str(wav_path.relative_to(output_root))
            meta = by_rel.get(rel_wav, {})
            text = txt_path.read_text(encoding="utf-8").strip() if txt_path.is_file() else str(meta.get("text", "")).strip()
            rows.append(
                metadata_row_cls(
                    id=str(meta.get("id") or wav_path.stem),
                    wav_basename=wav_path.name,
                    text=text,
                    start_sec=float(meta.get("start", 0.0) or 0.0),
                    end_sec=float(meta.get("end", 0.0) or 0.0),
                    source_video=str(meta.get("source_video") or ""),
                    profile=profile,
                    video_slot=slot,
                    wav_path=rel_wav,
                    txt_path=str(txt_path.relative_to(output_root)),
                )
            )
        meta_dir = output_root / "metadata"
        meta_dir.mkdir(parents=True, exist_ok=True)
        write_metadata_txt(meta_dir / "metadata.txt", rows)
        write_metadata_csv(meta_dir / "metadata.csv", rows)
        write_metadata_jsonl(meta_dir / "metadata.jsonl", rows)

        with self._conn() as conn:
            conn.execute("DELETE FROM corpus_segments WHERE job_id = ?", (job_id,))
            now = utcnow_iso()
            for row in rows:
                conn.execute(
                    """
                    INSERT INTO corpus_segments (
                      id, contribution_id, job_id, clip_id, video_slot, wav_path, txt_path,
                      text, start_sec, end_sec, quality_score, source_video, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)
                    """,
                    (
                        self._new_id("seg"),
                        contribution_id,
                        job_id,
                        row.id,
                        row.video_slot,
                        row.wav_path,
                        row.txt_path,
                        row.text,
                        row.start_sec,
                        row.end_sec,
                        1.0,
                        row.source_video,
                        now,
                    ),
                )
            conn.commit()
        return rows

    def _reconcile_job_state(self, conn: sqlite3.Connection, job_id: str) -> None:
        stages = conn.execute(
            """
            SELECT stage_key, state
            FROM pipeline_stage_runs
            WHERE job_id = ?
            """,
            (job_id,),
        ).fetchall()
        reviews = conn.execute(
            """
            SELECT status, block_job
            FROM review_tasks
            WHERE job_id = ?
            """,
            (job_id,),
        ).fetchall()
        if any(stage["state"] == "failed" for stage in stages):
            self._set_job_state(conn, job_id, "failed")
            return
        if any(review["status"] == "pending" and review["block_job"] for review in reviews):
            self._set_job_state(conn, job_id, "blocked_for_review")
            return
        if not stages or any(stage["state"] not in {"completed", "skipped"} for stage in stages):
            self._set_job_state(conn, job_id, "running")
            return
        segment_count = conn.execute(
            "SELECT COUNT(*) FROM corpus_segments WHERE job_id = ?",
            (job_id,),
        ).fetchone()[0]
        if segment_count <= 0:
            self._set_job_state(conn, job_id, "failed", error_message="no_ready_segments")
            return
        self._set_job_state(conn, job_id, "ready")

    def _sync_contribution_rollup(self, conn: sqlite3.Connection, job_id: str) -> None:
        job = conn.execute(
            "SELECT * FROM pipeline_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
        if job is None:
            return
        segments = conn.execute(
            """
            SELECT clip_id, text, wav_path
            FROM corpus_segments
            WHERE job_id = ?
            ORDER BY created_at ASC
            """,
            (job_id,),
        ).fetchall()
        first_segment = segments[0] if segments else None
        quality_report_path = Path(job["artifact_root"]) / "metadata" / "quality_report.json"
        quality_score = None
        if quality_report_path.is_file():
            report = json.loads(quality_report_path.read_text(encoding="utf-8"))
            quality_score = self._ratio_confidence(report)
        review_reasons = [
            row["reason"]
            for row in conn.execute(
                """
                SELECT reason
                FROM review_tasks
                WHERE job_id = ? AND status = 'pending'
                ORDER BY created_at ASC
                """,
                (job_id,),
            ).fetchall()
        ]
        audio_url = ""
        if first_segment is not None:
            audio_url = self._storage_url(Path(job["artifact_root"]) / first_segment["wav_path"])
        conn.execute(
            """
            UPDATE contributions
            SET status = ?, pipeline_state = ?, transcript_snippet = ?, quality_score = ?,
                ready_segment_count = ?, audio_url = ?, risk_flags = ?, updated_at = ?
            WHERE job_id = ?
            """,
            (
                job["status"],
                job["status"],
                (first_segment["text"][:140] if first_segment else ""),
                quality_score,
                len(segments),
                audio_url,
                json.dumps(review_reasons, ensure_ascii=False),
                utcnow_iso(),
                job_id,
            ),
        )
        conn.commit()

    def _seed_stage_runs(self, conn: sqlite3.Connection, job_id: str) -> None:
        for stage in STAGES:
            conn.execute(
                """
                INSERT INTO pipeline_stage_runs (
                  job_id, stage_key, state, started_at, ended_at, confidence, note,
                  agent_name, artifacts, metadata
                ) VALUES (?, ?, 'pending', NULL, NULL, NULL, '', ?, '{}', '{}')
                """,
                (job_id, stage["key"], stage["agent_name"]),
            )

    def _mark_stage(
        self,
        job_id: str,
        stage_key: str,
        state: str,
        *,
        confidence: Optional[float] = None,
        note: str = "",
        artifacts: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        now = utcnow_iso()
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT started_at
                FROM pipeline_stage_runs
                WHERE job_id = ? AND stage_key = ?
                """,
                (job_id, stage_key),
            ).fetchone()
            started_at = row["started_at"] if row is not None else None
            if state == "running" and not started_at:
                started_at = now
            ended_at = now if state in {"completed", "failed", "skipped", "blocked"} else None
            conn.execute(
                """
                UPDATE pipeline_stage_runs
                SET state = ?, started_at = COALESCE(?, started_at), ended_at = ?,
                    confidence = ?, note = ?, artifacts = ?, metadata = ?, agent_name = ?
                WHERE job_id = ? AND stage_key = ?
                """,
                (
                    state,
                    started_at,
                    ended_at,
                    confidence,
                    note,
                    json.dumps(artifacts or {}, ensure_ascii=False),
                    json.dumps(metadata or {}, ensure_ascii=False),
                    get_stage_meta(stage_key)["agent_name"],
                    job_id,
                    stage_key,
                ),
            )
            conn.execute(
                """
                UPDATE pipeline_jobs
                SET stage_cursor = ?, updated_at = ?
                WHERE id = ?
                """,
                (stage_key, now, job_id),
            )
            self._reconcile_job_state(conn, job_id)
            self._sync_contribution_rollup(conn, job_id)

    def _set_job_state(
        self,
        conn: sqlite3.Connection,
        job_id: str,
        status: str,
        *,
        error_message: Optional[str] = None,
    ) -> None:
        now = utcnow_iso()
        completed_at = now if status in {"ready", "failed"} else None
        conn.execute(
            """
            UPDATE pipeline_jobs
            SET status = ?, error_message = COALESCE(?, error_message),
                updated_at = ?, completed_at = COALESCE(?, completed_at)
            WHERE id = ?
            """,
            (status, error_message, now, completed_at, job_id),
        )
        conn.commit()

    def _create_review_task(
        self,
        *,
        job_id: str,
        contribution_id: str,
        stage_key: str,
        severity: str,
        reason: str,
        block_job: bool,
    ) -> None:
        with self._conn() as conn:
            existing = conn.execute(
                """
                SELECT id
                FROM review_tasks
                WHERE job_id = ? AND stage_key = ? AND reason = ? AND status = 'pending'
                """,
                (job_id, stage_key, reason),
            ).fetchone()
            if existing is not None:
                return
            now = utcnow_iso()
            conn.execute(
                """
                INSERT INTO review_tasks (
                  id, job_id, contribution_id, stage_key, severity, reason, status,
                  decision, note, block_job, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, '', ?, ?, ?)
                """,
                (
                    self._new_id("review"),
                    job_id,
                    contribution_id,
                    stage_key,
                    severity,
                    reason,
                    1 if block_job else 0,
                    now,
                    now,
                ),
            )
            self._reconcile_job_state(conn, job_id)
            self._sync_contribution_rollup(conn, job_id)

    def _create_edge_match_reviews(
        self,
        *,
        job_id: str,
        contribution_id: str,
        report: Dict[str, Any],
    ) -> None:
        for row in report.get("kept", []):
            score = float(row.get("match_score", 0.0) or 0.0)
            if 0.55 <= score < 0.72:
                self._create_review_task(
                    job_id=job_id,
                    contribution_id=contribution_id,
                    stage_key="mandarin_filter_agent",
                    severity="medium",
                    reason=f"mandarin_match_borderline:{row.get('id')}:{score:.3f}",
                    block_job=False,
                )

    def _store_audio_transcripts(
        self,
        contribution_id: str,
        *,
        user_transcript: str,
        asr_transcript: str,
        transcript_source: str,
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE contributions
                SET content = ?, user_transcript = ?, asr_transcript = ?, transcript_source = ?,
                    transcript_snippet = CASE
                      WHEN COALESCE(NULLIF(?, ''), '') <> '' THEN substr(?, 1, 140)
                      WHEN COALESCE(NULLIF(?, ''), '') <> '' THEN substr(?, 1, 140)
                      ELSE transcript_snippet
                    END,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    user_transcript,
                    user_transcript,
                    asr_transcript,
                    transcript_source,
                    user_transcript,
                    user_transcript,
                    asr_transcript,
                    asr_transcript,
                    utcnow_iso(),
                    contribution_id,
                ),
            )
            conn.commit()

    def _transcribe_with_dashscope(self, audio_path: Path) -> Dict[str, Any]:
        if not DASHSCOPE_ASR_ENABLED:
            return {"text": "", "source": "", "confidence": None, "note": "dashscope_disabled"}
        if not DASHSCOPE_API_KEY:
            return {"text": "", "source": "", "confidence": None, "note": "dashscope_api_key_missing"}

        suffix = audio_path.suffix.lower()
        mime_type = mimetypes.types_map.get(suffix, "audio/wav")
        encoded = base64.b64encode(audio_path.read_bytes()).decode("utf-8")
        data_uri = f"data:{mime_type};base64,{encoded}"
        payload = {
            "model": DASHSCOPE_ASR_MODEL,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_audio",
                                "input_audio": {"data": data_uri},
                            }
                        ],
                    }
                ]
            },
            "parameters": {
                "format": suffix.lstrip(".") or "wav",
                "sample_rate": "16000",
            },
        }
        headers = {
            "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            "Content-Type": "application/json",
            "X-DashScope-SSE": "disable",
        }
        response = requests.post(
            DASHSCOPE_ASR_URL,
            headers=headers,
            json=payload,
            timeout=DASHSCOPE_ASR_TIMEOUT_SEC,
        )
        result = response.json().copy()
        if not response.ok:
            message = result.get("message") or result.get("code") or f"http_{response.status_code}"
            raise RuntimeError(f"dashscope_request_failed:{message}")
        text = self._extract_dashscope_transcript_text(result)
        return {
            "text": text.strip(),
            "source": DASHSCOPE_ASR_MODEL,
            "confidence": 0.93 if text.strip() else 0.0,
            "note": "dashscope_fun_asr",
            "raw": result,
        }

    def _extract_dashscope_transcript_text(self, payload: Dict[str, Any]) -> str:
        output = payload.get("output") or {}
        collected: List[str] = []

        def collect(node: Any) -> None:
            if isinstance(node, str):
                text = node.strip()
                if text:
                    collected.append(text)
                return
            if isinstance(node, list):
                for item in node:
                    collect(item)
                return
            if not isinstance(node, dict):
                return
            if isinstance(node.get("text"), str):
                text = node["text"].strip()
                if text:
                    collected.append(text)
            if isinstance(node.get("transcript"), str):
                text = node["transcript"].strip()
                if text:
                    collected.append(text)
            if isinstance(node.get("transcripts"), list):
                for item in node["transcripts"]:
                    if isinstance(item, dict) and isinstance(item.get("text"), str):
                        text = item["text"].strip()
                        if text:
                            collected.append(text)
                    collect(item)
            for key in ("choices", "message", "content", "result", "results", "sentences"):
                if key in node:
                    collect(node[key])

        collect(output)
        seen = set()
        ordered = []
        for item in collected:
            if item in seen:
                continue
            seen.add(item)
            ordered.append(item)
        return "\n".join(ordered)

    def _proofread_srt(self, cfg: Dict[str, Any], srt_path: Path, proofread_srt_file: Any) -> str:
        llm_cfg = dict(cfg.get("llm_proofread") or {})
        if not llm_cfg.get("enabled"):
            return "llm_disabled"
        env_name = str(llm_cfg.get("api_key_env") or "DASHSCOPE_API_KEY")
        if proofread_srt_file is None:
            return "llm_module_unavailable"
        try:
            from src.api_keys import resolve_dashscope_api_key

            resolve_dashscope_api_key(llm_cfg)
        except Exception:
            return "api_key_missing"
        try:
            proofread_srt_file(
                srt_path,
                llm_cfg,
                logger=None,
                force=bool(llm_cfg.get("force", False)),
            )
            return "llm_applied"
        except Exception:
            return "llm_failed_open"

    def _proofread_note_text(self, state: str) -> str:
        mapping = {
            "llm_applied": "已执行 LLM 校对",
            "llm_disabled": "未启用 LLM，保留规则清洗结果",
            "llm_module_unavailable": "LLM 模块不可用，保留原文本继续",
            "api_key_missing": "缺少 LLM 密钥，使用未校对文本继续",
            "llm_failed_open": "LLM 校对失败，按 fail-open 继续",
        }
        return mapping.get(state, state)

    def _normalize_audio(self, ffmpeg: str, input_path: Path, output_wav: Path) -> None:
        output_wav.parent.mkdir(parents=True, exist_ok=True)
        audio_filters = ",".join(
            [
                "highpass=f=80",
                "lowpass=f=7600",
                "afftdn=nf=-22",
                "silenceremove=start_periods=1:start_silence=0.25:start_threshold=-42dB:stop_periods=-1:stop_silence=0.45:stop_threshold=-42dB",
                "loudnorm=I=-19:LRA=7:TP=-1.5",
            ]
        )
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(input_path),
                "-af",
                audio_filters,
                "-ar",
                "22050",
                "-ac",
                "1",
                str(output_wav),
            ],
            check=True,
            timeout=600,
        )

    def _extract_audio_slice(
        self,
        ffmpeg: str,
        input_audio: Path,
        output_wav: Path,
        start_sec: float,
        end_sec: float,
    ) -> None:
        output_wav.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(input_audio),
                "-ss",
                f"{start_sec:.3f}",
                "-to",
                f"{end_sec:.3f}",
                "-ac",
                "1",
                "-ar",
                "22050",
                str(output_wav),
            ],
            check=True,
            timeout=300,
        )

    def _write_single_segment_srt(
        self,
        *,
        output_root: Path,
        stem: str,
        start_sec: float,
        end_sec: float,
        text: str,
        write_srt_file: Any,
        subtitle_segment: Any,
    ) -> Path:
        work_dir = output_root / "logs" / "work"
        work_dir.mkdir(parents=True, exist_ok=True)
        srt_path = work_dir / f"{stem}.srt"
        write_srt_file(
            srt_path,
            [subtitle_segment(start=float(start_sec), end=float(end_sec), text=text.strip())],
        )
        return srt_path

    def _write_index_and_metadata(
        self,
        *,
        output_root: Path,
        rows: List[Any],
        source_ref: str,
        write_metadata_csv: Any,
        write_metadata_jsonl: Any,
        write_metadata_txt: Any,
    ) -> None:
        video_index_path = output_root / "video_index.json"
        video_index_path.write_text(
            json.dumps({"001": source_ref}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        meta_dir = output_root / "metadata"
        meta_dir.mkdir(parents=True, exist_ok=True)
        write_metadata_txt(meta_dir / "metadata.txt", rows)
        write_metadata_csv(meta_dir / "metadata.csv", rows)
        write_metadata_jsonl(meta_dir / "metadata.jsonl", rows)
        (meta_dir / "quality_report.json").write_text(
            json.dumps({"profile": "", "kept_count": len(rows), "rejected_count": 0, "kept": [], "rejected": []}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (meta_dir / "mandarin_filter_report.json").write_text(
            json.dumps({"profile": "", "kept_count": len(rows), "rejected_count": 0, "kept": [], "rejected": []}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _count_kept_clips(self, output_root: Path) -> int:
        count = 0
        video_root = output_root / "video"
        if not video_root.is_dir():
            return 0
        for slot_dir in video_root.iterdir():
            if slot_dir.is_dir():
                count += len(list(slot_dir.glob("*.wav")))
        return count

    def _probe_duration_with_ffprobe(self, media_path: Path, *, ffprobe: Optional[str] = None) -> float:
        if ffprobe is None:
            ffprobe = shutil.which("ffprobe") or "ffprobe"
        cp = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(media_path),
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=120,
        )
        return float((cp.stdout or "0").strip() or "0")

    def _load_metadata_rows(self, path: Path) -> List[Dict[str, Any]]:
        if not path.is_file():
            return []
        rows: List[Dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
        return rows

    def _artifact_to_url(self, value: Any) -> Any:
        """把产物字典里的本地路径字符串转换为可访问的 /storage/... URL。"""
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped or stripped.startswith(("http://", "https://", "/storage/")):
            return value
        try:
            p = Path(stripped)
            if p.is_absolute():
                rel = p.resolve().relative_to(JOBS_ROOT.resolve())
                return f"{DEFAULT_STORAGE_URL_PREFIX}/{rel.as_posix()}"
        except Exception:
            pass
        return value

    def _stage_response(self, row: Dict[str, Any]) -> Dict[str, Any]:
        stage = get_stage_meta(str(row.get("stage_key") or ""))
        raw_artifacts = json.loads(row.get("artifacts") or "{}")
        artifacts_with_urls = {k: self._artifact_to_url(v) for k, v in raw_artifacts.items()}
        return {
            "key": row["stage_key"],
            "label": stage["label"],
            "state": row["state"],
            "startedAt": row["started_at"],
            "endedAt": row["ended_at"],
            "confidence": row["confidence"],
            "note": row["note"],
            "agentName": row["agent_name"],
            "artifacts": artifacts_with_urls,
            "metadata": json.loads(row.get("metadata") or "{}"),
        }

    def _collapse_public_state(self, stages: Iterable[Dict[str, Any]]) -> str:
        states = [stage["state"] for stage in stages]
        if any(state == "failed" for state in states):
            return "failed"
        if any(state == "blocked" for state in states):
            return "blocked"
        if any(state == "running" for state in states):
            return "running"
        if states and all(state in {"completed", "skipped"} for state in states):
            return "completed"
        return "pending"

    def _insert_media_asset(
        self,
        conn: sqlite3.Connection,
        *,
        contribution_id: str,
        job_id: str,
        role: str,
        path: Path,
        mime_type: str,
        metadata: Dict[str, Any],
    ) -> None:
        conn.execute(
            """
            INSERT INTO media_assets (
              id, contribution_id, job_id, role, path, mime_type, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self._new_id("asset"),
                contribution_id,
                job_id,
                role,
                str(path),
                mime_type,
                json.dumps(metadata, ensure_ascii=False),
                utcnow_iso(),
            ),
        )

    def _insert_media_asset_record(
        self,
        *,
        contribution_id: str,
        job_id: str,
        role: str,
        path: Path,
        mime_type: str,
        metadata: Dict[str, Any],
    ) -> None:
        with self._conn() as conn:
            self._insert_media_asset(
                conn,
                contribution_id=contribution_id,
                job_id=job_id,
                role=role,
                path=path,
                mime_type=mime_type,
                metadata=metadata,
            )

    def _ratio_confidence(self, report: Dict[str, Any]) -> float:
        kept = float(report.get("kept_count", 0) or 0)
        rejected = float(report.get("rejected_count", 0) or 0)
        total = kept + rejected
        if total <= 0:
            return 0.0
        return round(kept / total, 4)

    def _mandarin_strategy_text(self, cfg: Dict[str, Any], *, degraded: bool = False) -> str:
        if degraded:
            return "本地 ASR 未就绪，已降级跳过音频比对（未接大模型）。"
        llm_enabled = bool(cfg.get("llm_enabled"))
        match_only = bool(cfg.get("match_only_mode", True))
        backend = str(cfg.get("asr_backend") or "local")
        if llm_enabled and not match_only:
            return f"大模型文本分类 + {backend} ASR 与字幕比对（混合模式）。"
        if llm_enabled:
            return f"大模型辅助 + {backend} ASR 字幕相似度比对。"
        return (
            f"未启用大模型；使用 {backend} 普通话 ASR 转写，与字幕 OCR 逐句/整段比对。"
            "相似度 ≥ 阈值视为普通话口播并剔除。"
        )

    def _build_mandarin_summary(
        self,
        report: Dict[str, Any],
        cfg: Dict[str, Any],
        *,
        degraded: bool = False,
    ) -> Dict[str, Any]:
        def _clip_row(row: Dict[str, Any], verdict: str) -> Dict[str, Any]:
            llm_sub = row.get("llm_subtitle") if isinstance(row.get("llm_subtitle"), dict) else {}
            llm_asr = row.get("llm_asr") if isinstance(row.get("llm_asr"), dict) else {}
            segments = row.get("segments") if isinstance(row.get("segments"), list) else []
            return {
                "id": row.get("id"),
                "slot": row.get("slot"),
                "verdict": verdict,
                "ocrText": str(row.get("ocr_text") or ""),
                "asrText": str(row.get("asr_text") or ""),
                "matchScore": row.get("match_score"),
                "reasons": row.get("reasons") or [],
                "llmSubtitle": {
                    "isMandarin": bool(llm_sub.get("is_mandarin")),
                    "confidence": llm_sub.get("confidence"),
                    "reason": str(llm_sub.get("reason") or ""),
                },
                "llmAsr": {
                    "isMandarin": bool(llm_asr.get("is_mandarin")),
                    "confidence": llm_asr.get("confidence"),
                    "reason": str(llm_asr.get("reason") or ""),
                },
                "segmentHighMatchRatio": row.get("segment_high_match_ratio"),
                "segments": [
                    {
                        "ocr": seg.get("ocr"),
                        "asr": seg.get("asr"),
                        "match": seg.get("match"),
                        "start": seg.get("start"),
                        "end": seg.get("end"),
                    }
                    for seg in segments[:8]
                ],
            }

        clips: List[Dict[str, Any]] = []
        for row in report.get("rejected") or []:
            if isinstance(row, dict):
                clips.append(_clip_row(row, "rejected"))
        for row in report.get("kept") or []:
            if isinstance(row, dict):
                clips.append(_clip_row(row, "kept"))

        return {
            "strategy": self._mandarin_strategy_text(cfg, degraded=degraded),
            "llmEnabled": bool(cfg.get("llm_enabled")),
            "asrBackend": str(cfg.get("asr_backend") or "local"),
            "matchOnlyMode": bool(cfg.get("match_only_mode", True)),
            "highMatchReject": cfg.get("high_match_reject"),
            "segmentHighMatch": cfg.get("segment_high_match"),
            "keptCount": int(report.get("kept_count") or 0),
            "rejectedCount": int(report.get("rejected_count") or 0),
            "skipped": bool(report.get("skipped")),
            "degraded": degraded,
            "clips": clips,
        }

    def _load_mandarin_report_file(self, report_path: Path) -> Dict[str, Any]:
        if not report_path.is_file():
            return {}
        try:
            payload = json.loads(report_path.read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _enrich_mandarin_stage(
        self,
        stage: Dict[str, Any],
        *,
        artifact_root: str = "",
    ) -> Dict[str, Any]:
        if stage.get("key") != "mandarin_filter_agent":
            return stage
        metadata = dict(stage.get("metadata") or {})
        if metadata.get("mandarinSummary"):
            stage["metadata"] = metadata
            return stage

        report_path = (stage.get("artifacts") or {}).get("mandarinReport")
        if not report_path and artifact_root:
            report_path = str(Path(artifact_root) / "metadata" / "mandarin_filter_report.json")
        if not report_path:
            return stage

        report = self._load_mandarin_report_file(Path(str(report_path)))
        if not report:
            return stage

        cfg = self._load_dialect_config(str(report.get("profile") or DEFAULT_PROFILE)).get("mandarin_filter") or {}
        degraded = False
        metadata["mandarinSummary"] = self._build_mandarin_summary(report, cfg, degraded=degraded)
        stage["metadata"] = metadata
        return stage

    def _storage_url(self, path: Path) -> str:
        try:
            rel = path.resolve().relative_to(JOBS_ROOT.resolve())
        except ValueError:
            try:
                rel = path.resolve().relative_to(UPLOADS_ROOT.resolve())
            except ValueError:
                job_match = None
                try:
                    parts = path.parts
                    job_index = parts.index("jobs")
                    job_match = Path(*parts[job_index + 1 :])
                except ValueError:
                    job_match = None
                if not job_match:
                    return ""
                rel = job_match
        return f"{DEFAULT_STORAGE_URL_PREFIX}/{rel.as_posix()}"

    def _ui_status(self, raw_status: Optional[str]) -> str:
        status = str(raw_status or "").strip().lower()
        if status == "ready":
            return "ready"
        if status == "failed":
            return "failed"
        if status == "blocked_for_review":
            return "review"
        if status in {"running"}:
            return "processing"
        return "new"

    def _matches_layer(self, status: str, layer: str) -> bool:
        if layer == "ready":
            return status == "ready"
        if layer == "new":
            return status == "new"
        return status in {"processing", "review", "failed"}

    def _display_status(
        self,
        raw_status: Optional[str],
        *,
        ready_segment_count: Optional[int] = None,
        audio_url: Optional[str] = None,
        volunteer_summary: Optional[Dict[str, Any]] = None,
    ) -> str:
        status = str(raw_status or "").strip().lower()
        if status == "failed":
            return "failed"
        base_status = self._ui_status(raw_status)
        has_output = bool((ready_segment_count or 0) > 0) or bool(str(audio_url or "").strip())
        summary = volunteer_summary or {}
        if has_output:
            if summary.get("isPassed"):
                return "ready"
            return "review"
        if base_status == "new":
            return "new"
        return base_status if base_status in {"review", "failed"} else "processing"

    def _display_review_reason(
        self,
        item: Dict[str, Any],
        volunteer_summary: Optional[Dict[str, Any]],
        display_status: str,
    ) -> str:
        summary = volunteer_summary or {}
        if display_status == "failed":
            return self._error_or_risk(item)
        if display_status == "review":
            if summary.get("isRejected"):
                return "多数志愿者判定方言不准确，样本未通过。"
            if summary.get("status") == "risk_flagged":
                return "志愿者多数票认为内容存在风险，等待进一步处理。"
            if str(summary.get("status") or "").startswith("awaiting_reviewer_"):
                return summary.get("label") or "等待志愿者复核通过。"
            if summary.get("status") in {"pending", "not_started"}:
                return summary.get("label") or "等待志愿者复核通过。"
        return self._error_or_risk(item)

    def _error_or_risk(self, item: Dict[str, Any]) -> str:
        error = str(item.get("error_message") or "").strip()
        if error:
            return self._humanize_review_reason(error)
        try:
            flags = json.loads(item.get("risk_flags") or "[]")
        except Exception:
            flags = []
        return self._humanize_review_reason(flags[0]) if flags else ""

    def _humanize_review_reason(self, reason: str) -> str:
        text = str(reason or "").strip()
        if not text:
            return ""
        if text == "mandarin_filter_degraded_no_local_asr":
            return "普通话过滤环节当前没有接入本地普通话 ASR 校验，只能降级运行，结果可信度会比完整模式低。"
        if text == "all_clips_rejected_by_mandarin_filter":
            return "普通话过滤后没有保留下来的有效片段。"
        if text == "no_ready_segments":
            return "当前还没有生成可训练片段。"
        if text.startswith("mandarin_match_borderline:"):
            parts = text.split(":")
            clip_id = parts[1] if len(parts) > 1 else "未知片段"
            score = parts[2] if len(parts) > 2 else ""
            suffix = f"（匹配值 {score}）" if score else ""
            return f"片段 {clip_id} 的普通话匹配结果处于边缘区间，建议志愿者重点复核{suffix}。"
        if text.startswith("dashscope_request_failed:"):
            return f"方言 ASR 服务请求失败：{text.split(':', 1)[1]}"
        return text

    def _timestamp_minus_hours(self, hours: int) -> str:
        from datetime import datetime, timedelta, timezone

        return (
            datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=hours)
        ).isoformat()

    def _load_job_context(self, job_id: str) -> Tuple[sqlite3.Row, sqlite3.Row]:
        with self._conn() as conn:
            job = conn.execute(
                "SELECT * FROM pipeline_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            if job is None:
                raise KeyError(job_id)
            contribution = conn.execute(
                "SELECT * FROM contributions WHERE id = ?",
                (job["contribution_id"],),
            ).fetchone()
            if contribution is None:
                raise KeyError(job["contribution_id"])
        return job, contribution

    def _get_stage_meta_for_job(self, job_id: str) -> Dict[str, str]:
        with self._conn() as conn:
            job = conn.execute(
                """
                SELECT stage_cursor, error_message
                FROM pipeline_jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
        if job is None:
            return {"key": "", "label": "待处理", "errorMessage": ""}
        key = str(job["stage_cursor"] or "")
        return {
            "key": key,
            "label": get_stage_meta(key).get("label", "待处理"),
            "errorMessage": str(job["error_message"] or ""),
        }

    def _load_dialect_config(self, profile: str) -> Dict[str, Any]:
        path = DIALECT_DATA_ROOT / "config.yaml"
        try:
            import yaml

            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except Exception:
            data = self._default_dialect_config()
        if not isinstance(data, dict):
            data = self._default_dialect_config()
        profile_name = profile or data.get("active_profile") or DEFAULT_PROFILE
        overlay = ((data.get("profiles") or {}) if isinstance(data.get("profiles"), dict) else {}).get(profile_name)
        if isinstance(overlay, dict):
            self._deep_merge_dict(data, dict(overlay))
        data["active_profile"] = profile_name
        return data

    def _default_dialect_config(self) -> Dict[str, Any]:
        return {
            "active_profile": DEFAULT_PROFILE,
            "pre_roll": 0.12,
            "post_roll": 0.08,
            "clip_end_trim_sec": 0.0,
            "min_duration_sec": 0.35,
            "max_duration_sec": 0.0,
            "collapse_whitespace": True,
            "strip_newlines": True,
            "drop_punctuation_only": True,
            "drop_single_char_subtitles": True,
            "single_char_allowlist": [],
            "audio": {
                "sample_rate": 22050,
                "channels": 1,
                "codec": "pcm_s16le",
            },
            "subtitle_fuzzy_merge": {
                "enabled": False,
            },
            "short_clip_merge": {
                "enabled": True,
                "min_duration_sec": 0.35,
                "max_merge_span_sec": 10.0,
                "max_neighbors_each_side": 1,
            },
            "clip_boundary": {
                "merge_on_gap_sec": 0.4,
                "tight_gap_sec": 0.3,
                "tight_tail_ratio": 0.2,
                "max_tail_sec": 0.03,
                "split_at_midgap": False,
                "split_pad_sec": 0.02,
            },
            "llm_proofread": {
                "enabled": True,
                "model": "deepseek-v4-flash",
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "api_key_env": "DASHSCOPE_API_KEY",
            },
            "quality_filter": {
                "enabled": True,
                "default": {
                    "mode": "dialect_news",
                    "min_rms": 0.003,
                    "max_rms": 0.45,
                    "min_speech_ratio": 0.08,
                    "max_speech_ratio": 0.35,
                    "max_low_band_ratio": 0.96,
                    "min_crest_db": 2.0,
                },
            },
            "mandarin_filter": {
                "enabled": True,
                "asr_backend": "dashscope",
                "asr_enabled": True,
                "segment_check_enabled": True,
                "llm_enabled": True,
                "match_only_mode": False,
                "model": "deepseek-v4-flash",
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "api_key_env": "DASHSCOPE_API_KEY",
                "high_match_reject": 0.90,
                "low_match_keep": 0.55,
                "segment_high_match": 0.90,
                "min_match_score": 0.82,
                "min_mandarin_confidence": 0.86,
            },
            "ocr": {
                "enabled": True,
            },
            "profiles": {},
        }

    def _deep_merge_dict(self, base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
        for key, value in overlay.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge_dict(base[key], value)
            else:
                base[key] = value
        return base

    def _build_clip_plans(
        self,
        segments: List[Any],
        duration: float,
        cfg: Dict[str, Any],
        *,
        plan_clips_from_segments: Any,
        merge_adjacent_by_gap: Any,
        merge_consecutive_fuzzy_similar: Any,
        normalize_text: Any,
        is_punctuation_or_noise_text: Any,
        is_single_char_subtitle_noise: Any,
        logger: Any,
    ) -> List[Any]:
        drop_punct_only = bool(cfg.get("drop_punctuation_only", True))
        collapse_ws = bool(cfg.get("collapse_whitespace", True))
        strip_nl = bool(cfg.get("strip_newlines", True))
        drop_single_char = bool(cfg.get("drop_single_char_subtitles", True))
        single_char_allowlist = list(cfg.get("single_char_allowlist") or [])

        normalized_segments: List[Any] = []
        for seg in segments:
            text = normalize_text(
                seg.text,
                collapse_whitespace=collapse_ws,
                strip_newlines=strip_nl,
            )
            if not text:
                continue
            if drop_punct_only and is_punctuation_or_noise_text(text):
                continue
            if drop_single_char and is_single_char_subtitle_noise(text, allowlist=single_char_allowlist):
                continue
            normalized_segments.append(type(seg)(start=seg.start, end=seg.end, text=text))

        if not normalized_segments:
            return []

        fuzzy_cfg = dict(cfg.get("subtitle_fuzzy_merge") or {})
        llm_cfg = dict(cfg.get("llm_proofread") or {})
        if fuzzy_cfg.get("enabled"):
            normalized_segments = merge_consecutive_fuzzy_similar(
                normalized_segments,
                float(fuzzy_cfg.get("max_gap_sec", 0.42)),
                float(fuzzy_cfg.get("similarity_threshold", 0.82)),
                llm_cfg=llm_cfg if llm_cfg.get("enabled") else None,
                logger=logger,
            )

        merge_gap = float(cfg.get("merge_adjacent_gap_sec", 0.0))
        merge_span = float(cfg.get("merge_max_span_sec", 14.0))
        if merge_gap > 0:
            normalized_segments = merge_adjacent_by_gap(normalized_segments, merge_gap, merge_span)

        short_cfg = dict(cfg.get("short_clip_merge") or {})
        max_neighbors = int(short_cfg.get("max_neighbors_each_side", 0 if not short_cfg.get("enabled") else 2))
        max_merge_span = float(short_cfg.get("max_merge_span_sec", merge_span))
        min_clip_sec = float(short_cfg.get("min_duration_sec", cfg.get("min_duration_sec", 0.35)))
        max_clip_sec = float(cfg.get("max_duration_sec", 0.0))

        return plan_clips_from_segments(
            normalized_segments,
            duration,
            pre_roll=float(cfg.get("pre_roll", 0.08)),
            post_roll=float(cfg.get("post_roll", 0.08)),
            clip_end_trim=float(cfg.get("clip_end_trim_sec", 0.0)),
            min_clip_sec=min_clip_sec,
            max_merge_span_sec=max_merge_span,
            max_neighbors_each_side=max_neighbors,
            max_clip_sec=max_clip_sec,
            boundary_cfg=dict(cfg.get("clip_boundary") or {}),
            llm_cfg=llm_cfg if llm_cfg.get("enabled") else None,
            logger=logger,
        )

    def _dialect_modules(self) -> Dict[str, Any]:
        with self._lock:
            dialect_root = str(DIALECT_DATA_ROOT)
            if dialect_root not in sys.path:
                sys.path.insert(0, dialect_root)
            from src.audio_export import extract_wav_segment  # type: ignore
            from src.layout import ClipPaths, VideoOutputDirs, iter_profile_clips  # type: ignore
            from src.local_asr import local_asr_available, transcribe_local  # type: ignore
            from src.metadata_writer import (  # type: ignore
                MetadataRow,
                write_metadata_csv,
                write_metadata_jsonl,
                write_metadata_txt,
            )
            from src.pipeline_filters import run_mandarin_filter  # type: ignore
            from src.srt_parser import (  # type: ignore
                SubtitleSegment,
                merge_adjacent_by_gap,
                merge_consecutive_fuzzy_similar,
                parse_srt_file,
                plan_clips_from_segments,
                write_srt_file,
            )
            from src.subtitle_extract import extract_subtitle_srt  # type: ignore
            from src.subtitle_probe import pick_text_subtitle_stream_index  # type: ignore
            from src.utils import (  # type: ignore
                ensure_ffmpeg_available,
                get_video_duration_sec,
                is_punctuation_or_noise_text,
                is_single_char_subtitle_noise,
                normalize_text,
                safe_stem,
            )

            try:
                from src.llm_proofread import proofread_srt_file  # type: ignore
            except Exception:  # pragma: no cover - optional dependency path
                proofread_srt_file = None
            try:
                from src.ocr_subtitle import try_generate_srt_via_ocr  # type: ignore
            except Exception:  # pragma: no cover - optional dependency path
                def try_generate_srt_via_ocr(*args: Any, **kwargs: Any) -> bool:
                    return False

            return {
                "ClipPaths": ClipPaths,
                "MetadataRow": MetadataRow,
                "SubtitleSegment": SubtitleSegment,
                "VideoOutputDirs": VideoOutputDirs,
                "build_clip_plans": self._build_clip_plans,
                "ensure_ffmpeg_available": ensure_ffmpeg_available,
                "extract_subtitle_srt": extract_subtitle_srt,
                "extract_wav_segment": extract_wav_segment,
                "get_video_duration_sec": get_video_duration_sec,
                "iter_profile_clips": iter_profile_clips,
                "is_punctuation_or_noise_text": is_punctuation_or_noise_text,
                "is_single_char_subtitle_noise": is_single_char_subtitle_noise,
                "local_asr_available": local_asr_available,
                "merge_adjacent_by_gap": merge_adjacent_by_gap,
                "merge_consecutive_fuzzy_similar": merge_consecutive_fuzzy_similar,
                "normalize_text": normalize_text,
                "parse_srt_file": parse_srt_file,
                "pick_text_subtitle_stream_index": pick_text_subtitle_stream_index,
                "plan_clips_from_segments": plan_clips_from_segments,
                "proofread_srt_file": proofread_srt_file,
                "run_mandarin_filter": run_mandarin_filter,
                "safe_stem": safe_stem,
                "transcribe_local": transcribe_local,
                "try_generate_srt_via_ocr": try_generate_srt_via_ocr,
                "write_metadata_csv": write_metadata_csv,
                "write_metadata_jsonl": write_metadata_jsonl,
                "write_metadata_txt": write_metadata_txt,
                "write_srt_file": write_srt_file,
            }

    def _conn(self) -> sqlite3.Connection:
        return get_connection()

    def _new_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:16]}"

    def _build_area_scope(self, province: str = "", city: str = "", district: str = "") -> str:
        return "/".join([part.strip() for part in (province, city, district) if str(part or "").strip()])

    def debug(self, *args: Any, **kwargs: Any) -> None:
        return None

    info = debug
    warning = debug
    error = debug


service = PipelineService()
