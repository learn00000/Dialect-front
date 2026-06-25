"""SQLite bootstrap helpers for the sidecar service."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from .config import DB_PATH


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    ensure_parent(DB_PATH)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS contributions (
              id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL UNIQUE,
              source_type TEXT NOT NULL,
              area TEXT,
              dialect_self_report TEXT,
              content_type TEXT,
              content TEXT,
              user_transcript TEXT NOT NULL DEFAULT '',
              asr_transcript TEXT NOT NULL DEFAULT '',
              transcript_source TEXT NOT NULL DEFAULT '',
              nickname TEXT,
              consent_granted INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL,
              pipeline_state TEXT NOT NULL,
              dialect_label TEXT,
              transcript_snippet TEXT,
              quality_score REAL,
              ready_segment_count INTEGER NOT NULL DEFAULT 0,
              audio_url TEXT,
              artifact_root TEXT,
              risk_flags TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pipeline_jobs (
              id TEXT PRIMARY KEY,
              contribution_id TEXT NOT NULL,
              source_type TEXT NOT NULL,
              status TEXT NOT NULL,
              profile TEXT,
              input_path TEXT,
              artifact_root TEXT,
              review_mode TEXT,
              stage_cursor TEXT,
              error_message TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              completed_at TEXT,
              FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS pipeline_stage_runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              job_id TEXT NOT NULL,
              stage_key TEXT NOT NULL,
              state TEXT NOT NULL,
              started_at TEXT,
              ended_at TEXT,
              confidence REAL,
              note TEXT,
              agent_name TEXT,
              artifacts TEXT NOT NULL DEFAULT '{}',
              metadata TEXT NOT NULL DEFAULT '{}',
              UNIQUE(job_id, stage_key),
              FOREIGN KEY (job_id) REFERENCES pipeline_jobs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS media_assets (
              id TEXT PRIMARY KEY,
              contribution_id TEXT NOT NULL,
              job_id TEXT NOT NULL,
              role TEXT NOT NULL,
              path TEXT NOT NULL,
              mime_type TEXT,
              metadata TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE,
              FOREIGN KEY (job_id) REFERENCES pipeline_jobs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS corpus_segments (
              id TEXT PRIMARY KEY,
              contribution_id TEXT NOT NULL,
              job_id TEXT NOT NULL,
              clip_id TEXT NOT NULL,
              video_slot TEXT,
              wav_path TEXT NOT NULL,
              txt_path TEXT,
              text TEXT NOT NULL,
              start_sec REAL,
              end_sec REAL,
              quality_score REAL,
              source_video TEXT,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE,
              FOREIGN KEY (job_id) REFERENCES pipeline_jobs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS review_tasks (
              id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL,
              contribution_id TEXT NOT NULL,
              stage_key TEXT NOT NULL,
              severity TEXT NOT NULL,
              reason TEXT NOT NULL,
              status TEXT NOT NULL,
              decision TEXT,
              note TEXT,
              block_job INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (job_id) REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
              FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS volunteer_applications (
              id TEXT PRIMARY KEY,
              reviewer_name TEXT NOT NULL,
              province TEXT,
              city TEXT,
              district TEXT,
              area_scope TEXT NOT NULL,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS volunteer_reviews (
              id TEXT PRIMARY KEY,
              contribution_id TEXT NOT NULL,
              reviewer_name TEXT NOT NULL,
              province TEXT,
              city TEXT,
              district TEXT,
              area_scope TEXT NOT NULL,
              dialect_accuracy INTEGER NOT NULL,
              dialect_note TEXT NOT NULL DEFAULT '',
              transcript_choice TEXT NOT NULL DEFAULT 'user',
              transcript_user TEXT NOT NULL DEFAULT '',
              transcript_asr TEXT NOT NULL DEFAULT '',
              transcript_final TEXT NOT NULL DEFAULT '',
              transcript_changed INTEGER NOT NULL DEFAULT 0,
              risk_flag INTEGER NOT NULL DEFAULT 0,
              risk_note TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (contribution_id) REFERENCES contributions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS training_jobs (
              id TEXT PRIMARY KEY,
              dialect_key TEXT NOT NULL,
              dialect_label TEXT NOT NULL,
              pipeline TEXT,
              status TEXT NOT NULL,
              stage TEXT NOT NULL DEFAULT '',
              stage_label TEXT NOT NULL DEFAULT '',
              progress REAL NOT NULL DEFAULT 0,
              clip_count INTEGER NOT NULL DEFAULT 0,
              mode TEXT NOT NULL DEFAULT 'simulate',
              export_root TEXT,
              log_path TEXT,
              weights_path TEXT,
              error_message TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              started_at TEXT,
              completed_at TEXT
            );
            """
        )
        _ensure_column(conn, "contributions", "user_transcript", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "contributions", "asr_transcript", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "contributions", "transcript_source", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "volunteer_reviews", "transcript_choice", "TEXT NOT NULL DEFAULT 'user'")
        conn.commit()
    finally:
        conn.close()


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    if any(row["name"] == column for row in rows):
        return
    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
