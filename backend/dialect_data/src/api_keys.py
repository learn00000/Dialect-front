"""百炼 API Key 内置默认值（本地开发用，环境变量优先）。"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

DEFAULT_DASHSCOPE_API_KEY = "sk-37422e3b618544c7a2282440c02e2ff1"


def resolve_dashscope_api_key(cfg: Optional[Dict[str, Any]] = None) -> str:
    env_name = str((cfg or {}).get("api_key_env") or "DASHSCOPE_API_KEY")
    key = os.environ.get(env_name, "").strip()
    if key:
        return key
    if env_name == "DASHSCOPE_API_KEY" and DEFAULT_DASHSCOPE_API_KEY:
        os.environ.setdefault("DASHSCOPE_API_KEY", DEFAULT_DASHSCOPE_API_KEY)
        return DEFAULT_DASHSCOPE_API_KEY
    raise RuntimeError(f"未设置环境变量 {env_name}")
