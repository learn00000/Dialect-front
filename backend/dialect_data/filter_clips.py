#!/usr/bin/env python3
"""听感质检（兼容入口，逻辑在 src.pipeline_filters）。"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from main import load_config, resolve_regions
from src.pipeline_filters import run_quality_filter


def main() -> int:
    p = argparse.ArgumentParser(description="听感质检：剔 BGM / 偏普通话专题")
    p.add_argument("--config", type=Path, default=Path("config.yaml"))
    p.add_argument("--output", type=Path, default=None)
    p.add_argument("--profile", type=str, default="all")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    log = logging.getLogger("filter_clips")

    base = yaml_load(args.config)
    jobs = resolve_regions(
        base, profile_arg=args.profile, output_override=args.output
    )
    for job in jobs:
        cfg = load_config(args.config, profile=job.profile)
        run_quality_filter(
            job.output_root, cfg, job.profile, dry_run=args.dry_run, log=log
        )
    return 0


def yaml_load(path: Path):
    import yaml

    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


if __name__ == "__main__":
    sys.exit(main())
