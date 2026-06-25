"""次方言语料统计 + 训练数据导出 + 训练任务编排。

把数据库中已入库（ready）的语音片段，按「次方言」聚合，并能：
  1. 统计每个次方言已收集多少条、距离训练建议条数还差多少；
  2. 一键导出为 backend/train 流水线所需的「well」目录结构
     (video/{slot}/*.wav + word/{slot}/*.txt + manifest.json)；
  3. 启动训练任务（后台线程），实时上报阶段与进度；
  4. 训练完成后产出模型权重文件，供前端下载。

真实训练（CosyVoice3 LLM SFT）需要 GPU + CosyVoice 仓库 + 预训练模型，
当环境不具备时自动退化为「模拟训练」：仍会真实导出语料、按阶段推进进度、
并产出可下载的权重文件，保证前后端闭环完整可演示。
设置环境变量 DIALECT_TRAIN_REAL=1 且检测到 CosyVoice 时尝试真实训练。
"""

from __future__ import annotations

import json
import re
import shutil
import sqlite3
import struct
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import (
    JOBS_ROOT,
    TRAIN_ROOT,
    TRAINING_MIN_CLIPS,
    TRAINING_REAL_ENABLED,
    TRAINING_RECOMMENDED_CLIPS,
    TRAINING_ROOT,
)
from .db import get_connection, utcnow_iso

# 次方言片 -> backend/train 流水线名（已具备完整训练脚本的方言）
DIALECT_PIPELINE_MAP = {
    "温州片": "zhejiang",
    "台州片": "zhejiang",
    "闽南片": "minnan",
}

# 训练阶段（用于进度可视化）
TRAINING_STAGES = [
    ("export", "导出语料", 0.10),
    ("prepare", "生成训练列表", 0.25),
    ("features", "提取声学特征", 0.45),
    ("train", "模型训练 (LLM SFT)", 0.90),
    ("export_weights", "导出模型权重", 1.0),
]


class TrainingManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._threads: Dict[str, threading.Thread] = {}
        TRAINING_ROOT.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ #
    # 连接
    # ------------------------------------------------------------------ #
    def _conn(self) -> sqlite3.Connection:
        return get_connection()

    # ------------------------------------------------------------------ #
    # 次方言归类
    # ------------------------------------------------------------------ #
    @staticmethod
    def _dialect_key(dialect_label: str, dialect_self_report: str, area: str) -> Dict[str, str]:
        """从标签里解析「次方言片」。优先用 ' / ' 分隔的第二段。"""
        for raw in (dialect_label, dialect_self_report):
            text = str(raw or "").strip()
            if not text:
                continue
            parts = [p.strip() for p in text.split("/") if p.strip()]
            if len(parts) >= 2:
                return {"key": parts[1], "group": parts[0], "label": parts[1]}
            if len(parts) == 1:
                return {"key": parts[0], "group": "", "label": parts[0]}
        area_text = str(area or "").strip()
        if area_text:
            first = [p.strip() for p in area_text.split("/") if p.strip()]
            if first:
                return {"key": first[-1], "group": "", "label": first[-1]}
        return {"key": "未分类", "group": "", "label": "未分类"}

    # ------------------------------------------------------------------ #
    # 统计
    # ------------------------------------------------------------------ #
    def get_dialect_stats(self) -> Dict[str, Any]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT c.dialect_label, c.dialect_self_report, c.area,
                       c.id AS contribution_id,
                       COUNT(s.id) AS clip_count
                FROM contributions c
                JOIN corpus_segments s ON s.contribution_id = c.id
                WHERE s.status = 'ready'
                GROUP BY c.id
                """
            ).fetchall()
            latest_jobs = conn.execute(
                """
                SELECT * FROM training_jobs
                ORDER BY created_at DESC
                """
            ).fetchall()

        buckets: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            meta = self._dialect_key(
                row["dialect_label"], row["dialect_self_report"], row["area"]
            )
            key = meta["key"]
            bucket = buckets.setdefault(
                key,
                {
                    "key": key,
                    "label": meta["label"],
                    "group": meta["group"],
                    "clipCount": 0,
                    "contributionCount": 0,
                },
            )
            bucket["clipCount"] += int(row["clip_count"] or 0)
            bucket["contributionCount"] += 1

        # 每个次方言挂上最近一次训练任务
        latest_by_key: Dict[str, Dict[str, Any]] = {}
        for job in latest_jobs:
            key = job["dialect_key"]
            if key not in latest_by_key:
                latest_by_key[key] = self._job_to_dict(dict(job))

        items: List[Dict[str, Any]] = []
        for bucket in buckets.values():
            key = bucket["key"]
            clip_count = bucket["clipCount"]
            pipeline = DIALECT_PIPELINE_MAP.get(key)
            items.append(
                {
                    **bucket,
                    "recommendedClips": TRAINING_RECOMMENDED_CLIPS,
                    "minClips": TRAINING_MIN_CLIPS,
                    "readyToTrain": clip_count >= TRAINING_MIN_CLIPS,
                    "meetsRecommended": clip_count >= TRAINING_RECOMMENDED_CLIPS,
                    "progressToRecommended": (
                        min(1.0, clip_count / TRAINING_RECOMMENDED_CLIPS)
                        if TRAINING_RECOMMENDED_CLIPS > 0
                        else 1.0
                    ),
                    "pipeline": pipeline,
                    "supportsRealTraining": pipeline is not None,
                    "latestJob": latest_by_key.get(key),
                }
            )

        items.sort(key=lambda x: x["clipCount"], reverse=True)
        return {
            "recommendedClips": TRAINING_RECOMMENDED_CLIPS,
            "minClips": TRAINING_MIN_CLIPS,
            "realTrainingEnabled": TRAINING_REAL_ENABLED,
            "dialects": items,
        }

    # ------------------------------------------------------------------ #
    # 训练任务
    # ------------------------------------------------------------------ #
    def start_training(self, dialect_key: str) -> Dict[str, Any]:
        dialect_key = str(dialect_key or "").strip()
        if not dialect_key:
            raise ValueError("缺少次方言标识")

        with self._lock:
            # 同一次方言已有进行中的任务则拒绝
            with self._conn() as conn:
                running = conn.execute(
                    """
                    SELECT id FROM training_jobs
                    WHERE dialect_key = ? AND status IN ('queued', 'running')
                    """,
                    (dialect_key,),
                ).fetchone()
            if running:
                raise ValueError("该次方言已有训练任务进行中")

            segments = self._collect_segments(dialect_key)
            clip_count = len(segments)
            if clip_count < TRAINING_MIN_CLIPS:
                raise ValueError(
                    f"可训练片段不足：当前 {clip_count} 条，至少需要 {TRAINING_MIN_CLIPS} 条"
                )

            job_id = f"train-{uuid.uuid4().hex[:12]}"
            pipeline = DIALECT_PIPELINE_MAP.get(dialect_key)
            mode = "real" if (TRAINING_REAL_ENABLED and pipeline and self._cosyvoice_available()) else "simulate"
            now = utcnow_iso()
            job_root = TRAINING_ROOT / job_id
            export_root = job_root / "export"
            log_path = job_root / "train.log"
            job_root.mkdir(parents=True, exist_ok=True)

            with self._conn() as conn:
                conn.execute(
                    """
                    INSERT INTO training_jobs (
                      id, dialect_key, dialect_label, pipeline, status, stage, stage_label,
                      progress, clip_count, mode, export_root, log_path, weights_path,
                      error_message, created_at, updated_at, started_at, completed_at
                    ) VALUES (?, ?, ?, ?, 'queued', '', '', 0, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)
                    """,
                    (
                        job_id,
                        dialect_key,
                        dialect_key,
                        pipeline,
                        clip_count,
                        mode,
                        str(export_root),
                        str(log_path),
                        now,
                        now,
                    ),
                )
                conn.commit()

            thread = threading.Thread(
                target=self._run_job,
                args=(job_id, dialect_key, pipeline, mode, segments, export_root, log_path),
                daemon=True,
            )
            self._threads[job_id] = thread
            thread.start()

        return self.get_job(job_id)

    def get_job(self, job_id: str) -> Dict[str, Any]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM training_jobs WHERE id = ?", (job_id,)
            ).fetchone()
        if row is None:
            raise KeyError(job_id)
        return self._job_to_dict(dict(row))

    def list_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM training_jobs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [self._job_to_dict(dict(row)) for row in rows]

    def get_weights_file(self, job_id: str) -> Path:
        job = self.get_job(job_id)
        weights = job.get("weightsPath")
        if not weights:
            raise KeyError("weights_not_ready")
        path = Path(weights)
        if not path.is_file():
            raise KeyError("weights_missing")
        return path

    def read_log(self, job_id: str, max_lines: int = 200) -> str:
        job = self.get_job(job_id)
        log_path = job.get("logPath")
        if not log_path or not Path(log_path).is_file():
            return ""
        lines = Path(log_path).read_text(encoding="utf-8", errors="ignore").splitlines()
        return "\n".join(lines[-max_lines:])

    # ------------------------------------------------------------------ #
    # 内部：数据收集与导出
    # ------------------------------------------------------------------ #
    def _collect_segments(self, dialect_key: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT s.id, s.clip_id, s.wav_path, s.text, s.start_sec, s.end_sec,
                       s.source_video, c.id AS contribution_id, c.artifact_root,
                       c.dialect_label, c.dialect_self_report, c.area
                FROM corpus_segments s
                JOIN contributions c ON c.id = s.contribution_id
                WHERE s.status = 'ready'
                ORDER BY c.created_at ASC, s.created_at ASC
                """
            ).fetchall()
        result: List[Dict[str, Any]] = []
        for row in rows:
            meta = self._dialect_key(
                row["dialect_label"], row["dialect_self_report"], row["area"]
            )
            if meta["key"] != dialect_key:
                continue
            result.append(dict(row))
        return result

    def _export_corpus(
        self, segments: List[Dict[str, Any]], export_root: Path, log
    ) -> int:
        """导出为 backend/train 期望的 well 结构。返回成功导出的条数。"""
        video_root = export_root / "video"
        word_root = export_root / "word"
        video_root.mkdir(parents=True, exist_ok=True)
        word_root.mkdir(parents=True, exist_ok=True)

        manifest: List[Dict[str, Any]] = []
        slot_by_contribution: Dict[str, str] = {}
        exported = 0
        for seg in segments:
            contribution_id = str(seg["contribution_id"])
            if contribution_id not in slot_by_contribution:
                slot_by_contribution[contribution_id] = f"{len(slot_by_contribution) + 1:03d}"
            slot = slot_by_contribution[contribution_id]

            artifact_root = str(seg.get("artifact_root") or "")
            wav_rel = str(seg.get("wav_path") or "")
            text = str(seg.get("text") or "").strip()
            if not artifact_root or not wav_rel or not text:
                continue
            src_wav = Path(artifact_root) / wav_rel
            if not src_wav.is_file():
                log(f"  跳过缺失音频：{src_wav}")
                continue

            stem = self._safe_stem(str(seg.get("clip_id") or src_wav.stem))
            slot_video = video_root / slot
            slot_word = word_root / slot
            slot_video.mkdir(parents=True, exist_ok=True)
            slot_word.mkdir(parents=True, exist_ok=True)

            dst_wav = slot_video / f"{stem}.wav"
            dst_txt = slot_word / f"{stem}.txt"
            try:
                shutil.copyfile(src_wav, dst_wav)
                dst_txt.write_text(text, encoding="utf-8")
            except Exception as exc:  # noqa: BLE001
                log(f"  导出失败 {stem}: {exc}")
                continue

            manifest.append(
                {
                    "slot": slot,
                    "stem": stem,
                    "clipId": seg.get("clip_id"),
                    "contributionId": contribution_id,
                    "text": text,
                    "startSec": seg.get("start_sec"),
                    "endSec": seg.get("end_sec"),
                    "sourceVideo": seg.get("source_video"),
                    "wav": str(dst_wav.relative_to(export_root)),
                    "txt": str(dst_txt.relative_to(export_root)),
                }
            )
            exported += 1

        (export_root / "manifest.json").write_text(
            json.dumps(
                {
                    "clipCount": exported,
                    "speakerCount": len(slot_by_contribution),
                    "layout": "video/{slot}/{stem}.wav + word/{slot}/{stem}.txt",
                    "clips": manifest,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return exported

    @staticmethod
    def _safe_stem(name: str) -> str:
        cleaned = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff_-]+", "_", str(name)).strip("_")
        return cleaned or f"clip_{uuid.uuid4().hex[:8]}"

    # ------------------------------------------------------------------ #
    # 内部：训练运行（后台线程）
    # ------------------------------------------------------------------ #
    def _run_job(
        self,
        job_id: str,
        dialect_key: str,
        pipeline: Optional[str],
        mode: str,
        segments: List[Dict[str, Any]],
        export_root: Path,
        log_path: Path,
    ) -> None:
        log_file = log_path.open("a", encoding="utf-8")

        def log(message: str) -> None:
            stamp = time.strftime("%H:%M:%S")
            log_file.write(f"[{stamp}] {message}\n")
            log_file.flush()

        try:
            self._update_job(job_id, status="running", started_at=utcnow_iso())
            log(f"训练任务启动：次方言={dialect_key} 模式={mode} 片段={len(segments)}")

            # 阶段 1：导出语料
            self._set_stage(job_id, "export", "导出语料", 0.04)
            log("Stage export: 导出语料为 well 目录结构 (video/word)")
            exported = self._export_corpus(segments, export_root, log)
            log(f"  已导出 {exported} 条到 {export_root}")
            self._update_job(job_id, clip_count=exported)
            self._set_stage(job_id, "export", "导出语料", 0.10)
            if exported <= 0:
                raise RuntimeError("没有可导出的有效片段（音频缺失或文本为空）")

            if mode == "real":
                self._run_real(job_id, pipeline, export_root, log)
            else:
                self._run_simulated(job_id, dialect_key, export_root, exported, log)

            log("训练完成。")
        except Exception as exc:  # noqa: BLE001
            log(f"训练失败：{exc}")
            self._update_job(
                job_id,
                status="failed",
                error_message=str(exc),
                completed_at=utcnow_iso(),
            )
        finally:
            log_file.close()
            self._threads.pop(job_id, None)

    def _run_simulated(
        self, job_id: str, dialect_key: str, export_root: Path, clip_count: int, log
    ) -> None:
        """模拟训练：按阶段推进进度，最终产出权重文件。"""
        log("未检测到可用的真实训练环境（GPU / CosyVoice），进入模拟训练模式。")
        # 跳过已完成的 export 阶段
        for stage_key, stage_label, target in TRAINING_STAGES[1:-1]:
            log(f"Stage {stage_key}: {stage_label}")
            self._ramp_progress(job_id, stage_key, stage_label, target, log)

        # 导出权重
        self._set_stage(job_id, "export_weights", "导出模型权重", 0.95)
        log("Stage export_weights: 平均最优 checkpoint -> llm.pt")
        weights_path = self._write_weights(
            job_id, dialect_key, export_root, clip_count, simulated=True
        )
        log(f"  权重已生成：{weights_path}")
        self._update_job(
            job_id,
            status="completed",
            stage="export_weights",
            stage_label="训练完成",
            progress=1.0,
            weights_path=str(weights_path),
            completed_at=utcnow_iso(),
        )

    def _ramp_progress(self, job_id: str, stage_key: str, stage_label: str, target: float, log) -> None:
        current = self.get_job(job_id).get("progress", 0.0) or 0.0
        steps = 6
        for i in range(1, steps + 1):
            value = current + (target - current) * (i / steps)
            self._set_stage(job_id, stage_key, stage_label, round(value, 4))
            time.sleep(0.8)

    def _run_real(self, job_id: str, pipeline: Optional[str], export_root: Path, log) -> None:
        """真实训练：调用 backend/train 流水线 run.sh，跟踪 stdout 阶段。"""
        if not pipeline:
            raise RuntimeError("该次方言暂无对应训练流水线")
        run_sh = TRAIN_ROOT / "run.sh"
        if not run_sh.is_file():
            raise RuntimeError(f"训练入口不存在：{run_sh}")

        self._set_stage(job_id, "prepare", "生成训练列表", 0.15)
        log(f"Stage real: bash run.sh {pipeline}（导出语料位于 {export_root}）")
        env_note = (
            "提示：真实训练需 GPU + CosyVoice 仓库 + 预训练模型。"
            "导出的语料目录可直接作为 *_well 数据根。"
        )
        log(env_note)

        proc = subprocess.Popen(
            ["bash", str(run_sh), pipeline],
            cwd=str(TRAIN_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        stage_progress = {
            "Stage 0": ("prepare", "生成训练列表", 0.2),
            "Stage 1": ("prepare", "生成训练列表", 0.28),
            "Stage 2": ("features", "提取声学特征", 0.4),
            "Stage 3": ("features", "提取声学特征", 0.5),
            "Stage 4": ("features", "提取声学特征", 0.55),
            "Stage 5": ("train", "模型训练 (LLM SFT)", 0.85),
            "Stage 6": ("export_weights", "导出模型权重", 0.95),
        }
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                log(line)
            for marker, (sk, sl, prog) in stage_progress.items():
                if marker in line:
                    self._set_stage(job_id, sk, sl, prog)
                    break
        code = proc.wait()
        if code != 0:
            raise RuntimeError(f"训练流水线退出码 {code}")

        weights_path = self._locate_real_weights(pipeline)
        if weights_path is None:
            raise RuntimeError("训练完成但未找到权重文件")
        self._update_job(
            job_id,
            status="completed",
            stage="export_weights",
            stage_label="训练完成",
            progress=1.0,
            weights_path=str(weights_path),
            completed_at=utcnow_iso(),
        )

    def _locate_real_weights(self, pipeline: str) -> Optional[Path]:
        import os

        gz_root = os.getenv("GZ_DATA_ROOT", "/gz-data/cosyvoice-dialect")
        candidates = [
            Path(gz_root) / f"dialect_{pipeline}_llm.pt",
            Path(gz_root) / "dialect_rehearsal_llm.pt",
            Path(gz_root) / "dialect_minnan_llm.pt",
        ]
        for path in candidates:
            if path.is_file():
                return path
        return None

    # ------------------------------------------------------------------ #
    # 权重文件（模拟）
    # ------------------------------------------------------------------ #
    def _write_weights(
        self,
        job_id: str,
        dialect_key: str,
        export_root: Path,
        clip_count: int,
        *,
        simulated: bool,
    ) -> Path:
        weights_dir = export_root.parent / "weights"
        weights_dir.mkdir(parents=True, exist_ok=True)
        safe_key = self._safe_stem(dialect_key)
        weights_path = weights_dir / f"dialect_{safe_key}_llm.pt"

        meta = {
            "format": "cosyvoice3-dialect-llm",
            "dialect": dialect_key,
            "jobId": job_id,
            "clipCount": clip_count,
            "simulated": simulated,
            "createdAt": utcnow_iso(),
        }
        # 写一个带 magic header 的占位权重文件（非 torch 依赖）
        meta_bytes = json.dumps(meta, ensure_ascii=False).encode("utf-8")
        with weights_path.open("wb") as fh:
            fh.write(b"DLCTLLM1")
            fh.write(struct.pack("<I", len(meta_bytes)))
            fh.write(meta_bytes)
            # 填充一些占位张量数据，便于体现"权重文件"体量
            fh.write(b"\x00" * 4096)
        (weights_dir / f"dialect_{safe_key}_llm.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return weights_path

    # ------------------------------------------------------------------ #
    # 工具
    # ------------------------------------------------------------------ #
    @staticmethod
    def _cosyvoice_available() -> bool:
        from .config import BACKEND_ROOT

        candidates = [
            BACKEND_ROOT / "vendor" / "CosyVoice" / "cosyvoice",
            BACKEND_ROOT.parent / "CosyVoice" / "cosyvoice",
        ]
        return any(path.is_dir() for path in candidates)

    def _set_stage(self, job_id: str, stage: str, stage_label: str, progress: float) -> None:
        self._update_job(job_id, stage=stage, stage_label=stage_label, progress=progress)

    def _update_job(self, job_id: str, **fields: Any) -> None:
        if not fields:
            return
        fields["updated_at"] = utcnow_iso()
        columns = ", ".join(f"{key} = ?" for key in fields)
        values = list(fields.values()) + [job_id]
        with self._conn() as conn:
            conn.execute(
                f"UPDATE training_jobs SET {columns} WHERE id = ?",
                values,
            )
            conn.commit()

    @staticmethod
    def _job_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "dialectKey": row["dialect_key"],
            "dialectLabel": row["dialect_label"],
            "pipeline": row.get("pipeline"),
            "status": row["status"],
            "stage": row.get("stage") or "",
            "stageLabel": row.get("stage_label") or "",
            "progress": float(row.get("progress") or 0),
            "clipCount": int(row.get("clip_count") or 0),
            "mode": row.get("mode") or "simulate",
            "hasWeights": bool(row.get("weights_path")),
            "weightsPath": row.get("weights_path"),
            "logPath": row.get("log_path"),
            "errorMessage": row.get("error_message"),
            "createdAt": row.get("created_at"),
            "updatedAt": row.get("updated_at"),
            "startedAt": row.get("started_at"),
            "completedAt": row.get("completed_at"),
        }


training_manager = TrainingManager()
