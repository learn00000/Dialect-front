#!/usr/bin/env python3
"""Pick the newest loadable epoch_*_whole.pt, skip truncated/corrupt files."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from cosyvoice.utils.common import load_checkpoint


def is_loadable(path: Path) -> bool:
    try:
        load_checkpoint(path, map_location="cpu")
        return True
    except Exception as exc:
        print(f"[skip corrupt] {path} ({exc})", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--search_dirs", nargs="+", required=True)
    parser.add_argument("--fallback", required=True, help="pretrained llm.pt if no valid ckpt")
    parser.add_argument(
        "--max_epoch",
        type=int,
        default=None,
        help="if set, return fallback when newest ckpt epoch >= max_epoch - 1",
    )
    args = parser.parse_args()

    candidates: list[Path] = []
    for d in args.search_dirs:
        root = Path(d)
        if root.is_dir():
            candidates.extend(sorted(root.glob("epoch_*_whole.pt"), reverse=True))

    seen = set()
    for path in candidates:
        if path in seen:
            continue
        seen.add(path)
        if not is_loadable(path):
            continue
        if args.max_epoch is not None:
            ckpt = load_checkpoint(path, map_location="cpu")
            epoch = ckpt.get("epoch", -1)
            if epoch >= args.max_epoch - 1:
                print(
                    f"[skip finished] {path} (epoch {epoch}, max_epoch {args.max_epoch})",
                    file=sys.stderr,
                )
                print(Path(args.fallback).resolve())
                return
        print(path.resolve())
        return

    print(Path(args.fallback).resolve())


if __name__ == "__main__":
    main()
