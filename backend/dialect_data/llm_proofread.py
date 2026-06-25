#!/usr/bin/env python3
"""仅对已有 SRT 做 LLM 批量校对，不重跑 OCR/切片。"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any, Dict

import yaml

from src.llm_proofread import proofread_srt_file


def load_config(path: Path) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def main() -> int:
    p = argparse.ArgumentParser(description="LLM 批量校对 SRT 字幕（阿里百炼）")
    p.add_argument(
        "--config",
        type=Path,
        default=Path("config.yaml"),
        help="YAML 配置（读取 llm_proofread 段）",
    )
    p.add_argument(
        "--srt",
        type=Path,
        required=True,
        help="待校对的 .srt 路径",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="忽略 .srt.proofread 标记，强制重新校对",
    )
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    logger = logging.getLogger("llm_proofread")

    cfg = load_config(args.config)
    llm_cfg = dict(cfg.get("llm_proofread") or {})
    if not llm_cfg.get("enabled") and not args.force:
        logger.warning("config 中 llm_proofread.enabled=false，仍按命令行执行校对")
    llm_cfg["enabled"] = True
    if args.force:
        llm_cfg["force"] = True

    try:
        ok = proofread_srt_file(args.srt, llm_cfg, logger=logger, force=args.force)
    except Exception as e:
        logger.error("校对失败: %s", e)
        return 1
    if not ok:
        logger.error("未产生校对结果")
        return 1
    print(f"完成: {args.srt.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
