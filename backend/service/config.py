"""Filesystem configuration for the Python sidecar."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
DIALECT_DATA_ROOT = BACKEND_ROOT / "dialect_data"

SERVICE_ROOT = BACKEND_ROOT / "service"
DATA_ROOT = SERVICE_ROOT / "data"
UPLOADS_ROOT = SERVICE_ROOT / "uploads"
JOBS_ROOT = SERVICE_ROOT / "jobs"
DB_PATH = DATA_ROOT / "live_dialect.db"

load_dotenv(REPO_ROOT / ".env.local", override=False)
load_dotenv(REPO_ROOT / ".env", override=False)
load_dotenv(BACKEND_ROOT / ".env", override=False)

# 模型训练相关
TRAIN_ROOT = BACKEND_ROOT / "train"
TRAINING_ROOT = SERVICE_ROOT / "training"  # 导出语料 + 训练产物 + 日志
# 单个次方言达到此片段数即「建议可开练」
TRAINING_RECOMMENDED_CLIPS = int(os.getenv("DIALECT_TRAINING_RECOMMENDED_CLIPS", "200"))
# 至少需要多少条才允许启动训练（演示可设 DIALECT_TRAINING_MIN_CLIPS=1）
TRAINING_MIN_CLIPS = int(os.getenv("DIALECT_TRAINING_MIN_CLIPS", "1"))
# 是否尝试真实调用 backend/train 流水线（需 GPU + CosyVoice 环境）
TRAINING_REAL_ENABLED = os.getenv("DIALECT_TRAIN_REAL", "0").strip().lower() in {"1", "true", "yes", "on"}

# 内置默认 Key；若 .env / 环境变量已配置则优先使用环境变量
_BUILTIN_DASHSCOPE_API_KEY = "sk-37422e3b618544c7a2282440c02e2ff1"
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", _BUILTIN_DASHSCOPE_API_KEY).strip() or _BUILTIN_DASHSCOPE_API_KEY
if DASHSCOPE_API_KEY:
    os.environ.setdefault("DASHSCOPE_API_KEY", DASHSCOPE_API_KEY)

DEFAULT_PROFILE = os.getenv("DIALECT_DEFAULT_PROFILE", "taizhou")
DEFAULT_REVIEW_POLICY = os.getenv("DIALECT_REVIEW_POLICY", "exception_optional")
DEFAULT_STORAGE_URL_PREFIX = os.getenv("DIALECT_STORAGE_URL_PREFIX", "/storage")
MAX_WORKERS = int(os.getenv("DIALECT_PIPELINE_WORKERS", "2"))

DASHSCOPE_ASR_ENABLED = os.getenv("DIALECT_DASHSCOPE_ASR_ENABLED", "true").strip().lower() not in {"0", "false", "off", "no"}
DASHSCOPE_ASR_MODEL = os.getenv("DIALECT_DASHSCOPE_ASR_MODEL", "fun-asr-flash-2026-06-15").strip()
DASHSCOPE_ASR_URL = os.getenv(
    "DIALECT_DASHSCOPE_ASR_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
).strip()
DASHSCOPE_ASR_TIMEOUT_SEC = int(os.getenv("DIALECT_DASHSCOPE_ASR_TIMEOUT_SEC", "180"))
