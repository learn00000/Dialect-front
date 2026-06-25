#!/usr/bin/env python3
"""普通话 ASR 过滤（兼容入口，逻辑在 src.pipeline_filters）。"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import yaml

from main import load_config, resolve_regions
from src.pipeline_filters import run_mandarin_filter


def main() -> int:
    p = argparse.ArgumentParser(description="本地 ASR + 字幕比对，剔普通话片段")
    p.add_argument("--config", type=Path, default=Path("config.yaml"))
    p.add_argument("--output", type=Path, default=None)
    p.add_argument("--profile", type=str, default="all")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )
    log = logging.getLogger("filter_mandarin")

    base = yaml.safe_load(args.config.read_text(encoding="utf-8")) or {}
    jobs = resolve_regions(
        base, profile_arg=args.profile, output_override=args.output
    )
    for job in jobs:
        cfg = load_config(args.config, profile=job.profile)
        run_mandarin_filter(
            job.output_root,
            cfg,
            job.profile,
            dry_run=args.dry_run,
            limit=args.limit,
            verbose=args.verbose,
            log=log,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
